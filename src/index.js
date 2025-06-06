const fs = require('fs');
require('dotenv').config();
const { startGame } = require('./ui/gameInterface');
const { initializeLogger } = require('./utils/logger');

// Initialize logger
const logger = initializeLogger();

// Check for and create .env file if it doesn't exist
function ensureEnvFile() {
  const envPath = '.env';
  if (!fs.existsSync(envPath)) {
    logger.info('Creating .env file with default values');
    fs.writeFileSync(envPath, 'ANTHROPIC_API_KEY=your_api_key_here\n');
    console.log('A new .env file has been created.');
    console.log('Please edit the file and add your Anthropic API key before continuing.');
    process.exit(0);
  }
}

// Start application
async function main() {
  logger.info('Starting Alpha Strike AI Game Master');
  
  // Ensure .env file exists
  ensureEnvFile();
  
  try {
    await startGame();
  } catch (error) {
    logger.error('Application error:', error);
    console.error('An unexpected error occurred. Please check the logs.');
  }
}

main(); 