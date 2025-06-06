/**
 * Simple logger utility for the Alpha Strike AI Game Master
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Get log level from environment or default to info
const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase() || 'info'];

/**
 * Initialize the logger utility
 * @returns {Object} Logger with log level methods
 */
function initializeLogger() {
  return {
    debug: (message, ...args) => {
      if (currentLogLevel <= LOG_LEVELS.debug) {
        console.log(`[DEBUG] ${message}`, ...args);
      }
    },
    info: (message, ...args) => {
      if (currentLogLevel <= LOG_LEVELS.info) {
        console.log(`[INFO] ${message}`, ...args);
      }
    },
    warn: (message, ...args) => {
      if (currentLogLevel <= LOG_LEVELS.warn) {
        console.warn(`[WARN] ${message}`, ...args);
      }
    },
    error: (message, ...args) => {
      if (currentLogLevel <= LOG_LEVELS.error) {
        console.error(`[ERROR] ${message}`, ...args);
      }
    }
  };
}

module.exports = { initializeLogger }; 