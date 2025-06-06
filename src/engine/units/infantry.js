/**
 * infantry.js
 * Handles infantry unit mechanics for BattleTech
 */

const { roll2d6 } = require('../../utils/dice');
const { calculateDistance } = require('../../utils/hexUtils');

// Infantry types
const INFANTRY_TYPES = {
	FOOT: 'foot',
	MOTORIZED: 'motorized',
	MECHANIZED: 'mechanized',
	JUMP: 'jump'
};

// Infantry equipment types
const EQUIPMENT_TYPES = {
	STANDARD: 'standard',
	LASER: 'laser',
	SRM: 'srm',
	MACHINE_GUN: 'machine_gun',
	FLAMER: 'flamer',
	INFERNO: 'inferno'
};

/**
 * Create a new infantry platoon
 * @param {Object} options - Infantry configuration options
 * @returns {Object} New infantry platoon object
 */
function createInfantryPlatoon(options = {}) {
	const {
		id = `infantry_${Date.now()}`,
		name = 'Infantry Platoon',
		team = 'neutral',
		type = INFANTRY_TYPES.FOOT,
		troopCount = 28,
		maxTroopCount = 28,
		equipment = EQUIPMENT_TYPES.STANDARD,
		position = null,
		experience = 4 // Default to regular (4)
	} = options;
	
	// Calculate movement capabilities based on type
	let walkMP = 1; // Default for foot infantry
	let jumpMP = 0;
	
	if (type === INFANTRY_TYPES.MOTORIZED) {
		walkMP = 3;
	} else if (type === INFANTRY_TYPES.MECHANIZED) {
		walkMP = 2;
	} else if (type === INFANTRY_TYPES.JUMP) {
		walkMP = 1;
		jumpMP = 2;
	}
	
	return {
		id,
		name,
		team,
		unitType: 'infantry',
		infantryType: type,
		equipment,
		troopCount,
		maxTroopCount,
		position,
		experience,
		walkMP,
		jumpMP,
		currentMP: walkMP,
		hasMoved: false,
		hasFired: false,
		isBreaking: false,
		isBroken: false,
		morale: 8, // Default morale value
		damage: calculateInfantryDamage(troopCount, equipment)
	};
}

/**
 * Calculate infantry damage output based on troop count and equipment
 * @param {number} troopCount - Current number of troops
 * @param {string} equipment - Equipment type
 * @returns {number} Damage value
 */
function calculateInfantryDamage(troopCount, equipment) {
	// Base damage factor for standard rifles
	let damagePerTroop = 0.05;
	
	// Adjust damage factor based on equipment
	if (equipment === EQUIPMENT_TYPES.LASER) {
		damagePerTroop = 0.07;
	} else if (equipment === EQUIPMENT_TYPES.SRM) {
		damagePerTroop = 0.1;
	} else if (equipment === EQUIPMENT_TYPES.MACHINE_GUN) {
		damagePerTroop = 0.08;
	} else if (equipment === EQUIPMENT_TYPES.FLAMER) {
		damagePerTroop = 0.06;
	} else if (equipment === EQUIPMENT_TYPES.INFERNO) {
		damagePerTroop = 0.04; // Lower direct damage but adds heat
	}
	
	// Calculate total damage
	const damage = Math.max(1, Math.round(troopCount * damagePerTroop));
	
	return damage;
}

/**
 * Update infantry after taking damage
 * @param {Object} infantry - Infantry platoon object
 * @param {number} damagePoints - Amount of damage taken
 * @returns {Object} Updated infantry object
 */
function applyDamageToInfantry(infantry, damagePoints) {
	// Calculate troops lost (1 troop per 0.5 damage points)
	const troopsLost = Math.ceil(damagePoints * 2);
	const newCount = Math.max(0, infantry.troopCount - troopsLost);
	
	// Update infantry
	infantry.troopCount = newCount;
	
	// Recalculate damage output
	infantry.damage = calculateInfantryDamage(newCount, infantry.equipment);
	
	// Check if squad is eliminated
	if (newCount === 0) {
		infantry.isEliminated = true;
	} else {
		// Check for morale if troops lost
		if (troopsLost > 0) {
			checkInfantryMorale(infantry, troopsLost);
		}
	}
	
	return infantry;
}

/**
 * Check infantry morale after taking casualties
 * @param {Object} infantry - Infantry platoon object
 * @param {number} casualties - Number of troops lost
 * @returns {Object} Updated infantry with morale check results
 */
function checkInfantryMorale(infantry, casualties) {
	// Calculate casualties percentage
	const casualtyPercentage = (casualties / infantry.maxTroopCount) * 100;
	
	// Determine morale check modifier
	let moraleModifier = 0;
	
	if (casualtyPercentage >= 50) {
		moraleModifier = -3; // -3 for 50%+ casualties
	} else if (casualtyPercentage >= 30) {
		moraleModifier = -2; // -2 for 30-49% casualties
	} else if (casualtyPercentage >= 10) {
		moraleModifier = -1; // -1 for 10-29% casualties
	}
	
	// Additional modifiers
	if (infantry.isBreaking) {
		moraleModifier -= 1; // -1 if already breaking
	}
	
	// Roll morale check
	const moraleRoll = roll2d6();
	const moraleCheck = moraleRoll + moraleModifier;
	const success = moraleCheck >= infantry.morale;
	
	// Update infantry status
	if (!success) {
		if (infantry.isBreaking) {
			infantry.isBroken = true; // Failed while breaking = broken
		} else {
			infantry.isBreaking = true; // First failure = breaking
		}
	}
	
	// Add morale check result to infantry
	infantry.lastMoraleCheck = {
		roll: moraleRoll,
		modifier: moraleModifier,
		result: moraleCheck,
		success
	};
	
	return infantry;
}

/**
 * Calculate to-hit number for infantry attack
 * @param {Object} infantry - Attacking infantry
 * @param {Object} target - Target unit
 * @param {Object} gameState - Current game state
 * @returns {number} To-hit target number
 */
function calculateInfantryToHit(infantry, target, gameState) {
	// Base to-hit is the infantry's experience rating
	let baseToHit = infantry.experience;
	
	// Calculate distance
	const distance = calculateDistance(infantry.position, target.position);
	
	// Apply range modifiers
	if (distance > 3) {
		baseToHit += 2; // Long range
	} else if (distance > 1) {
		baseToHit += 1; // Medium range
	}
	
	// Apply target movement modifier
	baseToHit += target.defenseModifier || 0;
	
	// Apply terrain modifiers
	const targetHex = gameState.map.getHex(target.position.x, target.position.y);
	if (targetHex) {
		if (targetHex.cover) {
			baseToHit += 1; // +1 for partial cover
		}
		if (targetHex.terrain === 'woods') {
			baseToHit += 1; // +1 for woods
		}
		if (targetHex.terrain === 'heavy_woods') {
			baseToHit += 2; // +2 for heavy woods
		}
	}
	
	// Apply status modifiers
	if (infantry.hasMoved) {
		baseToHit += 1; // +1 if moved
	}
	if (infantry.isBreaking) {
		baseToHit += 2; // +2 if breaking
	}
	
	return baseToHit;
}

/**
 * Execute an infantry attack
 * @param {Object} infantry - Attacking infantry
 * @param {Object} target - Target unit
 * @param {Object} gameState - Current game state
 * @returns {Object} Attack result
 */
function executeInfantryAttack(infantry, target, gameState) {
	// Check if attack is possible
	if (!canInfantryAttack(infantry, target, gameState)) {
		return {
			success: false,
			message: "Attack not possible"
		};
	}
	
	// Calculate to-hit number
	const toHitNumber = calculateInfantryToHit(infantry, target, gameState);
	
	// Roll to hit
	const hitRoll = roll2d6();
	const hit = hitRoll >= toHitNumber;
	
	// Initialize result
	const result = {
		success: true,
		hit,
		toHitNumber,
		roll: hitRoll
	};
	
	// If hit, calculate and apply damage
	if (hit) {
		// Base damage from infantry unit
		let damage = infantry.damage;
		
		// Calculate distance
		const distance = calculateDistance(infantry.position, target.position);
		
		// Apply range modifiers to damage
		if (distance > 3) {
			damage = Math.max(1, Math.floor(damage * 0.5)); // 50% damage at long range
		} else if (distance > 1) {
			damage = Math.max(1, Math.floor(damage * 0.75)); // 75% damage at medium range
		}
		
		result.damage = damage;
		
		// Handle special equipment effects
		if (infantry.equipment === EQUIPMENT_TYPES.INFERNO) {
			result.heatDamage = Math.ceil(damage * 1.5); // Inferno adds heat
		} else if (infantry.equipment === EQUIPMENT_TYPES.FLAMER) {
			result.heatDamage = Math.ceil(damage * 0.5); // Flamers add some heat
		}
		
		// Determine hit location (infantry typically hits exposed locations)
		// For mechs, more likely to hit legs and arms
		if (target.unitType === 'mech') {
			const locationRoll = Math.random();
			if (locationRoll < 0.3) {
				result.location = 'right_leg';
			} else if (locationRoll < 0.6) {
				result.location = 'left_leg';
			} else if (locationRoll < 0.7) {
				result.location = 'right_arm';
			} else if (locationRoll < 0.8) {
				result.location = 'left_arm';
			} else {
				result.location = 'center_torso';
			}
		}
	}
	
	// Mark infantry as having fired
	infantry.hasFired = true;
	
	return result;
}

/**
 * Check if infantry can attack a target
 * @param {Object} infantry - Attacking infantry
 * @param {Object} target - Target unit
 * @param {Object} gameState - Current game state
 * @returns {boolean} Whether attack is possible
 */
function canInfantryAttack(infantry, target, gameState) {
	// Check if infantry has been eliminated
	if (infantry.isEliminated || infantry.troopCount <= 0) {
		return false;
	}
	
	// Check if infantry has already fired
	if (infantry.hasFired) {
		return false;
	}
	
	// Check if broken (can't attack)
	if (infantry.isBroken) {
		return false;
	}
	
	// Check if infantry and target are on the same map
	if (!infantry.position || !target.position) {
		return false;
	}
	
	// Calculate distance
	const distance = calculateDistance(infantry.position, target.position);
	
	// Check if target is in range (maximum range depends on equipment)
	let maxRange = 3; // Default for standard rifles
	
	if (infantry.equipment === EQUIPMENT_TYPES.LASER) {
		maxRange = 4;
	} else if (infantry.equipment === EQUIPMENT_TYPES.SRM) {
		maxRange = 3;
	} else if (infantry.equipment === EQUIPMENT_TYPES.MACHINE_GUN) {
		maxRange = 2;
	} else if (infantry.equipment === EQUIPMENT_TYPES.FLAMER) {
		maxRange = 1;
	} else if (infantry.equipment === EQUIPMENT_TYPES.INFERNO) {
		maxRange = 2;
	}
	
	if (distance > maxRange) {
		return false;
	}
	
	// Skip friendly units if not allowing friendly fire
	if (!gameState.allowFriendlyFire && target.team === infantry.team) {
		return false;
	}
	
	return true;
}

/**
 * Move infantry unit
 * @param {Object} infantry - Infantry unit to move
 * @param {Object} targetPosition - Target position {x, y}
 * @param {Object} gameState - Current game state
 * @returns {Object} Result of the movement
 */
function moveInfantry(infantry, targetPosition, gameState) {
	// Check if movement is possible
	if (infantry.isEliminated || infantry.hasMoved) {
		return {
			success: false,
			message: "Movement not possible"
		};
	}
	
	// Calculate distance
	const distance = calculateDistance(infantry.position, targetPosition);
	
	// Check if distance is valid
	if (distance > infantry.currentMP) {
		return {
			success: false,
			message: "Target position out of movement range"
		};
	}
	
	// Check if target position is valid (not occupied, etc.)
	const targetHex = gameState.map.getHex(targetPosition.x, targetPosition.y);
	if (!targetHex || targetHex.occupied) {
		return {
			success: false,
			message: "Target position invalid or occupied"
		};
	}
	
	// Execute movement
	const oldPosition = { ...infantry.position };
	infantry.position = targetPosition;
	infantry.hasMoved = true;
	infantry.currentMP -= distance;
	
	// If unit is breaking, it must move away from enemies
	if (infantry.isBreaking) {
		// Check if movement was away from closest enemy
		const isMovingAwayFromEnemy = checkIfMovingAwayFromEnemy(oldPosition, targetPosition, infantry, gameState);
		
		if (!isMovingAwayFromEnemy) {
			// Breaking units not moving away from enemy might rally
			const rallyRoll = roll2d6();
			const rallied = rallyRoll >= 8;
			
			if (rallied) {
				infantry.isBreaking = false;
				return {
					success: true,
					message: "Unit moved and rallied",
					moved: true,
					rallied: true
				};
			} else {
				// Failed rally attempt makes the unit broken
				infantry.isBreaking = false;
				infantry.isBroken = true;
				return {
					success: true,
					message: "Unit moved but failed to rally and is now broken",
					moved: true,
					broken: true
				};
			}
		}
	}
	
	return {
		success: true,
		moved: true,
		oldPosition,
		newPosition: targetPosition
	};
}

/**
 * Check if infantry is moving away from closest enemy
 * @param {Object} oldPosition - Starting position
 * @param {Object} newPosition - Target position
 * @param {Object} infantry - Infantry unit
 * @param {Object} gameState - Current game state
 * @returns {boolean} True if moving away from closest enemy
 */
function checkIfMovingAwayFromEnemy(oldPosition, newPosition, infantry, gameState) {
	// Find closest enemy
	let closestEnemy = null;
	let closestDistance = Infinity;
	
	gameState.units.forEach(unit => {
		if (unit.team !== infantry.team) {
			const distance = calculateDistance(oldPosition, unit.position);
			if (distance < closestDistance) {
				closestDistance = distance;
				closestEnemy = unit;
			}
		}
	});
	
	if (!closestEnemy) {
		return true; // No enemies, so count as moving away
	}
	
	// Calculate distances from old and new positions to closest enemy
	const oldDistanceToEnemy = calculateDistance(oldPosition, closestEnemy.position);
	const newDistanceToEnemy = calculateDistance(newPosition, closestEnemy.position);
	
	// Moving away if new distance is greater than old distance
	return newDistanceToEnemy > oldDistanceToEnemy;
}

/**
 * Get valid movement destinations for infantry
 * @param {Object} infantry - Infantry unit
 * @param {Object} gameState - Current game state
 * @returns {Array} Array of valid position objects {x, y}
 */
function getValidInfantryDestinations(infantry, gameState) {
	if (infantry.isEliminated || infantry.hasMoved) {
		return [];
	}
	
	const validDestinations = [];
	const maxMP = infantry.currentMP;
	const currentPos = infantry.position;
	
	// Look at all hexes within maximum movement range
	for (let range = 1; range <= maxMP; range++) {
		const hexesAtRange = gameState.map.getHexesAtRange(currentPos.x, currentPos.y, range);
		
		hexesAtRange.forEach(hex => {
			// Skip if hex is null, impassable or occupied
			if (!hex || hex.impassable || hex.occupied) {
				return;
			}
			
			// Check if breaking infantry must move away from enemies
			if (infantry.isBreaking) {
				const isMovingAwayFromEnemy = checkIfMovingAwayFromEnemy(
					currentPos,
					{ x: hex.x, y: hex.y },
					infantry,
					gameState
				);
				
				if (!isMovingAwayFromEnemy) {
					return; // Skip this hex if not moving away from enemies
				}
			}
			
			// Calculate actual MP cost to enter the hex
			const mpCost = calculateInfantryMovementCost(infantry, hex);
			
			// If within movement range, add to valid destinations
			if (range <= maxMP && mpCost <= maxMP) {
				validDestinations.push({ x: hex.x, y: hex.y, mpCost });
			}
		});
	}
	
	return validDestinations;
}

/**
 * Calculate movement cost for infantry to enter a hex
 * @param {Object} infantry - Infantry unit
 * @param {Object} hex - Target hex
 * @returns {number} Movement point cost
 */
function calculateInfantryMovementCost(infantry, hex) {
	// Default cost is 1 MP
	let mpCost = 1;
	
	// Adjust based on terrain
	if (hex.terrain === 'woods') {
		mpCost = 2;
	} else if (hex.terrain === 'heavy_woods') {
		mpCost = 3;
	} else if (hex.terrain === 'rough') {
		mpCost = 2;
	} else if (hex.terrain === 'water') {
		// Water is impassable for foot infantry
		if (infantry.infantryType === INFANTRY_TYPES.FOOT || 
			infantry.infantryType === INFANTRY_TYPES.JUMP) {
			return Infinity;
		}
		mpCost = 2;
	}
	
	return mpCost;
}

module.exports = {
	INFANTRY_TYPES,
	EQUIPMENT_TYPES,
	createInfantryPlatoon,
	calculateInfantryDamage,
	applyDamageToInfantry,
	checkInfantryMorale,
	executeInfantryAttack,
	canInfantryAttack,
	moveInfantry,
	getValidInfantryDestinations
}; 