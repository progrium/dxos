//
// Copyright 2022 DXOS.org
//

import { LogConfig, LogLevel, LogOptions } from './config';
import { LogContext, LogProcessor } from './context';
import { CallMetadata } from './meta';
import { getConfig, DEFAULT_PROCESSORS } from './options';

/**
 * Logging function.
 */
type LogFunction = (message: string, context?: LogContext, meta?: CallMetadata) => void;

/**
 * Logging methods.
 */
interface LogMethods {
  trace: LogFunction;
  debug: LogFunction;
  info: LogFunction;
  warn: LogFunction;
  error: LogFunction;
  catch: (error: Error | any, context?: LogContext, meta?: CallMetadata) => void;
  break: () => void;
}

/**
 * Properties accessible on the logging function.
 */
interface Log extends LogMethods, LogFunction {
  config: (options: LogOptions) => void;
  addProcessor: (processor: LogProcessor) => void;
  runtimeConfig: LogConfig;
}

interface LogImp extends Log {
  _config: LogConfig;
}

const createLog = (): LogImp => {
  const log: LogImp = ((...params) => processLog(LogLevel.DEBUG, ...params)) as LogImp;

  log._config = getConfig();
  Object.defineProperty(log, 'runtimeConfig', { get: () => log._config });

  log.addProcessor = (processor: LogProcessor) => {
    if (DEFAULT_PROCESSORS.filter((p) => p === processor).length === 0) {
      DEFAULT_PROCESSORS.push(processor);
    }
    if (log._config.processors.filter((p) => p === processor).length === 0) {
      log._config.processors.push(processor);
    }
  };

  // Set config.
  log.config = (options: LogOptions) => {
    log._config = getConfig(options);
  };

  // TODO(burdon): API to set context and separate error object.
  //  E.g., log.warn('failed', { key: 123 }, err);

  log.trace = (...params) => processLog(LogLevel.TRACE, ...params);
  log.debug = (...params) => processLog(LogLevel.DEBUG, ...params);
  log.info = (...params) => processLog(LogLevel.INFO, ...params);
  log.warn = (...params) => processLog(LogLevel.WARN, ...params);
  log.error = (...params) => processLog(LogLevel.ERROR, ...params);

  // Catch only shows error message, not stacktrace.
  log.catch = (error: Error | any, context, meta) => processLog(LogLevel.ERROR, error.stack, context, meta);

  // Show break.
  log.break = () => log.info('——————————————————————————————————————————————————');

  /**
   * Process the current log call.
   */
  const processLog = (
    level: LogLevel,
    message: string,
    context: LogContext = {},
    meta?: CallMetadata,
    error?: Error,
  ) => {
    log._config.processors.forEach((processor) => processor(log._config, { level, message, context, meta, error }));
  };

  return log;
};

/**
 * Global logging function.
 */
export const log: Log = ((globalThis as any).dx_log ??= createLog());

/**
 * Accessible from browser console.
 */
declare global {
  // eslint-disable-next-line camelcase
  const dx_log: Log;
}
