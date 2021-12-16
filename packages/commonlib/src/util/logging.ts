import _ from 'lodash';
import path from 'path';

import {
  createLogger,
  format,
  config,
  transports,
  Logger,
} from 'winston';

import * as winston from 'winston';

const { combine, timestamp, prettyPrint } = format;
const { cli } = config;

export type TransportType = 'file' | 'console';


export function createConsoleLogger(): Logger {
  return createLogger({
    level: 'info',
    format: combine(timestamp(), prettyPrint()),
    transports: [
      new transports.Console(),
    ],
  });
}

export function setLogLabel(log: Logger, label: string) {
  // setLogLabels(log, label);
  log.format = format.combine(
    format.label({ label, message: true })
  );
}

// export function setLogLabels(log: Logger, label: string) {
//   _.each(
//     log.transports, t => {
//       // console.log('setting transport', t);
//       t.format = format.label({ label, message: true })
//     }
//   );
// }
export function setLogLevel(log: Logger, transportType: TransportType, level: string) {
  _.each(
    log.transports, t => {
      const setLevel = ((transportType === 'file') && (t instanceof transports.File))
        || ((transportType === 'console') && (t instanceof transports.Console))
      ;

      if (setLevel) {
        t.level = level;
      }
    }
  );
}

export function consoleTransport(level: string): transports.ConsoleTransportInstance {
  return new transports.Console({
    format: format.combine(
      format.colorize(),
      format.simple(),
    ),
    level
  });
}

export function newLogger(...transports: winston.transport[]): Logger {
  return createLogger({
    levels: cli.levels,
    transports,
  });
}

export function fileTransport(dirname: string, filename: string, level: string): transports.FileTransportInstance {
  return new transports.File({
    filename,
    level,
    format: format.combine(
      format.timestamp(),
      format.json()
    ),
    dirname,
    tailable: true,
  });
}

export function getLogger(
  logfilePath: string,
  consoleLogLevel: string = 'info',
): Logger {
  const rootLoggingPath = path.dirname(logfilePath);
  const logfile = path.basename(logfilePath);

  const consoleTransport = new transports.Console({
    format: format.combine(
      format.colorize(),
      format.simple(),
    ),
    level: consoleLogLevel
  });

  const fileTransport = new transports.File({
    filename: logfile,
    level: 'silly',
    format: format.combine(
      format.timestamp(),
      format.json()
    ),
    dirname: rootLoggingPath,
    tailable: true,
  });


  const logger = createLogger({
    levels: config.cli.levels,
    transports: [
      consoleTransport,
      fileTransport
    ],
  });
  return logger;
}

export function getConsoleAndFileLogger(
  logfilePath: string,
  consoleLogLevel: string = 'info',
): Logger {
  const rootLoggingPath = path.dirname(logfilePath);
  const logfile = path.basename(logfilePath);

  const consoleTransport = new transports.Console({
    format: format.combine(
      format.colorize(),
      format.simple(),
    ),
    level: consoleLogLevel
  });

  const fileTransport = new transports.File({
    filename: logfile,
    level: 'silly',
    format: format.combine(
      format.timestamp(),
      format.json()
    ),
    dirname: rootLoggingPath,
    tailable: true,
  });


  const logger = createLogger({
    levels: config.cli.levels,
    transports: [
      consoleTransport,
      fileTransport
    ],
  });
  return logger;
}
