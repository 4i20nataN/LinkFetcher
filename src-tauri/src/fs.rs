//! utilitários de filesystem e download para o Tauri.
//! Todos os comandos Tauri estão aqui para evitar conflitos de namespace
//! com o macro `generate_handler!`.

use std::path::{Path, PathBuf};
use std::sync::LazyLock;
use std::time::SystemTime;
use tokio::process::Child;
#[cfg(not(target_os = "android"))]
use tokio::io::AsyncReadExt;

use tauri::AppHandle;
#[cfg(not(target_os = "android"))]
use tauri::{Emitter, Manager};

/// Mapa id do download → processo filho (p/ cancelar).
type CancelMap = std::collections::HashMap<String, std::sync::Arc<tokio::sync::Mutex<Child>>>;

/// Processos ativos p/ cancelamento.
static CANCEL_MAP: LazyLock<std::sync::Mutex<CancelMap>> = LazyLock::new(|| {
    std::sync::Mutex::new(std::collections::HashMap::new())
});

pub fn register_cancel(id: String, child: std::sync::Arc<tokio::sync::Mutex<Child>>) {
    let mut g = CANCEL_MAP.lock().unwrap();
    g.insert(id, child);
}

pub fn unregister_cancel(id: &str) -> Option<std::sync::Arc<tokio::sync::Mutex<Child>>> {
    let mut g = CANCEL_MAP.lock().unwrap();
    g.remove(id)
}

/// Ids com `.part` a apagar ao terminar; `pause` preserva p/ resume.
static CLEANUP_INTENT: LazyLock<std::sync::Mutex<std::collections::HashSet<String>>> =
    LazyLock::new(|| std::sync::Mutex::new(std::collections::HashSet::new()));

fn mark_cleanup_intent(id: &str) {
    CLEANUP_INTENT.lock().unwrap().insert(id.to_owned());
}

/// Consome a intenção de limpeza.
fn take_cleanup_intent(id: &str) -> bool {
    CLEANUP_INTENT.lock().unwrap().remove(id)
}

/// Últimos `Destination:` por download (p/ cleanup post-mortem e resume).
static LAST_PATHS: LazyLock<std::sync::Mutex<std::collections::HashMap<String, Vec<String>>>> =
    LazyLock::new(|| std::sync::Mutex::new(std::collections::HashMap::new()));

fn remember_download_path(id: &str, path: &str) {
    let mut g = LAST_PATHS.lock().unwrap();
    if g.len() > 1000 {
        g.clear();
    }
    let v = g.entry(id.to_owned()).or_default();
    if !v.contains(&path.to_owned()) {
        v.push(path.to_owned());
        if v.len() > 8 {
            v.remove(0);
        }
    }
}

fn forget_download_paths(id: &str) -> Option<Vec<String>> {
    LAST_PATHS.lock().unwrap().remove(id)
}

/// Stat best-effort p/ reconciliação (arquivo final em disco após kill).
/// Só leitura; nunca falha (ausente = exists:false).
#[tauri::command]
pub fn fs_file_stat(path: String) -> Result<serde_json::Value, String> {
    let p = path.trim().trim_matches(|c| c == '\'' || c == '"');
    match std::fs::metadata(p) {
        Ok(m) => Ok(serde_json::json!({ "exists": m.is_file(), "size": m.len() })),
        Err(_) => Ok(serde_json::json!({ "exists": false, "size": 0 })),
    }
}

/// Diretório de downloads do SO.
#[cfg(not(target_os = "android"))]
#[tauri::command]
pub fn fs_get_downloads_path(app: AppHandle) -> Result<String, String> {
    let p = app.path().download_dir().map_err(|e| format!("{:?}", e))?;
    Ok(p.to_string_lossy().into_owned())
}

/// No Android: pasta do app no armazenamento externo (sem permissão extra).
#[cfg(target_os = "android")]
#[tauri::command]
pub async fn fs_get_downloads_path(app: AppHandle) -> Result<String, String> {
    let dir = crate::mobile_ytdlp::downloads_dir(&app).await?;
    Ok(dir.to_string_lossy().into_owned())
}

/// Abre arquivo ou pasta no gerenciador do SO.
#[cfg(not(target_os = "android"))]
#[tauri::command]
pub async fn fs_open_path(_app: AppHandle, target_path: String) -> Result<(), String> {
    let normalized = target_path.trim().trim_matches(|c| c == '\'' || c == '"');
    if normalized.is_empty() {
        return Err("path vazio".into());
    }
    let path = PathBuf::from(normalized);
    if path.exists() {
        if path.is_file() {
            #[cfg(target_os = "linux")]
            {
                use std::process::Command;
                let parent = path.parent().unwrap_or(&path);
                Command::new("xdg-open").arg(parent).spawn().map_err(|e| e.to_string())?;
            }
            #[cfg(target_os = "windows")]
            {
                use std::process::Command;
                Command::new("explorer").args(["/select,", &normalized]).spawn().map_err(|e| e.to_string())?;
            }
            #[cfg(target_os = "macos")]
            {
                use std::process::Command;
                Command::new("open").args(["-R", &normalized]).spawn().map_err(|e| e.to_string())?;
            }
        } else if path.is_dir() {
            #[cfg(target_os = "linux")]
            {
                use std::process::Command;
                Command::new("xdg-open").arg(normalized).spawn().map_err(|e| e.to_string())?;
            }
            #[cfg(target_os = "windows")]
            {
                use std::process::Command;
                Command::new("explorer").arg(&normalized).spawn().map_err(|e| e.to_string())?;
            }
            #[cfg(target_os = "macos")]
            {
                use std::process::Command;
                Command::new("open").arg(&normalized).spawn().map_err(|e| e.to_string())?;
            }
        }
    } else {
        if let Some(parent) = path.parent() {
            if parent.exists() {
                #[cfg(target_os = "linux")]
                {
                    use std::process::Command;
                    Command::new("xdg-open").arg(parent).spawn().map_err(|e| e.to_string())?;
                }
                #[cfg(target_os = "windows")]
                {
                    use std::process::Command;
                    Command::new("explorer").arg(parent).spawn().map_err(|e| e.to_string())?;
                }
                #[cfg(target_os = "macos")]
                {
                    use std::process::Command;
                    Command::new("open").arg(parent).spawn().map_err(|e| e.to_string())?;
                }
            }
        }
    }
    Ok(())
}

/// No Android: abre via intent VIEW (Kotlin).
#[cfg(target_os = "android")]
#[tauri::command]
pub async fn fs_open_path(app: AppHandle, target_path: String) -> Result<(), String> {
    let normalized = target_path.trim().trim_matches(|c| c == '\'' || c == '"');
    if normalized.is_empty() {
        return Err("path vazio".into());
    }
    let _: serde_json::Value = crate::mobile_ytdlp::call_mobile(
        &app,
        "openFile",
        &serde_json::json!({ "path": normalized }),
    )
    .await?;
    Ok(())
}

/// Abre diálogo p/ selecionar pasta.
#[tauri::command]
pub async fn fs_select_folder(app: AppHandle, default_path: Option<String>) -> Result<Option<String>, String> {
    #[cfg(desktop)]
    {
        use tauri_plugin_dialog::DialogExt;
        let default = default_path.and_then(|p| {
            let path = PathBuf::from(p);
            if path.is_absolute() && path.exists() {
                Some(path)
            } else {
                None
            }
        }).unwrap_or_else(|| {
            app.path().download_dir().unwrap_or(PathBuf::from("/tmp"))
        });

        let dialog = app.dialog().file().set_directory(&default);
        let (tx, rx) = tokio::sync::oneshot::channel();
        dialog.pick_folder(move |folder| {
            let _ = tx.send(folder.map(|f| f.to_string()));
        });
        match rx.await {
            Ok(folder) => Ok(folder),
            Err(_) => Ok(None),
        }
    }
    #[cfg(not(desktop))]
    {
        let _ = (app, default_path);
        Ok(None)
    }
}

/// Salva arquivo de texto na pasta de downloads.
#[cfg(not(target_os = "android"))]
#[tauri::command]
pub async fn fs_save_description(
    app: AppHandle,
    filename: String,
    content: String,
) -> Result<serde_json::Value, String> {
    let downloads = app.path().download_dir().map_err(|e| format!("{:?}", e))?;
    write_description_file(&downloads, &filename, &content)
}

/// No Android: mesma lógica, na pasta do app.
#[cfg(target_os = "android")]
#[tauri::command]
pub async fn fs_save_description(
    app: AppHandle,
    filename: String,
    content: String,
) -> Result<serde_json::Value, String> {
    let dir: String =
        crate::mobile_ytdlp::downloads_dir(&app).await?.to_string_lossy().into_owned();
    Ok(write_description_file(&PathBuf::from(dir), &filename, &content)?)
}

fn write_description_file(
    downloads: &Path,
    filename: &str,
    content: &str,
) -> Result<serde_json::Value, String> {
    let safe = filename.trim().trim_matches(|c| c == '\'' || c == '"');
    let safe = safe.replace(['<', '>', ':', '"', '/', '\\', '|', '?', '*'], "_");
    let mut file_path = downloads.join(&safe);
    if file_path.exists() {
        let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_string();
        let base = file_path.file_stem().and_then(|s| s.to_str()).unwrap_or("description").to_string();
        let mut counter = 1;
        while file_path.exists() {
            file_path = downloads.join(format!("{}_{}.{}", base, counter, ext));
            counter += 1;
        }
    }
    std::fs::write(&file_path, content).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "success": true,
        "filePath": file_path.to_string_lossy(),
        "dir": downloads.to_string_lossy(),
    }))
}

/// Extensão pela content-type.
fn content_type_ext(ct: &str) -> Option<&'static str> {
    let mime = ct.split(';').next()?.trim().to_lowercase();
    match mime.as_str() {
        "image/jpeg" => Some("jpg"),
        "image/png" => Some("png"),
        "image/webp" => Some("webp"),
        "image/gif" => Some("gif"),
        "image/avif" => Some("avif"),
        "image/bmp" => Some("bmp"),
        _ => None,
    }
}

/// Extensão pelo path da URL.
fn url_path_ext(url: &str) -> Option<String> {
    let path = url.split(['?', '#']).next()?;
    let ext = path.rsplit('.').next()?;
    if ext.len() >= 2
        && ext.len() <= 5
        && ext.chars().all(|c| c.is_ascii_alphanumeric())
        && !path.ends_with('/')
    {
        Some(if ext.eq_ignore_ascii_case("jpeg") {
            "jpg".to_owned()
        } else {
            ext.to_lowercase()
        })
    } else {
        None
    }
}

/// Hosts bloqueados p/ capa (SSRF): sem metadata/local/IP literal.
fn cover_host_blocked(url: &str) -> bool {
    let Some(after_scheme) = url.split("://").nth(1) else {
        return true;
    };
    let authority = after_scheme
        .split(['/', '?', '#'])
        .next()
        .unwrap_or("");
    let host = authority.rsplit('@').next().unwrap_or("");
    if host.starts_with('[') {
        return true;
    }
    let bare = host.split(':').next().unwrap_or("").trim_end_matches('.');
    let lower = bare.to_lowercase();
    if lower.is_empty() || lower == "localhost" || lower.starts_with("localhost.") {
        return true;
    }
    // IPv4 literal.
    let parts: Vec<&str> = lower.split('.').collect();
    if parts.len() == 4
        && parts
            .iter()
            .all(|p| !p.is_empty() && p.len() <= 3 && p.bytes().all(|b| b.is_ascii_digit()))
    {
        return true;
    }
    // IPv6 sem colchetes ou hostname inválido.
    if lower.contains(':') {
        return true;
    }
    false
}

/// Baixa a capa via HTTPS e devolve base64 + extensão (teto 25 MB).
/// Só `https://` com host público.
#[tauri::command]
pub async fn fs_fetch_cover(url: String) -> Result<serde_json::Value, String> {
    use base64::Engine as _;
    let url = url.trim().to_owned();
    if !url.starts_with("https://") || cover_host_blocked(&url) {
        return Err("URL de capa inválida".into());
    }
    let client = reqwest::Client::builder()
        .user_agent("LinkFetcher")
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("baixar capa: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("capa: HTTP {}", resp.status()));
    }
    let ext = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .and_then(content_type_ext)
        .map(str::to_owned)
        .or_else(|| url_path_ext(&url))
        .unwrap_or_else(|| "jpg".to_owned());
    const MAX_COVER: u64 = 25 * 1024 * 1024;
    if resp.content_length().is_some_and(|n| n > MAX_COVER) {
        return Err("capa grande demais".into());
    }
    let bytes = resp.bytes().await.map_err(|e| format!("ler capa: {e}"))?;
    if bytes.len() as u64 > MAX_COVER {
        return Err("capa grande demais".into());
    }
    Ok(serde_json::json!({
        "success": true,
        "data": base64::engine::general_purpose::STANDARD.encode(&bytes),
        "ext": ext,
        "size": bytes.len(),
    }))
}

/// Filtra ruído de progresso do ffmpeg/stderr e mantém o erro real (máx. 500).
/// Separa por `\n` e `\r` (o ffmpeg atualiza a mesma "linha" com `\r`).
fn clean_error_message(stderr_output: &str) -> String {
    fn is_progress_noise(line: &str) -> bool {
        let l = line.trim();
        if l.is_empty() {
            return true;
        }
        (l.contains("frame=") && l.contains("fps="))
            || (l.starts_with("size=") && l.contains("time="))
            || (l.contains("bitrate=") && l.contains("speed="))
            || l.starts_with("elapsed=")
    }

    let kept: Vec<&str> = stderr_output
        .split(['\n', '\r'])
        .map(str::trim)
        .filter(|l| !is_progress_noise(l))
        .collect();
    // Prioriza o fim (onde está a causa)
    let tail: Vec<&str> = kept
        .into_iter()
        .rev()
        .take(8)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    let mut msg = tail.join(" · ");
    if msg.is_empty() {
        // Tudo era ruído: mostra o último segmento não-vazio.
        msg = stderr_output
            .split(['\n', '\r'])
            .map(str::trim).rfind(|l| !l.is_empty())
            .unwrap_or("erro desconhecido")
            .to_owned();
    }
    for prefix in ["ERROR: ", "Error: "] {
        if let Some(rest) = msg.strip_prefix(prefix) {
            msg = rest.to_owned();
            break;
        }
    }
    if msg.chars().count() > 500 {
        msg = msg.chars().take(497).collect::<String>() + "...";
    }
    msg
}

/// Parse `MM:SS` ou `H:MM:SS` (aceita decimais) → segundos.
fn parse_section_time(t: &str) -> Option<f64> {
    let t = t.trim();
    if t.is_empty() {
        return None;
    }
    let mut total = 0.0;
    let mut any = false;
    for p in t.split(':') {
        total = total * 60.0 + p.trim().parse::<f64>().ok()?;
        any = true;
    }
    if any && total >= 0.0 { Some(total) } else { None }
}

/// Parse `*INÍCIO-FIM` → segundos (`*-02:00` = do início).
fn parse_section_range(s: &str) -> Option<(Option<f64>, Option<f64>)> {
    let body = s.strip_prefix('*').unwrap_or(s);
    let (start_s, end_s) = body.split_once('-')?;
    let start = parse_section_time(start_s);
    let end = parse_section_time(end_s);
    if start.is_none() && end.is_none() {
        return None;
    }
    if let (Some(st), Some(en)) = (start, end) {
        if en <= st {
            return None;
        }
    }
    Some((start, end))
}

/// Corte local via ffmpeg (`-c copy`, sem re-encode) + rename p/ o final.
async fn ffmpeg_cut_local(
    ffmpeg: &Path,
    full_path: &str,
    start: Option<f64>,
    end: Option<f64>,
) -> Result<(), String> {
    // Temp preserva a extensão (o ffmpeg infere o muxer pelo nome).
    let ext = Path::new(full_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("mp4");
    let tmp_path = format!("{full_path}.cuttmp.{ext}");
    let mut args: Vec<String> = vec!["-y".to_owned()];
    if let Some(st) = start {
        args.push("-ss".to_owned());
        args.push(format!("{st}"));
    }
    args.push("-i".to_owned());
    args.push(full_path.to_owned());
    match (start, end) {
        (Some(st), Some(en)) => {
            args.push("-t".to_owned());
            args.push(format!("{}", en - st));
        }
        (None, Some(en)) => {
            args.push("-to".to_owned());
            args.push(format!("{en}"));
        }
        _ => {}
    }
    args.push("-c".to_owned());
    args.push("copy".to_owned());
    args.push(tmp_path.clone());

    let mut cmd = tokio::process::Command::new(ffmpeg);
    cmd.args(&args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped());
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let out = cmd
        .output()
        .await
        .map_err(|e| format!("spawn ffmpeg p/ corte: {e}"))?;
    if !out.status.success() {
        let _ = std::fs::remove_file(&tmp_path);
        let stderr = String::from_utf8_lossy(&out.stderr).into_owned();
        let msg = clean_error_message(&stderr);
        return Err(if msg.is_empty() {
            format!("ffmpeg encerrou com status {:?}", out.status.code())
        } else {
            msg
        });
    }
    // Remove o cheio antes (Windows) e renomeia o trecho p/ o final.
    std::fs::remove_file(full_path).map_err(|e| format!("limpar arquivo cheio: {e}"))?;
    std::fs::rename(&tmp_path, full_path).map_err(|e| format!("finalizar corte: {e}"))?;
    Ok(())
}

/// Nomes temporários (nunca entregáveis; p/ eleição e limpeza).
fn is_temp_artifact_name(name: &str) -> bool {
    name.contains(".part")
        || name.ends_with(".ytdl")
        || name.ends_with(".temp")
        || name.ends_with(".tmp")
        || name.ends_with(".new")
        || name.contains(".cuttmp.")
        || name.ends_with(".cuttmp")
        || name.contains("-Frag")
}

/// Remove flags de legenda do argv (retry video-only).
fn strip_sub_flags(argv: Vec<String>) -> Vec<String> {
    let mut out = Vec::with_capacity(argv.len());
    let mut skip_next = false;
    for a in argv {
        if skip_next {
            skip_next = false;
            continue;
        }
        if a == "--sub-langs" || a == "--sub-format" {
            skip_next = true;
            continue;
        }
        if a == "--write-subs" || a == "--write-auto-subs" || a == "--embed-subs" {
            continue;
        }
        out.push(a);
    }
    out
}

/// Retry sem legendas se o stderr citar legenda e a saída for natural (não kill).
fn should_retry_without_subs(
    params: &crate::ytdlp::args::DownloadParams,
    err_lower: &str,
    code: Option<i32>,
) -> bool {
    let asked = params.write_subs.unwrap_or(false) || params.write_auto_subs.unwrap_or(false);
    params.subs_fallback.is_none() && asked && err_lower.contains("subtitle") && code.is_some()
}

/// Retry com client android se a mídia der 403 (uma única tentativa; kill nunca entra).
fn should_retry_with_android_client(
    params: &crate::ytdlp::args::DownloadParams,
    err_lower: &str,
    code: Option<i32>,
) -> bool {
    params.client_fallback.is_none()
        && code.is_some()
        && (err_lower.contains("403") || err_lower.contains("forbidden"))
}

/// Apaga temporários de um base (nunca o final); retorna quantos removeu.
fn remove_temp_variants(base: &Path) -> u32 {
    let mut removed = 0u32;
    if let Some(name) = base.file_name().and_then(|s| s.to_str()) {
        if is_temp_artifact_name(name) && std::fs::remove_file(base).is_ok() {
            removed += 1;
        }
    }
    for suffix in [".part", ".ytdl", ".temp", ".tmp", ".new"] {
        let p = PathBuf::from(format!("{}{suffix}", base.to_string_lossy()));
        if std::fs::remove_file(&p).is_ok() {
            removed += 1;
        }
    }
    // Varre `.cuttmp.*` e `-Frag*` pelo prefixo do base.
    if let (Some(parent), Some(stem)) = (
        base.parent(),
        base.file_name().and_then(|s| s.to_str()),
    ) {
        if let Ok(entries) = std::fs::read_dir(parent) {
            for e in entries.flatten() {
                let name = e.file_name().to_string_lossy().into_owned();
                if name.starts_with(stem)
                    && name.len() > stem.len()
                    && (name.contains(".cuttmp.") || name.contains("-Frag"))
                    && std::fs::remove_file(e.path()).is_ok()
                {
                    removed += 1;
                }
            }
        }
    }
    removed
}

/// Spawna yt-dlp com argv canônico, emite progresso e retorna o arquivo final.
/// Recorte baixa cheio e corta local com ffmpeg (sem `--download-sections` remoto).
#[cfg(not(target_os = "android"))]
#[tauri::command]
pub async fn ytdlp_download(
    app: AppHandle,
    options: Option<crate::ytdlp::args::DownloadParams>,
    params: Option<crate::ytdlp::args::DownloadParams>,
    payload: Option<crate::ytdlp::args::DownloadParams>,
) -> Result<String, String> {
    let params = options
        .or(params)
        .or(payload)
        .ok_or_else(|| "Nenhum parâmetro fornecido para download (esperado options, params ou payload)".to_string())?;
    eprintln!("[ytdlp_download] START id={} url={}", params.id, params.url);
    // Limpa intenção antiga do mesmo id (retry reusa o id; `.part` é p/ resume).
    take_cleanup_intent(&params.id);

    let ytdlp_bin = crate::ytdlp::binary::ytdlp_path(&app).map_err(|e| {
        eprintln!("[ytdlp_download] ERROR resolving yt-dlp binary: {:?}", e);
        format!("{:?}", e)
    })?;
    eprintln!("[ytdlp_download] yt-dlp binary: {}", ytdlp_bin.display());

    let ffmpeg_bin = crate::ytdlp::binary::ffmpeg_path(&app)
        .ok()
        .filter(|p| p.is_file());
    if let Some(ref ff) = ffmpeg_bin {
        eprintln!("[ytdlp_download] ffmpeg binary found: {}", ff.display());
    } else {
        eprintln!("[ytdlp_download] ffmpeg binary not found, using system PATH fallback if available");
    }

    let output_dir = app.path().download_dir().unwrap_or_else(|_| PathBuf::from("/tmp"));
    std::fs::create_dir_all(&output_dir).ok();
    eprintln!("[ytdlp_download] output_dir: {}", output_dir.display());

    let mut argv = crate::ytdlp::args::build_args(&params, &output_dir, ffmpeg_bin.as_deref());
    // Recorte: sem `--download-sections` remoto (lento/403, sem progresso).
    let wants_cut = params
        .download_sections
        .as_deref()
        .is_some_and(|s| !s.is_empty());
    let section_range: Option<(Option<f64>, Option<f64>)> = params
        .download_sections
        .as_deref()
        .and_then(parse_section_range);
    if wants_cut {
        if section_range.is_none() {
            eprintln!(
                "[ytdlp_download] WARN download_sections inválido ({:?}); entregando arquivo cheio",
                params.download_sections
            );
        }
        let mut stripped = Vec::with_capacity(argv.len());
        let mut skip_next = false;
        for a in argv {
            if skip_next {
                skip_next = false;
                continue;
            }
            if a == "--download-sections" {
                skip_next = true;
                continue;
            }
            stripped.push(a);
        }
        argv = stripped;
    }
    // Retry video-only: com `subs_fallback`, remove as flags de legenda.
    if params.subs_fallback.is_some() {
        eprintln!("[ytdlp_download] retry sem legendas");
        argv = strip_sub_flags(argv);
    }
    // Runtime JS antes da URL (após o `--`) p/ extração moderna.
    {
        let js = crate::ytdlp::binary::js_runtime_args();
        if !js.is_empty() {
            let url_arg = argv.pop();
            let sep = if argv.last().is_some_and(|s| s == "--") {
                argv.pop()
            } else {
                None
            };
            argv.extend(js);
            if let Some(s) = sep {
                argv.push(s);
            }
            if let Some(u) = url_arg {
                argv.push(u);
            }
        }
    }
    eprintln!("[ytdlp_download] argv: {:?}", argv);

    let mut cmd = tokio::process::Command::new(ytdlp_bin);
    cmd.args(&argv)
       .stdout(std::process::Stdio::piped())
       .stderr(std::process::Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut proc = cmd.spawn().map_err(|e| {
        eprintln!("[ytdlp_download] ERROR spawn: {}", e);
        format!("spawn yt-dlp: {e}")
    })?;

    eprintln!("[ytdlp_download] process spawned successfully");
    // Prova de vida imediata p/ o card não ficar em 0% mudo.
    let _ = app.emit(
        "yt-dlp-progress",
        &serde_json::json!({ "id": params.id, "type": "activity", "kind": "starting" }),
    );

    let mut stdout = proc.stdout.take().expect("stdout pipe");
    let mut stderr = proc.stderr.take().expect("stderr pipe");

    let child_arc = std::sync::Arc::new(tokio::sync::Mutex::new(proc));
    register_cancel(params.id.clone(), child_arc.clone());
    eprintln!("[ytdlp_download] registered in cancel map");

    let (stdout_tx, mut stdout_rx) = tokio::sync::mpsc::channel::<String>(128);

    // Leitor detém o `tx`; ao terminar, o canal fecha.
    let stdout_reader = tokio::spawn(async move {
        let mut buf = [0u8; 4096];
        let mut line_buf = String::new();
        loop {
            match stdout.read(&mut buf).await {
                Ok(0) => break, // EOF
                Ok(n) => {
                    line_buf.push_str(&String::from_utf8_lossy(&buf[..n]));
                    while let Some(pos) = line_buf.find('\n') {
                        let line = line_buf.drain(..=pos).collect::<String>();
                        if stdout_tx.send(line).await.is_err() {
                            break;
                        }
                    }
                }
                Err(_) => break,
            }
        }
        if !line_buf.is_empty() {
            let _ = stdout_tx.send(line_buf).await;
        }
    });

    // Coleta stderr (últimos 4000 chars p/ diagnóstico).
    let stderr_collector = tokio::spawn(async move {
        let mut buf = [0u8; 1024];
        let mut stderr_buf = String::new();
        loop {
            match stderr.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => {
                    stderr_buf.push_str(&String::from_utf8_lossy(&buf[..n]));
                    if stderr_buf.len() > 4000 {
                        stderr_buf = stderr_buf[stderr_buf.len() - 4000..].to_owned();
                    }
                }
                Err(_) => break,
            }
        }
        stderr_buf
    });

    let download_id = params.id.clone();
    let mut captured_filepath: Option<String> = None;
    let mut subtitle_written = false;
    // Portão por tempo (250ms); sem olhar conteúdo p/ não engolir eventos.
    let mut last_emit = std::time::Instant::now()
        .checked_sub(std::time::Duration::from_secs(1))
        .unwrap_or_else(std::time::Instant::now);

    // Espera concorrente com a drenagem; `complete` deriva do disco.
    let mut wait_task = tokio::spawn(async move {
        let mut child_guard = child_arc.lock().await;
        child_guard.wait().await
    });
    let mut eof = false;
    let wait_res: std::io::Result<std::process::ExitStatus> = loop {
        if eof {
            // EOF antes da saída: aguarda o término.
            eprintln!("[ytdlp_download] stdout EOF antes da saída; aguardando término");
            break wait_task
                .await
                .unwrap_or_else(|e| Err(std::io::Error::new(std::io::ErrorKind::Other, format!("wait: {e}"))));
        }
        // Sem `break` nos braços (atingiria o `select!`, não este loop).
        let mut exited: Option<std::io::Result<std::process::ExitStatus>> = None;
        let line: Option<String> = tokio::select! {
            w = &mut wait_task => {
                exited = Some(w.unwrap_or_else(|e| Err(std::io::Error::new(std::io::ErrorKind::Other, format!("wait: {e}")))));
                None
            }
            l = stdout_rx.recv() => l,
        };
        if let Some(wr) = exited {
            break wr;
        }
        let Some(line) = line else {
            eof = true;
            continue;
        };
        let trimmed = line.trim();
        if let Some(prog) = parse_progress(trimmed) {
            if progress_emit_due(Some(last_emit), std::time::Instant::now()) {
                last_emit = std::time::Instant::now();
                let progress_event = serde_json::json!({
                    "id": download_id,
                    "type": "progress",
                    "percent": prog.percent,
                    "speed": prog.speed.to_string(),
                    "eta": prog.eta.to_string(),
                    "downloaded": prog.downloaded,
                    "total": prog.total,
                });
                let _ = app.emit("yt-dlp-progress", &progress_event);
            }
        } else if let Some(dest) = parse_destination(trimmed) {
            eprintln!("[ytdlp_download] captured destination: {}", dest);
            remember_download_path(&download_id, &dest);
            captured_filepath = Some(dest.clone());
            // Frontend persiste na hora: kill depois daqui ainda reconcilia.
            let _ = app.emit(
                "yt-dlp-progress",
                &serde_json::json!({ "id": download_id, "type": "destination", "path": dest }),
            );
        } else if let Some(merged) = parse_merge(trimmed) {
            eprintln!("[ytdlp_download] captured merged file: {}", merged);
            remember_download_path(&download_id, &merged);
            captured_filepath = Some(merged.clone());
            let _ = app.emit(
                "yt-dlp-progress",
                &serde_json::json!({ "id": download_id, "type": "destination", "path": merged }),
            );
            // Merge: sinaliza `processing` (fase silenciosa).
            let _ = app.emit(
                "yt-dlp-progress",
                &serde_json::json!({ "id": download_id, "type": "processing" }),
            );
        } else if is_postprocess_line(trimmed) {
            // Pós-processamento: sinaliza `processing` (frontend dedupa).
            let _ = app.emit(
                "yt-dlp-progress",
                &serde_json::json!({ "id": download_id, "type": "processing" }),
            );
        } else if parse_retry_signal(trimmed) {
            // Retry de rede: sinaliza `retry` (cauda sem progresso).
            let _ = app.emit(
                "yt-dlp-progress",
                &serde_json::json!({ "id": download_id, "type": "activity", "kind": "retry" }),
            );
        } else if parse_subtitle_path(trimmed).is_some() {
            subtitle_written = true;
        } else if trimmed.contains("Extracting URL:") {
            // Extração sem %: sinaliza `extracting`.
            let _ = app.emit(
                "yt-dlp-progress",
                &serde_json::json!({ "id": download_id, "type": "activity", "kind": "extracting" }),
            );
        } else if trimmed.contains("has already been downloaded") {
            if let Some(start) = trimmed.find("[download] ") {
                if let Some(end) = trimmed.find(" has already been downloaded") {
                    let path = trimmed[start + 11..end].trim().to_owned();
                    eprintln!("[ytdlp_download] captured already downloaded file: {}", path);
                    remember_download_path(&download_id, &path);
                    captured_filepath = Some(path);
                }
            }
        }
    };
    // Aborta o leitor (neto com pipe herdado o prenderia).
    stdout_reader.abort();

    // stderr com teto; segue sem ele se travar.
    let stderr_output = match tokio::time::timeout(std::time::Duration::from_secs(5), stderr_collector).await {
        Ok(r) => r.unwrap_or_default(),
        Err(_) => {
            eprintln!("[ytdlp_download] WARN stderr travado após saída; seguindo sem ele");
            String::new()
        }
    };
    let _ = unregister_cancel(&download_id);

    match wait_res {
        Ok(status) if status.success() => {
            eprintln!("[ytdlp_download] Process exited successfully with status 0");

            let final_path = captured_filepath
                .filter(|p| Path::new(p).exists())
                .or_else(|| latest_downloaded_file(&output_dir));

            // Recorte: corta o cheio local via ffmpeg e entrega só o trecho.
            if wants_cut {
                match (final_path.clone(), section_range) {
                    (Some(path), Some((start, end))) => {
                        let _ = app.emit(
                            "yt-dlp-progress",
                            &serde_json::json!({ "id": download_id, "type": "processing" }),
                        );
                        let ffmpeg_prog = ffmpeg_bin
                            .clone()
                            .unwrap_or_else(|| PathBuf::from("ffmpeg"));
                        if let Err(cut_err) =
                            ffmpeg_cut_local(&ffmpeg_prog, &path, start, end).await
                        {
                            eprintln!("[ytdlp_download] Cut failed: {}", cut_err);
                            let error_event = serde_json::json!({
                                "id": download_id,
                                "type": "error",
                                "message": &cut_err,
                            });
                            let _ = app.emit("yt-dlp-progress", &error_event);
                            let _ = app.emit(
                                "binary-download",
                                serde_json::json!({
                                    "stage": "error",
                                    "file": "yt-dlp",
                                    "message": &cut_err,
                                }),
                            );
                            return Err(cut_err);
                        }
                    }
                    (Some(_), None) => {
                        eprintln!("[ytdlp_download] WARN corte ignorado (range inválido); entregando arquivo cheio");
                    }
                    (None, _) => {
                        eprintln!("[ytdlp_download] WARN recorte sem arquivo capturado");
                    }
                }
            }

            let size = final_path.as_ref().map(|p| {
                std::fs::metadata(p).ok().map(|m| m.len()).unwrap_or(0)
            }).unwrap_or(0);

            // Aviso de legendas (não é erro): retry sem elas ou recorte com sidecar.
            let sub_warning: Option<String> =
                if let Some(reason) = params.subs_fallback.as_deref() {
                    Some(format!("Legendas indisponíveis ({reason}); vídeo salvo sem elas"))
                } else if wants_cut
                    && subtitle_written
                    && !params.embed_subs.unwrap_or(false)
                    && (params.write_subs.unwrap_or(false)
                        || params.write_auto_subs.unwrap_or(false))
                {
                    Some(
                        "Legendas laterais cobrem o vídeo completo (o recorte aplica-se só ao vídeo)"
                            .to_owned(),
                    )
                } else {
                    None
                };

            let complete_event = serde_json::json!({
                "id": download_id,
                "type": "complete",
                "filePath": final_path,
                "size": size,
                "subWarning": sub_warning,
            });
            let _ = app.emit("yt-dlp-progress", &complete_event);
            let _ = app.emit(
                "binary-download",
                serde_json::json!({
                    "stage": "done",
                    "file": "yt-dlp",
                    "filePath": final_path,
                    "size": size,
                }),
            );
            // Sucesso: descarta rastreio de parciais.
            let _ = forget_download_paths(&download_id);
            let _ = take_cleanup_intent(&download_id);

            Ok(final_path.unwrap_or_default())
        }
        Ok(status) => {
            let err_msg = if !stderr_output.trim().is_empty() {
                clean_error_message(&stderr_output)
            } else {
                format!("yt-dlp encerrou com status {:?}", status.code())
            };
            eprintln!("[ytdlp_download] Process failed: {}", err_msg);

            // Falha citando legenda = acessório; re-executa sem as flags (uma vez).
            if should_retry_without_subs(&params, &err_msg.to_lowercase(), status.code()) {
                eprintln!("[ytdlp_download] subs falharam; repetindo sem legendas");
                let mut retry_params = params;
                retry_params.subs_fallback = Some(err_msg);
                return Box::pin(ytdlp_download(app.clone(), None, Some(retry_params), None)).await;
            }

            // 403 na mídia = pool bloqueado; re-executa com client android (com resume).
            if should_retry_with_android_client(&params, &err_msg.to_lowercase(), status.code()) {
                eprintln!("[ytdlp_download] 403 na mídia; repetindo com player_client=android");
                let mut retry_params = params;
                retry_params.client_fallback = Some("android".to_owned());
                return Box::pin(ytdlp_download(app.clone(), None, Some(retry_params), None)).await;
            }

            // Cancelamento definitivo apaga parciais; pausa/erro mantém p/ resume.
            if take_cleanup_intent(&download_id) {
                if let Some(remembered) = forget_download_paths(&download_id) {
                    for rp in remembered {
                        remove_temp_variants(Path::new(&rp));
                    }
                } else if let Some(ref p) = captured_filepath {
                    remove_temp_variants(Path::new(p));
                }
            }
            let error_event = serde_json::json!({
                "id": download_id,
                "type": "error",
                "message": &err_msg,
            });
            let _ = app.emit("yt-dlp-progress", &error_event);
            let _ = app.emit(
                "binary-download",
                serde_json::json!({
                    "stage": "error",
                    "file": "yt-dlp",
                    "message": &err_msg,
                }),
            );

            Err(err_msg)
        }
        Err(e) => {
            let err_msg = format!("Erro ao aguardar processo: {e}");
            eprintln!("[ytdlp_download] Error waiting for process: {}", err_msg);
            if take_cleanup_intent(&download_id) {
                if let Some(remembered) = forget_download_paths(&download_id) {
                    for rp in remembered {
                        remove_temp_variants(Path::new(&rp));
                    }
                } else if let Some(ref p) = captured_filepath {
                    remove_temp_variants(Path::new(p));
                }
            }
            let error_event = serde_json::json!({
                "id": download_id,
                "type": "error",
                "message": &err_msg,
            });
            let _ = app.emit("yt-dlp-progress", &error_event);
            Err(err_msg)
        }
    }
}

/// Resposta do `execute` Kotlin; alias garante o `filePath` camelCase.
#[cfg(target_os = "android")]
#[derive(Debug, serde::Deserialize)]
struct MobileExecuteResult {
    #[serde(default)]
    #[allow(dead_code)]
    out: String,
    #[serde(default, alias = "filePath")]
    file_path: Option<String>,
    // `size` é só conferência (a UI usa o evento `complete`).
    #[serde(default)]
    #[allow(dead_code)]
    size: u64,
}

#[cfg(all(test, target_os = "android"))]
mod mobile_contract_tests {
    use super::MobileExecuteResult;

    /// Contrato FFI com `YtDlpPlugin.kt`: o `invoke.resolve` entrega chaves
    /// camelCase (`filePath`). Regressão de 2026-09-30: sem o alias, o campo
    /// vinha `None` e download concluído virava "sem arquivo final".
    #[test]
    fn execute_result_parses_kotlin_camel_case() {
        let raw = r#"{"filePath": "/dl/video.mp3", "size": 12345}"#;
        let r: MobileExecuteResult = serde_json::from_str(raw).expect("parse");
        assert_eq!(r.file_path.as_deref(), Some("/dl/video.mp3"));
        assert_eq!(r.size, 12345);
    }

    #[test]
    fn execute_result_tolerates_missing_fields() {
        let r: MobileExecuteResult = serde_json::from_str("{}").expect("parse");
        assert!(r.file_path.is_none());
    }
}

/// `ytdlp_download` no Android: argv canônico via plugin Kotlin.
/// Sem `--progress-template`/`--ffmpeg-location`; `download_sections` nativo.
#[cfg(target_os = "android")]
#[tauri::command]
pub async fn ytdlp_download(
    app: AppHandle,
    options: Option<crate::ytdlp::args::DownloadParams>,
    params: Option<crate::ytdlp::args::DownloadParams>,
    payload: Option<crate::ytdlp::args::DownloadParams>,
) -> Result<String, String> {
    let params = options
        .or(params)
        .or(payload)
        .ok_or_else(|| "Nenhum parâmetro fornecido para download (esperado options, params ou payload)".to_string())?;
    eprintln!("[ytdlp_download:android] START id={} url={}", params.id, params.url);
    take_cleanup_intent(&params.id);

    let output_dir = crate::mobile_ytdlp::downloads_dir(&app).await?;
    std::fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;

    // Até 2 tentativas (2ª sem legendas); filtros `--ppa` viram `warnFilters`.
    let filters_dropped = params.normalize_audio.unwrap_or(false)
        || params.video_sharpen.as_deref().is_some_and(|s| !s.is_empty() && s != "none");
    let mut attempt_params = params;
    for attempt in 0..2 {
        let mut argv = crate::ytdlp::args::build_args(&attempt_params, &output_dir, None);
        strip_mobile_unsupported(&mut argv);
        eprintln!("[ytdlp_download:android] argv (tentativa {}): {:?}", attempt + 1, argv);

        let payload = serde_json::json!({
            "argv": argv,
            "processId": attempt_params.id,
            "warnFilters": filters_dropped,
            "title": attempt_params.title.as_deref().unwrap_or(""),
            "publicSubdir": attempt_params.mobile_public_subdir
                .as_deref()
                .unwrap_or("LinkFetcher"),
        });
        let res: Result<MobileExecuteResult, String> =
            crate::mobile_ytdlp::call_mobile(&app, "execute", &payload).await;
        match res {
            Ok(r) => {
                let _ = forget_download_paths(&attempt_params.id);
                let _ = take_cleanup_intent(&attempt_params.id);
                if let Some(fp) = r.file_path {
                    return Ok(fp);
                }
                return Err("download concluído sem arquivo final".into());
            }
            Err(e) => {
                let asked = attempt_params.write_subs.unwrap_or(false)
                    || attempt_params.write_auto_subs.unwrap_or(false);
                if attempt == 0
                    && attempt_params.subs_fallback.is_none()
                    && asked
                    && e.to_lowercase().contains("subtitle")
                {
                    eprintln!("[ytdlp_download:android] subs falharam; repetindo sem legendas");
                    attempt_params.subs_fallback = Some(e);
                    attempt_params.write_subs = Some(false);
                    attempt_params.write_auto_subs = Some(false);
                    attempt_params.embed_subs = Some(false);
                    continue;
                }
                if take_cleanup_intent(&attempt_params.id) {
                    let _ = forget_download_paths(&attempt_params.id);
                }
                return Err(e);
            }
        }
    }
    Err("download falhou após retry".into())
}

/// Remove do argv o sem-suporte no mobile (progress-template, ffmpeg-location, `--ppa`).
#[cfg(target_os = "android")]
fn strip_mobile_unsupported(argv: &mut Vec<String>) {
    let mut out = Vec::with_capacity(argv.len());
    let mut skip_next = false;
    for a in argv.drain(..) {
        if skip_next {
            skip_next = false;
            continue;
        }
        if a == "--progress-template" || a == "--ffmpeg-location" || a == "--ppa" {
            skip_next = true;
            continue;
        }
        if a == crate::ytdlp::args::PROGRESS_TEMPLATE {
            continue;
        }
        out.push(a);
    }
    *argv = out;
}

/// Cancela download ativo; `cleanup=true` apaga os `.part` ao terminar.
#[cfg(not(target_os = "android"))]
#[tauri::command]
pub async fn ytdlp_cancel(
    options: Option<serde_json::Value>,
    params: Option<serde_json::Value>,
    payload: Option<serde_json::Value>,
    id: Option<String>,
    cleanup: Option<bool>,
) -> Result<(), String> {
    // `cleanup` pode vir top-level ou aninhado.
    let nested_cleanup = options
        .as_ref()
        .or(params.as_ref())
        .or(payload.as_ref())
        .and_then(|v| v.get("cleanup").and_then(|c| c.as_bool()))
        .unwrap_or(false);
    let want_cleanup = cleanup.unwrap_or(false) || nested_cleanup;
    let resolved_id = if let Some(s) = id {
        s
    } else if let Some(ref opts) = options.or(params).or(payload) {
        if let Some(s) = opts.as_str() {
            s.to_owned()
        } else if let Some(id_val) = opts.get("id").and_then(|v| v.as_str()) {
            id_val.to_owned()
        } else {
            return Err("ID de download inválido para cancelamento".into());
        }
    } else {
        return Err("Nenhum ID fornecido para cancelamento".into());
    };

    if want_cleanup {
        mark_cleanup_intent(&resolved_id);
    }
    if let Some(child_arc) = unregister_cancel(&resolved_id) {
        let mut child = child_arc.lock().await;
        let _ = child.kill().await;
        eprintln!("[ytdlp_cancel] Cancelled download id={}", resolved_id);
        Ok(())
    } else {
        Err("Nenhum download ativo com esse id".into())
    }
}

/// `ytdlp_cancel` no Android via Kotlin; `cleanup=true` apaga os `.part`.
#[cfg(target_os = "android")]
#[tauri::command]
pub async fn ytdlp_cancel(
    app: AppHandle,
    options: Option<serde_json::Value>,
    params: Option<serde_json::Value>,
    payload: Option<serde_json::Value>,
    id: Option<String>,
    cleanup: Option<bool>,
) -> Result<(), String> {
    let nested_cleanup = options
        .as_ref()
        .or(params.as_ref())
        .or(payload.as_ref())
        .and_then(|v| v.get("cleanup").and_then(|c| c.as_bool()))
        .unwrap_or(false);
    let want_cleanup = cleanup.unwrap_or(false) || nested_cleanup;
    let resolved_id = if let Some(s) = id {
        s
    } else if let Some(ref opts) = options.or(params).or(payload) {
        if let Some(s) = opts.as_str() {
            s.to_owned()
        } else if let Some(id_val) = opts.get("id").and_then(|v| v.as_str()) {
            id_val.to_owned()
        } else {
            return Err("ID de download inválido para cancelamento".into());
        }
    } else {
        return Err("Nenhum ID fornecido para cancelamento".into());
    };

    if want_cleanup {
        mark_cleanup_intent(&resolved_id);
    }
    let killed = crate::mobile_ytdlp::cancel_mobile(&app, &resolved_id, want_cleanup).await?;
    // Inexistente/já morto não é erro (estado final já vale).
    if killed {
        eprintln!("[ytdlp_cancel:android] Cancelled download id={}", resolved_id);
    } else {
        eprintln!("[ytdlp_cancel:android] Nothing running for id={}", resolved_id);
    }
    Ok(())
}

/// Reconciliação pós-background no Android; retorna o JSON cru do Kotlin.
/// `unknown` = sem registro (engine não age).
#[cfg(target_os = "android")]
#[tauri::command]
pub async fn ytdlp_job_state(
    app: AppHandle,
    options: Option<serde_json::Value>,
    params: Option<serde_json::Value>,
    payload: Option<serde_json::Value>,
    id: Option<String>,
) -> Result<serde_json::Value, String> {
    let resolved_id = if let Some(s) = id {
        s
    } else if let Some(ref opts) = options.or(params).or(payload) {
        if let Some(s) = opts.as_str() {
            s.to_owned()
        } else if let Some(id_val) = opts.get("id").and_then(|v| v.as_str()) {
            id_val.to_owned()
        } else {
            return Err("Nenhum ID fornecido para job_state".into());
        }
    } else {
        return Err("Nenhum ID fornecido para job_state".into());
    };
    crate::mobile_ytdlp::job_state_mobile(&app, &resolved_id).await
}

/// Fora do Android: sem registro de jobs (erro explícito).
#[cfg(not(target_os = "android"))]
#[tauri::command]
pub async fn ytdlp_job_state() -> Result<serde_json::Value, String> {
    Err("job_state suportado só no Android".into())
}

/// Progresso do job no Android p/ poll do engine; fora dele, erro.
#[cfg(target_os = "android")]
#[tauri::command]
pub async fn ytdlp_job_progress(
    app: AppHandle,
    options: Option<serde_json::Value>,
    params: Option<serde_json::Value>,
    payload: Option<serde_json::Value>,
    id: Option<String>,
) -> Result<serde_json::Value, String> {
    let resolved_id = if let Some(s) = id {
        s
    } else if let Some(ref opts) = options.or(params).or(payload) {
        if let Some(s) = opts.as_str() {
            s.to_owned()
        } else if let Some(id_val) = opts.get("id").and_then(|v| v.as_str()) {
            id_val.to_owned()
        } else {
            return Err("Nenhum ID fornecido para job_progress".into());
        }
    } else {
        return Err("Nenhum ID fornecido para job_progress".into());
    };
    crate::mobile_ytdlp::job_progress_mobile(&app, &resolved_id).await
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub async fn ytdlp_job_progress() -> Result<serde_json::Value, String> {
    Err("job_progress suportado só no Android".into())
}

/// Apaga temporários (`.part`, `-Frag*`); só dentro dos downloads; idempotente.
#[cfg(not(target_os = "android"))]
#[tauri::command]
pub async fn ytdlp_cleanup(
    app: AppHandle,
    id: Option<String>,
    #[allow(non_snake_case)] filePath: Option<String>,
) -> Result<serde_json::Value, String> {
    if id.is_none() && filePath.is_none() {
        return Err("Nenhum id ou filePath fornecido para limpeza".into());
    }
    let downloads = app.path().download_dir().map_err(|e| format!("{e:?}"))?;
    let mut targets: Vec<PathBuf> = Vec::new();
    if let Some(fp) = filePath {
        let p = PathBuf::from(fp.trim().trim_matches(|c| c == '\'' || c == '"'));
        if p.parent() != Some(downloads.as_path()) {
            return Err("filePath fora da pasta de downloads".into());
        }
        targets.push(p);
    }
    if let Some(did) = id {
        let _ = take_cleanup_intent(&did);
        if let Some(remembered) = forget_download_paths(&did) {
            for rp in remembered {
                let p = PathBuf::from(rp);
                if p.parent() == Some(downloads.as_path()) && !targets.contains(&p) {
                    targets.push(p);
                }
            }
        }
    }
    let mut cleaned = 0u32;
    for t in &targets {
        cleaned += remove_temp_variants(t);
    }
    Ok(serde_json::json!({ "success": true, "cleaned": cleaned }))
}

/// `ytdlp_cleanup` no Android: mesma lógica, na pasta do app.
#[cfg(target_os = "android")]
#[tauri::command]
pub async fn ytdlp_cleanup(
    app: AppHandle,
    id: Option<String>,
    #[allow(non_snake_case)] filePath: Option<String>,
) -> Result<serde_json::Value, String> {
    if id.is_none() && filePath.is_none() {
        return Err("Nenhum id ou filePath fornecido para limpeza".into());
    }
    let downloads = crate::mobile_ytdlp::downloads_dir(&app).await?;
    let mut targets: Vec<PathBuf> = Vec::new();
    if let Some(fp) = filePath {
        let p = PathBuf::from(fp.trim().trim_matches(|c| c == '\'' || c == '"'));
        if p.parent() != Some(downloads.as_path()) {
            return Err("filePath fora da pasta de downloads".into());
        }
        targets.push(p);
    }
    if let Some(did) = id {
        let _ = take_cleanup_intent(&did);
        if let Some(remembered) = forget_download_paths(&did) {
            for rp in remembered {
                let p = PathBuf::from(rp);
                if p.parent() == Some(downloads.as_path()) && !targets.contains(&p) {
                    targets.push(p);
                }
            }
        }
    }
    let mut cleaned = 0u32;
    for t in &targets {
        cleaned += remove_temp_variants(t);
    }
    Ok(serde_json::json!({ "success": true, "cleaned": cleaned }))
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ParsedProgress {
    pub percent: f64,
    pub speed: f64,
    pub eta: f64,
    pub downloaded: u64,
    pub total: u64,
}

fn parse_speed_str(s: &str) -> f64 {
    let s = s.trim();
    if let Some(val) = s.strip_suffix("GiB/s") {
        val.trim().parse::<f64>().unwrap_or(0.0) * 1024.0 * 1024.0 * 1024.0
    } else if let Some(val) = s.strip_suffix("MiB/s") {
        val.trim().parse::<f64>().unwrap_or(0.0) * 1024.0 * 1024.0
    } else if let Some(val) = s.strip_suffix("KiB/s") {
        val.trim().parse::<f64>().unwrap_or(0.0) * 1024.0
    } else if let Some(val) = s.strip_suffix("B/s") {
        val.trim().parse::<f64>().unwrap_or(0.0)
    } else {
        0.0
    }
}

fn parse_eta_str(s: &str) -> f64 {
    let parts: Vec<&str> = s.trim().split(':').collect();
    if parts.len() == 2 {
        let m = parts[0].parse::<f64>().unwrap_or(0.0);
        let sec = parts[1].parse::<f64>().unwrap_or(0.0);
        m * 60.0 + sec
    } else if parts.len() == 3 {
        let h = parts[0].parse::<f64>().unwrap_or(0.0);
        let m = parts[1].parse::<f64>().unwrap_or(0.0);
        let sec = parts[2].parse::<f64>().unwrap_or(0.0);
        h * 3600.0 + m * 60.0 + sec
    } else {
        0.0
    }
}

/// Parse das linhas de progresso (`LF_PROG:`, `download:` ou genérico com `|`).
pub fn parse_progress(line: &str) -> Option<ParsedProgress> {
    let payload = if let Some(rest) = line.strip_prefix("LF_PROG:") {
        rest
    } else if let Some(rest) = line.strip_prefix("download:LF_PROG:") {
        rest
    } else if let Some(rest) = line.strip_prefix("download:") {
        rest
    } else if line.contains('|') && (line.contains('%') || line.contains("MiB/s") || line.contains("KiB/s")) {
        line
    } else {
        return None;
    };

    let parts: Vec<&str> = payload.split('|').collect();
    if parts.is_empty() {
        return None;
    }

    let pct_str = parts[0].trim().trim_end_matches('%').trim();
    let percent = pct_str.parse::<f64>().unwrap_or(0.0);

    let speed = if parts.len() > 1 {
        let s = parts[1].trim();
        if s == "NA" || s == "Unknown" {
            0.0
        } else if let Ok(val) = s.parse::<f64>() {
            val
        } else {
            parse_speed_str(s)
        }
    } else {
        0.0
    };

    let eta = if parts.len() > 2 {
        let s = parts[2].trim();
        if s == "NA" || s == "Unknown" {
            0.0
        } else if let Ok(val) = s.parse::<f64>() {
            val
        } else {
            parse_eta_str(s)
        }
    } else {
        0.0
    };

    let downloaded = if parts.len() > 3 {
        parts[3].trim().parse::<u64>().unwrap_or(0)
    } else {
        0
    };

    let total = if parts.len() > 4 {
        parts[4].trim().parse::<u64>().unwrap_or(0)
    } else {
        0
    };

    Some(ParsedProgress {
        percent,
        speed,
        eta,
        downloaded,
        total,
    })
}

/// Caminho da legenda sidecar (`Writing video subtitles to:`).
pub fn parse_subtitle_path(line: &str) -> Option<String> {
    if let Some(idx) = line.find("Writing video subtitles to: ") {
        return Some(line[idx + "Writing video subtitles to: ".len()..].trim().to_owned());
    }
    None
}

pub fn parse_destination(line: &str) -> Option<String> {
    if let Some(idx) = line.find("Destination: ") {
        return Some(line[idx + "Destination: ".len()..].trim().to_owned());
    }
    None
}

/// Portão por tempo (250ms); sem olhar conteúdo. Função pura p/ teste.
fn progress_emit_due(
    last_emit: Option<std::time::Instant>,
    now: std::time::Instant,
) -> bool {
    match last_emit {
        None => true,
        Some(t) => now.duration_since(t) >= std::time::Duration::from_millis(250),
    }
}

/// Pós-processamento silencioso (merge/recode); sem sinal a UI congela. Função pura p/ teste.
fn is_postprocess_line(line: &str) -> bool {
    line.starts_with("[ExtractAudio]")
        || line.starts_with("[VideoRemuxer]")
        || line.starts_with("[VideoConverter]")
        || line.starts_with("[Merger]")
}

/// Caminho do merge (`Merging formats into "..."`).
pub fn parse_merge(line: &str) -> Option<String> {
    let p = "Merging formats into \"";
    if let Some(idx) = line.find(p) {
        let rest = &line[idx + p.len()..];
        if let Some(end) = rest.find('"') {
            return Some(rest[..end].to_owned());
        }
    }
    None
}

/// Retry de fragmento/rede do yt-dlp; sem ele o card congela no fim. Função pura p/ teste.
pub fn parse_retry_signal(line: &str) -> bool {
    line.contains("Retrying fragment ")
        || line.contains("Retrying (")
        || (line.contains("Sleeping ") && line.contains(" seconds"))
}

/// Arquivo mais recente ignorando temporários.
pub fn latest_downloaded_file(output_dir: &Path) -> Option<String> {
    let entries = match std::fs::read_dir(output_dir) {
        Ok(r) => r.flatten().map(|e| e.path()).collect::<Vec<PathBuf>>(),
        Err(_) => return None,
    };
    let mut latest: Option<(SystemTime, PathBuf)> = None;
    for e in entries {
        if let Some(name) = e.file_name().and_then(|s| s.to_str()) {
            if is_temp_artifact_name(name) {
                continue;
            }
        }
        let m = match e.metadata() { Ok(m)=>m, Err(_)=>continue };
        if let Ok(t) = m.modified() {
            if latest.as_ref().is_none_or(|(lt,_)| t > *lt) {
                latest = Some((t, e));
            }
        }
    }
    latest.map(|(_,p)| p.to_string_lossy().into_owned())
}

/// Eleição do arquivo final p/ reconciliação (botão Verificar Lista + boot).
/// O `destination` guardado no frontend pode estar obsoleto: merge trocou o
/// container, retry renomeou com sufixo. Elege pelo mesmo radical no
/// diretório do hint, ignorando temporários (.part, -Frag, .cuttmp…).
/// Prefere mesmo radical (container trocado) a prefixo (sufixo de retry).
/// `hasPart` acusa parcial em voo com o mesmo radical: com ele, nunca curar.
/// Retorna null quando nada é elegível. Só leitura.
#[tauri::command]
pub fn fs_elect_finished(hint_path: String) -> Result<serde_json::Value, String> {
    let hint = PathBuf::from(&hint_path);
    let parent = match hint.parent() {
        Some(p) => p.to_path_buf(),
        None => return Ok(serde_json::Value::Null),
    };
    let stem = match hint.file_stem().and_then(|s| s.to_str()) {
        Some(s) if !s.is_empty() => s.to_owned(),
        _ => return Ok(serde_json::Value::Null),
    };
    let entries: Vec<PathBuf> = match std::fs::read_dir(&parent) {
        Ok(r) => r.flatten().map(|e| e.path()).collect(),
        Err(_) => return Ok(serde_json::Value::Null),
    };
    let mut best_same: Option<(SystemTime, PathBuf, u64)> = None;
    let mut best_prefix: Option<(SystemTime, PathBuf, u64)> = None;
    let mut has_part = false;
    for e in &entries {
        let name = match e.file_name().and_then(|s| s.to_str()) {
            Some(n) => n.to_owned(),
            None => continue,
        };
        let same_stem = e.file_stem().and_then(|s| s.to_str()) == Some(stem.as_str());
        let prefix = name.starts_with(stem.as_str()) && name.len() > stem.len();
        if is_temp_artifact_name(&name) {
            if same_stem || prefix {
                has_part = true;
            }
            continue;
        }
        let m = match e.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if !m.is_file() || m.len() == 0 {
            continue;
        }
        let t = match m.modified() {
            Ok(t) => t,
            Err(_) => continue,
        };
        let slot = if same_stem {
            &mut best_same
        } else if prefix {
            &mut best_prefix
        } else {
            continue;
        };
        if slot.as_ref().is_none_or(|(lt, _, _)| t > *lt) {
            *slot = Some((t, e.clone(), m.len()));
        }
    }
    match best_same.or(best_prefix) {
        Some((_, p, size)) => Ok(serde_json::json!({
            "path": p.to_string_lossy(),
            "size": size,
            "hasPart": has_part,
        })),
        None => Ok(serde_json::Value::Null),
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clean_error_drops_ffmpeg_progress_noise() {
        let stderr = "frame=  100 fps=112 q=-1.0 size= 1000KiB time=00:00:05.00 bitrate=1500kbits/s speed=1.8x\n\
            elapsed=0:00:05.00 frame=100 fps=112 q=-1.0\n\
            [info] downloading\n\
            ERROR: Postprocessing: Something broke badly\n";
        let msg = clean_error_message(stderr);
        assert!(!msg.contains("frame="), "{msg}");
        assert!(msg.contains("Something broke badly"), "{msg}");
    }

    #[test]
    fn clean_error_falls_back_when_only_noise() {
        let stderr = "frame= 1 fps=1 q=-1.0\nsize= 10KiB time=00:00:01.00\n";
        let msg = clean_error_message(stderr);
        assert!(!msg.is_empty());
    }

    #[test]
    fn clean_error_splits_cr_joined_ffmpeg_noise() {
        // ffmpeg com stderr em pipe separa updates de status com `\r`: sem
        // split, tudo vira uma mega-linha e a causa real se perde (ou o ruído
        // vaza inteiro como "mensagem de erro").
        let stderr = "frame=  100 fps=112 q=-1.0 size= 1000KiB time=00:00:05.00 bitrate=1500kbits/s speed=1.8x\r\
            frame=  200 fps=115 q=-1.0 size= 2000KiB time=00:00:10.00 bitrate=1600kbits/s speed=1.9x\r\
            [https @ 0x1] HTTP error 403 Forbidden\n\
            Error opening input files: Server returned 403 Forbidden (access denied)\n\
            ERROR: ffmpeg exited with code 8\n";
        let msg = clean_error_message(stderr);
        assert!(!msg.contains("frame="), "{msg}");
        assert!(!msg.contains("bitrate="), "{msg}");
        assert!(msg.contains("403 Forbidden"), "{msg}");
    }

    #[test]
    fn clean_error_all_noise_falls_back_to_short_segment() {
        let stderr = "frame= 1 fps=1 q=-1.0 size= 10KiB time=00:00:01.00 bitrate=9kbits/s speed=1x\rframe= 2 fps=1 q=-1.0 size= 20KiB time=00:00:02.00";
        let msg = clean_error_message(stderr);
        assert!(!msg.contains('\r'), "{msg}");
        assert!(msg.chars().count() <= 500, "{msg}");
    }

    #[test]
    fn postprocess_lines_detected_for_processing_signal() {
        // Fase silenciosa do yt-dlp (merge/recode/extract): sem este sinal a
        // UI congela no último % com velocidade fantasma ("travado").
        // UI congela no último % com velocidade fantasma ("travado").
        assert!(is_postprocess_line("[Merger] Merging formats into \"a.mp4\""));
        assert!(is_postprocess_line("[ExtractAudio] Destination: a.mp3"));
        assert!(is_postprocess_line("[VideoRemuxer] Not remuxing"));
        assert!(is_postprocess_line("[VideoConverter] Converting"));
        assert!(!is_postprocess_line("[download]  95.5% of 11.50MiB at 17.40MiB/s"));
        assert!(!is_postprocess_line("[info] Test"));
        assert!(!is_postprocess_line(""));
    }

    #[test]
    fn retry_lines_detected_for_activity_signal() {
        // Cauda silenciosa (fragmentos 429/403 com backoff): formatos
        // oficiais de RetryManager.report_retry — sem este sinal o card
        // congela na última % ("para no final").
        assert!(parse_retry_signal("[download] Got error: HTTP Error 429: Too Many Requests. Retrying fragment 12 (3/10)..."));
        assert!(parse_retry_signal("[download] Got error: HTTP Error 403: Forbidden. Retrying (2/10)..."));
        assert!(parse_retry_signal("Sleeping 2.00 seconds ..."));
        assert!(!parse_retry_signal("download:LF_PROG:86.7%|29.7MiB|NA|10000000|11500000"));
        assert!(!parse_retry_signal("[Merger] Merging formats into \"a.mp4\""));
        assert!(!parse_retry_signal("[download] Destination: /dl/a.mp4"));
        assert!(!parse_retry_signal(""));
    }

    #[test]
    fn progress_emit_due_time_only() {
        use std::time::{Duration, Instant};
        let now = Instant::now();
        // Sem emissão anterior: sempre emite (primeira linha nunca é engolida).
        assert!(progress_emit_due(None, now));
        // Janela fechada (<250ms): segura, qualquer que seja o conteúdo.
        assert!(!progress_emit_due(Some(now), now));
        assert!(!progress_emit_due(
            Some(now.checked_sub(Duration::from_millis(100)).unwrap()),
            now
        ));
        // Janela aberta (>=250ms): emite.
        assert!(progress_emit_due(
            Some(now.checked_sub(Duration::from_millis(250)).unwrap()),
            now
        ));
        assert!(progress_emit_due(
            Some(now.checked_sub(Duration::from_secs(5)).unwrap()),
            now
        ));
    }

    #[test]
    fn parse_section_range_formats() {
        assert_eq!(
            parse_section_range("*01:00-02:00"),
            Some((Some(60.0), Some(120.0)))
        );
        assert_eq!(
            parse_section_range("*1:02:03-2:00:00"),
            Some((Some(3723.0), Some(7200.0)))
        );
        assert_eq!(parse_section_range("*01:00-"), Some((Some(60.0), None)));
        assert_eq!(parse_section_range("*-02:00"), Some((None, Some(120.0))));
        // Degenerados: sem range útil → None (entrega arquivo cheio)
        assert_eq!(parse_section_range("*00:00-00:00"), None);
        assert_eq!(parse_section_range("*02:00-01:00"), None);
        assert_eq!(parse_section_range(""), None);
        assert_eq!(parse_section_range("*abc-def"), None);
    }

    #[test]
    fn temp_artifact_names_detected() {
        for n in [
            "video.mp4.part",
            "video.mp4.part-Frag12",
            "video.mp4-Frag3.part",
            "video.mp4.ytdl",
            "video.mp4.temp",
            "video.mp4.tmp",
            "yt-dlp.new",
            "video.mp4.cuttmp.mp4",
        ] {
            assert!(is_temp_artifact_name(n), "{n}");
        }
        for n in [
            "video.mp4",
            "audio.mp3",
            "subs.pt.srt",
            "thumb.webp",
            "video (1).mp4",
            "infojson.info.json",
        ] {
            assert!(!is_temp_artifact_name(n), "{n}");
        }
    }

    fn unique_tmp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "linkfetcher-test-{tag}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn remove_temp_variants_keeps_final_and_siblings() {
        let dir = unique_tmp_dir("variants");
        let base = dir.join("video.mp4");
        std::fs::write(&base, b"final").unwrap();
        std::fs::write(dir.join("video.mp4.part"), b"p").unwrap();
        std::fs::write(dir.join("video.mp4.ytdl"), b"y").unwrap();
        std::fs::write(dir.join("video.mp4.cuttmp.mp4"), b"c").unwrap();
        std::fs::write(dir.join("video.mp4-Frag7.part"), b"f").unwrap();
        // Homônimo de outro download: intocado.
        std::fs::write(dir.join("video.mp4 (1)"), b"sibling").unwrap();

        let removed = remove_temp_variants(&base);
        assert_eq!(removed, 4);
        assert!(base.is_file());
        assert!(dir.join("video.mp4 (1)").is_file());
        assert!(!dir.join("video.mp4.part").exists());
        assert!(!dir.join("video.mp4.ytdl").exists());
        assert!(!dir.join("video.mp4.cuttmp.mp4").exists());
        assert!(!dir.join("video.mp4-Frag7.part").exists());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn remove_temp_variants_handles_part_base() {
        let dir = unique_tmp_dir("partbase");
        let part = dir.join("video.mp4.part");
        std::fs::write(&part, b"p").unwrap();
        let removed = remove_temp_variants(&part);
        assert!(removed >= 1);
        assert!(!part.exists());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn latest_ignores_part_files() {
        let dir = unique_tmp_dir("latest");
        let final_f = dir.join("show.mp4");
        std::fs::write(&final_f, b"v").unwrap();
        // .part mais novo que o final: não pode ser eleito.
        std::thread::sleep(std::time::Duration::from_millis(20));
        std::fs::write(dir.join("other.mp4.part"), b"p").unwrap();
        let got = latest_downloaded_file(&dir).unwrap();
        assert!(got.ends_with("show.mp4"), "{got}");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn elect_finished_prefers_same_stem_over_prefix() {
        let dir = unique_tmp_dir("elect");
        // Mesmo radical, container trocado pelo merge (.mp4 → .mkv).
        std::fs::write(dir.join("show.mkv"), b"merged").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        // Retry com sufixo: mais novo, mas só vale se não houver mesmo radical.
        std::fs::write(dir.join("show (1).mp4"), b"retry").unwrap();
        let got = fs_elect_finished(dir.join("show.mp4").to_string_lossy().into_owned()).unwrap();
        assert_eq!(got["path"].as_str().unwrap(), dir.join("show.mkv").to_string_lossy().as_ref());
        assert_eq!(got["size"].as_u64().unwrap(), 6);
        assert_eq!(got["hasPart"].as_bool().unwrap(), false);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn elect_finished_reports_part_and_ignores_temps() {
        let dir = unique_tmp_dir("electpart");
        std::fs::write(dir.join("show.mp4"), b"v").unwrap();
        // .part mais novo com o mesmo radical: acusa parcial em voo.
        std::thread::sleep(std::time::Duration::from_millis(20));
        std::fs::write(dir.join("show.mp4.part"), b"p").unwrap();
        std::fs::write(dir.join("show.mp4-Frag3.part"), b"f").unwrap();
        let got = fs_elect_finished(dir.join("show.webm").to_string_lossy().into_owned()).unwrap();
        assert_eq!(got["path"].as_str().unwrap(), dir.join("show.mp4").to_string_lossy().as_ref());
        assert_eq!(got["hasPart"].as_bool().unwrap(), true);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn elect_finished_returns_null_without_match() {
        let dir = unique_tmp_dir("electnull");
        std::fs::write(dir.join("other.mp4"), b"v").unwrap();
        let got = fs_elect_finished(dir.join("show.mp4").to_string_lossy().into_owned()).unwrap();
        assert!(got.is_null());
        let got_empty = fs_elect_finished(String::new()).unwrap();
        assert!(got_empty.is_null());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn cover_host_blocklist() {
        // Públicos passam.
        assert!(!cover_host_blocked("https://i.ytimg.com/vi/x/hqdefault.jpg"));
        assert!(!cover_host_blocked("https://cdn.example.com/a.png?w=100"));
        // Metadata, localhost, IP literal e IPv6 nunca passam.
        assert!(cover_host_blocked("http://169.254.169.254/latest/meta-data"));
        assert!(cover_host_blocked("https://169.254.169.254/x.jpg"));
        assert!(cover_host_blocked("http://127.0.0.1:8080/x.jpg"));
        assert!(cover_host_blocked("https://localhost/x.jpg"));
        assert!(cover_host_blocked("https://localhost./x.jpg"));
        assert!(cover_host_blocked("https://[::1]/x.jpg"));
        assert!(cover_host_blocked("https://user:pass@10.0.0.1/x.jpg"));
        // Esquema barrado à parte (só https passa): host público não é block.
        assert!(!cover_host_blocked("ftp://cdn.example.com/x.jpg"));
        assert!(cover_host_blocked("not-a-url"));
    }

    #[test]
    fn cover_ext_from_content_type() {
        assert_eq!(content_type_ext("image/jpeg"), Some("jpg"));
        assert_eq!(content_type_ext("image/jpeg; charset=binary"), Some("jpg"));
        assert_eq!(content_type_ext("IMAGE/PNG"), Some("png"));
        assert_eq!(content_type_ext("image/webp"), Some("webp"));
        assert_eq!(content_type_ext("image/gif"), Some("gif"));
        assert_eq!(content_type_ext("text/html"), None);
        assert_eq!(content_type_ext(""), None);
    }

    #[test]
    fn cover_ext_from_url_path() {
        assert_eq!(
            url_path_ext("https://i.ytimg.com/vi/x/hqdefault.jpg"),
            Some("jpg".to_owned())
        );
        assert_eq!(
            url_path_ext("https://cdn/a.PNG?w=100#frag"),
            Some("png".to_owned())
        );
        assert_eq!(
            url_path_ext("https://cdn/a.JPEG"),
            Some("jpg".to_owned())
        );
        assert_eq!(url_path_ext("https://cdn/noext"), None);
        assert_eq!(url_path_ext("https://cdn/a.toolongext"), None);
    }

    #[test]
    fn subtitle_path_parsing() {
        assert_eq!(
            parse_subtitle_path("[info] Writing video subtitles to: /dl/v.en.srt"),
            Some("/dl/v.en.srt".to_owned())
        );
        assert_eq!(parse_subtitle_path("[download] Destination: /dl/v.mp4"), None);
        assert_eq!(parse_subtitle_path(""), None);
    }

    #[test]
    fn sub_flags_stripped_keeping_rest() {
        let argv = vec![
            "--format".to_owned(),
            "best".to_owned(),
            "--write-subs".to_owned(),
            "--write-auto-subs".to_owned(),
            "--sub-langs".to_owned(),
            "en".to_owned(),
            "--sub-format".to_owned(),
            "srt".to_owned(),
            "--embed-subs".to_owned(),
            "--concurrent-fragments".to_owned(),
            "8".to_owned(),
            "https://x/y".to_owned(),
        ];
        assert_eq!(
            strip_sub_flags(argv),
            vec![
                "--format",
                "best",
                "--concurrent-fragments",
                "8",
                "https://x/y",
            ]
        );
    }

    #[test]
    fn subs_retry_eligibility() {
        use crate::ytdlp::args::DownloadParams;
        let with_subs = DownloadParams {
            write_subs: Some(true),
            ..Default::default()
        };
        // Falha citando legenda + saída natural + 1ª vez → elegível.
        assert!(should_retry_without_subs(
            &with_subs,
            "unable to download video subtitles for 'en': http error 429",
            Some(1),
        ));
        // Sem citar legenda (falha do vídeo) → não.
        assert!(!should_retry_without_subs(&with_subs, "http error 429", Some(1)));
        // Kill (sem código) → não.
        assert!(!should_retry_without_subs(
            &with_subs,
            "unable to download video subtitles for 'en'",
            None,
        ));
        // Sem legendas pedidas → não.
        assert!(!should_retry_without_subs(
            &DownloadParams::default(),
            "unable to download video subtitles for 'en'",
            Some(1),
        ));
        // Segunda vez (já com fallback) → não (evita loop).
        let second = DownloadParams {
            write_subs: Some(true),
            subs_fallback: Some("x".into()),
            ..Default::default()
        };
        assert!(!should_retry_without_subs(
            &second,
            "unable to download video subtitles for 'en'",
            Some(1),
        ));
    }

    #[test]
    fn android_retry_eligibility() {
        use crate::ytdlp::args::DownloadParams;
        // 403 na mídia + saída natural + 1ª vez → elegível.
        assert!(should_retry_with_android_client(
            &DownloadParams::default(),
            "unable to download video data: http error 403: forbidden",
            Some(1),
        ));
        // Erro sem 403 (ex. 429 de legenda) → não.
        assert!(!should_retry_with_android_client(
            &DownloadParams::default(),
            "unable to download video subtitles for 'en': http error 429",
            Some(1),
        ));
        // Kill (sem código) → não.
        assert!(!should_retry_with_android_client(
            &DownloadParams::default(),
            "unable to download video data: http error 403",
            None,
        ));
        // Segunda vez (já com fallback) → não (evita loop).
        let second = DownloadParams {
            client_fallback: Some("android".into()),
            ..Default::default()
        };
        assert!(!should_retry_with_android_client(
            &second,
            "unable to download video data: http error 403",
            Some(1),
        ));
    }
}
