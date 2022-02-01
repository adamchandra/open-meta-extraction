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

  let logLevel = getLogEnvLevel();
  const level = logLevel || 'debug';

  const logger = createLogger({
    level,
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

  if (logLevel === undefined) {
    logger.warn('log level could not be deduced from env variables, setting to debug');
  }

  return logger;
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
