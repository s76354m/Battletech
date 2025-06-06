/**
 * combatUtils.js
 * Utility functions for combat calculations and hit location determination
 */

const { rollDice, roll2d6 } = require('./dice');

/**
 * Hit location tables for different unit types
 */
const HIT_LOCATIONS = {
	MECH: {
		2: 'Center Torso',
		3: 'Right Arm',
		4: 'Right Arm',
		5: 'Right Leg',
		6: 'Right Torso',
		7: 'Center Torso',
		8: 'Left Torso',
		9: 'Left Leg',
		10: 'Left Arm',
		11: 'Left Arm',
		12: 'Head'
	},
	VEHICLE: {
		2: 'Rear',
		3: 'Rear',
		4: 'Rear',
		5: 'Right Side',
		6: 'Right Side',
		7: 'Front',
		8: 'Front',
		9: 'Left Side',
		10: 'Left Side',
		11: 'Turret',
		12: 'Turret'
	},
	INFANTRY: {
		// For infantry, any hit location represents casualties
		2: 'Squad',
		3: 'Squad',
		4: 'Squad',
		5: 'Squad',
		6: 'Squad',
		7: 'Squad',
		8: 'Squad',
		9: 'Squad',
		10: 'Squad',
		11: 'Squad',
		12: 'Squad'
	},
	// Special hit locations for Death From Above attacks
	DFA_MECH: {
		2: 'Center Torso',
		3: 'Right Torso',
		4: 'Right Torso',
		5: 'Right Arm',
		6: 'Right Leg',
		7: 'Center Torso',
		8: 'Left Leg',
		9: 'Left Arm',
		10: 'Left Torso',
		11: 'Left Torso',
		12: 'Head'
	}
};

/**
 * Determine hit location for an attack
 * @param {string} unitType - Type of unit being targeted (MECH, VEHICLE, INFANTRY)
 * @param {string} attackType - Type of attack (optional, for special hit tables)
 * @returns {string} Hit location name
 */
function determineHitLocation(unitType, attackType = 'normal') {
	const roll = roll2d6();
	
	// Use appropriate hit location table
	if (attackType === 'DFA' && unitType === 'MECH') {
		return {
			location: HIT_LOCATIONS.DFA_MECH[roll] || 'Center Torso',
			roll
		};
	}
	
	// Default hit locations by unit type
	switch (unitType) {
		case 'MECH':
			return {
				location: HIT_LOCATIONS.MECH[roll] || 'Center Torso',
				roll
			};
		case 'VEHICLE':
			return {
				location: HIT_LOCATIONS.VEHICLE[roll] || 'Front',
				roll
			};
		case 'INFANTRY':
			return {
				location: HIT_LOCATIONS.INFANTRY[roll] || 'Squad',
				roll
			};
		default:
			return {
				location: 'Center Torso',
				roll
			};
	}
}

/**
 * Calculate movement modifier for to-hit rolls
 * @param {number} hexesMoved - Number of hexes the unit moved
 * @param {string} movementType - Type of movement (walk, run, jump)
 * @returns {number} Modifier to apply to to-hit rolls
 */
function calculateMovementModifier(hexesMoved, movementType) {
	if (movementType === 'stationary') return 0;
	if (movementType === 'walk') {
		if (hexesMoved <= 2) return 1;
		if (hexesMoved <= 4) return 2;
		return 3;
	}
	if (movementType === 'run') {
		return Math.min(hexesMoved, 5);
	}
	if (movementType === 'jump') {
		return Math.min(hexesMoved + 1, 6);
	}
	return 0;
}

/**
 * Calculate base to-hit number for an attack
 * @param {Object} attacker - Attacker unit data
 * @param {Object} target - Target unit data
 * @param {Object} conditions - Combat conditions
 * @returns {number} Base to-hit number
 */
function calculateBaseToHit(attacker, target, conditions = {}) {
	// Start with base skill
	let toHit = attacker.skills.gunnery || 4;
	
	// Add modifiers
	if (conditions.range === 'short') toHit += 0;
	else if (conditions.range === 'medium') toHit += 2;
	else if (conditions.range === 'long') toHit += 4;
	
	// Target movement modifier
	toHit += calculateMovementModifier(
		target.hexesMoved || 0,
		target.movementType || 'stationary'
	);
	
	// Attacker movement modifier
	toHit += calculateMovementModifier(
		attacker.hexesMoved || 0,
		attacker.movementType || 'stationary'
	);
	
	// Terrain and other modifiers
	if (conditions.targetInCover) toHit += 2;
	if (conditions.attackerDamaged) toHit += 1;
	
	return toHit;
}

/**
 * Calculate effective tonnage for damage purposes (for special attacks)
 * @param {number} tonnage - Unit's actual tonnage
 * @param {string} attackType - Type of attack
 * @returns {number} Effective tonnage for damage calculation
 */
function calculateEffectiveTonnage(tonnage, attackType) {
	switch (attackType) {
		case 'DFA':
			return Math.floor(tonnage / 10);
		case 'charge':
			return Math.floor(tonnage / 5);
		case 'melee':
			return Math.ceil(tonnage / 10);
		default:
			return tonnage;
	}
}

module.exports = {
	determineHitLocation,
	calculateMovementModifier,
	calculateBaseToHit,
	calculateEffectiveTonnage,
	HIT_LOCATIONS
}; 