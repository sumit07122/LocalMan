import path from 'path';
import fs from 'fs';
import EmbeddedPostgres from 'embedded-postgres';

const DB_DIR = path.resolve(process.cwd(), '.local-postgres-data');

export async function startLocalPostgres(): Promise<EmbeddedPostgres> {
  const isFirstTime = !fs.existsSync(DB_DIR);

  // Clean stale lockfile if previous instance crashed
  const pidFile = path.join(DB_DIR, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    try {
      fs.unlinkSync(pidFile);
    } catch {}
  }

  console.log('🐘 Initializing local PostgreSQL engine...');
  const pg = new (EmbeddedPostgres as any)({
    databaseDir: DB_DIR,
    port: 5432,
    user: 'localman_user',
    password: 'localman_secure_dev_password_2026',
    authMethod: 'password',
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  if (isFirstTime) {
    console.log('📦 Setting up fresh PostgreSQL data cluster in .local-postgres-data...');
    await pg.initialise();
  }

  console.log('🚀 Starting PostgreSQL service on port 5432...');
  await pg.start();

  try {
    // Ensure localman_db exists
    await pg.createDatabase('localman_db');
    console.log('✅ Database "localman_db" ready.');
  } catch (err: any) {
    if (err?.message?.includes('already exists') || err?.code === '42P04') {
      console.log('✅ Database "localman_db" already exists.');
    } else {
      console.warn('Note on database creation:', err?.message || err);
    }
  }

  console.log('🎉 Local PostgreSQL is ONLINE at localhost:5432 (localman_db)');
  return pg;
}

// When executed directly via node/tsx
const isMain = process.argv[1] && process.argv[1].includes('start-local-db');
if (isMain) {
  (async () => {
    try {
      const pg = await startLocalPostgres();
      console.log('Press Ctrl+C to stop PostgreSQL service.');

      const cleanup = async () => {
        console.log('\n🛑 Stopping local PostgreSQL...');
        await pg.stop();
        console.log('✅ Local PostgreSQL stopped.');
        process.exit(0);
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);

      // Keep event loop alive
      setInterval(() => {}, 1000 * 60 * 60);
    } catch (err) {
      console.error('Fatal error starting local Postgres:', err);
      process.exit(1);
    }
  })();
}
