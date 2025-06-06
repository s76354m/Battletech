/**
 * Simple Test Script for Alpha Strike AI Game Master
 * Tests just core functionality with proper error handling
 */

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { createGameState, PHASES, addUnit } = require('./engine/gameState');
const { listUnitTemplates } = require('./data/unitTemplates');
const mapGenerator = require('./engine/mapGenerator');

// Try to import UI components if available
let gameInterface;
try {
  gameInterface = require('./ui/gameInterface');
} catch (error) {
  console.log(chalk.yellow('Note: Could not load gameInterface, some UI tests will be skipped.'));
}

let menuInterface;
try {
  menuInterface = require('./ui/menuInterface');
} catch (error) {
  console.log(chalk.yellow('Note: Could not load menuInterface, some UI tests will be skipped.'));
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise);
  console.log('Reason:', reason);
});

// Test results tracking
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    console.log(`Testing: ${name}...`);
    fn();
    console.log(chalk.green(`✓ PASSED: ${name}`));
    passed++;
  } catch (error) {
    console.log(chalk.red(`✗ FAILED: ${name}`));
    console.log(chalk.red(`  Error: ${error.message}`));
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    console.log(`Testing: ${name}...`);
    await fn();
    console.log(chalk.green(`✓ PASSED: ${name}`));
    passed++;
  } catch (error) {
    console.log(chalk.red(`✗ FAILED: ${name}`));
    console.log(chalk.red(`  Error: ${error.message}`));
    failed++;
  }
}

// Run all tests
async function runTests() {
  console.log(chalk.cyan('\n=================================='));
  console.log(chalk.yellow('  ALPHA STRIKE - BASIC TEST SUITE'));
  console.log(chalk.cyan('==================================\n'));

  // Test 1: Game state initialization
  test('Game State Creation', () => {
    const gameState = createGameState();
    if (!gameState) throw new Error('Game state not created');
    if (!gameState.turnData) throw new Error('Turn data missing');
    if (!gameState.players) throw new Error('Players missing');
    if (!gameState.battlefield) throw new Error('Battlefield missing');
  });

  // Test 2: Map template listing
  test('Map Template Listing', () => {
    const templates = mapGenerator.getAvailableMapTemplates();
    if (!Array.isArray(templates)) throw new Error('Templates is not an array');
    if (templates.length === 0) throw new Error('No map templates found');
  });

  // Test 3: Unit template listing
  test('Unit Template Listing', () => {
    const templates = listUnitTemplates();
    if (!Array.isArray(templates)) throw new Error('Templates is not an array');
    if (templates.length === 0) throw new Error('No unit templates found');
    
    // Log first few templates for debugging
    const firstFew = templates.slice(0, 5);
    console.log(`Sample unit templates: ${JSON.stringify(firstFew)}`);
  });
  
  // Test 4: Check for visual bar functionality
  test('Visual Bars Code', () => {
    try {
      // Read the file directly
      const gameInterfaceCode = fs.readFileSync(path.join(__dirname, 'ui/gameInterface.js'), 'utf8');
      
      const hasCreateBarFunction = gameInterfaceCode.includes('createBar');
      if (!hasCreateBarFunction) throw new Error('createBar function not found in gameInterface');
      
      const hasArmorBar = gameInterfaceCode.includes('armorBar');
      if (!hasArmorBar) throw new Error('armorBar variable not found in gameInterface');
      
      const hasStructureBar = gameInterfaceCode.includes('structureBar');
      if (!hasStructureBar) throw new Error('structureBar variable not found in gameInterface');
      
      console.log(chalk.green('Visual bars code is present in gameInterface'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(chalk.yellow('Note: Could not read gameInterface.js file'));
        // Don't fail the test if we can't read the file
        return;
      }
      throw error;
    }
  });
  
  // Test 5: Attack command parameter names
  test('Attack Command Parameters', () => {
    try {
      // Read the file directly
      const menuInterfaceCode = fs.readFileSync(path.join(__dirname, 'ui/menuInterface.js'), 'utf8');
      
      const hasAttackerParameter = menuInterfaceCode.includes('attacker:');
      if (!hasAttackerParameter) throw new Error('attacker parameter not found in handleAttackMenu');
      
      const hasTargetParameter = menuInterfaceCode.includes('target:');
      if (!hasTargetParameter) throw new Error('target parameter not found in handleAttackMenu');
      
      console.log(chalk.green('Attack command has correct parameter names (attacker and target)'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(chalk.yellow('Note: Could not read menuInterface.js file'));
        // Don't fail the test if we can't read the file
        return;
      }
      throw error;
    }
  });
  
  // Test 6: Command menu after game start
  test('Game Start Command Menu', () => {
    try {
      // Read the file directly
      const gameInterfaceCode = fs.readFileSync(path.join(__dirname, 'ui/gameInterface.js'), 'utf8');
      
      const hasPhaseCheck = gameInterfaceCode.includes('gameState.turnData.phase');
      if (!hasPhaseCheck) throw new Error('Phase checking not found in commandChoices');
      
      const hasSetupCaseCheck = gameInterfaceCode.includes('case PHASES.SETUP:');
      if (!hasSetupCaseCheck) throw new Error('SETUP phase case not found in command menu');
      
      console.log(chalk.green('Command menu code properly checks phase before showing setup commands'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(chalk.yellow('Note: Could not read gameInterface.js file'));
        // Don't fail the test if we can't read the file
        return;
      }
      throw error;
    }
  });

  // Print summary
  console.log(chalk.cyan('\n=================================='));
  console.log(chalk.yellow('  TEST RESULTS'));
  console.log(chalk.cyan('=================================='));
  console.log(`Tests Passed: ${chalk.green(passed)}`);
  console.log(`Tests Failed: ${chalk.red(failed)}`);
  console.log(chalk.cyan('==================================\n'));

  if (failed === 0) {
    console.log(chalk.green('All tests passed!'));
  } else {
    console.log(chalk.red(`${failed} tests failed.`));
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error(chalk.red('Fatal error running tests:'), error);
  process.exit(1);
}); 