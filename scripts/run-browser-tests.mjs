import { spawnSync } from 'node:child_process';
const run = (args, env = process.env) => {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run(['node_modules/typescript/bin/tsc']);
run(['node_modules/vite/bin/vite.js', 'build', '--outDir', 'dist-e2e'], { ...process.env, VITE_E2E: '1' });
run(['node_modules/@playwright/test/cli.js', 'test']);
