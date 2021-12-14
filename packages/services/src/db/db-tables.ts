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
