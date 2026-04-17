import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DIST_DIR = 'dist';

async function fixVercelDeployment() {
  console.log('🚀 Preparing Vercel "Silent Skip" for gh-pages branch...');

  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ dist directory not found. Run npm run build first.');
    process.exit(1);
  }

  // 1. Inject vercel.json into dist
  const vercelConfig = {
    buildCommand: null,
    installCommand: "echo 'Deployment handled by GitHub Actions/gh-pages. Skipping build.'",
    outputDirectory: ".",
    cleanUrls: true,
    framework: null
  };

  fs.writeFileSync(
    path.join(DIST_DIR, 'vercel.json'),
    JSON.stringify(vercelConfig, null, 2)
  );
  console.log('✅ Injected vercel.json into dist/');

  // 2. Inject minimal package.json into dist to satisfy Vercel detection
  const pkgConfig = {
    name: "rsa-portal-static",
    version: "1.0.0",
    private: true,
    scripts: {
      "build": "echo 'Static assets already built' && exit 0"
    }
  };

  fs.writeFileSync(
    path.join(DIST_DIR, 'package.json'),
    JSON.stringify(pkgConfig, null, 2)
  );
  console.log('✅ Injected package.json into dist/');

  console.log('✨ dist/ is now ready for Vercel-safe deployment.');
}

fixVercelDeployment().catch(err => {
  console.error('❌ Error during deployment fix:', err);
  process.exit(1);
});
