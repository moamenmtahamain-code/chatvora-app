/**
 * Chatvora Production Build Script
 * 
 * Usage:
 *   node build.js              → Build Electron .exe (bundled backend)
 *   node build.js --web        → Build for web deployment (external backend)
 *   node build.js --clean      → Clean all build artifacts first
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const isWeb = args.includes('--web');
const isClean = args.includes('--clean');

const ROOT = __dirname;
const FRONTEND = path.join(ROOT, 'frontend');
const BACKEND = path.join(ROOT, 'backend');

console.log('═══════════════════════════════════════════');
console.log('  Chatvora Production Build');
console.log(`  Mode: ${isWeb ? 'Web Deployment' : 'Electron Desktop (.exe)'}`);
console.log('═══════════════════════════════════════════\n');

// ─── STEP 1: Clean ──────────────────────────────────────────────────────────
if (isClean) {
  console.log('🧹 Cleaning build artifacts...');
  const dirsToClean = [
    path.join(FRONTEND, '.next'),
    path.join(ROOT, 'release')
  ];
  dirsToClean.forEach(dir => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`   Removed: ${path.relative(ROOT, dir)}`);
    }
  });
  console.log('');
}

// ─── STEP 2: Install dependencies ──────────────────────────────────────────
console.log('📦 Checking dependencies...');
try {
  execSync('npm ci --prefix frontend', { stdio: 'inherit', cwd: ROOT });
  execSync('npm ci --prefix backend', { stdio: 'inherit', cwd: ROOT });
} catch (e) {
  console.log('   npm ci failed, trying npm install...');
  execSync('npm install --prefix frontend', { stdio: 'inherit', cwd: ROOT });
  execSync('npm install --prefix backend', { stdio: 'inherit', cwd: ROOT });
}
console.log('');

// ─── STEP 3: Build Next.js ─────────────────────────────────────────────────
console.log('🔨 Building Next.js frontend...');
execSync('npm run build', { stdio: 'inherit', cwd: FRONTEND });
console.log('');

// ─── STEP 4: Copy static files for standalone ──────────────────────────────
console.log('📁 Copying static files to standalone output...');
const standaloneDir = path.join(FRONTEND, '.next', 'standalone');
const staticDir = path.join(FRONTEND, '.next', 'static');
const publicDir = path.join(FRONTEND, 'public');

// Copy .next/static to standalone/.next/static
const standaloneStaticDir = path.join(standaloneDir, '.next', 'static');
if (fs.existsSync(staticDir)) {
  fs.cpSync(staticDir, standaloneStaticDir, { recursive: true });
  console.log('   ✓ Copied .next/static');
}

// Copy public to standalone/public
const standalonePublicDir = path.join(standaloneDir, 'public');
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, standalonePublicDir, { recursive: true });
  console.log('   ✓ Copied public/');
}

// Fix server.js in standalone to listen on 0.0.0.0 and configurable port
const standaloneServer = path.join(standaloneDir, 'server.js');
if (fs.existsSync(standaloneServer)) {
  let content = fs.readFileSync(standaloneServer, 'utf8');
  // Ensure it listens on 0.0.0.0 and port from env
  if (!content.includes('0.0.0.0')) {
    content = content.replace(
      /server\.listen\(/g,
      'server.listen(process.env.PORT || 3000, "0.0.0.0", '
    );
    fs.writeFileSync(standaloneServer, content);
    console.log('   ✓ Fixed standalone server.js host binding');
  }
}
console.log('');

// ─── STEP 5: Build Electron or prepare web ─────────────────────────────────
if (isWeb) {
  console.log('🌐 Web deployment mode:');
  console.log('');
  console.log('   Frontend is built in: frontend/.next/standalone/');
  console.log('   Backend is in: backend/');
  console.log('');
  console.log('   To deploy on Render.com:');
  console.log('   1. Push backend/ to a Render Web Service');
  console.log('   2. Set NEXT_PUBLIC_API_URL in frontend/.env.production');
  console.log('   3. Push frontend/.next/standalone/ as a static site or use Vercel');
  console.log('');
  console.log('✅ Web build complete!');
} else {
  console.log('🖥️  Building Electron .exe installer...');
  console.log('   This may take a few minutes...\n');
  
  try {
    execSync('npx electron-builder build --win', { stdio: 'inherit', cwd: ROOT });
    console.log('\n✅ Electron build complete!');
    console.log(`   Output: ${path.join(ROOT, 'release')}`);
    
    // List output files
    const releaseDir = path.join(ROOT, 'release');
    if (fs.existsSync(releaseDir)) {
      const files = findFiles(releaseDir, '.exe');
      if (files.length > 0) {
        console.log('\n   Installer(s):');
        files.forEach(f => {
          const size = (fs.statSync(f).size / 1024 / 1024).toFixed(1);
          console.log(`   📦 ${path.relative(ROOT, f)} (${size} MB)`);
        });
      }
    }
  } catch (e) {
    console.error('\n❌ Electron build failed!');
    console.error('   Make sure electron-builder is installed: npm install');
    process.exit(1);
  }
}

function findFiles(dir, ext) {
  let results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(findFiles(fullPath, ext));
    } else if (item.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}