const fs = require('fs');
const path = require('path');

const rootDir = 'c:\\Users\\91637\\Desktop\\Business Project\\leadforge-os';
const packagesDir = path.join(rootDir, 'packages');

// Clean up old ones
const toRemove = ['ai', 'api-client', 'validations'];
for (const dir of toRemove) {
  const p = path.join(packagesDir, dir);
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
  }
}

const packages = [
  {
    name: 'types',
    deps: [],
    dirs: ['entities', 'api', 'dto', 'ipc', 'utils']
  },
  {
    name: 'shared',
    deps: ['@leadforge/types'],
    dirs: ['constants', 'helpers', 'pagination', 'response', 'guards']
  },
  {
    name: 'config',
    deps: ['@leadforge/types'],
    dirs: ['schemas', 'factories', 'utils']
  },
  {
    name: 'logger',
    deps: ['@leadforge/types', '@leadforge/config', 'pino', 'pino-pretty'],
    dirs: []
  },
  {
    name: 'validation',
    deps: ['@leadforge/types', '@leadforge/shared', 'zod'],
    dirs: ['fields', 'entities', 'dto', 'common']
  },
  {
    name: 'auth',
    deps: ['@leadforge/types', '@leadforge/config', '@leadforge/shared', 'better-auth', 'bcryptjs'],
    dirs: ['config', 'types', 'utils', 'middleware']
  },
  {
    name: 'sdk',
    deps: ['@leadforge/types', '@leadforge/validation', '@leadforge/shared', '@leadforge/config'],
    dirs: ['client', 'http', 'modules', 'errors', 'types']
  },
  {
    name: 'integrations',
    deps: ['@leadforge/types', '@leadforge/validation', '@leadforge/shared', '@leadforge/config'],
    dirs: ['common', 'adapters', 'factories']
  },
  {
    name: 'workflows',
    deps: ['@leadforge/types', '@leadforge/validation', '@leadforge/shared'],
    dirs: ['types', 'engine', 'steps', 'builders']
  },
  {
    name: 'prompts',
    deps: ['@leadforge/types'],
    dirs: ['types', 'templates', 'renderer', 'registry']
  }
];

const baseTsConfig = {
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "moduleResolution": "bundler"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
};

for (const pkg of packages) {
  const pkgDir = path.join(packagesDir, pkg.name);
  const srcDir = path.join(pkgDir, 'src');
  
  if (!fs.existsSync(pkgDir)) fs.mkdirSync(pkgDir, { recursive: true });
  if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });
  
  for (const sub of pkg.dirs) {
    fs.mkdirSync(path.join(srcDir, sub), { recursive: true });
  }
  
  // package.json
  const dependencies = {};
  for (const dep of pkg.deps) {
    if (dep.startsWith('@leadforge/')) {
      dependencies[dep] = 'workspace:*';
    } else {
      dependencies[dep] = 'latest'; // using 'latest' for now, pnpm will fix version
    }
  }
  
  const pkgJson = {
    name: `@leadforge/${pkg.name}`,
    version: '0.0.0',
    private: true,
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports: {
      ".": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      }
    },
    scripts: {
      "build": "tsc",
      "check-types": "tsc --noEmit"
    },
    dependencies
  };
  
  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
  fs.writeFileSync(path.join(pkgDir, 'tsconfig.json'), JSON.stringify(baseTsConfig, null, 2));
  fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export {};\n');
}

console.log("Scaffolding complete.");
