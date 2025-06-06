/**
 * Menu-based Interface for Alpha Strike AI Game Master
 */

const inquirer = require('inquirer');
const chalk = require('chalk');
const { getHelpText } = require('./commandParser');
const { PHASES } = require('../engine/gameState');
const { listUnitTemplates } = require('../data/unitTemplates');
const mapGenerator = require('../engine/mapGenerator');

/**
 * Creates a menu of commands based on the current game phase
 * @param {Object} gameState - The current game state
 * @returns {Array} Array of command objects for menu selection
 */
function getCommandsForPhase(gameState) {
  const phase = gameState.turnData.phase;
  const commands = [];
  
  // Common commands for all phases
  const commonCommands = [
    { name: 'Status - Show game status', value: { type: 'STATUS' } },
    { name: 'List Units - Show all units', value: { type: 'LIST_UNITS' } },
    { name: 'Show Heat - Display heat information', value: { type: 'SHOW_HEAT' } },
    { name: 'Help - Show available commands', value: { type: 'HELP' } },
    { name: 'Quit - Exit the game', value: { type: 'QUIT' } }
  ];
  
  // Phase-specific commands
  switch(phase) {
    case PHASES.SETUP:
      commands.push(
        { name: 'Add Unit - Add a unit to the battlefield', value: 'ADD_UNIT_MENU' },
        { name: 'Map Commands - Load or generate maps', value: 'MAP_COMMANDS' },
        { name: 'Next - Advance to Initiative Phase', value: { type: 'NEXT_PHASE' } }
      );
      break;
      
    case PHASES.INITIATIVE:
      commands.push(
        { name: 'Roll Initiative - Roll for initiative', value: { type: 'INITIATIVE_ROLL' } }
      );
      break;
      
    case PHASES.MOVEMENT:
      commands.push(
        { name: 'Move Unit - Move a unit on the battlefield', value: 'MOVE_UNIT_MENU' },
        { name: 'Jump Unit - Use jump jets to move a unit', value: 'JUMP_UNIT_MENU' },
        { name: 'Startup Unit - Attempt to restart a shutdown unit', value: 'STARTUP_MENU' },
        { name: 'Next - End movement phase', value: { type: 'NEXT_PHASE' } }
      );
      break;
      
    case PHASES.COMBAT:
      commands.push(
        { name: 'Attack - Perform a ranged attack', value: 'ATTACK_MENU' },
        { name: 'Melee - Perform a melee attack', value: 'MELEE_MENU' },
        { name: 'Death From Above - Perform DFA attack (jump required)', value: 'DFA_MENU' },
        { name: 'Analyze Attack - Calculate attack probability', value: 'ANALYZE_MENU' },
        { name: 'Range - Display weapon ranges', value: 'RANGE_MENU' },
        { name: 'Next - End combat phase', value: { type: 'NEXT_PHASE' } }
      );
      break;
      
    case PHASES.END:
      commands.push(
        { name: 'Next - End turn and start a new one', value: { type: 'NEXT_PHASE' } }
      );
      break;
  }
  
  // Add common commands at the end
  return [...commands, ...commonCommands];
}

/**
 * Get a command from the user using a menu-based interface
 * @param {Object} gameState - The current game state
 * @returns {Promise<Object>} Command object
 */
async function getMenuCommand(gameState) {
  const commands = getCommandsForPhase(gameState);
  
  try {
    const { command } = await inquirer.prompt([
      {
        type: 'list',
        name: 'command',
        message: `${gameState.turnData.phase} Phase - Select a command:`,
        choices: commands,
        pageSize: 15
      }
    ]);
    
    // Handle menu redirect commands
    if (typeof command === 'string') {
      switch(command) {
        case 'ADD_UNIT_MENU':
          return await handleAddUnitMenu(gameState);
        case 'MAP_COMMANDS':
          return await handleMapCommandsMenu(gameState);
        case 'MOVE_UNIT_MENU':
          return await handleMoveUnitMenu(gameState);
        case 'STARTUP_MENU':
          return await handleStartupMenu(gameState);
        case 'ATTACK_MENU':
          return await handleAttackMenu(gameState);
        case 'MELEE_MENU':
          return await handleMeleeMenu(gameState);
        case 'ANALYZE_MENU':
          return await handleAnalyzeMenu(gameState);
        case 'RANGE_MENU':
          return await handleRangeMenu(gameState);
        case 'JUMP_UNIT_MENU':
          return await handleJumpUnitMenu(gameState);
        case 'DFA_MENU':
          return await handleDFAMenu(gameState);
        default:
          return { type: 'UNKNOWN' };
      }
    }
    
    // Return direct command
    return command;
  } catch (error) {
    console.error('Error displaying menu:', error);
    return { type: 'UNKNOWN' };
  }
}

/**
 * Handle Add Unit menu selection
 * @param {Object} gameState - The current game state
 * @returns {Promise<Object>} Command object
 */
async function handleAddUnitMenu(gameState) {
  // Get list of unit templates
  const templates = listUnitTemplates();
  const templateChoices = templates.map(t => ({ 
    name: `${t.name} (${t.type})`, 
    value: t.id 
  }));
  
  // Add random unit option
  templateChoices.unshift({ name: 'Random Unit', value: 'random' });
  
  const { unitType, owner, x, y, facing } = await inquirer.prompt([
    {
      type: 'list',
      name: 'unitType',
      message: 'Select unit type:',
      choices: templateChoices,
      pageSize: 10
    },
    {
      type: 'list',
      name: 'owner',
      message: 'Select unit owner:',
      choices: [
        { name: 'Player', value: 'player' },
        { name: 'AI', value: 'ai' }
      ]
    },
    {
      type: 'input',
      name: 'x',
      message: 'Enter X coordinate:',
      validate: input => !isNaN(parseInt(input)) ? true : 'Please enter a valid number',
      filter: input => parseInt(input)
    },
    {
      type: 'input',
      name: 'y',
      message: 'Enter Y coordinate:',
      validate: input => !isNaN(parseInt(input)) ? true : 'Please enter a valid number',
      filter: input => parseInt(input)
    },
    {
      type: 'list',
      name: 'facing',
      message: 'Select facing direction:',
      choices: [
        { name: 'North', value: 'N' },
        { name: 'Northeast', value: 'NE' },
        { name: 'East', value: 'E' },
        { name: 'Southeast', value: 'SE' },
        { name: 'South', value: 'S' },
        { name: 'Southwest', value: 'SW' },
        { name: 'West', value: 'W' },
        { name: 'Northwest', value: 'NW' }
      ]
    }
  ]);
  
  return {
    type: 'ADD_UNIT',
    unitType,
    owner,
    position: { x, y },
    facing
  };
}

/**
 * Handle Map Commands menu selection
 * @param {Object} gameState - The current game state
 * @returns {Promise<Object>} Command object
 */
async function handleMapCommandsMenu(gameState) {
  const { mapCommand } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mapCommand',
      message: 'Select map command:',
      choices: [
        { name: 'List Available Maps', value: 'LIST' },
        { name: 'Load Map Template', value: 'LOAD' },
        { name: 'Generate Random Map', value: 'RANDOM' }
      ]
    }
  ]);
  
  switch(mapCommand) {
    case 'LIST':
      return { type: 'MAP', command: 'list' };
      
    case 'LOAD':
      // Get available map templates
      const templates = mapGenerator.getAvailableMapTemplates();
      const templateChoices = templates.map(t => ({ 
        name: `${t.name} - ${t.description}`, 
        value: t.id 
      }));
      
      const { templateId, width, height } = await inquirer.prompt([
        {
          type: 'list',
          name: 'templateId',
          message: 'Select map template:',
          choices: templateChoices
        },
        {
          type: 'input',
          name: 'width',
          message: 'Enter map width:',
          default: '20',
          validate: input => !isNaN(parseInt(input)) ? true : 'Please enter a valid number',
          filter: input => parseInt(input)
        },
        {
          type: 'input',
          name: 'height',
          message: 'Enter map height:',
          default: '20',
          validate: input => !isNaN(parseInt(input)) ? true : 'Please enter a valid number',
          filter: input => parseInt(input)
        }
      ]);
      
      return { 
        type: 'MAP', 
        command: 'load',
        templateName: templateId,
        width,
        height
      };
      
    case 'RANDOM':
      const { randomWidth, randomHeight } = await inquirer.prompt([
        {
          type: 'input',
          name: 'randomWidth',
          message: 'Enter map width:',
          default: '20',
          validate: input => !isNaN(parseInt(input)) ? true : 'Please enter a valid number',
          filter: input => parseInt(input)
        },
        {
          type: 'input',
          name: 'randomHeight',
          message: 'Enter map height:',
          default: '20',
          validate: input => !isNaN(parseInt(input)) ? true : 'Please enter a valid number',
          filter: input => parseInt(input)
        }
      ]);
      
      return { 
        type: 'MAP', 
        command: 'random',
        width: randomWidth,
        height: randomHeight
      };
  }
}

/**
 * Handle Move Unit menu selection
 * @param {Object} gameState - The current game state
 * @returns {Promise<Object>} Command object
 */
async function handleMoveUnitMenu(gameState) {
  // Get list of player units that can move
  const playerUnits = Array.from(gameState.battlefield.units.values())
    .filter(unit => unit.owner === 'player' && !unit.destroyed);
    
  if (playerUnits.length === 0) {
    console.log(chalk.yellow('No units available to move.'));
    return { type: 'UNKNOWN' };
  }
  
  const unitChoices = playerUnits.map(unit => ({
    name: `${unit.name} (${unit.id}) - ${unit.type}`,
    value: unit.id
  }));
  
  const { unitId, x, y, facing } = await inquirer.prompt([
    {
      type: 'list',
      name: 'unitId',
      message: 'Select unit to move:',
      choices: unitChoices
    },
    {
      type: 'input',
      name: 'x',
      message: 'Enter destination X coordinate:',
      validate: input => !isNaN(parseInt(input)) ? true : 'Please enter a valid number',
      filter: input => parseInt(input)
    },
    {
      type: 'input',
      name: 'y',
      message: 'Enter destination Y coordinate:',
      validate: input => !isNaN(parseInt(input)) ? true : 'Please enter a valid number',
      filter: input => parseInt(input)
    },
    {
      type: 'list',
      name: 'facing',
      message: 'Select facing direction:',
      choices: [
        { name: 'North', value: 'N' },
        { name: 'Northeast', value: 'NE' },
        { name: 'East', value: 'E' },
        { name: 'Southeast', value: 'SE' },
        { name: 'South', value: 'S' },
        { name: 'Southwest', value: 'SW' },
        { name: 'West', value: 'W' },
        { name: 'Northwest', value: 'NW' }
      ]
    }
  ]);
  
  return {
    type: 'MOVE',
    unitId,
    position: { x, y },
    facing
  };
}

/**
 * Handle Startup Unit menu selection
 * @param {Object} gameState - The current game state
 * @returns {Promise<Object>} Command object
 */
async function handleStartupMenu(gameState) {
  // Get list of shutdown player units
  const shutdownUnits = Array.from(gameState.battlefield.units.values())
    .filter(unit => unit.owner === 'player' && !unit.destroyed && unit.status.shutdown);
    
  if (shutdownUnits.length === 0) {
    console.log(chalk.yellow('No shutdown units available to restart.'));
    return { type: 'UNKNOWN' };
  }
  
  const unitChoices = shutdownUnits.map(unit => ({
    name: `${unit.name} (${unit.id}) - ${unit.type}`,
    value: unit.id
  }));
  
  const { unitId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'unitId',
      message: 'Select unit to restart:',
      choices: unitChoices
    }
  ]);
  
  return {
    type: 'STARTUP',
    unitId
  };
}

/**
 * Handle Attack menu selection
 * @param {Object} gameState - The current game state
 * @returns {Promise<Object>} Command object
 */
async function handleAttackMenu(gameState) {
  // Get list of player units that can attack
  const playerUnits = Array.from(gameState.battlefield.units.values())
    .filter(unit => unit.owner === 'player' && !unit.destroyed && !unit.status.shutdown);
    
  if (playerUnits.length === 0) {
    console.log(chalk.yellow('No units available to attack with.'));
    return { type: 'UNKNOWN' };
  }
  
  // Get list of AI units that can be attacked
  const aiUnits = Array.from(gameState.battlefield.units.values())
    .filter(unit => unit.owner === 'ai' && !unit.destroyed);
    
  if (aiUnits.length === 0) {
    console.log(chalk.yellow('No enemy units available to attack.'));
    return { type: 'UNKNOWN' };
  }
  
  const attackerChoices = playerUnits.map(unit => ({
    name: `${unit.name} (${unit.id}) - ${unit.type}`,
    value: unit.id
  }));
  
  const targetChoices = aiUnits.map(unit => ({
    name: `${unit.name} (${unit.id}) - ${unit.type}`,
    value: unit.id
  }));
  
  const { attackerId, targetId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'attackerId',
      message: 'Select unit to attack with:',
      choices: attackerChoices
    },
    {
      type: 'list',
      name: 'targetId',
      message: 'Select target:',
      choices: targetChoices
    }
  ]);
  
  return {
    type: 'ATTACK',
    attacker: attackerId,
    target: targetId
  };
}

/**
 * Handle Melee Attack menu selection
 * @param {Object} gameState - The current game state
 * @returns {Promise<Object>} Command object
 */
async function handleMeleeMenu(gameState) {
  // Get list of player units that can attack
  const playerUnits = Array.from(gameState.battlefield.units.values())
    .filter(unit => unit.owner === 'player' && !unit.destroyed && !unit.status.shutdown);
    
  if (playerUnits.length === 0) {
    console.log(chalk.yellow('No units available for melee combat.'));
    return { type: 'UNKNOWN' };
  }
  
  // Get list of AI units that can be attacked
  const aiUnits = Array.from(gameState.battlefield.units.values())
    .filter(unit => unit.owner === 'ai' && !unit.destroyed);
    
  if (aiUnits.length === 0) {
    console.log(chalk.yellow('No enemy units available to attack.'));
    return { type: 'UNKNOWN' };
  }
  
  const attackerChoices = playerUnits.map(unit => ({
    name: `${unit.name} (${unit.id}) - ${unit.type}`,
    value: unit.id
  }));
  
  const targetChoices = aiUnits.map(unit => ({
    name: `${unit.name} (${unit.id}) - ${unit.type}`,
    value: unit.id
  }));
  
  const { attackerId, targetId, attackType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'attackerId',
      message: 'Select unit for melee:',
      choices: attackerChoices
    },
    {
      type: 'list',
      name: 'targetId',
      message: 'Select target:',
      choices: targetChoices
    },
    {
      type: 'list',
      name: 'attackType',
      message: 'Select melee attack type:',
      choices: [
        { name: 'Standard Melee Attack', value: 'STANDARD' },
        { name: 'Charge Attack', value: 'CHARGE' },
        { name: 'Punch Attack (Mechs only)', value: 'PUNCH' },
        { name: 'Kick Attack (Mechs only)', value: 'KICK' },
        { name: 'Physical Weapon Attack', value: 'WEAPON' }
      ]
    }
  ]);
  
  return {
    type: 'MELEE',
    attackerId,
    targetId,
    attackType
  };
}

/**
 * Handle Analyze Attack menu selection
 * @param {Object} gameState - The current game state
 * @returns {Promise<Object>} Command object
 */
async function handleAnalyzeMenu(gameState) {
  // Get list of player units
  const playerUnits = Array.from(gameState.battlefield.units.values())
    .filter(unit => unit.owner === 'player' && !unit.destroyed);
    
  // Get list of AI units
  const aiUnits = Array.from(gameState.battlefield.units.values())
    .filter(unit => unit.owner === 'ai' && !unit.destroyed);
    
  if (playerUnits.length === 0 || aiUnits.length === 0) {
    console.log(chalk.yellow('Not enough units available for analysis.'));
    return { type: 'UNKNOWN' };
  }
  
  const playerUnitChoices = playerUnits.map(unit => ({
    name: `${unit.name} (${unit.id}) - ${unit.type}`,
    value: unit.id
  }));
  
  const aiUnitChoices = aiUnits.map(unit => ({
    name: `${unit.name} (${unit.id}) - ${unit.type}`,
    value: unit.id
  }));
  
  const { attackerId, targetId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'attackerId',
      message: 'Select attacking unit:',
      choices: playerUnitChoices
    },
    {
      type: 'list',
      name: 'targetId',
      message: 'Select target unit:',
      choices: aiUnitChoices
    }
  ]);
  
  return {
    type: 'ANALYZE',
    attackerId,
    targetId
  };
}

/**
 * Handle Range Display menu selection
 * @param {Object} gameState - The current game state
 * @returns {Promise<Object>} Command object
 */
async function handleRangeMenu(gameState) {
  // Get list of player units
  const playerUnits = Array.from(gameState.battlefield.units.values())
    .filter(unit => unit.owner === 'player' && !unit.destroyed);
    
  if (playerUnits.length === 0) {
    console.log(chalk.yellow('No units available for range display.'));
    return { type: 'UNKNOWN' };
  }
  
  const unitChoices = playerUnits.map(unit => ({
    name: `${unit.name} (${unit.id}) - ${unit.type}`,
    value: unit.id
  }));
  
  const { unitId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'unitId',
      message: 'Select unit to display ranges for:',
      choices: unitChoices
    }
  ]);
  
  return {
    type: 'RANGE',
    unitId
  };
}

/**
 * Handle Jump Unit menu selection
 * @param {Object} gameState - The current game state
 * @returns {Promise<Object>} Command object
 */
async function handleJumpUnitMenu(gameState) {
  // Get list of player units that can jump
  const jumpCapableUnits = Array.from(gameState.battlefield.units.values())
    .filter(unit => {
      // Check if unit belongs to player, is not destroyed, and has jump capability
      if (unit.owner !== 'player' || unit.destroyed || unit.status.shutdown) {
        return false;
      }
      
      // Check for jump movement points or jump special ability
      const hasJumpMP = unit.stats.movement.jump && unit.stats.movement.jump > 0;
      const hasJumpAbility = unit.specialAbilities && unit.specialAbilities.includes('JMPS');
      
      return hasJumpMP || hasJumpAbility;
    });
    
  if (jumpCapableUnits.length === 0) {
    console.log(chalk.yellow('No units available with jump capability.'));
    return { type: 'UNKNOWN' };
  }
  
  const unitChoices = jumpCapableUnits.map(unit => ({
    name: `${unit.name} (${unit.id}) - Jump MP: ${unit.stats.movement.jump || 0}`,
    value: unit.id
  }));
  
  // Import the jumpVisualizer here to avoid circular dependencies
  const jumpVisualizer = require('./jumpVisualizer');
  
  const { unitId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'unitId',
      message: 'Select unit to jump:',
      choices: unitChoices
    }
  ]);
  
  // Use the jump visualizer to handle destination selection
  let destination, facing;
  
  await new Promise(resolve => {
    jumpVisualizer.promptJumpDestination(gameState, unitId, inquirer, (dest, face) => {
      destination = dest;
      facing = face;
      resolve();
    });
  });
  
  if (!destination) {
    return { type: 'UNKNOWN' };
  }
  
  return {
    type: 'JUMP',
    unitId,
    position: destination,
    facing
  };
}

/**
 * Handle Death From Above attack menu selection
 * @param {Object} gameState - The current game state
 * @returns {Promise<Object>} Command object
 */
async function handleDFAMenu(gameState) {
  // Import the jumpMovement module
  const jumpMovement = require('../engine/jumpMovement');
  
  // Get list of player units that have jumped this turn
  const jumpedUnits = Array.from(gameState.battlefield.units.values())
    .filter(unit => {
      return unit.owner === 'player' && 
             !unit.destroyed && 
             !unit.status.shutdown &&
             unit.status.moveType === 'jump';
    });
    
  if (jumpedUnits.length === 0) {
    console.log(chalk.yellow('No units available that have jumped this turn. Jump a unit first to perform DFA.'));
    return { type: 'UNKNOWN' };
  }
  
  const attackerChoices = jumpedUnits.map(unit => ({
    name: `${unit.name} (${unit.id}) - ${unit.type}`,
    value: unit.id
  }));
  
  const { attackerId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'attackerId',
      message: 'Select unit to perform Death From Above:',
      choices: attackerChoices
    }
  ]);
  
  // Get possible targets (adjacent units)
  const attacker = gameState.battlefield.units.get(attackerId);
  const possibleTargets = Array.from(gameState.battlefield.units.values())
    .filter(unit => {
      if (unit.owner === 'player' || unit.destroyed) {
        return false;
      }
      
      // Calculate distance
      const distance = Math.sqrt(
        Math.pow(unit.position.x - attacker.position.x, 2) + 
        Math.pow(unit.position.y - attacker.position.y, 2)
      );
      
      // Target must be adjacent
      return distance <= 1;
    });
  
  if (possibleTargets.length === 0) {
    console.log(chalk.yellow('No valid targets in adjacent hexes for Death From Above attack.'));
    return { type: 'UNKNOWN' };
  }
  
  const targetChoices = possibleTargets.map(unit => ({
    name: `${unit.name} (${unit.id}) - ${unit.type}`,
    value: unit.id
  }));
  
  const { targetId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'targetId',
      message: 'Select target for Death From Above:',
      choices: targetChoices
    }
  ]);
  
  // Validate DFA possibility
  const dfaCheck = jumpMovement.canPerformDFA(gameState, attackerId, targetId);
  
  if (!dfaCheck.valid) {
    console.log(chalk.red(`Cannot perform Death From Above: ${dfaCheck.reason}`));
    return { type: 'UNKNOWN' };
  }
  
  return {
    type: 'DFA',
    attackerId,
    targetId
  };
}

module.exports = {
  getMenuCommand,
  handleJumpUnitMenu,
  handleDFAMenu
}; 