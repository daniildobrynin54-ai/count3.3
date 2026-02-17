// Improved logger with levels and formatting
import { CONFIG } from './config.js';

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    IMPORTANT: 4
};

export const Logger = {
    level: CONFIG.DEBUG ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO,

    _log(level, color, icon, ...args) {
        if (level < this.level) return;
        const timestamp = new Date().toISOString().substr(11, 12);
        console.log(`%c[MBUF ${icon}] ${timestamp}`, `color: ${color}`, ...args);
    },

    debug(...args) {
        this._log(LOG_LEVELS.DEBUG, '#888', '🔧', ...args);
    },

    info(...args) {
        this._log(LOG_LEVELS.INFO, '#2196F3', 'ℹ️', ...args);
    },

    warn(...args) {
        this._log(LOG_LEVELS.WARN, '#FF9800', '⚠️', ...args);
    },

    error(...args) {
        this._log(LOG_LEVELS.ERROR, '#F44336', '❌', ...args);
    },

    important(...args) {
        this._log(LOG_LEVELS.IMPORTANT, '#4CAF50', '✨', ...args);
    },

    setLevel(level) {
        this.level = level;
    }
};
