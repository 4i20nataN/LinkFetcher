const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
const cancelMap = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 1000,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    }
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    const htmlPath = path.join(__dirname, '..', 'index.html');
    mainWindow.loadFile(htmlPath);
  }
}

function resolveYtDlpPath() {
  const candidates = [
    process.env.YTDLP_PATH || '',
    path.join(process.resourcesPath || process.cwd(), 'resources', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'),
    path.join(process.resourcesPath || process.cwd(), process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'),
    path.join(app.getAppPath(), 'yt-dlp', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'),
    path.join(app.getAppPath(), process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'),
    path.join(process.cwd(), 'yt-dlp', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
  ];
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || '';
}

function resolveFfmpegPath() {
  const candidates = [
    process.env.FFMPEG_PATH || '',
    path.join(process.resourcesPath || process.cwd(), 'resources', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
    path.join(process.resourcesPath || process.cwd(), process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
    path.join(app.getAppPath(), 'yt-dlp', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
    path.join(app.getAppPath(), process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
    path.join(process.cwd(), 'yt-dlp', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  ];
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || '';
}

ipcMain.handle('shell:openPath', async (_event, targetPath) => shell.openPath(targetPath));
ipcMain.handle('shell:openExternal', async (_event, url) => shell.openExternal(url));

ipcMain.handle('yt-dlp-probe', async (_event, args) => {
  const { probeUrl } = await import('../src/core/ytdlp/YtDlpManager.ts');
  process.env.YTDLP_PATH = resolveYtDlpPath();
  process.env.FFMPEG_PATH = resolveFfmpegPath();
  return probeUrl(args);
});

ipcMain.handle('yt-dlp-search', async (_event, args) => {
  const { searchVideos } = await import('../src/core/ytdlp/YtDlpManager.ts');
  process.env.YTDLP_PATH = resolveYtDlpPath();
  process.env.FFMPEG_PATH = resolveFfmpegPath();
  return searchVideos(args);
});

ipcMain.handle('yt-dlp-status', async () => {
  const { getBinaryPath } = await import('../src/core/ytdlp/YtDlpManager.ts');
  const binaryPath = getBinaryPath();
  const ready = fs.existsSync(binaryPath);
  return { ready, binaryPath };
});

ipcMain.handle('yt-dlp-download', async (_event, params) => {
  const { spawnDownload } = await import('../src/core/ytdlp/YtDlpManager.ts');
  process.env.YTDLP_PATH = resolveYtDlpPath();
  process.env.FFMPEG_PATH = resolveFfmpegPath();

  const outputDir = params.outputDir || require('electron').app.getPath('downloads');

  const promise = new Promise((resolve, reject) => {
    const child = spawnDownload({
      url: params.url,
      outputDir,
      format: params.format,
      audioOnly: params.audioOnly,
      audioFormat: params.audioFormat,
      audioQuality: params.audioQuality,
      writeSubs: params.writeSubs,
      writeAutoSubs: params.writeAutoSubs,
      subLangs: params.subLangs,
      subFormat: params.subFormat,
      embedSubs: params.embedSubs,
      writeThumbnail: params.writeThumbnail,
      embedThumbnail: params.embedThumbnail,
      embedMetadata: params.embedMetadata,
      mergeOutputFormat: params.mergeOutputFormat,
      restrictFilenames: params.restrictFilenames,
      concurrentFragments: params.concurrentFragments,
      retries: params.retries,
      bandLimit: params.bandLimit,
      noOverwrites: params.noOverwrites,
      keepVideo: params.keepVideo,
      videoOnly: params.videoOnly,
      downloadSections: params.downloadSections,
      sponsorblockRemove: params.sponsorblockRemove,
      fpsMax: params.fpsMax,
      onProgress: (data) => {
        mainWindow?.webContents.send('yt-dlp-progress', { id: params.id, type: 'progress', ...data });
      },
      onComplete: (filePath) => {
        mainWindow?.webContents.send('yt-dlp-progress', { id: params.id, type: 'complete', filePath });
        resolve({ ok: true, filePath });
      },
      onError: (error) => {
        mainWindow?.webContents.send('yt-dlp-progress', { id: params.id, type: 'error', message: error });
        reject(new Error(error));
      },
    });

    if (typeof child === 'function') {
      cancelMap.set(params.id, child);
    }
  });

  const cleanup = () => { cancelMap.delete(params.id); };
  promise.finally(cleanup);
  return promise;
});

ipcMain.handle('yt-dlp-cancel', async (_event, id) => {
  try {
    const fn = cancelMap.get(id);
    if (fn) {
      fn();
      cancelMap.delete(id);
      return { ok: true };
    }
    return { ok: false, error: 'No active download' };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
