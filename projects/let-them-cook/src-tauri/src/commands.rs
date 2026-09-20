use crate::paths;
use serde_json::Value;

#[tauri::command]
pub fn get_operator() -> String {
    paths::get_operator()
}

#[tauri::command]
pub fn shared_folder_path() -> Result<String, String> {
    Ok(paths::find_app_root()?.to_string_lossy().to_string())
}

#[tauri::command]
pub fn ensure_share_layout() -> Result<String, String> {
    let root = paths::find_app_root()?;
    paths::ensure_share_layout_at(&root)?;
    Ok(root.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_dashboard() -> Result<Value, String> {
    let root = paths::find_app_root()?;
    paths::read_dashboard_at(&root)
}

#[tauri::command]
pub fn write_submit(payload: Value) -> Result<String, String> {
    let root = paths::find_app_root()?;
    let path = paths::write_submit_at(&root, payload)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn write_dashboard(payload: Value) -> Result<String, String> {
    let root = paths::find_app_root()?;
    let path = paths::write_dashboard_at(&root, payload)?;
    Ok(path.to_string_lossy().to_string())
}
