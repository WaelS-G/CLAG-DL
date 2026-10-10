import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const extDir = path.join(rootDir, 'extension');
const outDir = path.join(rootDir, 'dist', 'extension');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const zipPath = path.join(outDir, 'clag-downloader-extension.zip');
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

console.log('[Extension Packager] Creating extension bundle...');
try {
  // Use PowerShell Compress-Archive on Windows
  execSync(`powershell -Command "Compress-Archive -Path '${extDir}\\*' -DestinationPath '${zipPath}' -Force"`, {
    stdio: 'inherit',
  });
  console.log(`[Extension Packager] Extension successfully packaged to:\n  ${zipPath}`);

  // Copy to public/ for static serving in dev & web builds
  const publicZip = path.join(rootDir, 'public', 'clag-downloader-extension.zip');
  fs.copyFileSync(zipPath, publicZip);
  console.log(`[Extension Packager] Mirrored to public:\n  ${publicZip}`);

  // Also mirror directly to dist/client and dist/web if they exist
  const clientZip = path.join(rootDir, 'dist', 'client', 'clag-downloader-extension.zip');
  if (fs.existsSync(path.join(rootDir, 'dist', 'client'))) {
    fs.copyFileSync(zipPath, clientZip);
  }
  const webZip = path.join(rootDir, 'dist', 'web', 'clag-downloader-extension.zip');
  if (fs.existsSync(path.join(rootDir, 'dist', 'web'))) {
    fs.copyFileSync(zipPath, webZip);
  }
} catch (e) {
  console.error('[Extension Packager] Packaging failed:', e);
}
