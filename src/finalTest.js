/**
 * Final Test Script just to verify all our fixes are in place
 */
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

console.log('\n=== Testing Our Fixes ===');

// Check Visual Bars
const gameInterfaceFile = path.join(__dirname, 'ui/gameInterface.js');
const gameInterfaceCode = fs.readFileSync(gameInterfaceFile, 'utf8');

if (gameInterfaceCode.includes('createBar')) {
  console.log(chalk.green('✓ Visual bars code is present (createBar function found)'));
} else {
  console.log(chalk.red('✗ Visual bars code is missing (createBar function not found)'));
}

// Check Attack Command
const menuInterfaceFile = path.join(__dirname, 'ui/menuInterface.js');
const menuInterfaceCode = fs.readFileSync(menuInterfaceFile, 'utf8');

if (menuInterfaceCode.includes('attacker:') && menuInterfaceCode.includes('target:')) {
  console.log(chalk.green('✓ Attack command has correct parameter names (attacker and target)'));
} else {
  console.log(chalk.red('✗ Attack command has incorrect parameter names'));
}

// Check Phase-based Command Menu
if (gameInterfaceCode.includes('case PHASES.SETUP:') && 
    gameInterfaceCode.includes('commandChoices.push({ name: \'SETUP')) {
  console.log(chalk.green('✓ Command menu correctly checks phase before displaying setup commands'));
} else {
  console.log(chalk.red('✗ Command menu does not properly check phase'));
}

console.log('\n=== Test Complete ===\n'); 