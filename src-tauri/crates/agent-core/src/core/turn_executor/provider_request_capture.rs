#![cfg(debug_assertions)]

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use serde_json::Value;

const MAX_CAPTURED_REQUESTS: usize = 32;

static ARMED: AtomicBool = AtomicBool::new(false);
static CAPTURES: OnceLock<Mutex<VecDeque<ProviderRequestCapture>>> = OnceLock::new();

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderRequestCapture {
    pub session_id: String,
    pub iteration: u32,
    pub model: String,
    pub max_tokens: u32,
    pub temperature: f32,
    pub message_count: usize,
    pub tool_count: usize,
    pub tool_names: Vec<String>,
    pub messages: Vec<Value>,
    pub tools: Vec<Value>,
}

fn captures() -> &'static Mutex<VecDeque<ProviderRequestCapture>> {
    CAPTURES.get_or_init(|| Mutex::new(VecDeque::new()))
}

pub fn arm(clear_existing: bool) {
    if clear_existing {
        clear();
    }
    ARMED.store(true, Ordering::SeqCst);
}

pub fn disarm() {
    ARMED.store(false, Ordering::SeqCst);
}

pub fn is_armed() -> bool {
    ARMED.load(Ordering::SeqCst)
}

pub fn clear() {
    if let Ok(mut captures) = captures().lock() {
        captures.clear();
    }
}

pub fn drain(clear_after_read: bool) -> Vec<ProviderRequestCapture> {
    match captures().lock() {
        Ok(mut captures) => {
            let snapshot = captures.iter().cloned().collect();
            if clear_after_read {
                captures.clear();
            }
            snapshot
        }
        Err(_) => Vec::new(),
    }
}

pub fn capture(
    session_id: &str,
    iteration: u32,
    model: &str,
    max_tokens: u32,
    temperature: f32,
    messages: &[Value],
    tools: &[Value],
) {
    if !is_armed() {
        return;
    }

    let tool_names = tools
        .iter()
        .filter_map(|tool| {
            tool.get("function")
                .and_then(|function| function.get("name"))
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .collect::<Vec<_>>();

    let capture = ProviderRequestCapture {
        session_id: session_id.to_string(),
        iteration,
        model: model.to_string(),
        max_tokens,
        temperature,
        message_count: messages.len(),
        tool_count: tools.len(),
        tool_names,
        messages: messages.to_vec(),
        tools: tools.to_vec(),
    };

    if let Ok(mut captures) = captures().lock() {
        captures.push_back(capture);
        while captures.len() > MAX_CAPTURED_REQUESTS {
            captures.pop_front();
        }
    }
}
