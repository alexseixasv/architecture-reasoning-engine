import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type AppDatabase = PostgresJsDatabase<typeof schema>;

let client: ReturnType<typeof postgres> | undefined;
let db: AppDatabase | undefined;

export function getDatabaseUrl(): string {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }
  return url;
}

export function createDb(connectionString = getDatabaseUrl()): AppDatabase {
  client = postgres(connectionString, { max: 10 });
  db = drizzle(client, { schema });
  return db;
}

export function getDb(): AppDatabase {
  if (!db) {
    return createDb();
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.end({ timeout: 5 });
    client = undefined;
    db = undefined;
  }
}
