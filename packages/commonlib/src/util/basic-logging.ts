import {
  createLogger,
  transports,
  format,
  Logger,
  config,
} from 'winston';

const { cli } = config;

export function getLogEnvLevel(): string {
  const envLogLevel = process.env['service-comm.loglevel'];
  const envLevel = envLogLevel;

  switch (envLevel) {
    case "error":
    case "warn":
    case "info":
    case "http":
    case "verbose":
    case "debug":
    case "silly":
      return envLevel;
  }
  return undefined;
}

export function getServiceLogger(label: string): Logger {
  const { cli } = config;

  let logLevel = getLogEnvLevel() || 'debug';

  return createLogger({
    level: logLevel,
    levels: cli.levels,
    transports: [
      new transports.Console({
        format: format.combine(
          format.colorize(),
          format.label({ label, message: true }),
          format.simple(),
        ),
      })
    ],
  });
}

export function getBasicConsoleLogger(level: string = 'info'): Logger {
  const console = new transports.Console({
    format: format.combine(
      format.colorize(),
      format.simple(),
    ),
    level
  });

  const logger = createLogger({
    levels: cli.levels,
    transports: [console],
  });
  return logger;
}


// export function getBasicLogger(
//   workingDirectory: string,
//   logfileName: string,
//   loglevel: string = 'info',
// ): Logger {
//   const rootLoggingPath = path.resolve(workingDirectory);

//   const console = new transports.Console({
//     format: format.combine(
//       format.colorize(),
//       format.simple(),
//     ),
//     level: loglevel
//   });

//   const logger = createLogger({
//     levels: cli.levels,
//     transports: [
//       console,
//       new transports.File({
//         filename: logfileName,
//         level: 'silly',
//         format: format.combine(
//           format.timestamp(),
//           format.json()
//         ),
//         dirname: rootLoggingPath,
//         tailable: true,
//       })
//     ],
//   });
//   return logger;
// }
