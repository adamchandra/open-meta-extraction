import _ from 'lodash';

import {
  Model,
  Sequelize,
} from 'sequelize';

import {
  optionalString,
  optionalText,
  primaryKey,
  primaryKeyString,
  requiredNumber,
  requiredString
} from './db-table-utils';

export class AlphaRecord extends Model {
  public id!: number;
  public note_id!: string;
  public url!: string;
  public dblp_key!: string;
  public author_id!: string;
  public title!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public static setup(sequelize: Sequelize) {
    AlphaRecord.init({
      id: primaryKey(),
      note_id: requiredString(), // uniqKey 1
      url: requiredString(), // uniqKey 2
      dblp_key: optionalString(),
      author_id: optionalString(),
      title: optionalText(),
    }, {
      sequelize,
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['note_id', 'url']
        }
      ]
    });
  }
}

export class UrlChain extends Model {
  public request_url!: string; // Primary Key
  public response_url?: string; // Nullable
  public status_code!: string; // http:2/4/5xx, spider:new, etc.
  public status_message?: string; // any error/info messages

  public static setup(sequelize: Sequelize) {
    UrlChain.init({
      request_url: primaryKeyString(),
      response_url: optionalString(),
      status_code: requiredString(),
      status_message: optionalText(),
    }, {
      sequelize,
      timestamps: true
    });
  }
}

export class ExtractedField extends Model {
  public id!: number;
  public alphaRecordId!: number;
  public name!: string; // abstract, title, pdfLink, etc..
  public value!: string;


  public static setup(sequelize: Sequelize) {
    ExtractedField.init({
      id: primaryKey(),
      alpha_record_id: requiredNumber(),
      name: requiredString(),
      value: requiredString(),
    }, {
      sequelize,
      timestamps: true
    });
  }
}


export function defineTables(sql: Sequelize): void {
  UrlChain.setup(sql);
  AlphaRecord.setup(sql);
}

/*

|  trait CorpusLockingApi {
|
|    def createLock(docId: Int@@DocumentID, lockPath: String@@CorpusPath): Int@@LockID
|    def deleteLock(lockId: Int@@LockID): Unit
|    def getLocks(): Seq[Int@@LockID]
|
|    def getLockRecord(lockId: Int@@LockID): Option[R.CorpusLock]
|
|    def getDocumentLocks(docId: Int@@DocumentID): Seq[Int@@LockID]
|    def getUserLocks(userId: Int@@UserID): Seq[Int@@LockID]
|
|    def acquireLock(userId: Int@@UserID, lockPath: String@@CorpusPath): Option[Int@@LockID]
|    def releaseLock(lockId: Int@@LockID): Unit
|
|  }
|  case class CorpusLock(
|    id         : Int@@LockID,
|    holder     : Option[Int@@UserID],
|    document   : Int@@DocumentID,
|    lockPath   : String@@CorpusPath,
|    status     : String@@StatusCode
|  )
|  StatusCode("OnHold")
|  StatusCode("Active")
|  StatusCode("Complete")
|  StatusCode("Available")
|  StatusCode("Locked")
|  StatusCode("Completed")


| object corpusLockApi extends CorpusLockingApi {
|
|     def createLock(docId: Int@@DocumentID, lockPath: String@@CorpusPath): Int@@LockID = runq {
|       sql"""
|            INSERT INTO corpuslock (holder, document, lockPath, status)
|            SELECT NULL, ${docId}, text2ltree($lockPath), ${CorpusLockStatus.Available}
|       """.update.withUniqueGeneratedKeys[Int@@LockID]("corpuslock")
|     }
|
|     def deleteLock(lockId: Int@@LockID): Unit = runq {
|       sql"""
|            DELETE FROM corpuslock WHERE corpuslock = ${lockId};
|       """.update.run
|     }
|
|     def getLocks(): Seq[Int@@LockID] = runq {
|       sql"""
|           SELECT corpuslock FROM corpuslock;
|       """.query[Int@@LockID].to[Vector]
|     }
|
|
|     def getLockRecord(lockId: Int@@LockID): Option[R.CorpusLock] = {
|       // println(s"getLockRecord ${lockId}")
|
|       runq {
|         sql"""
|           SELECT corpuslock, holder, document, lockPath, status
|           FROM corpuslock
|           WHERE corpuslock=${lockId.unwrap};
|       """.query[Rel.CorpusLock].option
|       }
|     }
|
|     def getDocumentLocks(docId: Int@@DocumentID): Seq[Int@@LockID] = runq {
|       sql"""
|           SELECT corpuslock FROM corpuslock WHERE document=${docId}
|       """.query[Int@@LockID].to[Vector]
|     }
|
|
|     def getUserLocks(userId: Int@@UserID): Seq[Int@@LockID] = runq {
|       sql"""
|           SELECT corpuslock FROM corpuslock WHERE holder=${userId}
|       """.query[Int@@LockID].to[Vector]
|     }
|
|     def acquireLock(userId: Int@@UserID, lockPath: String@@CorpusPath): Option[Int@@LockID] = runq {
|       sql"""
|           WITH priorLockedDocs AS (
|             SELECT document FROM corpuslock WHERE holder=${userId} AND lockPath=text2ltree( ${lockPath} )
|           ),
|           heldLocks AS (
|             SELECT corpuslock FROM corpuslock
|             WHERE   holder=${userId}
|               AND   status=${CorpusLockStatus.Locked}
|           ),
|           nextAvailable AS (
|             SELECT corpuslock FROM corpuslock
|             WHERE   lockPath=text2ltree( ${lockPath} )
|               AND   status=${CorpusLockStatus.Available}
|               AND   document NOT IN (SELECT * FROM priorLockedDocs)
|               AND   (SELECT count(*) FROM heldLocks) = 0
|             LIMIT 1
|             FOR UPDATE
|           )
|           UPDATE corpuslock cl
|           SET status=${CorpusLockStatus.Locked}, holder=${userId}
|           FROM nextAvailable
|           WHERE  nextAvailable.corpuslock = cl.corpuslock
|           RETURNING cl.corpuslock
|       """.query[Int@@LockID].option
|     }
|
|   def releaseLock(lockId: Int@@LockID): Unit = runq {
|     sql"""
|       UPDATE corpuslock SET status=${CorpusLockStatus.Completed}
|       WHERE   corpuslock=${lockId}
|     """.update.run
|   }

 */
