//! Helpers de processo multiplataforma.

/// No Windows, impede que processos filhos de console (yt-dlp/ffmpeg) abram
/// uma janela de "prompt preto" a cada spawn. O app roda com
/// `windows_subsystem = "windows"` (sem console próprio), mas sem esta flag o
/// Windows cria um console novo para cada filho de console — no boot (checagem
/// de versão) e a cada análise/download. No-op nas demais plataformas.
#[cfg(target_os = "windows")]
pub fn hide_console(cmd: &mut tokio::process::Command) {
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(target_os = "windows"))]
#[inline]
pub fn hide_console(_cmd: &mut tokio::process::Command) {}
