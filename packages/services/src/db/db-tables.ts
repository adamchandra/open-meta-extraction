import { AlphaRecord } from '@watr/commonlib';
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

export type NoteRecordStatus = 'hasAbstract' | 'noAbstract';


export class NoteRecord extends Model {
  declare id: number;
  declare note_id: string;
  declare url: string;
  declare status: string;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  public static setup(sequelize: Sequelize) {
    NoteRecord.init({
      id: primaryKey(),
      note_id: requiredString(), // uniqKey 1
      url: requiredString(), // uniqKey 2
      status: requiredString(),
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
  public static async upsertRec(rec: AlphaRecord, status: NoteRecordStatus) {
    const [newEntry, isNew] = await NoteRecord.findOrCreate({
      where: {
        note_id: rec.noteId,
        url: rec.url,
        status
      },
      defaults: {
        note_id: rec.noteId,
        url: rec.url,
        status
      },
    });
    const plainNewEntry = newEntry.get({ plain: true });
    return plainNewEntry;
  }
}

export class UrlChain extends Model {
  declare request_url: string; // Primary Key
  declare response_url: string; // Nullable
  declare status_code: string; // http:2/4/5xx, spider:new, etc.
  declare status_message: string; // any error/info messages

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

export function defineTables(sql: Sequelize): void {
  UrlChain.setup(sql);
  NoteRecord.setup(sql);
}
