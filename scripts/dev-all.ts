import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { startLocalPostgres } from './start-local-db.js';

async function main() {
  console.log('================================================================');
  console.log('🚀 LocalMan Marketplace - Complete Local Development Stack');
  console.log('================================================================');

  const rootDir = process.cwd();

  // 1. Start Local PostgreSQL Database
  console.log('[DB] 🐘 Initializing & verifying PostgreSQL database...');
  const pg = await startLocalPostgres();
  console.log('[DB] ✅ Database running and healthy on localhost:5432');

  const processes: ChildProcess[] = [];

  function spawnPrefixed(name: string, command: string, args: string[], cwd: string): ChildProcess {
    const isWin = process.platform === 'win32';
    // On Windows run via cmd.exe /c to resolve npm / npx properly without PowerShell restriction errors
    const child = isWin
      ? spawn('cmd.exe', ['/c', command, ...args], {
          cwd,
          stdio: ['inherit', 'pipe', 'pipe'],
          env: { ...process.env, FORCE_COLOR: '1' },
        })
      : spawn(command, args, {
          cwd,
          stdio: ['inherit', 'pipe', 'pipe'],
          env: { ...process.env, FORCE_COLOR: '1' },
        });

    child.stdout?.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.trim().length > 0) {
          console.log(`[${name}] ${line}`);
        }
      }
    });

    child.stderr?.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.trim().length > 0) {
          console.error(`[${name}] ${line}`);
        }
      }
    });

    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.warn(`[${name}] Exited with code ${code}`);
      }
    });

    processes.push(child);
    return child;
  }

  // 2. Start API Backend Service
  console.log('[API] ⚡ Starting Fastify API backend service on http://localhost:4000...');
  spawnPrefixed('API', 'npx', ['tsx', 'watch', 'src/server.ts'], path.join(rootDir, 'apps/api'));

  // 3. Start Admin Web Frontend
  console.log('[ADMIN] 🖥️ Starting Vite Admin Web portal on http://localhost:3000...');
  spawnPrefixed('ADMIN', 'npm', ['run', 'dev', '--workspace=@localman/admin-web'], rootDir);

  console.log('================================================================');
  console.log('✨ All development services launched successfully!');
  console.log('   • Database:  localhost:5432 (localman_db)');
  console.log('   • API:       http://localhost:4000/api/v1/health');
  console.log('   • Admin Web: http://localhost:3000');
  console.log('   Press Ctrl+C at any time to cleanly stop all services.');
  console.log('================================================================');

  const shutdown = async () => {
    console.log('\n🛑 Gracefully shutting down LocalMan development stack...');
    for (const proc of processes) {
      try {
        proc.kill();
      } catch {}
    }
    try {
      await pg.stop();
      console.log('[DB] ✅ PostgreSQL stopped cleanly.');
    } catch (e: any) {
      console.warn('[DB] Note on PostgreSQL shutdown:', e?.message || e);
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep event loop alive
  setInterval(() => {}, 1000 * 60 * 60);
}

main().catch((err) => {
  console.error('❌ Fatal error in dev:all:', err);
  process.exit(1);
});
