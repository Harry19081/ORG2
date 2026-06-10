//! Data-category tool entries (remote nodes).

use super::aliases::*;
use super::macros::action_sub;

pub(super) static TOOLS: &[ToolEntry] = &[ToolEntry {
    name: tool_names::MANAGE_NODES,
    description: "Control remote devices (mobile, IoT) connected via WebSocket.",
    description_detail: "Sends commands to remote devices registered through the nodes bridge, such as phones, IoT endpoints, or simulators, over WebSocket.",
    category: tool_categories::DATA,
    icon_id: "network",
    simulator_app: AppCode,
    app_subtool: OtherTool,
    chat_block: CbFallback,
    label_running: "tools.manageNodesRunning",
    label_done: "tools.manageNodesDone",
    label_failed: "tools.manageNodesFailed",
    actions: &[
        action_sub!("status", "Get connection status of all nodes", OtherTool, labels: "tools.manageNodesStatusRunning", "tools.manageNodesStatusDone", "tools.manageNodesStatusFailed"),
        action_sub!("describe", "Get device capabilities and metadata", OtherTool, labels: "tools.manageNodesDescribeRunning", "tools.manageNodesDescribeDone", "tools.manageNodesDescribeFailed"),
        action_sub!("notify", "Send a notification to a device", OtherTool, labels: "tools.manageNodesNotifyRunning", "tools.manageNodesNotifyDone", "tools.manageNodesNotifyFailed"),
        action_sub!("camera_snap", "Take a photo with the device camera", OtherTool, labels: "tools.manageNodesCameraSnapRunning", "tools.manageNodesCameraSnapDone", "tools.manageNodesCameraSnapFailed"),
        action_sub!("camera_list", "List available cameras", OtherTool, labels: "tools.manageNodesCameraListRunning", "tools.manageNodesCameraListDone", "tools.manageNodesCameraListFailed"),
        action_sub!("camera_clip", "Record a short video clip", OtherTool, labels: "tools.manageNodesCameraClipRunning", "tools.manageNodesCameraClipDone", "tools.manageNodesCameraClipFailed"),
        action_sub!("screen_record", "Capture screen recording", OtherTool, labels: "tools.manageNodesScreenRecordRunning", "tools.manageNodesScreenRecordDone", "tools.manageNodesScreenRecordFailed"),
        action_sub!("location_get", "Get device GPS location", OtherTool, labels: "tools.manageNodesLocationGetRunning", "tools.manageNodesLocationGetDone", "tools.manageNodesLocationGetFailed"),
        action_sub!("run", "Execute a command on the device", OtherTool, labels: "tools.manageNodesRunRunning", "tools.manageNodesRunDone", "tools.manageNodesRunFailed"),
        action_sub!("invoke", "Call a custom device capability", OtherTool, labels: "tools.manageNodesInvokeRunning", "tools.manageNodesInvokeDone", "tools.manageNodesInvokeFailed"),
    ],
    required_capability: CapData,
    ..DEFAULT_TOOL_ENTRY
}];
