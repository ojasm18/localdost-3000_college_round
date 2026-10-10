const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

console.log('Building PATCHWORK Unified Stack for Vercel...');

// 1. Install & Build Dashboard
console.log('[1/4] Preparing & Building Dashboard...');
if (!fs.existsSync(path.join(root, 'dashboard', 'node_modules'))) {
  console.log('Installing dashboard dependencies...');
  execSync('npm install', { cwd: path.join(root, 'dashboard'), stdio: 'inherit' });
}
execSync('npm run build', { cwd: path.join(root, 'dashboard'), stdio: 'inherit' });

// 2. Install & Build Demo Site with base /demo/
console.log('[2/4] Preparing & Building MediCare+ Demo Site...');
if (!fs.existsSync(path.join(root, 'demo-site', 'node_modules'))) {
  console.log('Installing demo-site dependencies...');
  execSync('npm install', { cwd: path.join(root, 'demo-site'), stdio: 'inherit' });
}
execSync('npm run build', {
  cwd: path.join(root, 'demo-site'),
  stdio: 'inherit',
  env: { ...process.env, VITE_BASE: '/demo/' }
});

// 3. Assemble dist directory
console.log('[3/4] Assembling unified dist folder...');
if (fs.existsSync(dist)) {
  fs.rmSync(dist, { recursive: true, force: true });
}
fs.mkdirSync(dist, { recursive: true });

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy dashboard/dist to root of dist
copyDir(path.join(root, 'dashboard', 'dist'), dist);

// Copy demo-site/dist to dist/demo
copyDir(path.join(root, 'demo-site', 'dist'), path.join(dist, 'demo'));

// 4. Ensure runtime is present at dist/runtime and dist/demo/runtime
const runtimeSrc = path.join(root, 'runtime', 'src');
if (fs.existsSync(runtimeSrc)) {
  copyDir(runtimeSrc, path.join(dist, 'runtime'));
  copyDir(runtimeSrc, path.join(dist, 'demo', 'runtime'));
}

console.log('✓ Unified distribution build completed at dist/');
