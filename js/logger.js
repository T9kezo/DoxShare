// logger.js - Centralized logging module
class Logger {
    constructor() {
        this.levels = {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3
        };
        this.currentLevel = this.levels.INFO; // Set to INFO by default
    }

    setLevel(level) {
        this.currentLevel = this.levels[level.toUpperCase()] || this.levels.INFO;
    }

    log(level, message, data = {}) {
        if (this.levels[level.toUpperCase()] < this.currentLevel) return;

        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            ...data
        };

        console.log(JSON.stringify(logEntry));

        // In a production app, you might send this to a logging service
        // For now, we'll just console.log
    }

    debug(message, data) {
        this.log('DEBUG', message, data);
    }

    info(message, data) {
        this.log('INFO', message, data);
    }

    warn(message, data) {
        this.log('WARN', message, data);
    }

    error(message, data) {
        this.log('ERROR', message, data);
    }
}

const logger = new Logger();
export default logger;
