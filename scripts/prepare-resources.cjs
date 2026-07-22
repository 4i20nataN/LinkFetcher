const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return false;
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(s, d);
    } else if (entry.isFile()) {
      try { fs.copyFileSync(s, d); } catch (e) { console.warn('copy failed', s, e); }
    }
  }
  return true;
}

const projectRoot = process.cwd();
const sourceDir = path.join(projectRoot, 'yt-dlp');
const targetDir = path.join(projectRoot, 'electron', 'resources');

console.log('prepare-resources: copying from', sourceDir, 'to', targetDir);

if (!fs.existsSync(sourceDir)) {
  console.log('prepare-resources: source yt-dlp folder not found, skipping');
  process.exit(0);
}

ensureDir(targetDir);
copyRecursive(sourceDir, targetDir);
console.log('prepare-resources: done');
