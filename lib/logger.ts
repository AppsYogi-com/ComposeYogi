// ============================================
// ComposeYogi — Logger Utility
// Industry-standard logging with levels, context, and environment awareness
// ============================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    context: string;
    message: string;
    timestamp: string;
    data?: unknown;
}

interface LoggerConfig {
    /** Minimum log level to output */
    minLevel: LogLevel;
    /** Enable/disable logging globally */
    enabled: boolean;
    /** Include timestamps in console output */
    showTimestamp: boolean;
    /** Include log level badge in console output */
    showLevel: boolean;
}

// Log level priority (higher = more severe)
const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

// Console styling for different levels
const LEVEL_STYLES: Record<LogLevel, { badge: string; style: string }> = {
    debug: { badge: '🔍 DEBUG', style: 'color: #888' },
    info: { badge: 'ℹ️  INFO', style: 'color: #3b82f6' },
    warn: { badge: '⚠️  WARN', style: 'color: #f59e0b' },
    error: { badge: '❌ ERROR', style: 'color: #ef4444' },
};

// Default configuration based on environment
const DEFAULT_CONFIG: LoggerConfig = {
    minLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    enabled: true,
    showTimestamp: process.env.NODE_ENV !== 'production',
    showLevel: true,
};

let globalConfig: LoggerConfig = { ...DEFAULT_CONFIG };

/**
 * Configure the global logger settings
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
    globalConfig = { ...globalConfig, ...config };
}

/**
 * Get current logger configuration
 */
export function getLoggerConfig(): LoggerConfig {
    return { ...globalConfig };
}

/**
 * Reset logger to default configuration
 */
export function resetLoggerConfig(): void {
    globalConfig = { ...DEFAULT_CONFIG };
}

/**
 * Format timestamp for log output
 */
function formatTimestamp(): string {
    const now = new Date();
    return now.toISOString().slice(11, 23); // HH:mm:ss.SSS
}

/**
 * Check if a log level should be output based on config
 */
function shouldLog(level: LogLevel): boolean {
    if (!globalConfig.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[globalConfig.minLevel];
}

/**
 * Format log message for console output
 */
function formatLogMessage(context: string, message: string): string {
    const parts: string[] = [];

    if (globalConfig.showTimestamp) {
        parts.push(`[${formatTimestamp()}]`);
    }

    parts.push(`[${context}]`);
    parts.push(message);

    return parts.join(' ');
}

/**
 * Core log function
 */
function log(level: LogLevel, context: string, message: string, data?: unknown): void {
    if (!shouldLog(level)) return;

    const formattedMessage = formatLogMessage(context, message);
    const { badge, style } = LEVEL_STYLES[level];

    // Use appropriate console method
    const consoleFn = level === 'error'
        ? console.error
        : level === 'warn'
            ? console.warn
            : console.log;

    if (globalConfig.showLevel && typeof window !== 'undefined') {
        // Browser: use styled console output
        if (data !== undefined) {
            consoleFn(`%c${badge}%c ${formattedMessage}`, style, '', data);
        } else {
            consoleFn(`%c${badge}%c ${formattedMessage}`, style, '');
        }
    } else {
        // Node.js or simplified output
        const prefix = globalConfig.showLevel ? `[${level.toUpperCase()}]` : '';
        if (data !== undefined) {
            consoleFn(`${prefix} ${formattedMessage}`, data);
        } else {
            consoleFn(`${prefix} ${formattedMessage}`);
        }
    }
}

/**
 * Create a logger instance with a specific context
 * This is the recommended way to use the logger
 * 
 * @example
 * const logger = createLogger('AudioEngine');
 * logger.info('Initialized');
 * logger.debug('Processing clip', { clipId: '123' });
 * logger.error('Failed to load', error);
 */
export function createLogger(context: string) {
    return {
        debug: (message: string, data?: unknown) => log('debug', context, message, data),
        info: (message: string, data?: unknown) => log('info', context, message, data),
        warn: (message: string, data?: unknown) => log('warn', context, message, data),
        error: (message: string, data?: unknown) => log('error', context, message, data),

        /**
         * Create a child logger with extended context
         * @example
         * const audioLogger = createLogger('Audio');
         * const engineLogger = audioLogger.child('Engine'); // Context: "Audio:Engine"
         */
        child: (childContext: string) => createLogger(`${context}:${childContext}`),
    };
}

/**
 * Global logger instance for quick one-off logging
 * Prefer createLogger() for module-specific logging
 */
export const logger = createLogger('App');

// ============================================
// Pre-configured loggers for common modules
// ============================================

export const audioLogger = createLogger('Audio');
export const dbLogger = createLogger('DB');
export const uiLogger = createLogger('UI');
export const playbackLogger = createLogger('Playback');

// ============================================
// Type exports
// ============================================

export type { LogLevel, LogEntry, LoggerConfig };
export type Logger = ReturnType<typeof createLogger>;
