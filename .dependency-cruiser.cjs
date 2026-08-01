/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies are strictly forbidden.',
      from: {},
      to: { circular: true }
    },
    {
      name: 'no-electron-in-packages',
      severity: 'error',
      comment: 'Packages under packages/ must never import Electron modules directly.',
      from: { path: '^packages/' },
      to: { path: '^electron$' }
    },
    {
      name: 'ai-boundaries',
      severity: 'error',
      comment: 'packages/ai must not import from agent-core, agent-runtime, workflow-engine, or desktop.',
      from: { path: '^packages/ai/' },
      to: {
        path: '^(packages/agent-core|packages/agent-runtime|packages/workflow-engine|apps/desktop)/'
      }
    },
    {
      name: 'agent-core-boundaries',
      severity: 'error',
      comment: 'packages/agent-core must remain pure and not depend on packages/ai, agent-runtime, workflow-engine, or apps.',
      from: { path: '^packages/agent-core/' },
      to: {
        path: '^(packages/ai|packages/agent-runtime|packages/workflow-engine|apps/)/'
      }
    },
    {
      name: 'no-db-drivers-in-packages',
      severity: 'error',
      comment: 'Native database drivers (better-sqlite3, mongoose, mongodb) are forbidden outside concrete database modules or apps.',
      from: { path: '^packages/' },
      to: { path: '^(better-sqlite3|mongoose|mongodb)$' }
    }
  ],
  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    exclude: '(/dist/|/out/|/node_modules/|\\.test\\.ts$|\\.spec\\.ts$)',
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json'
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default']
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+'
      },
      archi: {
        collapsePattern: '^(node_modules|packages|apps)/[^/]+'
      }
    }
  }
};
