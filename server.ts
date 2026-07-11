import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { createServer as createViteServer } from "vite";
import { ensureYtDlp, spawnDownload, probeUrl, searchVideos } from "./src/core/ytdlp/YtDlpManager.js";

// ─── Temp download directory ────────────────────────────────────────────
const TEMP_DOWNLOAD_DIR = path.join(os.tmpdir(), 'linkfetcher_downloads');
if (!fs.existsSync(TEMP_DOWNLOAD_DIR)) {
  fs.mkdirSync(TEMP_DOWNLOAD_DIR, { recursive: true });
}

// ─── Active downloads map (id -> cancel function) ───────────────────────
const activeDownloads = new Map<string, () => void>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ─── HEALTHCHECK ────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, platform: process.platform, arch: process.arch });
  });

  // ─── PROBE URL ────────────────────────────────────────────────────────
  app.post('/api/probe', async (req, res) => {
    try {
      const { url, cookies, cookiesFromBrowser, proxy } = req.body;

      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      const metadata = await probeUrl({
        url,
        cookies,
        cookiesFromBrowser,
        proxy
      });

      res.json(metadata);
    } catch (error: any) {
      console.error('Probe error:', error);
      res.status(500).json({ error: error.message || 'Probe failed' });
    }
  });

  // ─── SEARCH VIDEOS ───────────────────────────────────────────────────
  app.post('/api/search', async (req, res) => {
    try {
      const { query, platform, maxResults, cookies, proxy } = req.body;

      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }

      const results = await searchVideos({
        query,
        platform: platform || 'youtube',
        maxResults: maxResults || 10,
        cookies,
        proxy
      });

      res.json(results);
    } catch (error: any) {
      console.error('Search error:', error);
      res.status(500).json({ error: error.message || 'Search failed' });
    }
  });

  // ─── YT-DLP STATUS ─────────────────────────────────────────────────────
  // Check if yt-dlp binary is ready (for the UI to display install status)
  app.get("/api/ytdlp/status", (_req, res) => {
    const binaryPath = path.join(process.cwd(), '.cache',
      process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
    const ready = fs.existsSync(binaryPath);
    res.json({ ready, binaryPath });
  });

  // ─── YT-DLP ENSURE (Setup endpoint) ────────────────────────────────────
  // Called once to trigger binary download. Uses SSE to stream progress.
  app.get("/api/ytdlp/ensure", async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (data: object) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      await ensureYtDlp((msg) => {
        send({ type: 'progress', message: msg });
      });
      send({ type: 'ready', message: 'yt-dlp instalado e pronto!' });
    } catch (err: any) {
      send({ type: 'error', message: err.message || String(err) });
    } finally {
      res.end();
    }
  });

  // ─── REAL DOWNLOAD VIA YT-DLP (SSE streaming progress) ─────────────────
  /**
   * POST /api/download/start
   * Body: { id, url, format, qualityLabel, isAudio, title }
   * Returns SSE stream: { type: 'progress'|'complete'|'error', ...data }
   */
  app.get("/api/download/start", async (req, res) => {
    const {
      id,
      url,
      quality,
      isAudio,
      title
    } = req.query as Record<string, string>;

    if (!id || !url) {
      return res.status(400).json({ error: 'Missing required params: id, url' });
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (data: object) => {
      try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { /* disconnected */ }
    };

    // Build yt-dlp format string
    let formatStr: string;
    if (isAudio === 'true') {
      // Best audio, convert to mp3
      formatStr = 'bestaudio[ext=m4a]/bestaudio';
    } else {
      const h = quality || '1080';
      // Try exact height first, fall back to best available
      formatStr = `bestvideo[height<=${h}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${h}]+bestaudio/best[height<=${h}]/best`;
    }

    const cleanTitle = (title || 'video').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').substring(0, 100);
    const ext = isAudio === 'true' ? 'mp3' : 'mp4';
    const outputTemplate = path.join(TEMP_DOWNLOAD_DIR, `${id}_${cleanTitle}.%(ext)s`);

    send({ type: 'started', message: 'Iniciando yt-dlp...' });

    try {
      // Ensure binary is available first
      await ensureYtDlp((msg) => send({ type: 'setup', message: msg }));
    } catch (err: any) {
      send({ type: 'error', message: `Falha ao preparar yt-dlp: ${err.message}` });
      return res.end();
    }

    const cancelFn = spawnDownload({
      url: decodeURIComponent(url),
      format: formatStr,
      outputTemplate,
      onProgress: ({ percent, speed, eta }) => {
        send({ type: 'progress', percent, speed, eta });
      },
      onComplete: (filePath) => {
        // Store file path for serving
        const fileId = `${id}_done`;
        activeDownloads.delete(id);

        // Schedule cleanup after 5 minutes
        setTimeout(() => {
          try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          } catch {}
        }, 5 * 60 * 1000);

        send({
          type: 'complete',
          downloadUrl: `/api/download/file?path=${encodeURIComponent(filePath)}&filename=${encodeURIComponent(`${cleanTitle}.${ext}`)}`,
          filePath,
          filename: `${cleanTitle}.${ext}`
        });
        res.end();
      },
      onError: (errMsg) => {
        activeDownloads.delete(id);
        send({ type: 'error', message: errMsg });
        res.end();
      }
    });

    activeDownloads.set(id, cancelFn);

    // Handle client disconnect
    req.on('close', () => {
      console.log(`[Download] Client disconnected for id=${id}`);
      // Don't cancel - let it finish so next reconnect can serve the file
    });
  });

  // ─── CANCEL DOWNLOAD ─────────────────────────────────────────────────
  app.post("/api/download/cancel", (req, res) => {
    const { id } = req.body;
    const cancel = activeDownloads.get(id);
    if (cancel) {
      cancel();
      activeDownloads.delete(id);
    }
    res.json({ ok: true });
  });

  // ─── SERVE COMPLETED FILE ─────────────────────────────────────────────
  app.get("/api/download/file", (req, res) => {
    const { path: filePath, filename } = req.query as Record<string, string>;
    if (!filePath) return res.status(400).send('Missing path');

    const resolved = path.resolve(filePath);
    // Security: only allow files in our temp dir
    if (!resolved.startsWith(TEMP_DOWNLOAD_DIR)) {
      return res.status(403).send('Access denied');
    }

    if (!fs.existsSync(resolved)) {
      return res.status(404).send('File not found or already cleaned up');
    }

    const cleanName = filename || path.basename(resolved);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(cleanName)}`);
    res.sendFile(resolved);
  });

  // ─── LEGACY COBALT PROXY (kept as secondary fallback) ────────────────
  app.post("/api/cobalt", async (req, res) => {
    const cobaltEndpoints = [
      'https://cobalt.api.ryor.sh',
      'https://cobalt-api.kwiateque.pl',
      'https://cobalt.soundgasm.net',
      'https://co.wuk.sh'
    ];

    const { url, videoQuality, downloadMode, isAudioOnly, audioFormat, filenameStyle } = req.body;
    const mappedBody = {
      url,
      videoQuality: videoQuality || '1080',
      audioFormat: audioFormat || 'mp3',
      downloadMode: downloadMode || (isAudioOnly ? 'audio' : 'auto'),
      filenameStyle: filenameStyle || 'pretty'
    };

    for (const endpoint of cobaltEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: JSON.stringify(mappedBody),
          signal: AbortSignal.timeout(8000)
        });

        if (response.ok) {
          const data = await response.json();
          return res.json(data);
        }
      } catch (err: any) {
        console.warn(`[Cobalt Fallback] ${endpoint} failed:`, err.message);
      }
    }

    res.status(502).json({ error: 'All Cobalt fallback endpoints failed' });
  });

  // ─── PROXY DOWNLOAD (legacy file proxy) ──────────────────────────────
  app.get("/api/proxy-download", async (req, res) => {
    const { url, filename } = req.query;
    if (!url) return res.status(400).send('URL parameter is required');

    const targetUrl = decodeURIComponent(url as string);

    try {
      const response = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        return res.redirect(targetUrl);
      }

      const contentType = response.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      const cleanName = filename ? (filename as string) : 'download';
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(cleanName)}`);

      const reader = response.body?.getReader();
      if (!reader) {
        const buf = await response.arrayBuffer();
        return res.send(Buffer.from(buf));
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch (err: any) {
      try { res.redirect(targetUrl); } catch { res.status(500).send('Proxy error'); }
    }
  });

  // ─── VITE MIDDLEWARE (dev) / STATIC (prod) ────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    console.log("🚀 Modo DESENVOLVIMENTO com Vite...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("🚀 Modo PRODUÇÃO...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n✅ Servidor rodando em http://localhost:${PORT}`);
    console.log(`📁 Downloads temporários: ${TEMP_DOWNLOAD_DIR}`);
    console.log(`🔧 Verificando yt-dlp...\n`);

    // Pre-warm: download yt-dlp in background at startup
    ensureYtDlp((msg) => console.log(msg)).catch(err => {
      console.warn('[yt-dlp] Falha no pré-download:', err.message);
      console.warn('[yt-dlp] Será baixado automaticamente no primeiro uso.');
    });
  });
}

startServer().catch((err) => {
  console.error("❌ Falha ao iniciar servidor:", err);
});
