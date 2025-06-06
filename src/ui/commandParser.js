/**
 * Command Parser for Alpha Strike AI Game Master
 */

const { initializeLogger } = require('../utils/logger');
const logger = initializeLogger();

/**
 * Parse a command string into a structured command object
 * @param {string} commandStr - The command string to parse
 * @returns {Object} Parsed command object
 */
function parseCommand(commandStr) {
  // Trim and normalize the command
  const normalizedCommand = commandStr.trim().toLowerCase();
  
  // Exit/quit command
  if (/^(quit|exit)$/i.test(normalizedCommand)) {
    return { type: 'QUIT' };
  }
  
  // Help command
  if (/^help$/i.test(normalizedCommand)) {
    return { type: 'HELP' };
  }
  
  // Status command
  if (/^status$/i.test(normalizedCommand)) {
    return { type: 'STATUS' };
  }
  
  // Next phase command
  if (/^(next|next phase|advance|end phase)$/i.test(normalizedCommand)) {
    return { type: 'NEXT_PHASE' };
  }
  
  // Initiative roll command
  const initiativeMatch = normalizedCommand.match(/^roll(?:\s+initiative)?(?:\s+(\d+))?$/i);
  if (initiativeMatch) {
    const specifiedRoll = initiativeMatch[1] ? parseInt(initiativeMatch[1], 10) : null;
    return { 
      type: 'INITIATIVE_ROLL',
      roll: specifiedRoll || (Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1)
    };
  }
  
  // Add unit command
  // Format: add [unit_type] at x,y
  const addUnitMatch = normalizedCommand.match(/^add\s+([a-z0-9_-]+)(?:\s+at\s+(\d+)[,\s]+(\d+))?$/i);
  if (addUnitMatch) {
    const unitType = addUnitMatch[1];
    const x = addUnitMatch[2] ? parseInt(addUnitMatch[2], 10) : 0;
    const y = addUnitMatch[3] ? parseInt(addUnitMatch[3], 10) : 0;
    
    return {
      type: 'ADD_UNIT',
      unitType,
      position: { x, y }
    };
  }
  
  // Add terrain command
  // Format: add terrain [terrain_type] at x,y
  const addTerrainMatch = normalizedCommand.match(/^add\s+terrain\s+([a-z_]+)(?:\s+at\s+(\d+)[,\s]+(\d+))?$/i);
  if (addTerrainMatch) {
    const terrainType = addTerrainMatch[1];
    const x = addTerrainMatch[2] ? parseInt(addTerrainMatch[2], 10) : 0;
    const y = addTerrainMatch[3] ? parseInt(addTerrainMatch[3], 10) : 0;
    
    return {
      type: 'ADD_TERRAIN',
      terrainType,
      position: { x, y }
    };
  }
  
  // Move command
  // Format: move [unit_id] to x,y [facing direction]
  const moveMatch = normalizedCommand.match(/^move\s+([a-z0-9_-]+)\s+to\s+(\d+)[,\s]+(\d+)(?:\s+facing\s+([a-z]+))?$/i);
  if (moveMatch) {
    const unitId = moveMatch[1];
    const x = parseInt(moveMatch[2], 10);
    const y = parseInt(moveMatch[3], 10);
    const facing = moveMatch[4] ? moveMatch[4].toUpperCase() : null;
    
    return {
      type: 'MOVE',
      unitId,
      position: { x, y },
      facing
    };
  }
  
  // Attack command
  // Format: attack [unit_id] target [target_id]
  // Alternative: fire [unit_id] at [target_id]
  const attackMatch = normalizedCommand.match(/^(attack|fire)\s+([a-z0-9_-]+)\s+(target|at)\s+([a-z0-9_-]+)$/i);
  if (attackMatch) {
    const attackerId = attackMatch[2];
    const targetId = attackMatch[4];
    
    return {
      type: 'ATTACK',
      attackerId,
      targetId
    };
  }
  
  // Display/list units command
  if (/^(list|show)\s+units$/i.test(normalizedCommand)) {
    return { type: 'LIST_UNITS' };
  }
  
  // Startup command for shutdown units
  // Format: startup [unit_id]
  const startupMatch = normalizedCommand.match(/^startup(?:\s+([a-z0-9_-]+))?$/i);
  if (startupMatch) {
    return {
      type: 'STARTUP',
      unitId: startupMatch[1] || null
    };
  }
  
  // Show heat command
  if (/^(show|display)\s+heat$/i.test(normalizedCommand)) {
    return { type: 'SHOW_HEAT' };
  }
  
  // Unknown command
  return {
    type: 'UNKNOWN',
    original: commandStr
  };
}

/**
 * Get help text based on the current game phase
 * @param {string} phase - Current game phase
 * @returns {string} Help text
 */
function getHelpText(phase) {
  const commonCommands = [
    'status - Show current game status',
    'list units - Show all units on the battlefield',
    'show heat - Display detailed heat information for all units',
    'help - Show this help text',
    'quit - Exit the game'
  ];
  
  let phaseSpecificCommands = [];
  
  switch (phase) {
    case 'SETUP':
      phaseSpecificCommands = [
        'add [unit_type] at x,y - Add a unit to the battlefield',
        'add terrain [terrain_type] at x,y - Add terrain to the battlefield',
        'next - Advance to initiative phase when setup is complete'
      ];
      break;
      
    case 'INITIATIVE':
      phaseSpecificCommands = [
        'roll - Roll for initiative',
        'roll [number] - Use specified initiative roll'
      ];
      break;
      
    case 'MOVEMENT':
      phaseSpecificCommands = [
        'move [unit_id] to x,y - Move a unit to the specified position',
        'move [unit_id] to x,y facing [direction] - Move with specific facing',
        'startup [unit_id] - Attempt to restart a shutdown unit',
        'next - End your movement phase'
      ];
      break;
      
    case 'COMBAT':
      phaseSpecificCommands = [
        'attack [unit_id] target [target_id] - Attack a target',
        'fire [unit_id] at [target_id] - Alternative attack syntax',
        'next - End your combat phase'
      ];
      break;
      
    case 'END':
      phaseSpecificCommands = [
        'next - End the current turn and start a new one'
      ];
      break;
      
    default:
      phaseSpecificCommands = [];
  }
  
  return `Available Commands (${phase} Phase):\n\n` +
    [...phaseSpecificCommands, ...commonCommands].join('\n');
}

module.exports = {
  parseCommand,
  getHelpText
}; 