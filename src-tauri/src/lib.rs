// No Android o backend desktop é desligado por cfg; o allow cobre dead_code só nesse target.
#![cfg_attr(target_os = "android", allow(dead_code))]

mod ytdlp;
mod fs;
#[cfg(target_os = "android")]
mod mobile_ytdlp;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Libera a GPU do WebView removendo vetos de raster por software herdados do ambiente.
  #[cfg(target_os = "linux")]
  {
    for var in ["WEBKIT_DISABLE_COMPOSITING_MODE", "LIBGL_ALWAYS_SOFTWARE"] {
      if std::env::var_os(var).is_some() {
        std::env::remove_var(var);
        eprintln!("[hw-accel] removido veto de software: {var}=* (GPU liberada)");
      }
    }
  }

  #[allow(unused_mut)]
  let mut builder = tauri::Builder::default();

  #[cfg(desktop)]
  {
    builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
  }

  #[cfg(target_os = "android")]
  {
    builder = builder.plugin(mobile_ytdlp::init());
  }

  builder
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    .invoke_handler(tauri::generate_handler![
      ytdlp::probe::ytdlp_probe,
      ytdlp::probe::ytdlp_probe_playlist,
      ytdlp::search::ytdlp_search,
      ytdlp::binary::ytdlp_status,
      ytdlp::binary::ytdlp_ensure_binaries,
      fs::ytdlp_download,
      fs::ytdlp_cancel,
      fs::ytdlp_cleanup,
      fs::ytdlp_job_state,
      fs::ytdlp_job_progress,
      fs::fs_get_downloads_path,
      fs::fs_open_path,
      fs::fs_select_folder,
      fs::fs_save_description,
      fs::fs_fetch_cover,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
