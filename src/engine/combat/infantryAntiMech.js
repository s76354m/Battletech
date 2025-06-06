/**
 * infantryAntiMech.js
 * Implements infantry anti-mech tactics and capabilities
 */

const { rollDice, roll2d6 } = require('../../utils/dice');
const { determineHitLocation } = require('../../utils/combatUtils');

// Anti-mech attack types
const ANTI_MECH_ATTACKS = {
	LEG_ATTACK: 'leg_attack',
	SWARM: 'swarm_attack',
	MINE: 'mine_placement',
	EXPLOSIVE: 'explosives_placement'
};

// Equipment that helps with anti-mech attacks
const ANTI_MECH_EQUIPMENT = {
	VIBRO_BLADE: 'vibro_blade',
	DEMO_CHARGE: 'demo_charge',
	INFERNO_GRENADE: 'inferno_grenade',
	MAGNETIC_CLAMP: 'magnetic_clamp',
	ANTI_MECH_MINE: 'anti_mech_mine'
};

/**
 * Check if infantry can perform an anti-mech attack
 * @param {Object} infantry - Infantry unit attempting the attack
 * @param {Object} target - Target unit (should be a mech)
 * @param {string} attackType - Type of anti-mech attack
 * @param {Object} gameState - Current game state
 * @returns {Object} Result with validity and reason
 */
function canPerformAntiMechAttack(infantry, target, attackType, gameState) {
	// Only infantry can perform these attacks
	if (infantry.type !== 'INFANTRY') {
		return { valid: false, reason: "Only infantry can perform anti-mech attacks" };
	}
	
	// Target must be a mech
	if (target.type !== 'MECH') {
		return { valid: false, reason: "Anti-mech attacks can only target mechs" };
	}
	
	// Infantry must have sufficient troops
	const minimumTroops = {
		[ANTI_MECH_ATTACKS.LEG_ATTACK]: 5,
		[ANTI_MECH_ATTACKS.SWARM]: 10,
		[ANTI_MECH_ATTACKS.MINE]: 3,
		[ANTI_MECH_ATTACKS.EXPLOSIVE]: 3
	};
	
	if (infantry.troopCount < minimumTroops[attackType]) {
		return { 
			valid: false, 
			reason: `Insufficient troops for this attack (need ${minimumTroops[attackType]})` 
		};
	}
	
	// Check proximity requirements
	const distance = calculateDistance(infantry.position, target.position);
	
	if (attackType === ANTI_MECH_ATTACKS.LEG_ATTACK || 
		attackType === ANTI_MECH_ATTACKS.SWARM) {
		// Must be in same hex
		if (distance !== 0) {
			return { valid: false, reason: "Infantry must be in the same hex as the target" };
		}
	} else if (attackType === ANTI_MECH_ATTACKS.MINE || 
			   attackType === ANTI_MECH_ATTACKS.EXPLOSIVE) {
		// Can be adjacent or same hex
		if (distance > 1) {
			return { valid: false, reason: "Infantry must be adjacent to the target" };
		}
	}
	
	// Check if infantry has proper equipment for the attack
	if (attackType === ANTI_MECH_ATTACKS.EXPLOSIVE && 
		!hasEquipment(infantry, ANTI_MECH_EQUIPMENT.DEMO_CHARGE)) {
		return { valid: false, reason: "Infantry requires demo charges for this attack" };
	}
	
	if (attackType === ANTI_MECH_ATTACKS.MINE && 
		!hasEquipment(infantry, ANTI_MECH_EQUIPMENT.ANTI_MECH_MINE)) {
		return { valid: false, reason: "Infantry requires anti-mech mines for this attack" };
	}
	
	return { valid: true };
}

/**
 * Calculate distance between two positions
 * @param {Object} pos1 - First position {x, y}
 * @param {Object} pos2 - Second position {x, y}
 * @returns {number} Distance in hexes
 */
function calculateDistance(pos1, pos2) {
	if (!pos1 || !pos2) return Infinity;
	
	// If positions are exactly the same, they're in the same hex
	if (pos1.x === pos2.x && pos1.y === pos2.y) return 0;
	
	// Otherwise calculate hex distance
	const dx = Math.abs(pos1.x - pos2.x);
	const dy = Math.abs(pos1.y - pos2.y);
	return Math.max(dx, dy);
}

/**
 * Check if infantry has a particular equipment type
 * @param {Object} infantry - Infantry unit to check
 * @param {string} equipmentType - Type of equipment to check for
 * @returns {boolean} Whether infantry has the equipment
 */
function hasEquipment(infantry, equipmentType) {
	return infantry.equipment && 
		infantry.equipment.some(eq => eq.type === equipmentType && eq.count > 0);
}

/**
 * Calculate the to-hit number for an anti-mech attack
 * @param {Object} infantry - Attacking infantry
 * @param {Object} target - Target mech
 * @param {string} attackType - Type of anti-mech attack
 * @param {Object} gameState - Current game state
 * @returns {number} Target number to hit (2d6)
 */
function calculateAntiMechToHit(infantry, target, attackType, gameState) {
	// Base to-hit number depends on attack type
	let baseToHit = 8; // Default difficulty
	
	if (attackType === ANTI_MECH_ATTACKS.LEG_ATTACK) {
		baseToHit = 7;
	} else if (attackType === ANTI_MECH_ATTACKS.SWARM) {
		baseToHit = 9;
	} else if (attackType === ANTI_MECH_ATTACKS.MINE) {
		baseToHit = 8;
	} else if (attackType === ANTI_MECH_ATTACKS.EXPLOSIVE) {
		baseToHit = 8;
	}
	
	// Skill modifier (infantry quality)
	baseToHit -= infantry.skill || 0;
	
	// Equipment modifiers
	if (attackType === ANTI_MECH_ATTACKS.LEG_ATTACK && 
		hasEquipment(infantry, ANTI_MECH_EQUIPMENT.VIBRO_BLADE)) {
		baseToHit -= 1; // Easier with vibro blades
	}
	
	if (attackType === ANTI_MECH_ATTACKS.SWARM && 
		hasEquipment(infantry, ANTI_MECH_EQUIPMENT.MAGNETIC_CLAMP)) {
		baseToHit -= 2; // Much easier with magnetic clamps
	}
	
	// Target movement modifiers
	if (target.hasMoved) {
		if (target.moveType === 'run') baseToHit += 3;
		else if (target.moveType === 'walk') baseToHit += 1;
		else if (target.moveType === 'jump') baseToHit += 4; // Very hard to attack jumping mech
	}
	
	// Terrain modifiers
	const hexTerrain = gameState.battlefield.hexes.get(`${infantry.position.x},${infantry.position.y}`);
	if (hexTerrain && hexTerrain.terrain === 'woods') {
		baseToHit -= 1; // Easier to hide and attack from woods
	}
	
	// Ensure to-hit is within bounds (2-12)
	return Math.min(Math.max(baseToHit, 2), 12);
}

/**
 * Calculate damage for an anti-mech attack
 * @param {Object} infantry - Attacking infantry
 * @param {Object} target - Target mech
 * @param {string} attackType - Type of anti-mech attack
 * @returns {number} Damage amount
 */
function calculateAntiMechDamage(infantry, target, attackType) {
	let baseDamage = 0;
	
	// Damage depends on attack type and number of troops
	if (attackType === ANTI_MECH_ATTACKS.LEG_ATTACK) {
		// 1 damage per 5 troops, rounded up
		baseDamage = Math.ceil(infantry.troopCount / 5);
		
		if (hasEquipment(infantry, ANTI_MECH_EQUIPMENT.VIBRO_BLADE)) {
			baseDamage *= 1.5; // 50% more damage with vibro blades
		}
	} else if (attackType === ANTI_MECH_ATTACKS.SWARM) {
		// 2 damage per 10 troops, plus hit location advantages
		baseDamage = Math.floor(infantry.troopCount / 5);
	} else if (attackType === ANTI_MECH_ATTACKS.EXPLOSIVE) {
		// Fixed damage based on demo charges
		const demoPacks = getEquipmentCount(infantry, ANTI_MECH_EQUIPMENT.DEMO_CHARGE);
		baseDamage = demoPacks * 5; // 5 damage per demo pack
	} else if (attackType === ANTI_MECH_ATTACKS.MINE) {
		// Fixed damage based on mines
		const mines = getEquipmentCount(infantry, ANTI_MECH_EQUIPMENT.ANTI_MECH_MINE);
		baseDamage = mines * 3; // 3 damage per mine
	}
	
	// Cap damage based on infantry squad size
	const maxDamage = infantry.troopCount * 2;
	return Math.min(baseDamage, maxDamage);
}

/**
 * Get the count of a specific equipment type
 * @param {Object} infantry - Infantry unit to check
 * @param {string} equipmentType - Type of equipment to count
 * @returns {number} Count of equipment
 */
function getEquipmentCount(infantry, equipmentType) {
	if (!infantry.equipment) return 0;
	
	const equipItem = infantry.equipment.find(eq => eq.type === equipmentType);
	return equipItem ? equipItem.count : 0;
}

/**
 * Execute an anti-mech attack
 * @param {Object} infantry - Attacking infantry
 * @param {Object} target - Target mech
 * @param {string} attackType - Type of anti-mech attack
 * @param {Object} gameState - Current game state
 * @returns {Object} Result of the attack
 */
function executeAntiMechAttack(infantry, target, attackType, gameState) {
	// Check if attack is valid
	const validityCheck = canPerformAntiMechAttack(infantry, target, attackType, gameState);
	if (!validityCheck.valid) {
		return {
			success: false,
			message: validityCheck.reason
		};
	}
	
	// Calculate to-hit number
	const toHitNumber = calculateAntiMechToHit(infantry, target, attackType, gameState);
	
	// Roll to hit
	const hitRoll = roll2d6();
	const hit = hitRoll >= toHitNumber;
	
	// Initialize result
	const result = {
		success: true,
		hit,
		attackType,
		toHitNumber,
		roll: hitRoll
	};
	
	// If attack hits
	if (hit) {
		// Calculate damage
		const damage = calculateAntiMechDamage(infantry, target, attackType);
		result.damage = damage;
		
		// Determine hit location based on attack type
		if (attackType === ANTI_MECH_ATTACKS.LEG_ATTACK) {
			// 50% left leg, 50% right leg
			result.location = Math.random() < 0.5 ? 'LEFT_LEG' : 'RIGHT_LEG';
		} else if (attackType === ANTI_MECH_ATTACKS.SWARM) {
			// Swarm attack - hit determined by 1d6
			const swarmLocationRoll = rollDice(1, 6).sum;
			
			if (swarmLocationRoll <= 2) result.location = 'HEAD';
			else if (swarmLocationRoll === 3) result.location = 'CENTER_TORSO';
			else if (swarmLocationRoll === 4) result.location = 'RIGHT_TORSO';
			else if (swarmLocationRoll === 5) result.location = 'LEFT_TORSO';
			else result.location = 'REAR'; // Special - attack from rear
		} else if (attackType === ANTI_MECH_ATTACKS.EXPLOSIVE) {
			// Explosives - usually center torso or legs
			const explosiveLocationRoll = rollDice(1, 6).sum;
			
			if (explosiveLocationRoll <= 2) result.location = 'CENTER_TORSO';
			else if (explosiveLocationRoll === 3) result.location = 'RIGHT_LEG';
			else if (explosiveLocationRoll === 4) result.location = 'LEFT_LEG';
			else if (explosiveLocationRoll === 5) result.location = 'RIGHT_TORSO';
			else result.location = 'LEFT_TORSO';
		} else if (attackType === ANTI_MECH_ATTACKS.MINE) {
			// Mines always hit legs
			result.location = Math.random() < 0.5 ? 'LEFT_LEG' : 'RIGHT_LEG';
		}
		
		// Special effects based on attack type
		if (attackType === ANTI_MECH_ATTACKS.LEG_ATTACK) {
			// Chance to force a PSR
			result.psrRequired = true;
			result.psrModifier = Math.ceil(damage / 5); // +1 per 5 points of damage
		} else if (attackType === ANTI_MECH_ATTACKS.SWARM) {
			// Swarming effects
			result.swarmingEffects = {
				turnsRemaining: rollDice(1, 3).sum, // 1-3 turns of swarming
				damagePer: Math.max(1, Math.floor(infantry.troopCount / 10))
			};
		} else if (attackType === ANTI_MECH_ATTACKS.EXPLOSIVE && 
				  hasEquipment(infantry, ANTI_MECH_EQUIPMENT.INFERNO_GRENADE)) {
			// Inferno effects if carrying those grenades
			result.heatGenerated = rollDice(2, 6).sum; // 2d6 heat
		}
		
		// Calculate casualties to the infantry unit
		let casualties = 0;
		
		if (attackType === ANTI_MECH_ATTACKS.LEG_ATTACK) {
			casualties = Math.ceil(infantry.troopCount * 0.1); // 10% casualties
		} else if (attackType === ANTI_MECH_ATTACKS.SWARM) {
			casualties = Math.ceil(infantry.troopCount * 0.2); // 20% casualties
		} else if (attackType === ANTI_MECH_ATTACKS.EXPLOSIVE) {
			casualties = Math.ceil(infantry.troopCount * 0.15); // 15% casualties
		} else if (attackType === ANTI_MECH_ATTACKS.MINE) {
			casualties = Math.ceil(infantry.troopCount * 0.05); // 5% casualties
		}
		
		result.infantryCasualties = casualties;
	} else {
		// Attack missed - still take some casualties
		const casualties = Math.ceil(infantry.troopCount * 0.05); // 5% casualties on miss
		result.infantryCasualties = casualties;
	}
	
	return result;
}

module.exports = {
	ANTI_MECH_ATTACKS,
	ANTI_MECH_EQUIPMENT,
	canPerformAntiMechAttack,
	calculateAntiMechToHit,
	calculateAntiMechDamage,
	executeAntiMechAttack
}; 