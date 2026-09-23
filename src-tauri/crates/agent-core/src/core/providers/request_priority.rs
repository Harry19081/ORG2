//! Per-call intent, never mutable provider/session state. Auxiliary wrappers
//! scope the actual call, so spawned tasks and shared providers cannot leak it.
use std::future::Future;

tokio::task_local! { static AUXILIARY: (); }

pub fn is_auxiliary() -> bool {
    AUXILIARY.try_with(|_| ()).is_ok()
}

pub(crate) async fn auxiliary<T>(call: impl Future<Output = T>) -> T {
    AUXILIARY.scope((), call).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn auxiliary_intent_is_per_call_and_does_not_leak_to_main_or_spawned_tasks() {
        let background = auxiliary(async {
            assert!(is_auxiliary());
            tokio::task::yield_now().await;
            assert!(is_auxiliary());
            assert!(!tokio::spawn(async { is_auxiliary() }).await.unwrap());
        });
        let main = async {
            assert!(!is_auxiliary());
            tokio::task::yield_now().await;
            assert!(!is_auxiliary());
        };
        tokio::join!(background, main);
        assert!(!is_auxiliary());
    }
}
