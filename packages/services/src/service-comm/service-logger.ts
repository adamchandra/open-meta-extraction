
import winston, {
  createLogger,
  transports,
  format,
} from 'winston';


export function getServiceLogger(label: string): winston.Logger {

  const envLogLevel = process.env['service-comm.loglevel'];
  const logLevel = envLogLevel || 'info';
  const cli = winston.config.cli;
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

