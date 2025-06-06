/**
 * Alpha Strike Special Abilities
 * Management and implementation of special unit abilities
 */

const logger = {
  info: console.log,
  warn: console.warn,
  error: console.error
};

/**
 * Special Abilities Registry
 * Contains definitions and implementations for all special abilities in Alpha Strike
 */
const SPECIAL_ABILITIES = {
  // Combat Abilities
  "AC": {
    name: "Anti-'Mech",
    description: "Infantry with this ability can use its full damage value against 'Mechs.",
    applicableUnitTypes: ["infantry"],
    type: "passive",
    implementation: {
      modifyDamage: (sourceUnit, targetUnit, damageAmount) => {
        if (sourceUnit.type === 'infantry' && targetUnit.type === 'mech') {
          // Allow full damage instead of reduced damage
          return damageAmount;
        }
        return damageAmount;
      },
      
      // New Anti-'Mech attack implementation
      canPerformAntiMechAttack: (sourceUnit, targetUnit, gameState) => {
        // Check if units are adjacent
        const sourcePos = sourceUnit.position;
        const targetPos = targetUnit.position;
        const distance = calculateDistance(sourcePos, targetPos);
        
        // Anti-Mech attacks require:
        // 1. Source unit is infantry with AC ability
        // 2. Target unit is a mech
        // 3. Units are adjacent
        return sourceUnit.type === 'infantry' && 
               targetUnit.type === 'mech' && 
               distance <= 1;
      },
      
      performAntiMechAttack: (gameState, sourceUnitId, targetUnitId) => {
        const sourceUnit = gameState.battlefield.units.get(sourceUnitId);
        const targetUnit = gameState.battlefield.units.get(targetUnitId);
        
        if (!sourceUnit || !targetUnit) return false;
        
        // Check if the attacker can perform Anti-Mech attack
        if (!hasSpecialAbility(sourceUnit, 'AC')) return false;
        if (targetUnit.type !== 'mech') return false;
        
        // Calculate special damage for Anti-Mech attack
        // Base damage is 1 + infantry squad strength percentage
        let baseDamage = 1;
        
        // Add bonus based on squad strength
        if (sourceUnit.status.squadStrength && sourceUnit.status.squadStrength.currentRatio) {
          // Add up to 1 additional point of damage based on squad strength
          baseDamage += Math.floor(sourceUnit.status.squadStrength.currentRatio);
        }
        
        // Battle Armor gets an additional +1 damage bonus
        if (sourceUnit.name.toLowerCase().includes('battle armor')) {
          baseDamage += 1;
        }
        
        // Roll for hit location (chance for critical effect)
        const hitLocationRoll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
        let criticalEffect = false;
        let pilotingCheck = false;
        
        // Special effects based on hit location
        if (hitLocationRoll >= 10) {
          // Hit to critical systems
          criticalEffect = true;
        }
        
        if (hitLocationRoll >= 8) {
          // Hit requiring piloting roll to avoid fall
          pilotingCheck = true;
        }
        
        // Log the action
        gameState.battleLog.push({
          type: 'ANTI_MECH_ATTACK',
          attackerId: sourceUnitId,
          targetId: targetUnitId,
          damage: baseDamage,
          hitLocation: hitLocationRoll,
          criticalEffect,
          pilotingCheck,
          timestamp: Date.now()
        });
        
        // Apply the damage
        const damageFunction = require('./gameState').applyDamage;
        const damageResult = damageFunction(gameState, targetUnitId, baseDamage, {
          attackType: 'anti-mech',
          attacker: sourceUnitId
        });
        
        // Apply critical hit if applicable
        if (criticalEffect) {
          const criticalHitFunction = require('./gameState').processCriticalHit;
          criticalHitFunction(gameState, targetUnitId, { forceCritical: true });
        }
        
        // Apply piloting check if applicable
        if (pilotingCheck) {
          // Roll for piloting check (simplified)
          const pilotingRoll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
          const pilotingTarget = 7; // Base difficulty
          
          if (pilotingRoll < pilotingTarget) {
            // Failed piloting check - mech falls
            targetUnit.status.effects.push('PRONE');
            
            // Log the effect
            gameState.battleLog.push({
              type: 'UNIT_PRONE',
              unitId: targetUnitId,
              cause: 'Anti-Mech attack',
              timestamp: Date.now()
            });
          }
        }
        
        return {
          success: true,
          damage: baseDamage,
          hitLocation: hitLocationRoll,
          criticalEffect,
          pilotingCheck,
          ...damageResult
        };
      }
    }
  },
  
  "ARM": {
    name: "Armored",
    description: "Unit ignores 1 point of damage per attack.",
    applicableUnitTypes: ["all"],
    type: "passive",
    implementation: {
      modifyIncomingDamage: (unit, damageAmount) => {
        return Math.max(0, damageAmount - 1);
      }
    }
  },
  
  "BFC": {
    name: "Battlefield Control",
    description: "Can prevent opponent from making overheat attacks or indirect fire.",
    applicableUnitTypes: ["mech", "vehicle"],
    type: "active",
    range: 2,
    implementation: {
      activationCheck: (unit, gameState) => {
        // This ability is automatically active if the unit has it
        return true;
      },
      affectsTarget: (sourceUnit, targetUnit, gameState) => {
        // Check if target is within the control radius (2 hexes)
        const sourcePos = sourceUnit.position;
        const targetPos = targetUnit.position;
        const distance = calculateDistance(sourcePos, targetPos);
        return distance <= 2;
      },
      preventAttackType: (targetUnit, attackType) => {
        // Prevent overheat attacks and indirect fire
        return attackType === 'overheat' || attackType === 'indirect';
      }
    }
  },
  
  "BHJ": {
    name: "Battle Armor Handling",
    description: "Can transport Battle Armor units.",
    applicableUnitTypes: ["mech", "vehicle"],
    implementation: {
      // Implementation would be in unit transport mechanics
    }
  },
  
  "CR": {
    name: "Counter-ECM",
    description: "Cancels ECM effects within 2 hexes.",
    applicableUnitTypes: ["mech", "vehicle"],
    type: "passive",
    range: 2,
    implementation: {
      counterAbility: "ECM",
      activationCheck: (unit, gameState) => true, // Always active
      affectsTarget: (sourceUnit, targetUnit, gameState) => {
        const sourcePos = sourceUnit.position;
        const targetPos = targetUnit.position;
        const distance = calculateDistance(sourcePos, targetPos);
        return distance <= 2;
      }
    }
  },
  
  "ECM": {
    name: "Electronic Countermeasures",
    description: "Provides +1 Target Movement Modifier to attacks against unit and all friendly units within 2 hexes.",
    applicableUnitTypes: ["mech", "vehicle"],
    type: "passive",
    range: 2,
    implementation: {
      modifyTargetMovementModifier: (targetUnit, gameState) => {
        // Check if target unit is protected by ECM
        if (isUnitInECMField(targetUnit, gameState)) {
          return 1; // Add +1 to the target movement modifier
        }
        return 0;
      }
    }
  },
  
  "HT": {
    name: "Heat",
    description: "Weapons generate heat.",
    applicableUnitTypes: ["mech"],
    implementation: {
      // This is a passive ability handled in heat tracking
    }
  },
  
  "IF": {
    name: "Indirect Fire",
    description: "Can make indirect attacks with +1 to-hit modifier.",
    applicableUnitTypes: ["mech", "vehicle"],
    type: "active",
    implementation: {
      canUseIndirectFire: () => true,
      modifyAttackRoll: (sourceUnit, targetUnit, attackType) => {
        if (attackType === 'indirect') {
          return -1; // -1 penalty to the attack roll (making it harder to hit)
        }
        return 0;
      }
    }
  },
  
  "LRM": {
    name: "Long-Range Missiles",
    description: "Has missile weapons that can use indirect fire.",
    applicableUnitTypes: ["all"],
    implementation: {
      // This is an indicator for indirect fire and UI options
      providesIndirectFire: () => true
    }
  },
  
  "MEL": {
    name: "Melee",
    description: "Can make physical attacks in addition to weapon attacks.",
    applicableUnitTypes: ["mech"],
    type: "active",
    implementation: {
      canPerformMelee: (sourceUnit, targetUnit, gameState) => {
        // Check if units are adjacent
        const sourcePos = sourceUnit.position;
        const targetPos = targetUnit.position;
        const distance = calculateDistance(sourcePos, targetPos);
        return distance <= 1;
      },
      getMeleeDamage: (unit) => {
        // Damage based on weight class of mech
        let damage = 1; // Light mech default
        
        // Determine damage based on armor value as a rough proxy for weight class
        if (unit.stats.armor >= 7) {
          damage = 3; // Assault class
        } else if (unit.stats.armor >= 6) {
          damage = 2; // Heavy class
        } else if (unit.stats.armor >= 4) {
          damage = 1; // Medium class
        }
        
        return damage;
      },
      performMelee: (gameState, sourceUnitId, targetUnitId) => {
        const sourceUnit = gameState.battlefield.units.get(sourceUnitId);
        const targetUnit = gameState.battlefield.units.get(targetUnitId);
        
        if (!sourceUnit || !targetUnit) return false;
        
        // Check if the attacker can perform melee
        if (!hasSpecialAbility(sourceUnit, 'MEL')) return false;
        
        // Calculate and apply damage
        const damage = SPECIAL_ABILITIES.MEL.implementation.getMeleeDamage(sourceUnit);
        
        // Log the action
        gameState.battleLog.push({
          type: 'MELEE_ATTACK',
          attackerId: sourceUnitId,
          targetId: targetUnitId,
          damage: damage,
          timestamp: Date.now()
        });
        
        // Apply the damage
        const damageFunction = require('./gameState').applyDamage;
        damageFunction(gameState, targetUnitId, damage);
        
        return true;
      }
    }
  },
  
  // Movement and Structure Abilities
  "HVY-CHAS": {
    name: "Heavy Chassis",
    description: "Unit gets +1 structure point.",
    applicableUnitTypes: ["vehicleprotomech"],
    implementation: {
      modifyStructure: (baseStructure) => baseStructure + 1
    }
  },
  
  "VTOL": {
    name: "Vertical Take-Off and Landing",
    description: "Aircraft that operates close to the ground. Ignores terrain movement costs.",
    applicableUnitTypes: ["vehicle"],
    implementation: {
      ignoresTerrainCosts: () => true,
      getElevation: () => 1 // VTOLs operate at elevation 1
    }
  },
  
  "RCN": {
    name: "Recon",
    description: "Provides +1 to initiative rolls and can spot for indirect fire.",
    applicableUnitTypes: ["mech", "vehicle"],
    type: "passive",
    implementation: {
      modifyInitiative: (unit, currentBonus) => {
        return currentBonus + 1; // Add +1 to initiative
      },
      canSpotForIndirectFire: () => true
    }
  },
  
  "AMS": {
    name: "Anti-Missile System",
    description: "Reduce damage from missile attacks by 1 point.",
    applicableUnitTypes: ["mech", "vehicle"],
    implementation: {
      modifyIncomingDamage: (unit, damageAmount, attackType) => {
        if (attackType === 'missile') {
          return Math.max(0, damageAmount - 1);
        }
        return damageAmount;
      }
    }
  },
  
  "ENE": {
    name: "Energy",
    description: "Attacks use only energy weapons.",
    applicableUnitTypes: ["all"],
    implementation: {
      // Affects UI and heat generation, primarily a marker
      getWeaponType: () => 'energy'
    }
  },
  
  "ENG": {
    name: "Engineer",
    description: "Can build or demolish bridges, clear woods, etc.",
    applicableUnitTypes: ["vehicle", "infantry"],
    implementation: {
      canPerformEngineeringAction: (unit, actionType, targetPosition, gameState) => {
        // Check if unit is adjacent to target
        const unitPos = unit.position;
        const distance = calculateDistance(unitPos, targetPosition);
        return distance <= 1;
      },
      performEngineeringAction: (gameState, unitId, actionType, targetPosition) => {
        // Implementation for building/clearing would go here
        // Not fully implemented in current game version
        return false;
      }
    }
  },
  
  "HARD": {
    name: "Hardened Armor",
    description: "Reduces critical hit chances by 1",
    applicableUnitTypes: ["all"],
    type: "passive",
    implementation: {
      modifyCriticalRoll: (unit, roll) => {
        return Math.max(2, roll - 1); // Lower critical roll by 1, minimum of 2
      }
    }
  },
  
  "PRB": {
    name: "Precision",
    description: "Improves critical hit chances by 1",
    applicableUnitTypes: ["all"],
    type: "passive",
    implementation: {
      modifyCriticalRoll: (unit, roll) => {
        return roll + 1; // Increase critical roll by 1
      }
    }
  },
  
  "DF": {
    name: "Direct Fire",
    description: "Removes minimum range penalties",
    applicableUnitTypes: ["mech", "vehicle"],
    type: "passive",
    implementation: {
      ignoreMinimumRange: () => true
    }
  },
  
  "REIN": {
    name: "Reinforced",
    description: "Unit doesn't suffer movement or weapon critical hits until structure reaches 0",
    applicableUnitTypes: ["all"],
    type: "passive",
    implementation: {
      preventCriticalType: (unit, critType) => {
        if (unit.status.damage.structure < unit.stats.structure &&
            (critType === 'MOVEMENT_HIT' || critType === 'WEAPON_HIT')) {
          return true; // Prevent this critical hit
        }
        return false;
      }
    }
  },
  
  // Movement Abilities
  "JJ": {
    name: "Jump Jets",
    description: "Allows jump movement, ignoring terrain movement costs",
    applicableUnitTypes: ["mech", "infantry"],
    type: "passive",
    implementation: {
      modifyMovement: (unit, terrainType, movementCost) => {
        // Jump movement ignores terrain costs
        return 1; // Standard cost regardless of terrain
      },
      
      // Death From Above attack implementation
      canPerformDFA: (sourceUnit, targetUnit, gameState) => {
        // Requirements for DFA:
        // 1. Unit must have jumped this turn
        // 2. Target must be in the same position the unit jumped to
        // 3. Unit must have jump capability
        
        // Check if the unit jumped this turn
        const hasJumped = sourceUnit.status.lastMoveType === 'jump';
        
        // Check if unit has jump capability
        const hasJumpCapability = sourceUnit.stats.movement.jump > 0;
        
        // Check if target is in same position
        const samePosition = 
          sourceUnit.position.x === targetUnit.position.x && 
          sourceUnit.position.y === targetUnit.position.y;
        
        return hasJumped && hasJumpCapability && samePosition;
      },
      
      performDFA: (gameState, sourceUnitId, targetUnitId) => {
        const sourceUnit = gameState.battlefield.units.get(sourceUnitId);
        const targetUnit = gameState.battlefield.units.get(targetUnitId);
        
        if (!sourceUnit || !targetUnit) return false;
        
        // Check if the DFA can be performed
        if (!hasSpecialAbility(sourceUnit, 'JJ')) return false;
        
        // Ensure the unit can perform DFA
        const canPerformDFA = applySpecialAbility(
          sourceUnit, 
          'JJ', 
          'canPerformDFA', 
          [sourceUnit, targetUnit, gameState]
        );
        
        if (!canPerformDFA) {
          return { success: false, reason: 'Cannot perform Death From Above attack' };
        }
        
        // Calculate damage
        // Base damage is the attacking unit's size + 1
        const attackerSize = sourceUnit.stats.size || Math.ceil(sourceUnit.stats.structure / 2);
        const targetSize = targetUnit.stats.size || Math.ceil(targetUnit.stats.structure / 2);
        
        const attackDamage = attackerSize + 1;
        const selfDamage = Math.ceil(targetSize / 2); // Attacker takes damage equal to half target's size
        
        // Log the action
        gameState.battleLog.push({
          type: 'DFA_ATTACK',
          attackerId: sourceUnitId,
          targetId: targetUnitId,
          damage: attackDamage,
          selfDamage: selfDamage,
          timestamp: Date.now()
        });
        
        // Apply damage to target
        const damageFunction = require('./gameState').applyDamage;
        const targetDamageResult = damageFunction(gameState, targetUnitId, attackDamage, {
          attackType: 'physical',
          attacker: sourceUnitId
        });
        
        // Apply self-damage to attacker
        const selfDamageResult = damageFunction(gameState, sourceUnitId, selfDamage, {
          attackType: 'dfa-self',
          attacker: sourceUnitId
        });
        
        // Both units must make piloting checks or become prone
        let attackerProne = false;
        let targetProne = false;
        
        // Simplified piloting checks (roll 2d6, need 8+ to succeed)
        const attackerPilotingRoll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
        const attackerPilotingTarget = 8;
        
        if (attackerPilotingRoll < attackerPilotingTarget) {
          // Failed piloting check - attacker falls
          sourceUnit.status.effects.push('PRONE');
          attackerProne = true;
          
          // Log the effect
          gameState.battleLog.push({
            type: 'UNIT_PRONE',
            unitId: sourceUnitId,
            cause: 'Failed DFA piloting check',
            timestamp: Date.now()
          });
        }
        
        // Target piloting check
        const targetPilotingRoll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
        const targetPilotingTarget = 8; // Harder for target
        
        if (targetPilotingRoll < targetPilotingTarget) {
          // Failed piloting check - target falls
          targetUnit.status.effects.push('PRONE');
          targetProne = true;
          
          // Log the effect
          gameState.battleLog.push({
            type: 'UNIT_PRONE',
            unitId: targetUnitId,
            cause: 'DFA impact',
            timestamp: Date.now()
          });
        }
        
        // Calculate heat for attacker (mechs only)
        if (sourceUnit.type === 'mech') {
          const heatFunction = require('./gameState').addHeat;
          const dfa_heat = 2; // DFA generates 2 heat
          heatFunction(gameState, sourceUnitId, dfa_heat);
        }
        
        return {
          success: true,
          attackDamage,
          selfDamage,
          attackerProne,
          targetProne,
          attackerPilotingRoll,
          targetPilotingRoll,
          targetDamageResult,
          selfDamageResult
        };
      }
    }
  }
};

/**
 * Helper Functions
 */

/**
 * Check if a unit is in an active ECM field
 * 
 * @param {Object} unit - The unit to check
 * @param {Object} gameState - Current game state
 * @returns {boolean} Whether unit is in ECM field
 */
function isUnitInECMField(unit, gameState) {
  // Get all units with ECM ability
  const ecmUnits = Array.from(gameState.battlefield.units.values())
    .filter(u => hasSpecialAbility(u, 'ECM'));
  
  // Check if any unit has counter-ECM that could negate ECM
  const crUnits = Array.from(gameState.battlefield.units.values())
    .filter(u => hasSpecialAbility(u, 'CR'));
  
  // Check if unit is protected by an ECM field
  for (const ecmUnit of ecmUnits) {
    // Skip if unit is enemy of the ECM unit (ECM only protects friendly units)
    if (unit.owner !== ecmUnit.owner) continue;
    
    // Get distance between unit and ECM unit
    const distance = calculateDistance(unit.position, ecmUnit.position);
    
    // Check if unit is within ECM range (2 hexes)
    if (distance <= 2) {
      // Check if ECM is negated by a counter-ECM unit
      let ecmNegated = false;
      
      for (const crUnit of crUnits) {
        // Skip if CR unit is friendly to the ECM unit (CR only affects enemy ECM)
        if (crUnit.owner === ecmUnit.owner) continue;
        
        // Get distance between ECM unit and CR unit
        const crDistance = calculateDistance(ecmUnit.position, crUnit.position);
        
        // Check if ECM unit is within CR range (2 hexes)
        if (crDistance <= 2) {
          ecmNegated = true;
          break;
        }
      }
      
      // Return true if ECM is not negated
      if (!ecmNegated) return true;
    }
  }
  
  return false;
}

/**
 * Calculate distance between two positions
 * 
 * @param {Object} pos1 - Position 1 {x, y}
 * @param {Object} pos2 - Position 2 {x, y}
 * @returns {number} Distance between positions
 */
function calculateDistance(pos1, pos2) {
  return Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2));
}

/**
 * Apply a special ability to modify a value
 * 
 * @param {Object} unit - The unit with the ability
 * @param {string} abilityCode - The code of the ability to apply
 * @param {string} functionName - The implementation function to call
 * @param {Array} params - Parameters to pass to the implementation function
 * @returns {*} The modified value or result
 */
function applySpecialAbility(unit, abilityCode, functionName, params = []) {
  // Check if the unit has the ability
  if (!hasSpecialAbility(unit, abilityCode)) return params[0]; // Return first param unchanged
  
  // Get the ability
  const ability = SPECIAL_ABILITIES[abilityCode];
  if (!ability || !ability.implementation || !ability.implementation[functionName]) {
    return params[0]; // Return first param unchanged if ability or function doesn't exist
  }
  
  // Call the implementation function with the unit and parameters
  return ability.implementation[functionName](unit, ...params);
}

/**
 * Check if a unit has a specific special ability
 * 
 * @param {Object} unit - Unit to check
 * @param {string} abilityCode - Code of the special ability
 * @returns {boolean} Whether the unit has the ability
 */
function hasSpecialAbility(unit, abilityCode) {
  // First check if unit is defined
  if (!unit) return false;
  
  // Check if unit has stats property
  if (!unit.stats) return false;
  
  // Check if unit has specialAbilities property and if it includes the ability
  return Array.isArray(unit.stats.specialAbilities) && unit.stats.specialAbilities.includes(abilityCode);
}

/**
 * Get all abilities for a specific unit type
 * 
 * @param {string} unitType - Type of unit
 * @returns {Array} Array of ability objects applicable to the unit type
 */
function getApplicableAbilities(unitType) {
  return Object.entries(SPECIAL_ABILITIES)
    .filter(([_, ability]) => {
      return ability.applicableUnitTypes.includes('all') || 
             ability.applicableUnitTypes.includes(unitType);
    })
    .map(([code, ability]) => ({
      code,
      name: ability.name,
      description: ability.description
    }));
}

/**
 * Apply multiple special abilities for a specific function
 * @param {Object} unit - The unit with abilities
 * @param {string} functionName - The implementation function to call
 * @param {Array} params - Parameters to pass to the implementation function
 * @returns {*} The modified value after applying all relevant abilities
 */
function applyAllSpecialAbilities(unit, functionName, params = []) {
  if (!unit.stats.specialAbilities || unit.stats.specialAbilities.length === 0) {
    return params[0]; // Return first param unchanged if no abilities
  }
  
  let result = params[0]; // Start with the initial value
  
  // Apply each ability that has the specified function
  for (const abilityCode of unit.stats.specialAbilities) {
    const ability = SPECIAL_ABILITIES[abilityCode];
    if (ability && ability.implementation && ability.implementation[functionName]) {
      // Update the first parameter with the current result
      const updatedParams = [result, ...params.slice(1)];
      result = ability.implementation[functionName](unit, ...updatedParams);
    }
  }
  
  return result;
}

module.exports = {
  SPECIAL_ABILITIES,
  applySpecialAbility,
  hasSpecialAbility,
  getApplicableAbilities,
  isUnitInECMField,
  applyAllSpecialAbilities,
  calculateDistance
}; 