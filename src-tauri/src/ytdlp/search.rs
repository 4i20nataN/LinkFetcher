//! Search — replica exata de YtDlpSearch.ts (query por plataforma + 9 campos).

use tauri::AppHandle;

#[derive(serde::Deserialize, serde::Serialize)]
pub struct SearchOptions {
    pub query: String,
    pub platform: String,
    #[serde(rename = "maxResults")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_results: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy: Option<String>,
    /// Id p/ cancelamento (abort no frontend mata o yt-dlp órfão).
    #[serde(rename = "searchId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search_id: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub url: String,
    pub thumbnail: String,
    pub duration: f64,
    pub duration_string: String,
    pub view_count: u64,
    pub uploader: String,
    pub description: String,
}

fn str_field(v: &serde_json::Value, keys: &[&str]) -> String {
    keys.iter()
        .filter_map(|k| v.get(*k))
        .find_map(|f| f.as_str())
        .unwrap_or("")
        .to_owned()
}

/// `encodeURIComponent` mínimo p/ URLs diretas (sem nova dep).
fn pct_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        if b.is_ascii_alphanumeric()
            || matches!(b, b'-' | b'_' | b'.' | b'!' | b'~' | b'*' | b'\'' | b'(' | b')')
        {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// Mapeia plataforma→query de busca.
fn build_query(platform: &str, query: &str, max: u32) -> String {
    match platform {
        "youtube" => format!("ytsearch{max}:{query}"),
        "vimeo" => format!("https://vimeo.com/search?q={}", pct_encode(query)),
        "dailymotion" => format!(
            "https://www.dailymotion.com/search/{}/videos",
            pct_encode(query)
        ),
        "bilibili" => format!(
            "https://search.bilibili.com/all?keyword={}",
            pct_encode(query)
        ),
        "soundcloud" => format!("scsearch{max}:{query}"),
        _ => format!("ytsearch{max}:{query}"),
    }
}

/// Mesmos args/NDJSON/fallbacks do frontend.
#[cfg(target_os = "android")]
#[tauri::command]
pub async fn ytdlp_search(
    app: AppHandle,
    options: SearchOptions,
) -> Result<Vec<SearchResult>, String> {
    // Envelope `{results}` pois `invoke.resolve` exige `JSObject`.
    #[derive(serde::Deserialize)]
    struct SearchResponse {
        #[serde(default)]
        results: Vec<SearchResult>,
    }
    let res: SearchResponse = crate::mobile_ytdlp::call_mobile(&app, "search", &options).await?;
    Ok(res.results)
}

/// Mesmos args/NDJSON/fallbacks do frontend.
#[cfg(not(target_os = "android"))]
#[tauri::command]
pub async fn ytdlp_search(
    app: AppHandle,
    options: SearchOptions,
) -> Result<Vec<SearchResult>, String> {
    let bin = super::binary::ytdlp_path(&app)?;
    let max = options.max_results.unwrap_or(10);
    let mut args = vec![
        "--flat-playlist".into(),
        "--dump-json".into(),
        "--no-download".into(),
        // Zero resíduo fora dos downloads (paridade com probe/download).
        "--no-cache-dir".into(),
    ];
    if let Some(p) = &options.proxy {
        args.push("--proxy".into());
        args.push(p.clone());
    }
    args.extend(super::binary::js_runtime_args());
    args.push(build_query(&options.platform, &options.query, max));
    let mut cmd = tokio::process::Command::new(&bin);
    cmd.args(&args);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    let mut spawned = cmd.spawn().map_err(|e| e.to_string())?;
    // Tira os pipes antes de registrar: o waiter nunca segura o lock do
    // filho (poll com try_wait), então o kill do `ytdlp_cancel` entra na
    // hora em vez de enfileirar atrás da espera. Kill de busca nunca apaga
    // .part (cleanup=false): só interrompe o yt-dlp órfão.
    let stdout = spawned.stdout.take();
    let stderr = spawned.stderr.take();
    let registered_sid = options.search_id.clone().unwrap_or_else(|| {
        format!(
            "search-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        )
    });
    let arc = std::sync::Arc::new(tokio::sync::Mutex::new(spawned));
    crate::fs::register_cancel(registered_sid.clone(), arc.clone());
    let exit_status = loop {
        let exited = arc.lock().await.try_wait();
        let exited = match exited {
            Ok(v) => v,
            Err(e) => {
                let _ = crate::fs::unregister_cancel(&registered_sid);
                return Err(e.to_string());
            }
        };
        match exited {
            Some(st) => break st,
            // Busca plana resolve em segundos: poll de 50ms é ruído zero.
            None => tokio::time::sleep(std::time::Duration::from_millis(50)).await,
        }
    };
    let _ = crate::fs::unregister_cancel(&registered_sid);
    // Morto por sinal = cancelado pelo frontend (o abort descarta o erro).
    if exit_status.code().is_none() {
        return Err("busca cancelada".into());
    }
    let mut out_buf = Vec::new();
    if let Some(mut so) = stdout {
        use tokio::io::AsyncReadExt as _;
        let _ = so.read_to_end(&mut out_buf).await;
    }
    let mut err_buf = Vec::new();
    if let Some(mut se) = stderr {
        use tokio::io::AsyncReadExt as _;
        let _ = se.read_to_end(&mut err_buf).await;
    }
    if !exit_status.success() {
        return Err(format!(
            "Search failed: {}",
            String::from_utf8_lossy(&err_buf)
        ));
    }
    let text = String::from_utf8_lossy(&out_buf);
    let mut results = Vec::new();
    for line in text.lines().map(str::trim).filter(|l| !l.is_empty()) {
        let Ok(item) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        let thumbnail = {
            let t = str_field(&item, &["thumbnail"]);
            if !t.is_empty() {
                t
            } else {
                item.get("thumbnails")
                    .and_then(|v| v.as_array())
                    .and_then(|a| a.first())
                    .and_then(|t| t.get("url"))
                    .and_then(|u| u.as_str())
                    .unwrap_or("")
                    .to_owned()
            }
        };
        results.push(SearchResult {
            id: str_field(&item, &["id"]),
            title: {
                let t = str_field(&item, &["title"]);
                if t.is_empty() {
                    "Unknown".into()
                } else {
                    t
                }
            },
            url: str_field(&item, &["url", "webpage_url"]),
            thumbnail,
            duration: item
                .get("duration")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0),
            duration_string: {
                let d = str_field(&item, &["duration_string"]);
                if d.is_empty() {
                    "0:00".into()
                } else {
                    d
                }
            },
            view_count: item
                .get("view_count")
                .and_then(|v| v.as_u64())
                .unwrap_or(0),
            uploader: str_field(&item, &["uploader", "channel"]),
            description: str_field(&item, &["description"]),
        });
    }
    Ok(results)
}
