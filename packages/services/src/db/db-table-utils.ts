import _ from 'lodash';

import {
  DataTypes,
} from 'sequelize';

export const primaryKey = () => _.clone({
  type: DataTypes.INTEGER,
  primaryKey: true,
  autoIncrement: true
});

export const primaryKeyString = () => _.clone({
  type: DataTypes.STRING,
  allowNull: false,
  primaryKey: true,
  unique: true
});

// defaultValue = ''
export const uniqString = () => _.clone({
  type: DataTypes.STRING,
  length: 512,
  allowNull: false,
  unique: true
});

export const requiredString = () => _.clone({
  type: DataTypes.STRING,
  allowNull: false,
  length: 512,
  unique: false
});

export const requiredNumber = () => _.clone({
  type: DataTypes.NUMBER,
  allowNull: false,
  unique: false
});

export const optionalString = () => _.clone({
  type: DataTypes.STRING,
  length: 512,
  allowNull: true,
  unique: false
});

export const optionalText = () => _.clone({
  type: DataTypes.TEXT,
  allowNull: true,
  unique: false
});
