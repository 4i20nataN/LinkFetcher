const packager = require('electron-packager');
const path = require('path');
const fs = require('fs');
const { createWindowsInstaller } = require('electron-winstaller');
const pkg = require('../package.json');

async function run() {
  try {
    console.log('Packaging app with electron-packager (win32 x64)...');
    const opts = {
      dir: '.',
      out: path.join('release', 'packages'),
      platform: 'win32',
      arch: 'x64',
      overwrite: true,
      asar: false,
      prune: true,
      name: pkg.productName || pkg.name || 'LinkFetcher'
    };

    const appPaths = await packager(opts);
    console.log('Packager output:', appPaths);

    const appDir = appPaths[0];
    const exeName = (pkg.productName || pkg.name || 'LinkFetcher') + '.exe';

    // Copy to a temporary path without spaces to avoid nuget / FileStream issues
    const tmpAppDir = path.join(process.cwd(), 'release', 'tmp_app');
    if (fs.existsSync(tmpAppDir)) {
      fs.rmSync(tmpAppDir, { recursive: true, force: true });
    }

    // Remove reserved device-file names that break Windows archivers (e.g., "nul")
    const reservedNames = new Set(['nul','con','prn','aux','clock$','com1','com2','com3','com4','lpt1','lpt2','lpt3']);
    function removeReservedFiles(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          removeReservedFiles(entryPath);
        } else if (entry.isFile()) {
          if (reservedNames.has(entry.name.toLowerCase())) {
            try { fs.unlinkSync(entryPath); console.log('Removed reserved file', entryPath); } catch (e) { /* ignore */ }
          }
        }
      }
    }

    // Clean reserved files in source packaged dir before copying
    try { removeReservedFiles(appDir); } catch (e) { /* ignore */ }

    fs.cpSync(appDir, tmpAppDir, { recursive: true });
    // Also ensure reserved files removed in tmp copy
    try { removeReservedFiles(tmpAppDir); } catch (e) { /* ignore */ }

    console.log('Creating portable ZIP of packaged app...');
    const zipOut = path.join(process.cwd(), 'release', `${pkg.productName || pkg.name}-win32-x64.zip`);
    // Ensure release dir exists
    fs.mkdirSync(path.dirname(zipOut), { recursive: true });
    try {
      // Use Powershell Compress-Archive on Windows
      const { execSync } = require('child_process');
      const psCmd = `powershell -NoProfile -Command "Compress-Archive -Force -Path '${tmpAppDir}\\*' -DestinationPath '${zipOut}'"`;
      execSync(psCmd, { stdio: 'inherit' });
      console.log('Portable ZIP created at', zipOut);
    } catch (zipErr) {
      console.warn('Failed to create ZIP portable package:', zipErr);
    }

    // Try to create installer, but don't fail the whole process if it errors
    try {
      console.log('Attempting to create installer with electron-winstaller (using temp path)...');
      await createWindowsInstaller({
        appDirectory: tmpAppDir,
        outputDirectory: path.join('release', 'installer'),
        authors: pkg.author && pkg.author.name ? pkg.author.name : 'LinkFetcher',
        exe: exeName,
        setupExe: `${pkg.productName || pkg.name}-Setup.exe`,
        noMsi: true
      });
      console.log('Installer created at', path.join('release', 'installer'));
    } catch (installerErr) {
      console.warn('Installer creation failed (non-fatal). Check logs to retry manually:', installerErr);
    }
  } catch (err) {
    console.error('Packaging failed:', err);
    process.exit(1);
  }
}

run();
