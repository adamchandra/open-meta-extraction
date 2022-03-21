import { Database, DBConfig, openDatabase } from './database';
import fs from 'fs-extra';


export async function createEmptyDB(
  dbConfig: DBConfig,
): Promise<Database> {
  if (fs.existsSync(dbConfig.dbFile)) {
    fs.rmSync(dbConfig.dbFile)
    return openDatabase(dbConfig);
  }
  const db = await openDatabase(dbConfig);
  const freshDB = await db.unsafeResetDatabase();
  return freshDB;
}

export async function useEmptyDatabase(
  dbConfig: DBConfig,
  f: (db: Database) => Promise<void>
): Promise<void> {
  const db = await createEmptyDB(dbConfig);
  return f(db).then(() => db.close());
}

