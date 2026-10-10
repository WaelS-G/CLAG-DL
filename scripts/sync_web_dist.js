import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const mainDist = path.join(rootDir, 'dist');
const clientDir = path.join(rootDir, 'dist', 'client');
const webDir = path.join(rootDir, 'dist', 'web');
const apiDir = path.join(rootDir, 'api');
const targetApiDir = path.join(webDir, 'api');

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  for (const element of fs.readdirSync(from)) {
    // Avoid recursive copying of subdirectories
    if (element === 'client' || element === 'web' || element === 'server' || element === 'exe' || element === 'extension') {
      continue;
    }
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    if (fs.lstatSync(fromPath).isDirectory()) {
      copyFolderSync(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  }
}

// Find whichever dist folder has index.html
const sourceDist = [mainDist, clientDir, webDir].find(d => fs.existsSync(path.join(d, 'index.html')));

if (sourceDist) {
  console.log(`[Web Dist Sync] Populating dist/client and dist/web from ${sourceDist}...`);
  if (sourceDist !== clientDir) copyFolderSync(sourceDist, clientDir);
  if (sourceDist !== webDir) copyFolderSync(sourceDist, webDir);

  // Copy serverless api directory to dist/web so both root and dist/web deployments have api routes
  if (fs.existsSync(apiDir)) {
    console.log('[Web Dist Sync] Mirroring api/ serverless functions to dist/web/api...');
    copyFolderSync(apiDir, targetApiDir);
  }

  // Create tailored vercel.json for dist/web deployment
  const webVercelConfig = {
    version: 2,
    cleanUrls: true,
    rewrites: [
      {
        source: '/((?!api/).*)',
        destination: '/index.html'
      }
    ]
  };
  fs.writeFileSync(path.join(webDir, 'vercel.json'), JSON.stringify(webVercelConfig, null, 2));

  // Standalone web package.json for dist/web
  const webPkg = {
    name: 'clag-downloader-web',
    version: '1.0.0',
    type: 'module',
    scripts: {
      build: 'echo Production static bundle and serverless API ready',
    },
  };
  fs.writeFileSync(path.join(webDir, 'package.json'), JSON.stringify(webPkg, null, 2));

  // Also ensure extension zip is copied to dist folders
  const extZip = path.join(rootDir, 'public', 'clag-downloader-extension.zip');
  if (fs.existsSync(extZip)) {
    if (fs.existsSync(clientDir)) fs.copyFileSync(extZip, path.join(clientDir, 'clag-downloader-extension.zip'));
    if (fs.existsSync(webDir)) fs.copyFileSync(extZip, path.join(webDir, 'clag-downloader-extension.zip'));
  }
  console.log(`[Web Dist Sync] Successfully synchronized all dist folders.`);
} else {
  console.log('[Web Dist Sync] Note: No built index.html found yet. Skipping sync.');
}
