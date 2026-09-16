//! Blocking Git work runs off the async server executor. Dropped HTTP clients do
//! not cancel an operation between snapshotting and checkout/apply.
use crate::{
    commands::branch_switch as switch,
    error::{GitApiError, GitApiResult},
    extractors::{lookup_repo_path, validate_path},
};
use axum::{
    extract::{Path, Query},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;

#[derive(Deserialize)]
struct Scope {
    path: Option<String>,
    cursor: Option<String>,
    branch: Option<String>,
}

pub fn routes() -> Router {
    Router::new()
        .route(
            "/api/git/repo/{repo_id}/branch-switch/prepare",
            post(prepare),
        )
        .route(
            "/api/git/repo/{repo_id}/branch-switch/execute",
            post(execute),
        )
        .route("/api/git/repo/{repo_id}/branch-switch/saved", get(saved))
        .route(
            "/api/git/repo/{repo_id}/branch-switch/available",
            get(available),
        )
        .route(
            "/api/git/repo/{repo_id}/branch-switch/saved/{id}",
            get(preview),
        )
        .route(
            "/api/git/repo/{repo_id}/branch-switch/restore",
            post(restore),
        )
}

async fn run<T: serde::Serialize + Send + 'static>(
    repo_id: String,
    scope: Scope,
    f: impl FnOnce(std::path::PathBuf) -> Result<T, String> + Send + 'static,
) -> GitApiResult<Json<serde_json::Value>> {
    let path = match scope.path {
        Some(path) => validate_path(&path)?,
        None => lookup_repo_path(&repo_id)?,
    };
    let data = tokio::task::spawn_blocking(move || f(path))
        .await
        .map_err(|e| GitApiError::Internal {
            message: e.to_string(),
        })?
        .map_err(GitApiError::from_git_error)?;
    Ok(Json(serde_json::json!({ "status": 0, "data": data })))
}
async fn prepare(
    Path(id): Path<String>,
    Query(scope): Query<Scope>,
    Json(target): Json<switch::SwitchTarget>,
) -> GitApiResult<Json<serde_json::Value>> {
    run(id, scope, move |p| switch::prepare(&p, &target)).await
}
async fn execute(
    Path(id): Path<String>,
    Query(scope): Query<Scope>,
    Json(req): Json<switch::ExecuteRequest>,
) -> GitApiResult<Json<serde_json::Value>> {
    run(id, scope, move |p| switch::execute(&p, req)).await
}
async fn saved(
    Path(id): Path<String>,
    Query(scope): Query<Scope>,
) -> GitApiResult<Json<serde_json::Value>> {
    let cursor = scope.cursor.clone();
    run(id, scope, move |p| {
        switch::list_saved(&p, cursor.as_deref())
    })
    .await
}
async fn preview(
    Path((repo, id)): Path<(String, String)>,
    Query(scope): Query<Scope>,
) -> GitApiResult<Json<serde_json::Value>> {
    run(repo, scope, move |p| switch::preview(&p, &id)).await
}
async fn restore(
    Path(id): Path<String>,
    Query(scope): Query<Scope>,
    Json(req): Json<switch::RestoreRequest>,
) -> GitApiResult<Json<serde_json::Value>> {
    run(id, scope, move |p| switch::restore(&p, &req.id)).await
}

async fn available(
    Path(id): Path<String>,
    Query(scope): Query<Scope>,
) -> GitApiResult<Json<serde_json::Value>> {
    let branch = scope.branch.clone().unwrap_or_default();
    run(id, scope, move |p| switch::has_saved(&p, &branch)).await
}
