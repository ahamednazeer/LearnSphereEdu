import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@shared/schema';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

// Parse DATABASE_URL to handle file:// URLs
function parseDatabaseUrl(url: string): string {
  if (url.startsWith('file:')) {
    return url.replace('file:', '');
  }
  return url;
}

const dbFile = parseDatabaseUrl(process.env.DATABASE_URL || './db.sqlite');

// Ensure the directory exists
const dbDir = dirname(dbFile);
try {
  mkdirSync(dbDir, { recursive: true });
} catch (error) {
  // Directory might already exist, ignore error
}

const sqlite = new Database(dbFile);
export const db = drizzle(sqlite, { schema });