import { Database, DBConfig, openDatabase } from './database';


export async function createEmptyDB(
  dbConfig: DBConfig,
): Promise<Database> {
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

