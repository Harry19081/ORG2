//! Read-only own-buyer scheduling hint. The gateway remains authoritative.
use crate::Connection;
use serde::Deserialize;
use std::sync::Arc;

#[derive(Deserialize)]
struct Protection {
    limits: Limits,
}
#[derive(Deserialize)]
struct Limits {
    concurrency: u32,
}
fn decode(bytes: &[u8]) -> Result<usize, &'static str> {
    let value: Protection =
        serde_json::from_slice(bytes).map_err(|_| "market_invalid_buyer_protection")?;
    if !(1..=32).contains(&value.limits.concurrency) {
        return Err("market_invalid_buyer_protection");
    }
    Ok(value.limits.concurrency as usize)
}
impl Connection {
    pub async fn buyer_concurrency(self: &Arc<Self>) -> Result<usize, &'static str> {
        decode(
            &self
                .market_request("/v1/console/buyer-protection", None)
                .await?,
        )
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn concurrency_is_bounded_and_unknown_is_not_a_permissive_default() {
        for value in [1, 2, 20, 32] {
            assert_eq!(
                decode(
                    format!(r#"{{"limits":{{"concurrency":{value}}},"status":"active"}}"#)
                        .as_bytes()
                ),
                Ok(value)
            );
        }
        for value in ["0", "33", "-1", "2.5", "null", r#""2""#] {
            assert!(
                decode(format!(r#"{{"limits":{{"concurrency":{value}}}}}"#).as_bytes()).is_err()
            );
        }
        assert!(decode(b"{}").is_err());
    }
}
