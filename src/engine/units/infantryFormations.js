/**
 * Infantry Formations Module
 * 
 * This module provides specialized formation types and tactics for infantry units,
 * enhancing their battlefield effectiveness against various targets.
 */

const { SQUAD_FORMATION } = require('./enhancedInfantry');
const { TERRAIN_TYPE } = require('../movement/terrainEffects');

// Formation bonuses for different terrain types
const FORMATION_TERRAIN_BONUSES = {
  [SQUAD_FORMATION.DISPERSED]: {
    [TERRAIN_TYPE.WOODS]: { defense: 2, movement: 0 },
    [TERRAIN_TYPE.ROUGH]: { defense: 1, movement: 0 },
    [TERRAIN_TYPE.WATER]: { defense: -1, movement: -1 },
    [TERRAIN_TYPE.BUILDING]: { defense: 1, movement: -1 }
  },
  [SQUAD_FORMATION.CONCENTRATED]: {
    [TERRAIN_TYPE.WOODS]: { defense: 0, movement: -1 },
    [TERRAIN_TYPE.ROUGH]: { defense: -1, movement: -1 },
    [TERRAIN_TYPE.WATER]: { defense: -2, movement: -2 },
    [TERRAIN_TYPE.BUILDING]: { defense: 2, movement: 0 }
  },
  [SQUAD_FORMATION.STEALTH]: {
    [TERRAIN_TYPE.WOODS]: { defense: 3, movement: -1, detection: -3 },
    [TERRAIN_TYPE.ROUGH]: { defense: 2, movement: -1, detection: -2 },
    [TERRAIN_TYPE.WATER]: { defense: 0, movement: -2, detection: -1 },
    [TERRAIN_TYPE.BUILDING]: { defense: 2, movement: -1, detection: -3 }
  },
  [SQUAD_FORMATION.DEFENSIVE]: {
    [TERRAIN_TYPE.WOODS]: { defense: 2, movement: -2 },
    [TERRAIN_TYPE.ROUGH]: { defense: 1, movement: -2 },
    [TERRAIN_TYPE.WATER]: { defense: -1, movement: -3 },
    [TERRAIN_TYPE.BUILDING]: { defense: 3, movement: -1 }
  }
};

// Tactical specializations for infantry
const INFANTRY_TACTICS = {
  AMBUSH: 'AMBUSH',         // Bonus to first attack from hidden position
  GUERRILLA: 'GUERRILLA',   // Enhanced retreat and reposition capabilities
  ASSAULT: 'ASSAULT',       // Improved damage when charging into combat
  DEFENSIVE: 'DEFENSIVE',   // Improved defensive capabilities
  ANTI_MECH: 'ANTI_MECH',   // Specialized against mechs
  ANTI_VEHICLE: 'ANTI_VEHICLE', // Specialized against vehicles
  ANTI_INFANTRY: 'ANTI_INFANTRY' // Specialized against other infantry
};

/**
 * Calculate formation bonus for a specific terrain type
 * @param {Object} infantry - Infantry unit
 * @param {string} terrainType - Type of terrain
 * @returns {Object} Applicable bonuses
 */
function calculateFormationTerrainBonus(infantry, terrainType) {
  if (!infantry || !infantry.formation || !terrainType) {
    return { defense: 0, movement: 0, detection: 0 };
  }
  
  const formationBonuses = FORMATION_TERRAIN_BONUSES[infantry.formation] || {};
  const terrainBonuses = formationBonuses[terrainType] || { defense: 0, movement: 0, detection: 0 };
  
  return terrainBonuses;
}

/**
 * Apply tactical specialization to infantry
 * @param {Object} infantry - Infantry unit
 * @param {string} tactic - Tactical specialization to apply
 * @returns {Object} Updated infantry unit
 */
function applyInfantryTactic(infantry, tactic) {
  if (!Object.values(INFANTRY_TACTICS).includes(tactic)) {
    return infantry;
  }
  
  // Create a copy to avoid direct state mutation
  const updatedInfantry = { ...infantry };
  
  // Store current tactic
  updatedInfantry.currentTactic = tactic;
  
  // Apply tactic-specific modifications
  switch (tactic) {
    case INFANTRY_TACTICS.AMBUSH:
      updatedInfantry.firstAttackBonus = 2;
      updatedInfantry.detectionModifier = -3;
      updatedInfantry.movementModifier = -1;
      break;
      
    case INFANTRY_TACTICS.GUERRILLA:
      updatedInfantry.retreatBonus = 2;
      updatedInfantry.movementModifier = 1;
      updatedInfantry.detectionModifier = -2;
      break;
      
    case INFANTRY_TACTICS.ASSAULT:
      updatedInfantry.chargeBonus = 2;
      updatedInfantry.movementModifier = 1;
      updatedInfantry.defenseModifier = -1;
      break;
      
    case INFANTRY_TACTICS.DEFENSIVE:
      updatedInfantry.defenseModifier = 2;
      updatedInfantry.movementModifier = -1;
      updatedInfantry.damageReduction = 1;
      break;
      
    case INFANTRY_TACTICS.ANTI_MECH:
      updatedInfantry.antiMechBonus = 2;
      updatedInfantry.antiVehicleBonus = -1;
      updatedInfantry.antiInfantryBonus = -1;
      break;
      
    case INFANTRY_TACTICS.ANTI_VEHICLE:
      updatedInfantry.antiVehicleBonus = 2;
      updatedInfantry.antiMechBonus = -1;
      updatedInfantry.antiInfantryBonus = 0;
      break;
      
    case INFANTRY_TACTICS.ANTI_INFANTRY:
      updatedInfantry.antiInfantryBonus = 2;
      updatedInfantry.antiMechBonus = -1;
      updatedInfantry.antiVehicleBonus = -1;
      break;
  }
  
  return updatedInfantry;
}

/**
 * Calculate optimal formation for current terrain and target
 * @param {Object} infantry - Infantry unit
 * @param {string} terrainType - Current terrain type
 * @param {Object} target - Target unit (optional)
 * @returns {string} Recommended formation
 */
function recommendFormation(infantry, terrainType, target = null) {
  // Default to dispersed if no specific recommendation
  let bestFormation = SQUAD_FORMATION.DISPERSED;
  
  // If target is present, adjust based on target type
  if (target) {
    if (target.type === 'MECH') {
      // Against mechs
      if (terrainType === TERRAIN_TYPE.WOODS || terrainType === TERRAIN_TYPE.BUILDING) {
        bestFormation = SQUAD_FORMATION.STEALTH;
      } else {
        bestFormation = SQUAD_FORMATION.CONCENTRATED;
      }
    } else if (target.type === 'VEHICLE') {
      // Against vehicles
      bestFormation = SQUAD_FORMATION.CONCENTRATED;
    } else if (target.type === 'INFANTRY') {
      // Against infantry
      bestFormation = SQUAD_FORMATION.DISPERSED;
    }
  } else {
    // No target, optimize for terrain
    switch (terrainType) {
      case TERRAIN_TYPE.WOODS:
      case TERRAIN_TYPE.ROUGH:
        bestFormation = SQUAD_FORMATION.STEALTH;
        break;
      case TERRAIN_TYPE.BUILDING:
        bestFormation = SQUAD_FORMATION.DEFENSIVE;
        break;
      case TERRAIN_TYPE.WATER:
        bestFormation = SQUAD_FORMATION.CONCENTRATED;
        break;
      default:
        bestFormation = SQUAD_FORMATION.DISPERSED;
    }
  }
  
  // Consider current fatigue level
  if (infantry.fatigue > 7) {
    // Exhausted units should prefer defensive formation
    bestFormation = SQUAD_FORMATION.DEFENSIVE;
  }
  
  return bestFormation;
}

/**
 * Calculate optimal tactic for current situation
 * @param {Object} infantry - Infantry unit
 * @param {string} terrainType - Current terrain type
 * @param {Object} target - Target unit (optional)
 * @param {boolean} isHidden - Whether unit is currently hidden
 * @returns {string} Recommended tactic
 */
function recommendTactic(infantry, terrainType, target = null, isHidden = false) {
  // Default tactic
  let bestTactic = INFANTRY_TACTICS.DEFENSIVE;
  
  // If hidden and with good cover, ambush is strong
  if (isHidden && (terrainType === TERRAIN_TYPE.WOODS || terrainType === TERRAIN_TYPE.BUILDING)) {
    bestTactic = INFANTRY_TACTICS.AMBUSH;
  }
  
  // If target present, specialize based on target type
  if (target) {
    if (target.type === 'MECH') {
      bestTactic = INFANTRY_TACTICS.ANTI_MECH;
    } else if (target.type === 'VEHICLE') {
      bestTactic = INFANTRY_TACTICS.ANTI_VEHICLE;
    } else if (target.type === 'INFANTRY') {
      bestTactic = INFANTRY_TACTICS.ANTI_INFANTRY;
    }
  }
  
  // Consider infantry status
  if (infantry.troopCount < infantry.maxTroopCount * 0.5) {
    // Low on troops, prioritize survival
    bestTactic = INFANTRY_TACTICS.GUERRILLA;
  }
  
  // Consider terrain
  if (terrainType === TERRAIN_TYPE.OPEN) {
    // In open ground, either assault or retreat
    bestTactic = infantry.troopCount > infantry.maxTroopCount * 0.7 
      ? INFANTRY_TACTICS.ASSAULT 
      : INFANTRY_TACTICS.GUERRILLA;
  }
  
  return bestTactic;
}

/**
 * Calculate visibility modifier for infantry in current formation and terrain
 * @param {Object} infantry - Infantry unit
 * @param {string} terrainType - Type of terrain
 * @param {string} timeOfDay - Current time of day (DAY, DUSK, NIGHT)
 * @returns {number} Visibility modifier (negative is harder to detect)
 */
function calculateVisibilityModifier(infantry, terrainType, timeOfDay) {
  // Start with formation-specific terrain bonus
  const terrainBonus = calculateFormationTerrainBonus(infantry, terrainType);
  
  // Base visibility modifier from terrain bonus
  let visibilityModifier = terrainBonus.detection || 0;
  
  // Factor in formation
  if (infantry.formation === SQUAD_FORMATION.STEALTH) {
    visibilityModifier -= 2;
  } else if (infantry.formation === SQUAD_FORMATION.DISPERSED) {
    visibilityModifier -= 1;
  } else if (infantry.formation === SQUAD_FORMATION.CONCENTRATED) {
    visibilityModifier += 1;
  }
  
  // Adjust for time of day
  if (timeOfDay === 'NIGHT') {
    visibilityModifier -= 3;
  } else if (timeOfDay === 'DUSK') {
    visibilityModifier -= 1;
  }
  
  // Account for unit movement (moving units are more visible)
  if (infantry.hasMovedThisTurn) {
    visibilityModifier += 2;
  }
  
  // Account for unit's detection modifier from tactics
  visibilityModifier += infantry.detectionModifier || 0;
  
  return visibilityModifier;
}

/**
 * Calculate overall effectiveness score for infantry in current situation
 * @param {Object} infantry - Infantry unit
 * @param {string} terrainType - Current terrain type
 * @param {Object} target - Target unit (optional)
 * @param {Object} weather - Current weather conditions
 * @returns {number} Effectiveness score (0-10)
 */
function calculateEffectivenessScore(infantry, terrainType, target = null, weather = { visibility: 'NORMAL' }) {
  let score = 5; // Base score
  
  // Factor in terrain bonuses
  const terrainBonus = calculateFormationTerrainBonus(infantry, terrainType);
  score += terrainBonus.defense / 2;
  
  // Factor in troop count
  const troopRatio = infantry.troopCount / infantry.maxTroopCount;
  score = score * troopRatio;
  
  // Factor in formation effectiveness for target
  if (target) {
    if (target.type === 'MECH') {
      if (infantry.formation === SQUAD_FORMATION.STEALTH || 
          infantry.formation === SQUAD_FORMATION.CONCENTRATED) {
        score += 1;
      }
      
      // Anti-mech equipment bonus
      if (infantry.antiMechEquipment && infantry.antiMechEquipment.length > 0) {
        score += infantry.antiMechEquipment.length;
      }
    } else if (target.type === 'VEHICLE') {
      if (infantry.formation === SQUAD_FORMATION.CONCENTRATED) {
        score += 2;
      }
    } else if (target.type === 'INFANTRY') {
      if (infantry.formation === SQUAD_FORMATION.DISPERSED) {
        score += 1;
      }
    }
  }
  
  // Factor in weather
  if (weather.visibility === 'LOW') {
    if (infantry.formation === SQUAD_FORMATION.STEALTH) {
      score += 2;
    } else {
      score -= 1;
    }
  }
  
  // Factor in fatigue
  score -= infantry.fatigue / 3;
  
  // Factor in tactical bonuses
  if (infantry.currentTactic) {
    switch (infantry.currentTactic) {
      case INFANTRY_TACTICS.ANTI_MECH:
        if (target && target.type === 'MECH') {
          score += 2;
        } else {
          score -= 1;
        }
        break;
      case INFANTRY_TACTICS.ANTI_VEHICLE:
        if (target && target.type === 'VEHICLE') {
          score += 2;
        }
        break;
      case INFANTRY_TACTICS.AMBUSH:
        if (!infantry.hasAttackedThisTurn && !infantry.hasMovedThisTurn) {
          score += 3;
        }
        break;
    }
  }
  
  // Clamp to 0-10 range
  return Math.max(0, Math.min(10, score));
}

module.exports = {
  FORMATION_TERRAIN_BONUSES,
  INFANTRY_TACTICS,
  calculateFormationTerrainBonus,
  applyInfantryTactic,
  recommendFormation,
  recommendTactic,
  calculateVisibilityModifier,
  calculateEffectivenessScore
}
