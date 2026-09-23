use serde_json::{json, Value};
use tauri::command;

use super::super::shared::make_client;
use super::merge::{apply_pull_request_merge_context, get_pull_request_merge_automation_context};
use super::pagination::get_paginated_array;

#[command]
pub async fn github_list_pr_base_branches(repo_full_name: String) -> Result<Vec<String>, String> {
    let client = make_client()?;
    let mut names = Vec::new();
    // The picker is opened on demand. Bound the scan for repositories with
    // thousands of branches; the UI also accepts an exact typed branch name.
    for page in 1..=10 {
        let data = client
            .get_conditional(&format!(
                "/repos/{repo_full_name}/branches?per_page=100&page={page}"
            ))
            .await?;
        let branches = data
            .as_array()
            .ok_or_else(|| "GitHub returned a non-array branch list".to_string())?;
        names.extend(
            branches
                .iter()
                .filter_map(|branch| branch["name"].as_str().map(String::from)),
        );
        if branches.len() < 100 {
            break;
        }
    }
    Ok(names)
}

#[command]
pub async fn github_update_pr(
    repo_full_name: String,
    pr_number: u64,
    title: Option<String>,
    base: Option<String>,
) -> Result<Value, String> {
    if title.is_none() && base.is_none() {
        return Err("No pull request changes supplied".to_string());
    }
    if title.as_ref().is_some_and(|value| value.trim().is_empty()) {
        return Err("Pull request title cannot be empty".to_string());
    }
    if base.as_ref().is_some_and(|value| value.trim().is_empty()) {
        return Err("Pull request base branch cannot be empty".to_string());
    }
    let mut payload = json!({});
    if let Some(title) = title {
        payload["title"] = json!(title);
    }
    if let Some(base) = base {
        payload["base"] = json!(base);
    }
    let client = make_client()?;
    client
        .patch(
            &format!("/repos/{repo_full_name}/pulls/{pr_number}"),
            payload,
        )
        .await
}

#[cfg(test)]
mod update_tests {
    use super::github_update_pr;

    #[tokio::test]
    async fn rejects_empty_pr_updates_before_sending_a_request() {
        assert!(github_update_pr("org/repo".into(), 1, None, None)
            .await
            .unwrap_err()
            .contains("No pull request changes"));
        assert!(
            github_update_pr("org/repo".into(), 1, Some("  ".into()), None)
                .await
                .unwrap_err()
                .contains("title cannot be empty")
        );
        assert!(
            github_update_pr("org/repo".into(), 1, None, Some("".into()))
                .await
                .unwrap_err()
                .contains("base branch cannot be empty")
        );
    }
}

#[command]
pub async fn github_get_pr(repo_full_name: String, pr_number: u64) -> Result<Value, String> {
    log::info!("[GitHub][Cmd] get_pr repo={repo_full_name} pr={pr_number}");
    let client = make_client()?;
    let mut detail = client
        .get_conditional(&format!("/repos/{repo_full_name}/pulls/{pr_number}"))
        .await?;

    let pull_request_id = detail["node_id"].as_str().map(String::from);
    let base_sha = detail["base"]["sha"].as_str().map(String::from);
    let head_sha = detail["head"]["sha"].as_str().map(String::from);
    let merge_context = async {
        match pull_request_id.as_deref() {
            Some(id) => Some(get_pull_request_merge_automation_context(&client, id).await),
            None => None,
        }
    };
    let compare = async {
        match (base_sha, head_sha) {
            (Some(base_sha), Some(head_sha)) => Some(
                client
                    .get_conditional(&format!(
                        "/repos/{repo_full_name}/compare/{base_sha}...{head_sha}"
                    ))
                    .await,
            ),
            _ => None,
        }
    };
    let (merge_context, compare) = tokio::join!(merge_context, compare);

    if let Some(result) = merge_context {
        match result {
            Ok(context) => apply_pull_request_merge_context(&mut detail, context),
            Err(error) => {
                log::warn!("[GitHub][Cmd] get_pr merge metadata failed: {error}");
            }
        }
    }
    if let Some(result) = compare {
        match result {
            Ok(compare) => {
                if let Some(merge_base_sha) = compare["merge_base_commit"]["sha"].as_str() {
                    detail["merge_base_sha"] = json!(merge_base_sha);
                }
            }
            Err(err) if err.contains("GitHubReAuthRequired") => return Err(err),
            Err(err) => {
                log::warn!("[GitHub][Cmd] get_pr compare failed: {err}");
            }
        }
    }

    Ok(detail)
}

#[command]
pub async fn github_list_pr_commits(
    repo_full_name: String,
    pr_number: u64,
) -> Result<Value, String> {
    log::info!("[GitHub][Cmd] list_pr_commits repo={repo_full_name} pr={pr_number}");
    let client = make_client()?;
    Ok(Value::Array(
        get_paginated_array(
            &client,
            &format!("/repos/{repo_full_name}/pulls/{pr_number}/commits"),
        )
        .await?,
    ))
}

#[command]
pub async fn github_list_pr_files(repo_full_name: String, pr_number: u64) -> Result<Value, String> {
    log::info!("[GitHub][Cmd] list_pr_files repo={repo_full_name} pr={pr_number}");
    let client = make_client()?;
    Ok(Value::Array(
        get_paginated_array(
            &client,
            &format!("/repos/{repo_full_name}/pulls/{pr_number}/files"),
        )
        .await?,
    ))
}
