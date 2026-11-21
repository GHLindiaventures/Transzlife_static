import fs from 'node:fs';
import path from 'node:path';

// If hosting providers (such as Render) have their publish directory configured as
// "frontend/dist" instead of "dist", mirror dist/ into frontend/dist so the deployment succeeds.
const distDir = path.resolve('dist');
const targetDir = path.resolve('frontend', 'dist');

if (fs.existsSync(distDir)) {
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(distDir, targetDir, { recursive: true });
  console.log('✓ Mirrored build artifacts to frontend/dist');
}
