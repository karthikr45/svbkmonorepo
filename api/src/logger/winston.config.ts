import * as winston from 'winston';

const { combine, timestamp, colorize, printf, json } = winston.format;

const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ timestamp, level, message, context, trace }) => {
    return `[${timestamp}] [${level}]${context ? ` [${context}]` : ''} ${message}${trace ? `\n${trace}` : ''}`;
  }),
);

const fileFormat = combine(timestamp(), json());

export const winstonConfig: winston.LoggerOptions = {
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: fileFormat,
    }),
  ],
};
