//! Probe — replica exata de YtDlpProbe.ts (args + NDJSON parse).

use std::path::Path;
use tauri::AppHandle;

#[derive(serde::Deserialize, serde::Serialize)]
pub struct ProbeOptions {
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy: Option<String>,
}

/// Probe no Android via yt-dlp embarcado.
/// O Python pode travar em rede (DNS/extrator): sem deadline o `await` do
/// bridge fica pendurado e a UI em "Analisando…" para sempre.
#[cfg(target_os = "android")]
#[tauri::command]
pub async fn ytdlp_probe(
    app: AppHandle,
    options: ProbeOptions,
) -> Result<serde_json::Value, String> {
    tokio::time::timeout(
        std::time::Duration::from_secs(120),
        crate::mobile_ytdlp::call_mobile(&app, "probe", &options),
    )
    .await
    .map_err(|_| "probe: tempo esgotado (120s) — verifique a conexão".to_string())?
}

async fn run_capture(bin: &Path, args: &[String]) -> Result<Vec<u8>, String> {
    let mut cmd = tokio::process::Command::new(bin);
    cmd.args(args);
    cmd.kill_on_drop(true);
    crate::proc::hide_console(&mut cmd);
    // Deadline: sem ele, um probe travado em rede segura o comando para sempre
    // e não está no mapa de cancelamento (nada o liberta).
    let out = tokio::time::timeout(std::time::Duration::from_secs(180), cmd.output())
        .await
        .map_err(|_| "probe: tempo esgotado (180s) — verifique a conexão".to_string())?
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).into_owned());
    }
    Ok(out.stdout)
}

fn common_auth(args: &mut Vec<String>, proxy: &Option<String>) {
    if let Some(p) = proxy {
        args.push("--proxy".into());
        args.push(p.clone());
    }
}

/// Args do probe simples; a URL vem sempre depois do `--` para que um campo
/// XSS'd (`--load-info-json=…`) não seja lido como opção do yt-dlp.
pub fn probe_args(url: &str, proxy: &Option<String>, js_args: &[String]) -> Vec<String> {
    let mut args = vec![
        "--dump-json".into(),
        "--no-download".into(),
        "--no-playlist".into(),
        // Rede parada ≠ espera infinita (paridade com o Android).
        "--socket-timeout".into(),
        "30".into(),
    ];
    common_auth(&mut args, proxy);
    args.extend(js_args.iter().cloned());
    args.push("--".into());
    args.push(url.to_owned());
    args
}

/// Args do probe de playlist; mesma regra do `--` antes da URL.
pub fn playlist_probe_args(url: &str, proxy: &Option<String>, js_args: &[String]) -> Vec<String> {
    let mut args = vec![
        "--flat-playlist".into(),
        "--dump-json".into(),
        "--no-download".into(),
        "--ignore-errors".into(),
        "--socket-timeout".into(),
        "30".into(),
    ];
    common_auth(&mut args, proxy);
    args.extend(js_args.iter().cloned());
    args.push("--".into());
    args.push(url.to_owned());
    args
}

/// Retorna o JSON bruto; `--no-playlist` mantém paridade com o Android.
#[cfg(not(target_os = "android"))]
#[tauri::command]
pub async fn ytdlp_probe(
    app: AppHandle,
    options: ProbeOptions,
) -> Result<serde_json::Value, String> {
    let bin = super::binary::ytdlp_path(&app)?;
    let args = probe_args(&options.url, &options.proxy, &super::binary::js_runtime_args());
    let stdout = run_capture(&bin, &args).await?;
    serde_json::from_slice(&stdout).map_err(|e| format!("probe: JSON inválido: {e}"))
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct PlaylistResult {
    pub entries: Vec<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub playlist_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

/// Playlist no Android via Kotlin, mesmo formato.
#[cfg(target_os = "android")]
#[tauri::command]
pub async fn ytdlp_probe_playlist(
    app: AppHandle,
    options: ProbeOptions,
) -> Result<PlaylistResult, String> {
    tokio::time::timeout(
        std::time::Duration::from_secs(120),
        crate::mobile_ytdlp::call_mobile(&app, "probePlaylist", &options),
    )
    .await
    .map_err(|_| "playlist: tempo esgotado (120s) — verifique a conexão".to_string())?
}

/// Parse das linhas NDJSON do `--flat-playlist`.
/// Linha `_type == "url"` (redirect de `watch?v=X&list=Y`) é um vídeo:
/// entra como item, nunca como cabeçalho — mesmo com `playlist_count: null`.
/// Só cabeçalho real (`_type == "playlist"` ou contagem inteira) dá título/contagem.
pub fn parse_playlist_ndjson(text: &str) -> PlaylistResult {
    let mut entries = Vec::new();
    let mut count: Option<u64> = None;
    let mut title: Option<String> = None;
    for line in text.lines().map(str::trim).filter(|l| !l.is_empty()) {
        let Ok(obj) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        let typ = obj.get("_type").and_then(|v| v.as_str());
        if typ == Some("url") {
            entries.push(obj);
            continue;
        }
        let is_playlist = typ == Some("playlist")
            || obj.get("playlist_count").and_then(|v| v.as_u64()).is_some();
        if is_playlist {
            if count.is_none() {
                count = obj.get("playlist_count").and_then(|v| v.as_u64());
            }
            if title.is_none() {
                title = obj
                    .get("title")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_owned());
            }
        } else {
            entries.push(obj);
        }
    }
    if count.is_none() && !entries.is_empty() {
        count = Some(entries.len() as u64);
    }
    if title.is_none() {
        title = entries
            .first()
            .and_then(|e| e.get("playlist"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_owned());
    }
    PlaylistResult {
        entries,
        playlist_count: count,
        title,
    }
}

/// Playlist em NDJSON (linha playlist tem `_type == "playlist"` ou `playlist_count`).
#[cfg(not(target_os = "android"))]
#[tauri::command]
pub async fn ytdlp_probe_playlist(
    app: AppHandle,
    options: ProbeOptions,
) -> Result<PlaylistResult, String> {
    let bin = super::binary::ytdlp_path(&app)?;
    let args = playlist_probe_args(&options.url, &options.proxy, &super::binary::js_runtime_args());
    let stdout = run_capture(&bin, &args).await?;
    Ok(parse_playlist_ndjson(&String::from_utf8_lossy(&stdout)))
}

#[cfg(test)]
mod playlist_parse_tests {
    use super::parse_playlist_ndjson;
    use serde_json::json;

    fn line(v: &serde_json::Value) -> String {
        serde_json::to_string(v).unwrap()
    }

    #[test]
    fn url_redirect_com_count_null_vira_item() {
        // watch?v=X&list=Y morto: só o redirect (playlist_count: null).
        // Regressão: vinha como header → título do vídeo + 0 itens.
        let text = line(&json!({
            "_type": "url", "ie_key": "Youtube", "id": "abc",
            "title": "Meu Vídeo", "url": "https://www.youtube.com/watch?v=abc",
            "playlist_count": null, "playlist_index": 1,
        }));
        let r = parse_playlist_ndjson(&text);
        assert_eq!(r.entries.len(), 1);
        assert_eq!(r.playlist_count, Some(1));
        assert!(r.title.is_none());
    }

    #[test]
    fn url_redirect_com_count_inteira_vira_item() {
        // Mix/redirect válido: a 1ª linha é o próprio vídeo com a contagem
        // da playlist junto — continua valendo como item, não header.
        let text = [
            line(&json!({
                "_type": "url", "ie_key": "Youtube", "id": "abc",
                "title": "Meu Vídeo", "url": "https://www.youtube.com/watch?v=abc",
                "playlist": "Mix - X", "playlist_count": 50, "playlist_index": 1,
            })),
            line(&json!({ "_type": "url", "id": "d", "title": "D", "url": "u-d" })),
        ]
        .join("\n");
        let r = parse_playlist_ndjson(&text);
        assert_eq!(r.entries.len(), 2);
        assert_eq!(r.title.as_deref(), Some("Mix - X"));
    }

    #[test]
    fn header_real_define_titulo_e_contagem() {
        let text = [
            line(&json!({
                "_type": "playlist", "title": "Minha Playlist",
                "playlist_count": 2,
            })),
            line(&json!({ "_type": "url", "id": "a", "title": "A", "url": "u-a" })),
            line(&json!({ "id": "b", "title": "B", "webpage_url": "u-b" })),
        ]
        .join("\n");
        let r = parse_playlist_ndjson(&text);
        assert_eq!(r.entries.len(), 2);
        assert_eq!(r.playlist_count, Some(2));
        assert_eq!(r.title.as_deref(), Some("Minha Playlist"));
    }
}

#[cfg(test)]
mod args_security_tests {
    use super::{playlist_probe_args, probe_args};

    #[test]
    fn url_maliciosa_apos_separador_nao_vira_opcao() {
        // Regressão de segurança: URL/flag injetada deve ser posição, não opção.
        let evil = "--load-info-json=/etc/passwd";
        let a = probe_args(evil, &None, &[]);
        let sep = a.iter().position(|x| x == "--").expect("faltou o separador --");
        assert_eq!(a.last().map(String::as_str), Some(evil));
        assert_eq!(sep, a.len() - 2);

        let p = playlist_probe_args(evil, &Some("http://127.0.0.1:8080".into()), &["--js-run".into()]);
        let sep = p.iter().position(|x| x == "--").expect("faltou o separador --");
        assert_eq!(p.last().map(String::as_str), Some(evil));
        // Opções legítimas (proxy, js) vêm antes do separador; nada depois além da URL.
        assert!(p[..sep].contains(&"--proxy".to_string()));
        assert!(p[..sep].contains(&"--js-run".to_string()));
    }
}
