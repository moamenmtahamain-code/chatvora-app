/**
 * Chatvora Cleanup Script
 * Run from root:  node electron/cleanup.js
 * Or:             npm run cleanup
 *
 * Kills any orphaned Node.js processes holding ports 3000 or 5000.
 */
const { execSync } = require('child_process');

const PORTS = [3000, 5000];
const isWin = process.platform === 'win32';

function cleanup() {
  console.log('=== Chatvora Process Cleanup ===\n');

  for (const port of PORTS) {
    try {
      const cmd = isWin
        ? `netstat -ano | findstr :${port} | findstr LISTENING`
        : `lsof -ti :${port}`;

      const result = execSync(cmd, { encoding: 'utf8', timeout: 5000 });
      const pids = [
        ...new Set(
          result
            .split('\n')
            .map((l) => l.trim().split(/\s+/).pop())
            .filter(Boolean)
            .filter((p) => !isNaN(p) && p.length > 0)
        ),
      ];

      if (pids.length === 0) {
        console.log(`Port ${port}: No processes found`);
        continue;
      }

      for (const pid of pids) {
        try {
          const killCmd = isWin ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`;
          execSync(killCmd, { timeout: 3000 });
          console.log(`Port ${port}: Killed PID ${pid}`);
        } catch (e) {
          console.log(`Port ${port}: Failed to kill PID ${pid}: ${e.message}`);
        }
      }
    } catch (e) {
      console.log(`Port ${port}: No processes found`);
    }
  }

  // Also kill any orphaned Electron processes
  if (isWin) {
    try {
      const result = execSync(
        'tasklist /FI "IMAGENAME eq electron.exe" /FO CSV /NH',
        { encoding: 'utf8', timeout: 3000 }
      );
      const lines = result.trim().split('\n').filter(Boolean);
      if (lines.length > 0) {
        console.log(`\nFound ${lines.length} Electron process(es)`);
        execSync('taskkill /F /IM electron.exe', { timeout: 3000 });
        console.log('Killed all Electron processes');
      }
    } catch (_) {}
  }

  console.log('\n=== Cleanup complete ===');
}

cleanup();
