// No Android o backend desktop é desligado por cfg; o allow cobre dead_code só nesse target.
#![cfg_attr(target_os = "android", allow(dead_code))]

// Allocator global só no desktop: mesma ABI, nenhum comportamento muda.
// No Android mantém o allocator padrão (evita risco no mobile).
#[cfg(not(target_os = "android"))]
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

mod ytdlp;
mod fs;
mod proc;
#[cfg(target_os = "android")]
mod mobile_ytdlp;

/// Pasta XDG de autostart do usuário (`$XDG_CONFIG_HOME/autostart`, senão
/// `$HOME/.config/autostart`).
#[cfg(target_os = "linux")]
fn autostart_dir() -> Option<std::path::PathBuf> {
  let base = std::env::var_os("XDG_CONFIG_HOME")
    .map(std::path::PathBuf::from)
    .filter(|p| p.is_absolute())
    .or_else(|| std::env::var_os("HOME").map(|h| std::path::PathBuf::from(h).join(".config")))?;
  Some(base.join("autostart"))
}

#[cfg(target_os = "linux")]
fn autostart_writable(dir: &std::path::Path) -> bool {
  let probe = dir.join(".lf-write-probe");
  match std::fs::File::create(&probe) {
    Ok(_) => {
      let _ = std::fs::remove_file(&probe);
      true
    }
    Err(_) => false,
  }
}

#[cfg(target_os = "linux")]
fn id_field(flag: &str) -> Result<String, String> {
  let out = std::process::Command::new("id")
    .arg(flag)
    .output()
    .map_err(|e| format!("id {}: {}", flag, e))?;
  let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
  if s.is_empty() {
    Err(format!("id {} vazio", flag))
  } else {
    Ok(s)
  }
}

/// Garante que a pasta de autostart seja gravável pelo usuário atual.
///
/// Sistema saudável: no-op. Se a pasta estiver sob posse de outro dono
/// (ex.: `root`, criada por um comando elevado), pede a senha via `pkexec`
/// e corrige o dono — o toggle "iniciar com o sistema" nunca exige
/// configuração manual, no máximo uma senha. Somente Linux.
#[tauri::command]
async fn autostart_repair() -> Result<(), String> {
  #[cfg(target_os = "linux")]
  {
    let dir = autostart_dir()
      .ok_or_else(|| "não foi possível localizar a pasta de autostart".to_string())?;
    if !dir.exists() {
      std::fs::create_dir_all(&dir).map_err(|e| format!("criar {}: {}", dir.display(), e))?;
      return Ok(());
    }
    if autostart_writable(&dir) {
      return Ok(());
    }
    let owner = format!("{}:{}", id_field("-u")?, id_field("-g")?);
    let out = std::process::Command::new("pkexec")
      .arg("chown")
      .arg("-R")
      .arg(&owner)
      .arg(&dir)
      .output()
      .map_err(|e| format!("pkexec indisponível: {}", e))?;
    if !out.status.success() {
      let err = String::from_utf8_lossy(&out.stderr);
      return Err(format!(
        "permissão necessária para ajustar {} ({})",
        dir.display(),
        err.trim()
      ));
    }
    if autostart_writable(&dir) {
      return Ok(());
    }
    Err(format!("{} ainda sem permissão de escrita", dir.display()))
  }
  #[cfg(not(target_os = "linux"))]
  {
    Ok(())
  }
}

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
    // Hints p/ composição acelerada no WebKitGTK (só quando o usuário não
    // definiu): sem eles o fallback é raster por CPU mesmo com GPU presente.
    // `set_var` aqui não sobrescreve escolha explícita do usuário.
    for (k, v) in [
      ("GSK_RENDERER", "gl"),
      ("WEBKIT_DMABUF_RENDERER", "1"),
    ] {
      if std::env::var_os(k).is_none() {
        std::env::set_var(k, v);
      }
    }
    if let Ok(n) = std::thread::available_parallelism() {
      eprintln!("[hw-accel] CPUs disponíveis: {}", n.get());
    }
  }

  #[allow(unused_mut)]
  let mut builder = tauri::Builder::default();

  #[cfg(desktop)]
  {
    builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    // Autostart honesto (Linux .desktop / Windows Run / macOS LaunchAgent).
    // `--minimized`: boot pelo sistema abre minimizado, sem roubar o foco.
    builder = builder.plugin(tauri_plugin_autostart::init(
      tauri_plugin_autostart::MacosLauncher::LaunchAgent,
      Some(vec!["--minimized"]),
    ));
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
    .setup(|app| {
      // Boot via autostart (`--minimized`): janela nasce minimizada.
      #[cfg(desktop)]
      {
        if std::env::args().any(|a| a == "--minimized") {
          use tauri::Manager;
          if let Some(w) = app.get_webview_window("main") {
            let _ = w.minimize();
          }
        }
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      ytdlp::probe::ytdlp_probe,
      ytdlp::probe::ytdlp_probe_playlist,
      ytdlp::search::ytdlp_search,
      ytdlp::binary::ytdlp_status,
      ytdlp::binary::ytdlp_ensure_binaries,
      fs::ytdlp_download,
      fs::ytdlp_cancel,
      fs::ytdlp_update_download,
      fs::ytdlp_cleanup,
      fs::ytdlp_job_state,
      fs::ytdlp_job_progress,
      fs::fs_get_downloads_path,
      fs::fs_file_stat,
      fs::fs_open_path,
      fs::fs_select_folder,
      fs::fs_save_description,
      fs::fs_fetch_cover,
      fs::fs_elect_finished,
      autostart_repair,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
