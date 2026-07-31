const fs = require('fs');
const path = require('path');

// Remove local tsconfig.tsbuildinfo relative to current package directory
try {
  fs.rmSync(path.join(process.cwd(), 'tsconfig.tsbuildinfo'), { force: true });
} catch (e) {
  // Silent fallback
}
