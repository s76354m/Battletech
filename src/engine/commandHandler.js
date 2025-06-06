// Import the jumpMovement module
const jumpMovement = require('./jumpMovement');
// Import the dfaAttack module (which we'll create next)
const dfaAttack = require('./dfaAttack');

/**
 * Executes a command on the game state
 * @param {Object} gameState - The current game state
 * @param {Object} command - The command to execute
 * @returns {Object} Updated game state
 */
function executeCommand(gameState, command) {
  // Deep clone the game state to avoid direct mutations
  const newGameState = JSON.parse(JSON.stringify(gameState));
  
  console.log(`Executing command: ${command.type}`);
  
  switch (command.type) {
    // ... existing cases ...
    
    case 'JUMP':
      // Execute jump movement
      jumpMovement.executeJumpMove(
        newGameState, 
        command.unitId, 
        command.position, 
        command.facing
      );
      
      // Log the jump
      const jumpingUnit = newGameState.battlefield.units.get(command.unitId);
      console.log(chalk.cyan(
        `${jumpingUnit.name} jumped to position (${command.position.x}, ${command.position.y}) ` +
        `facing ${command.facing}.`
      ));
      
      // Apply heat for jumping
      const unit = newGameState.battlefield.units.get(command.unitId);
      const distance = Math.sqrt(
        Math.pow(command.position.x - unit.previousPosition.x, 2) +
        Math.pow(command.position.y - unit.previousPosition.y, 2)
      );
      const heatGenerated = jumpMovement.calculateJumpHeat(unit, distance);
      
      if (heatGenerated > 0) {
        unit.status.heat += heatGenerated;
        console.log(chalk.yellow(`${unit.name} generates ${heatGenerated} heat from jumping.`));
      }
      
      // Mark the unit as having moved
      unit.status.hasMoved = true;
      unit.status.moveType = 'jump';
      
      break;
      
    case 'DFA':
      // Execute Death From Above attack
      const dfaResult = dfaAttack.executeDFAAttack(
        newGameState,
        command.attackerId,
        command.targetId
      );
      
      // Log the DFA result
      console.log(chalk.red(dfaResult.message));
      
      // Apply the result to both attacker and target
      const attacker = newGameState.battlefield.units.get(command.attackerId);
      attacker.status.hasFired = true;
      
      break;
    
    // ... existing cases ...
  }
  
  return newGameState;
} 