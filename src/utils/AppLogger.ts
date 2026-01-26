import SettingsStore from '@/store/SettingsStore';

export type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

export interface AppLogEntry {
  time: string;
  level: LogLevel;
  context: string;
  message: string;
  args?: any[];
}

/**
 * AppLogger - Singleton that wraps console methods to capture application logs
 */
export class AppLogger {
  private static instance: AppLogger;
  private originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
  };
  private initialized = false;

  private constructor() {
    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
    };
  }

  static getInstance(): AppLogger {
    if (!AppLogger.instance) {
      AppLogger.instance = new AppLogger();
    }
    return AppLogger.instance;
  }

  /**
   * Initialize the logger by wrapping console methods
   */
  init(): void {
    if (this.initialized) {
      return;
    }

    this.wrapConsoleMethod('log');
    this.wrapConsoleMethod('info');
    this.wrapConsoleMethod('warn');
    this.wrapConsoleMethod('error');
    this.wrapConsoleMethod('debug');

    this.initialized = true;
  }

  /**
   * Wrap a console method to capture logs
   */
  private wrapConsoleMethod(level: LogLevel): void {
    const original = this.originalConsole[level];

    (console as any)[level] = (...args: any[]) => {
      // Call original first (preserves debugging)
      original.apply(console, args);

      // Capture and store log
      this.captureLog(level, args);
    };
  }

  /**
   * Capture a log entry and store it
   */
  private captureLog(level: LogLevel, args: any[]): void {
    try {
      const timestamp = new Date().toISOString();
      const context = this.extractContext();
      const message = this.formatMessage(args);

      const logEntry: AppLogEntry = {
        time: timestamp,
        level,
        context,
        message,
        args: args.length > 1 ? args.slice(1) : undefined,
      };

      // Add to SettingsStore
      SettingsStore.addAppLog(JSON.stringify(logEntry));
    } catch (error) {
      // Silently fail to avoid infinite loops
      this.originalConsole.error('AppLogger failed to capture log:', error);
    }
  }

  /**
   * Extract caller context from Error stack
   */
  private extractContext(): string {
    try {
      const stack = new Error().stack;
      if (!stack) {
        return 'unknown';
      }

      // Parse stack trace
      // Skip first 3 lines (Error, extractContext, captureLog, wrapConsoleMethod)
      const stackLines = stack.split('\n');
      const callerLine = stackLines[4] || stackLines[3] || '';

      // Try to extract file and line number
      // Pattern: at FunctionName (file:line:column) or at file:line:column
      const match = callerLine.match(/at (?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);

      if (match) {
        const functionName = match[1];
        const filePath = match[2];
        const lineNumber = match[3];

        // Extract just the filename from path
        const fileName = filePath.split('/').pop() || filePath;

        if (functionName && functionName !== 'Object.<anonymous>') {
          return `${functionName} (${fileName}:${lineNumber})`;
        }
        return `${fileName}:${lineNumber}`;
      }

      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Format log arguments into a message string
   */
  private formatMessage(args: any[]): string {
    if (args.length === 0) {
      return '';
    }

    return args
      .map(arg => {
        if (typeof arg === 'string') {
          return arg;
        }
        if (arg instanceof Error) {
          return `${arg.name}: ${arg.message}`;
        }
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');
  }

  /**
   * Get original console methods (for internal use)
   */
  getOriginalConsole() {
    return this.originalConsole;
  }
}

export default AppLogger;
