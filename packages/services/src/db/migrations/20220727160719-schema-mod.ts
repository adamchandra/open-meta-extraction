import { Db } from 'mongodb';

export async function up(db: Db) {
  console.log(`up: ${db.databaseName}`);
  db.collection('url_status').updateMany({}, { $set: { hasPdfLink: false } });
}

export async function down(db: Db) {
  console.log(`down: ${db.databaseName}`);
  db.collection('url_status').updateMany({}, { $unset: { hasPdfLink: '' } });
}
