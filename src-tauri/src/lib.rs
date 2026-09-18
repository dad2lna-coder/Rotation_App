#[allow(dead_code)]
mod paths;

#[cfg(feature = "app")]
mod commands;

#[cfg(feature = "app")]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            if let Err(err) = commands::ensure_share_layout() {
                eprintln!("FACTTT layout warning: {err}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_operator,
            commands::shared_folder_path,
            commands::ensure_share_layout,
            commands::read_dashboard,
            commands::write_submit,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Operational Movements");
}
