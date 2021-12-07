import { getEnv } from '@watr/commonlib';
import _ from 'lodash';

import {
  Sequelize,
  Transaction,
} from 'sequelize';

import { defineTables } from './db-tables';

export interface DBConfig {
  username: string;
  password: string;
  database: string;
}

export function getDBConfig(configType: 'test' | 'production'): DBConfig | undefined {
  const database = getEnv('DBName') || configType === 'test' ? 'open_extraction_testdb' : 'open_extraction';
  const username = getEnv('DBUser') || 'watrworker';
  const password = getEnv('DBPassword') || configType === 'test' ? 'watrpasswd' : undefined;
  if (password === undefined) {
    return;
  }
  return {
    database, username, password
  };
}

export async function initSequelize(dbConfig: DBConfig): Promise<Sequelize> {
  const sequelize = new Sequelize({
    dialect: 'postgres',
    ...dbConfig,
    // logging: false, // logging: console.log,
    logging: console.log,
  });

  return sequelize
    .authenticate()
    .then(() => {
      return sequelize;
    })
    .catch((error: any) => {
      console.error('Unable to connect to the database:', error);
      throw error;
    });
}

export interface Database {
  sql: Sequelize;
  run: <R>(f: (db: Sequelize) => Promise<R>) => Promise<R>;
  runTransaction: <R>(f: (db: Sequelize, t: Transaction) => Promise<R>) => Promise<R>;
  unsafeResetDatabase: () => Promise<Database>;
  close(): Promise<void>;
}

export async function runQuery<R>(sql: Sequelize, f: (sql: Sequelize) => Promise<R>): Promise<R> {
  return f(sql)
    .catch((error) => {
      console.log('runQuery: error:', error);
      throw error;
    });
}

export async function runTransaction<R>(
  sql: Sequelize,
  f: (sql: Sequelize, t: Transaction) => Promise<R>
): Promise<R> {
  return runQuery(sql, async db => {
    const transaction = await db.transaction();
    return f(db, transaction)
      .then(async (r) => {
        // console.log('committing transaction');
        return transaction.commit().then(() => r);
      })
      .catch(async (error) => {
        return transaction.rollback().then(() => {
          // console.log('runTransaction: error:', error);
          throw error;
        });
      });
  });
}

export async function openDatabase(dbConfig: DBConfig): Promise<Database> {
  return initSequelize(dbConfig)
    .then(async _sql => {
      defineTables(_sql);

      // Create tables if they don't exist, else no-op
      const sql = await _sql.sync({ alter: true });

      const run = _.curry(runQuery)(sql);
      const runT = _.curry(runTransaction)(sql);

      const unsafeResetDatabase = async () => {
        // await sql.drop();
        await sql.dropAllSchemas({});
        return sql
          .sync({ force: true })
          .then(async () => {
            await sql.close();
            return openDatabase(dbConfig);
          });
      };
      const close = async () => {
        await sql.close();
      };

      return {
        unsafeResetDatabase,
        sql,
        run,
        runTransaction: runT,
        close,
      };
    });
}
