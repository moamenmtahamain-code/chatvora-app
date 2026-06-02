const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');

const isDev = !app.isPackaged;
const PORT = 3000;
const BACKEND_PORT = 5000;
const PING_TIMEOUT = 60000;
const PING_INTERVAL = 500;

let mainWindow = null;
let nextProcess = null;
let backendProcess = null;
let isQuitting = false;

// ─── LOADING HTML (shown while waiting for the server) ──────────────────────

const LOADING_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f0f11;
      color: #e1e1e6;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      flex-direction: column;
      gap: 24px;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #2a2a2e;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { font-size: 14px; color: #888; }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <p>Starting Chatvora...</p>
</body>
</html>`;

// ─── UTILITIES ──────────────────────────────────────────────────────────────

function pingServer(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

function waitForServer(url, timeout) {
  const start = Date.now();
  return new Promise((resolve) => {
    const poll = async () => {
      const ok = await pingServer(url);
      if (ok) return resolve(true);
      if (Date.now() - start > timeout) return resolve(false);
      setTimeout(poll, PING_INTERVAL);
    };
    poll();
  });
}

function killProcessOnPort(port) {
  try {
    const cmd = process.platform === 'win32'
      ? `netstat -ano | findstr :${port} | findstr LISTENING`
      : `lsof -ti :${port}`;
    const result = execSync(cmd, { encoding: 'utf8', timeout: 3000 });
    const pids = [...new Set(
      result.split('\n')
        .map(l => l.trim().split(/\s+/).pop())
        .filter(Boolean)
        .filter(pid => !isNaN(pid) && pid.length > 0)
    )];
    pids.forEach(pid => {
      try {
        const kill = process.platform === 'win32'
          ? `taskkill /F /PID ${pid}`
          : `kill -9 ${pid}`;
        execSync(kill, { timeout: 2000 });
      } catch (_) {}
    });
  } catch (_) {}
}

function killChildProcess(proc, label) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${proc.pid}`, { timeout: 3000 });
    } else {
      proc.kill('SIGTERM');
      setTimeout(() => { if (!proc.killed) proc.kill('SIGKILL'); }, 3000);
    }
    console.log(`[${label}] Terminated`);
  } catch (err) {
    console.error(`[${label}] Force-kill failed:`, err.message);
  }
}

// ─── SERVER SPAWNERS ────────────────────────────────────────────────────────

function startBackend() {
  if (backendProcess) return;
  const dir = isDev
    ? path.join(__dirname, '..', 'backend')
    : path.join(process.resourcesPath, 'backend');

  backendProcess = spawn('node', ['server.js'], {
    cwd: dir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(BACKEND_PORT) },
  });
  backendProcess.stdout.on('data', (d) => { const t = d.toString().trim(); if (t) console.log('[Backend]', t); });
  backendProcess.stderr.on('data', (d) => { const t = d.toString().trim(); if (t) console.error('[Backend]', t); });
  backendProcess.on('error', (err) => console.error('[Backend] Start failed:', err.message));
  backendProcess.on('exit', (code) => { console.log(`[Backend] Exited (${code})`); backendProcess = null; });
}

function startNextServer() {
  if (nextProcess) return;
  const dir = path.join(
    isDev ? path.join(__dirname, '..', 'frontend') : process.resourcesPath,
    '.next', 'standalone'
  );

  nextProcess = spawn('node', ['server.js'], {
    cwd: dir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT) },
  });
  nextProcess.stdout.on('data', (d) => { const t = d.toString().trim(); if (t) console.log('[Next]', t); });
  nextProcess.stderr.on('data', (d) => { const t = d.toString().trim(); if (t) console.error('[Next]', t); });
  nextProcess.on('error', (err) => console.error('[Next] Start failed:', err.message));
  nextProcess.on('exit', (code) => { console.log(`[Next] Exited (${code})`); nextProcess = null; });
}

// ─── WINDOW ─────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f0f11',
    icon: path.join(__dirname, '..', 'frontend', 'public', 'icons', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // If the renderer crashes, reload after 2s (but only if we have a server)
  mainWindow.webContents.on('render-process-gone', () => {
    if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => mainWindow.reload(), 2000);
    }
  });

  // Show loading HTML — this is the ONLY thing the user ever sees until the app is ready
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(LOADING_HTML)}`);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Wait for the real server, then navigate
  (async () => {
    const url = `http://127.0.0.1:${PORT}`;
    console.log(`[Electron] Waiting for ${url}...`);
    const ready = await waitForServer(url, PING_TIMEOUT);

    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (ready) {
      console.log('[Electron] Server ready, loading app...');
      mainWindow.loadURL(url);
    } else {
      console.error('[Electron] Server did not start in time.');
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(
        `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f0f11;color:#e1e1e6;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;text-align:center;padding:24px}
h1{font-size:20px;font-weight:600}
p{color:#888;max-width:360px;line-height:1.5;font-size:14px}
button{padding:10px 28px;border:none;border-radius:8px;background:#6366f1;color:white;font-size:14px;font-weight:600;cursor:pointer}
button:hover{background:#4f46e5}
</style></head><body>
<h1>Could not start</h1>
<p>Chatvora took too long to start. This usually happens when another instance is already running.</p>
<button onclick="location.reload()">Retry</button>
</body></html>`
      )}`);
    }
  })();
}

// ─── CLEANUP ────────────────────────────────────────────────────────────────

function cleanup() {
  console.log('[Electron] Cleaning up...');
  [['Backend', backendProcess], ['Next', nextProcess]].forEach(([label, proc]) => {
    killChildProcess(proc, label);
  });
  backendProcess = null;
  nextProcess = null;
}

// ─── APP LIFECYCLE ──────────────────────────────────────────────────────────

async function startApp() {
  if (!isDev) {
    killProcessOnPort(PORT);
    killProcessOnPort(BACKEND_PORT);
    startBackend();
    startNextServer();
  }
  createWindow();
}

// Prevent silent crashes — log all uncaught errors
process.on('uncaughtException', (err) => {
  console.error('[Electron] Uncaught exception:', err.message);
  if (!isQuitting) cleanup();
});

app.whenReady().then(startApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) startApp(); else mainWindow.show();
});

app.on('before-quit', () => { isQuitting = true; cleanup(); });
app.on('will-quit', () => cleanup());
