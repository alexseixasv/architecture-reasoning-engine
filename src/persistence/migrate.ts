import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import { createDb, closeDb, getDatabaseUrl } from './db';

export async function runMigrations(
  connectionString = getDatabaseUrl(),
): Promise<void> {
  const db = createDb(connectionString);
  const migrationsFolder = path.join(__dirname, '..', '..', 'drizzle');
  await migrate(db, { migrationsFolder });
}

async function main(): Promise<void> {
  await runMigrations();
  await closeDb();
  process.stdout.write(`${JSON.stringify({ msg: 'migrations_applied' })}\n`);
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
}
