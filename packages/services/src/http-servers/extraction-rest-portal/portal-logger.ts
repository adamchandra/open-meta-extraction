import {
  createLogger,
  format,
  transports,
  Logger,
} from 'winston';

import * as winston from 'winston';

export function createAppLogger(): Logger {
  const envLogLevel = process.env['rest-portal.loglevel'];
  const logLevel = envLogLevel || 'info';
  const { cli } = winston.config;
  return createLogger({
    level: logLevel,
    levels: cli.levels,
    transports: [
      new transports.Console({
        format: format.combine(
          format.colorize(),
          format.label({ label: 'RestPortal', message: true }),
          format.simple(),
        ),
      })
    ],
  });
}
