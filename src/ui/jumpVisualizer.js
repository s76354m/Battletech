/**
 * Jump Movement Visualization Module
 * Handles display of jump range and valid destinations
 */

const chalk = require('chalk');
const { getValidJumpDestinations } = require('../engine/jumpMovement');

/**
 * Display jump range for a unit on the battlefield
 * @param {Object} gameState - Current game state
 * @param {string} unitId - ID of unit to display jump range for
 */
function displayJumpRange(gameState, unitId) {
  const unit = gameState.battlefield.units.get(unitId);
  if (!unit) {
    console.log(chalk.red('Unit not found'));
    return;
  }
  
  const jumpMP = unit.stats.movement.jump || 0;
  if (jumpMP <= 0) {
    console.log(chalk.yellow(`${unit.name} has no jump capability`));
    return;
  }
  
  // Get battlefield dimensions
  const { width, height } = gameState.battlefield.dimensions;
  
  // Get valid jump destinations
  const validDestinations = getValidJumpDestinations(gameState, unitId);
  
  // Create a display grid
  const grid = Array(height).fill().map(() => Array(width).fill(' '));
  
  // Mark unit position
  const { x: unitX, y: unitY } = unit.position;
  grid[unitY][unitX] = 'U';
  
  // Mark valid jump destinations
  validDestinations.forEach(pos => {
    grid[pos.y][pos.x] = 'J';
  });
  
  // Display the grid
  console.log(chalk.cyan('\n=== Jump Range Display ==='));
  console.log(chalk.yellow(`Unit: ${unit.name} (${unitId})`));
  console.log(chalk.yellow(`Jump MP: ${jumpMP}`));
  
  // Display coordinate header
  process.stdout.write('   ');
  for (let x = 0; x < width; x++) {
    process.stdout.write(` ${x.toString().padStart(2)} `);
  }
  console.log();
  
  // Display grid
  for (let y = 0; y < height; y++) {
    process.stdout.write(`${y.toString().padStart(2)} |`);
    for (let x = 0; x < width; x++) {
      // Choose symbol and color based on cell content
      let cellDisplay;
      
      switch(grid[y][x]) {
        case 'U':
          cellDisplay = chalk.green('◉');
          break;
        case 'J':
          cellDisplay = chalk.blue('●');
          break;
        default:
          // Check terrain
          const terrain = gameState.battlefield.terrain.get(`${x},${y}`);
          if (terrain && terrain.impassable) {
            cellDisplay = chalk.red('▩');
          } else {
            cellDisplay = chalk.gray('·');
          }
      }
      
      process.stdout.write(` ${cellDisplay} `);
    }
    console.log('|');
  }
  
  // Display legend
  console.log('\nLegend:');
  console.log(`${chalk.green('◉')} - Current unit position`);
  console.log(`${chalk.blue('●')} - Valid jump destination`);
  console.log(`${chalk.red('▩')} - Impassable terrain`);
  console.log(`${chalk.gray('·')} - Other terrain`);
  console.log(chalk.cyan('===================\n'));
}

/**
 * Prompt user for jump destination and execute jump
 * @param {Object} gameState - Current game state
 * @param {string} unitId - ID of unit to jump
 * @param {Function} inquirer - Inquirer module for prompts
 * @param {Function} callback - Callback to execute jump move
 */
async function promptJumpDestination(gameState, unitId, inquirer, callback) {
  const unit = gameState.battlefield.units.get(unitId);
  if (!unit) {
    console.log(chalk.red('Unit not found'));
    return;
  }
  
  // Display jump range
  displayJumpRange(gameState, unitId);
  
  // Get valid jump destinations
  const validDestinations = getValidJumpDestinations(gameState, unitId);
  
  if (validDestinations.length === 0) {
    console.log(chalk.yellow('No valid jump destinations available'));
    return;
  }
  
  // Prompt for destination
  const { x, y } = await inquirer.prompt([
    {
      type: 'list',
      name: 'destination',
      message: 'Select jump destination:',
      choices: validDestinations.map(pos => ({
        name: `(${pos.x}, ${pos.y})`,
        value: pos
      }))
    }
  ]).then(result => result.destination);
  
  // Prompt for facing
  const { facing } = await inquirer.prompt([
    {
      type: 'list',
      name: 'facing',
      message: 'Select new facing:',
      choices: [
        { name: 'North (N)', value: 'N' },
        { name: 'Northeast (NE)', value: 'NE' },
        { name: 'East (E)', value: 'E' },
        { name: 'Southeast (SE)', value: 'SE' },
        { name: 'South (S)', value: 'S' },
        { name: 'Southwest (SW)', value: 'SW' },
        { name: 'West (W)', value: 'W' },
        { name: 'Northwest (NW)', value: 'NW' }
      ]
    }
  ]);
  
  // Execute callback with selected destination and facing
  callback({ x, y }, facing);
}

module.exports = {
  displayJumpRange,
  promptJumpDestination
}; 