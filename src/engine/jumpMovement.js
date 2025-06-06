/**
 * Jump Movement Module for Alpha Strike
 * Handles jump movement mechanics, validations, and special attacks
 */

/**
 * Checks if a unit has jump capability
 * @param {Object} unit - The unit to check
 * @returns {boolean} Whether the unit can jump
 */
function canJump(unit) {
  // Check if the unit has jump jets and isn't destroyed or shutdown
  return (
    unit && 
    unit.equipment && 
    unit.equipment.some(eq => eq.type === 'JUMP_JET' && eq.status === 'functional') &&
    !unit.status.destroyed && 
    !unit.status.shutdown
  );
}

/**
 * Gets the maximum jump distance for a unit
 * @param {Object} unit - The unit to check
 * @returns {number} Maximum jump distance in hexes
 */
function getJumpDistance(unit) {
  if (!canJump(unit)) return 0;
  
  // Count functional jump jets
  const jumpJets = unit.equipment.filter(
    eq => eq.type === 'JUMP_JET' && eq.status === 'functional'
  );
  
  // Calculate jump distance based on tonnage and number of jump jets
  // Basic rule: 1 hex per jump jet, with maximum based on unit weight
  const jumpDistancePerJet = 1;
  let maxJumpDistance;
  
  if (unit.tonnage <= 35) { // Light mechs
    maxJumpDistance = 8;
  } else if (unit.tonnage <= 55) { // Medium mechs
    maxJumpDistance = 6;
  } else if (unit.tonnage <= 75) { // Heavy mechs
    maxJumpDistance = 5;
  } else { // Assault mechs
    maxJumpDistance = 4;
  }
  
  return Math.min(jumpJets.length * jumpDistancePerJet, maxJumpDistance);
}

/**
 * Calculate valid hexes that the unit can jump to
 * @param {Object} gameState - Current game state
 * @param {string} unitId - ID of the unit to jump
 * @returns {Array} Array of valid positions {x, y} the unit can jump to
 */
function getValidJumpPositions(gameState, unitId) {
  const unit = gameState.battlefield.units.get(unitId);
  if (!canJump(unit)) return [];
  
  const maxDistance = getJumpDistance(unit);
  const validPositions = [];
  const currentPos = unit.position;
  
  // Get all positions within jump distance
  for (let x = currentPos.x - maxDistance; x <= currentPos.x + maxDistance; x++) {
    for (let y = currentPos.y - maxDistance; y <= currentPos.y + maxDistance; y++) {
      // Skip out-of-bounds positions
      if (x < 0 || y < 0 || x >= gameState.battlefield.width || y >= gameState.battlefield.height) {
        continue;
      }
      
      // Calculate distance from current position
      const distance = Math.sqrt(
        Math.pow(x - currentPos.x, 2) + 
        Math.pow(y - currentPos.y, 2)
      );
      
      // Check if within jump range
      if (distance <= maxDistance) {
        // Check if hex is occupied
        const isOccupied = [...gameState.battlefield.units.values()].some(
          u => u.position.x === x && u.position.y === y && u.id !== unitId
        );
        
        // If not occupied, add to valid positions
        if (!isOccupied) {
          validPositions.push({ x, y });
        }
      }
    }
  }
  
  return validPositions;
}

/**
 * Calculate heat generated from a jump
 * @param {Object} unit - The unit performing the jump
 * @param {number} distance - Distance jumped
 * @returns {number} Heat generated
 */
function calculateJumpHeat(unit, distance) {
  // Basic rule: Generate 1 heat per hex jumped, with minimum heat of 3
  const heatPerHex = 1;
  const minHeat = 3;
  
  return Math.max(Math.ceil(distance) * heatPerHex, minHeat);
}

/**
 * Execute a jump move
 * @param {Object} gameState - Current game state
 * @param {string} unitId - ID of the unit jumping
 * @param {Object} position - Destination position {x, y}
 * @param {number} facing - New facing direction (0-5)
 * @returns {Object} Updated game state
 */
function executeJumpMove(gameState, unitId, position, facing) {
  const unit = gameState.battlefield.units.get(unitId);
  
  if (!canJump(unit)) {
    console.error(`Unit ${unit.name} cannot jump!`);
    return gameState;
  }
  
  const validPositions = getValidJumpPositions(gameState, unitId);
  const isValidPosition = validPositions.some(
    pos => pos.x === position.x && pos.y === position.y
  );
  
  if (!isValidPosition) {
    console.error(`Position ${position.x}, ${position.y} is not a valid jump destination!`);
    return gameState;
  }
  
  // Store previous position for reference
  unit.previousPosition = { ...unit.position };
  
  // Update unit position and facing
  unit.position = { ...position };
  unit.facing = facing;
  
  // Mark that the unit has jumped (used for DFA eligibility)
  unit.status.hasJumped = true;
  
  return gameState;
}

/**
 * Check if a Death From Above attack is possible
 * @param {Object} gameState - Current game state
 * @param {string} attackerId - Attacking unit ID
 * @param {string} targetId - Target unit ID
 * @returns {Object} Validity and modifiers {valid, toHitModifier, damageModifier}
 */
function canPerformDFA(gameState, attackerId, targetId) {
  const attacker = gameState.battlefield.units.get(attackerId);
  const target = gameState.battlefield.units.get(targetId);
  
  if (!attacker || !target) {
    return { valid: false, reason: "Unit not found" };
  }
  
  // Only mechs can perform DFA
  if (attacker.type !== 'mech') {
    return { valid: false, reason: "Only mechs can perform DFA" };
  }
  
  // Attacker must have jump capability
  if (!canJump(attacker)) {
    return { valid: false, reason: "Attacker cannot jump" };
  }
  
  // Attacker must have jumped this turn
  if (!attacker.status.hasJumped) {
    return { valid: false, reason: "Attacker must jump before performing DFA" };
  }
  
  // Target must be adjacent
  const distance = Math.sqrt(
    Math.pow(target.position.x - attacker.position.x, 2) + 
    Math.pow(target.position.y - attacker.position.y, 2)
  );
  
  if (distance > 1) {
    return { valid: false, reason: "Target must be adjacent" };
  }
  
  // Calculate modifiers
  const toHitModifier = 1; // +1 to hit for DFA
  const damageModifier = 2; // Double damage for successful DFA
  
  return {
    valid: true,
    toHitModifier,
    damageModifier
  };
}

module.exports = {
  canJump,
  getJumpDistance,
  getValidJumpPositions,
  calculateJumpHeat,
  executeJumpMove,
  canPerformDFA
}; 