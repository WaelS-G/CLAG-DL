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

  // Standalone web package.json for dist/web with Node web server support
  const webPkg = {
    name: 'clag-downloader-web',
    version: '1.0.0',
    type: 'module',
    main: 'server.js',
    scripts: {
      start: 'node server.js',
      build: 'echo Production web bundle ready',
    },
    dependencies: {
      cors: '^2.8.5',
      express: '^4.21.2',
    },
  };
  fs.writeFileSync(path.join(webDir, 'package.json'), JSON.stringify(webPkg, null, 2));

  // Copy or create standalone server.js for Render / Node Web Service hosting
  const serverCode = `import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const routeHandler = (modulePath) => async (req, res) => {
  try {
    const mod = await import(modulePath);
    const handler = mod.default || mod;
    return handler(req, res);
  } catch (err) {
    console.error('Error handling ' + req.path + ':', err);
    res.status(500).json({ error: err.message });
  }
};

app.all('/api/probe', routeHandler('./api/probe.js'));
app.all('/api/resolve', routeHandler('./api/resolve.js'));
app.all('/api/downloads', routeHandler('./api/downloads.js'));
app.all('/api/settings', routeHandler('./api/settings.js'));
app.all('/api/stream', routeHandler('./api/stream.js'));
app.all('/api/batch/parse', routeHandler('./api/batch/parse.js'));
app.all('/api/system/open', routeHandler('./api/system/open.js'));

app.use(express.static(__dirname));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('CLAG Downloader Web Engine running on port ' + PORT);
});
`;
  fs.writeFileSync(path.join(webDir, 'server.js'), serverCode);

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
