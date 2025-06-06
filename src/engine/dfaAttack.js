/**
 * dfaAttack.js
 * Implements Death From Above (DFA) attack mechanics
 */

const { rollDice } = require('../utils/dice');

/**
 * Check if a unit can perform a DFA attack on a target
 * @param {Object} gameState - Current game state
 * @param {string} attackerId - ID of the attacking unit
 * @param {string} targetId - ID of the target unit
 * @returns {Object} Result with validity and reason
 */
function canPerformDFA(gameState, attackerId, targetId) {
  const attacker = gameState.battlefield.units.get(attackerId);
  const target = gameState.battlefield.units.get(targetId);
  
  if (!attacker || !target) {
    return { valid: false, reason: "Unit not found" };
  }
  
  // Only mechs can perform DFA
  if (attacker.type !== 'MECH') {
    return { valid: false, reason: "Only mechs can perform DFA" };
  }
  
  // Target must be a ground unit (no DFA against VTOLs or aerospace)
  if (target.type === 'AEROSPACE' || (target.type === 'VEHICLE' && target.moveType === 'VTOL')) {
    return { valid: false, reason: "Cannot perform DFA against flying units" };
  }
  
  // Attacker must have jumped this turn
  if (!attacker.status.hasJumped) {
    return { valid: false, reason: "Attacker must jump before performing DFA" };
  }
  
  // Attacker and target must be adjacent
  const distance = Math.sqrt(
    Math.pow(attacker.position.x - target.position.x, 2) + 
    Math.pow(attacker.position.y - target.position.y, 2)
  );
  
  if (distance > 1) {
    return { valid: false, reason: "Target must be adjacent to attacker" };
  }
  
  return { valid: true };
}

/**
 * Calculate the to-hit number for a DFA attack
 * @param {Object} attacker - Attacking unit
 * @param {Object} target - Target unit
 * @param {Object} gameState - Current game state
 * @returns {number} Target number to hit (2d6)
 */
function calculateDFAToHit(attacker, target, gameState) {
  // Base to-hit number
  let toHitNumber = 8;
  
  // Attacker's piloting skill
  toHitNumber -= attacker.skills.piloting || 4;
  
  // Target size modifier
  if (target.size === 'SMALL') toHitNumber += 1;
  if (target.size === 'LARGE') toHitNumber -= 1;
  
  // Target movement modifier
  if (target.status.hasMoved) {
    if (target.status.moveType === 'run') toHitNumber += 2;
    else if (target.status.moveType === 'walk') toHitNumber += 1;
  }
  
  // Terrain modifiers (simplified)
  const targetHex = gameState.battlefield.hexes.get(`${target.position.x},${target.position.y}`);
  if (targetHex && targetHex.cover) toHitNumber += 1;
  
  // Ensure to-hit is within bounds
  return Math.min(Math.max(toHitNumber, 2), 12);
}

/**
 * Calculate damage for a DFA attack
 * @param {Object} attacker - Attacking unit
 * @returns {Object} Damage dealt to target and attacker
 */
function calculateDFADamage(attacker) {
  // Basic DFA damage is based on attacker's tonnage
  const tonnage = attacker.tonnage || 30;
  
  // Target damage: 1 point per 10 tons of attacker (rounded up)
  // with double damage for locations hit
  const baseDamage = Math.ceil(tonnage / 10) * 2;
  
  // Attacker takes half the damage to their legs
  const attackerDamage = Math.ceil(baseDamage / 2);
  
  return {
    targetDamage: baseDamage,
    attackerDamage: attackerDamage
  };
}

/**
 * Determine hit locations for a DFA attack
 * @param {Object} target - Target unit
 * @returns {Object} Hit locations for target
 */
function determineDFAHitLocations(target) {
  // For mechs, DFA primarily hits upper locations
  if (target.type === 'MECH') {
    // Roll on hit table for mechs (simplified)
    const roll = rollDice(2, 6);
    
    let hitLocation;
    if (roll <= 4) hitLocation = 'HEAD';
    else if (roll <= 8) hitLocation = 'CENTER_TORSO';
    else if (roll <= 10) hitLocation = 'RIGHT_TORSO';
    else hitLocation = 'LEFT_TORSO';
    
    return { primary: hitLocation };
  }
  
  // For vehicles, hit is always on top armor
  if (target.type === 'VEHICLE') {
    return { primary: 'TOP' };
  }
  
  // For infantry, hit is on all units in hex
  if (target.type === 'INFANTRY') {
    return { primary: 'ALL' };
  }
  
  // Default
  return { primary: 'BODY' };
}

/**
 * Execute a DFA attack
 * @param {Object} gameState - Current game state
 * @param {string} attackerId - ID of attacking unit
 * @param {string} targetId - ID of target unit
 * @returns {Object} Attack result and updated game state
 */
function executeDFAAttack(gameState, attackerId, targetId) {
  const canDFA = canPerformDFA(gameState, attackerId, targetId);
  if (!canDFA.valid) {
    console.error(`Cannot perform DFA: ${canDFA.reason}`);
    return { success: false, message: canDFA.reason, gameState };
  }
  
  const attacker = gameState.battlefield.units.get(attackerId);
  const target = gameState.battlefield.units.get(targetId);
  
  // Calculate to-hit number
  const toHitNumber = calculateDFAToHit(attacker, target, gameState);
  
  // Roll to hit
  const hitRoll = rollDice(2, 6);
  const hit = hitRoll >= toHitNumber;
  
  if (!hit) {
    // Attack missed - attacker lands prone in the hex they were in
    attacker.status.prone = true;
    
    // Piloting skill roll to avoid damage
    const pilotingRoll = rollDice(2, 6);
    const pilotingCheck = pilotingRoll >= (attacker.skills.piloting + 3) || 7;
    
    if (!pilotingCheck) {
      // Failed piloting roll - attacker takes damage
      const fallDamage = Math.ceil(attacker.tonnage / 10);
      // Apply fall damage to attacker's legs (simplified)
      attacker.status.damage = (attacker.status.damage || 0) + fallDamage;
    }
    
    return {
      success: true,
      hit: false,
      message: `DFA missed! ${attacker.name} falls prone.`,
      gameState
    };
  }
  
  // Calculate damage
  const { targetDamage, attackerDamage } = calculateDFADamage(attacker);
  
  // Determine hit locations
  const hitLocations = determineDFAHitLocations(target);
  
  // Apply damage to target
  target.status.damage = (target.status.damage || 0) + targetDamage;
  
  // Apply damage to attacker
  attacker.status.damage = (attacker.status.damage || 0) + attackerDamage;
  
  // Attacker ends prone
  attacker.status.prone = true;
  
  // Piloting skill roll for target to remain standing
  if (target.type === 'MECH') {
    const targetPilotingRoll = rollDice(2, 6);
    const targetPilotingCheck = targetPilotingRoll >= (target.skills.piloting + 2) || 6;
    
    if (!targetPilotingCheck) {
      target.status.prone = true;
    }
  }
  
  // Generate heat for attacker (simplified)
  if (attacker.type === 'MECH') {
    attacker.status.heat = (attacker.status.heat || 0) + 2;
  }
  
  return {
    success: true,
    hit: true,
    damage: {
      targetDamage,
      attackerDamage,
      hitLocations
    },
    message: `DFA hit! ${attacker.name} deals ${targetDamage} damage to ${target.name}.`,
    gameState
  };
}

module.exports = {
  canPerformDFA,
  calculateDFAToHit,
  calculateDFADamage,
  executeDFAAttack
}; 