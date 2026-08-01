import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const newVersion = process.argv[2];
if (!newVersion) {
  console.error('Error: Please provide a version to bump to (e.g., pnpm bump-version 0.1.0-beta.2)');
  process.exit(1);
}

// Ensure the version format matches semver or prerelease semver (e.g., 0.1.0, 0.1.0-beta.2)
if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(newVersion)) {
  console.error(`Error: Invalid version format: "${newVersion}". Must match x.y.z or x.y.z-tag.w`);
  process.exit(1);
}

function updatePackageJson(filePath) {
  if (!fs.existsSync(filePath)) return;
  try {
    const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    pkg.version = newVersion;
    fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log(`Updated: ${path.relative(rootDir, filePath)} -> ${newVersion}`);
  } catch (err) {
    console.error(`Failed to update ${filePath}:`, err.message);
  }
}

// 1. Root package.json
updatePackageJson(path.join(rootDir, 'package.json'));

// 2. Apps package.json files
updatePackageJson(path.join(rootDir, 'apps/desktop/package.json'));
updatePackageJson(path.join(rootDir, 'apps/api/package.json'));

// 3. Packages package.json files
const packagesDir = path.join(rootDir, 'packages');
if (fs.existsSync(packagesDir)) {
  const pkgs = fs.readdirSync(packagesDir);
  for (const pkgName of pkgs) {
    const pkgPath = path.join(packagesDir, pkgName, 'package.json');
    if (fs.existsSync(pkgPath)) {
      updatePackageJson(pkgPath);
    }
  }
}

console.log(`\nSuccessfully bumped all workspace versions to: ${newVersion}! 🎉`);
