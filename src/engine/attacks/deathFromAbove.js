/**
 * Death from Above Attack Module
 * 
 * This module implements the iconic Death From Above (DFA) attack mechanic
 * where a jumping mech crashes down on an opponent for devastating effect.
 */

const { MECH_LOCATION } = require('../units/mechLocations');
const { rollDice } = require('../../utils/diceRolls');
const { calculateLineOfSight } = require('../combat/lineOfSight');
const { TERRAIN_TYPE } = require('../movement/terrainEffects');

// DFA attack result types
const DFA_RESULT = {
	SUCCESS: 'SUCCESS',
	MISSED: 'MISSED',
	ATTACKER_FELL: 'ATTACKER_FELL',
	MUTUAL_DAMAGE: 'MUTUAL_DAMAGE'
};

// DFA attack specific modifiers
const DFA_MODIFIERS = {
	JUMPING_SKILL: -1,      // Per point of piloting/jumping skill
	TARGET_RUNNING: 2,      // Target moved more than walk speed
	TARGET_PRONE: -2,       // Target is already prone
	ATTACKER_DAMAGE: 1,     // Per 10 points of damage on attacker
	ELEVATION_DIFF: -1,     // Per level of elevation advantage
	WEATHER_POOR: 1,        // Poor visibility conditions
	WEAPON_DAMAGE: -0.5,    // Per leg/foot actuator weapon
};

/**
 * Check if a mech can perform a Death From Above attack
 * @param {Object} attacker - The attacking mech
 * @param {Object} target - The target mech
 * @param {number} jumpDistance - Distance jumped in hexes
 * @returns {boolean} Whether the attack can be performed
 */
function canPerformDFA(attacker, target, jumpDistance) {
	// Basic requirements
	if (!attacker || !target) {
		return false;
	}
	
	// Must be a mech vs mech attack
	if (attacker.type !== 'MECH' || target.type !== 'MECH') {
		return false;
	}
	
	// Must have jump capability
	if (!attacker.jumpCapable) {
		return false;
	}
	
	// Must have jumped this turn
	if (!attacker.hasJumpedThisTurn) {
		return false;
	}
	
	// Must have functional legs
	if (attacker.damagedLocations?.includes(MECH_LOCATION.LEFT_LEG) &&
			attacker.damagedLocations?.includes(MECH_LOCATION.RIGHT_LEG)) {
		return false;
	}
	
	// Must have jumped at least 1 hex
	if (jumpDistance < 1) {
		return false;
	}
	
	// Must be able to land on target's hex
	if (!canLandOnHex(attacker, target.position)) {
		return false;
	}
	
	// Must have line of sight to target at end of jump
	if (!calculateLineOfSight(attacker, target)) {
		return false;
	}
	
	return true;
}

/**
 * Check if mech can land on a hex
 * @param {Object} mech - The mech
 * @param {Object} hexPosition - The hex position
 * @returns {boolean} Whether landing is possible
 */
function canLandOnHex(mech, hexPosition) {
	// This would connect to terrain and stacking rules
	// Simplified implementation for now
	return true;
}

/**
 * Calculate the to-hit number for a DFA attack
 * @param {Object} attacker - The attacking mech
 * @param {Object} target - The target mech
 * @param {Object} terrain - Terrain conditions
 * @param {Object} weather - Weather conditions
 * @param {number} jumpDistance - Distance jumped in hexes
 * @returns {number} To-hit number (2-12 scale, lower is better)
 */
function calculateDFAToHit(attacker, target, terrain, weather, jumpDistance) {
	// Base to-hit for DFA
	let baseToHit = 9;
	
	// Apply pilot skill (assumes piloting skill is 1-8 scale, lower is better)
	baseToHit += (attacker.pilotSkill - 4);
	
	// Apply jumping skill bonus if applicable
	if (attacker.jumpingSkill) {
		baseToHit += attacker.jumpingSkill * DFA_MODIFIERS.JUMPING_SKILL;
	}
	
	// Target movement
	if (target.currentMovement > target.walkSpeed) {
		baseToHit += DFA_MODIFIERS.TARGET_RUNNING;
	}
	
	// Target prone
	if (target.isProne) {
		baseToHit += DFA_MODIFIERS.TARGET_PRONE;
	}
	
	// Attacker damage penalty (more damaged = harder to control)
	const damagePercentage = attacker.damageTaken / attacker.maxArmor;
	baseToHit += Math.floor(damagePercentage * 10) * DFA_MODIFIERS.ATTACKER_DAMAGE;
	
	// Elevation advantage
	const elevationDiff = (attacker.elevation || 0) - (target.elevation || 0);
	if (elevationDiff > 0) {
		baseToHit += elevationDiff * DFA_MODIFIERS.ELEVATION_DIFF;
	}
	
	// Weather effects
	if (weather.visibility === 'LOW') {
		baseToHit += DFA_MODIFIERS.WEATHER_POOR;
	}
	
	// Specialized DFA weapons
	const specializedWeapons = attacker.equipment?.filter(e => 
		e.location === MECH_LOCATION.LEFT_LEG || e.location === MECH_LOCATION.RIGHT_LEG);
		
	if (specializedWeapons && specializedWeapons.length > 0) {
		baseToHit += specializedWeapons.length * DFA_MODIFIERS.WEAPON_DAMAGE;
	}
	
	// Jump distance (longer jump is harder to control)
	baseToHit += Math.floor(jumpDistance / 3);
	
	// Terrain effects
	if (terrain.type === TERRAIN_TYPE.ROUGH) {
		baseToHit += 1;
	}
	
	// Clamp to valid range
	return Math.max(2, Math.min(12, baseToHit));
}

/**
 * Calculate damage for successful DFA attack
 * @param {Object} attacker - The attacking mech
 * @param {Object} target - The target mech
 * @returns {Object} Damage calculations for both attacker and target
 */
function calculateDFADamage(attacker, target) {
	// Base damage is based on attacker's tonnage
	const baseDamage = Math.floor(attacker.tonnage / 10);
	
	// Calculate damage to target
	const targetDamage = baseDamage * 1.5;
	
	// Calculate damage to attacker (self-damage from impact)
	const attackerDamage = baseDamage * 0.5;
	
	// Damage location distribution for target
	const targetLocations = {
		[MECH_LOCATION.HEAD]: 0.1,
		[MECH_LOCATION.CENTER_TORSO]: 0.3,
		[MECH_LOCATION.LEFT_TORSO]: 0.2,
		[MECH_LOCATION.RIGHT_TORSO]: 0.2,
		[MECH_LOCATION.LEFT_ARM]: 0.1,
		[MECH_LOCATION.RIGHT_ARM]: 0.1
	};
	
	// Damage location distribution for attacker (mostly legs)
	const attackerLocations = {
		[MECH_LOCATION.LEFT_LEG]: 0.5,
		[MECH_LOCATION.RIGHT_LEG]: 0.5
	};
	
	return {
		targetDamage,
		attackerDamage,
		targetLocations,
		attackerLocations
	};
}

/**
 * Execute a Death From Above attack
 * @param {Object} attacker - The attacking mech
 * @param {Object} target - The target mech
 * @param {Object} terrain - Terrain conditions
 * @param {Object} weather - Weather conditions
 * @param {number} jumpDistance - Distance jumped in hexes
 * @returns {Object} Attack result information
 */
function executeDFAAttack(attacker, target, terrain, weather, jumpDistance) {
	// Check if attack can be performed
	if (!canPerformDFA(attacker, target, jumpDistance)) {
		return {
			result: DFA_RESULT.MISSED,
			message: "Cannot perform Death From Above attack",
			attackerDamage: 0,
			targetDamage: 0
		};
	}
	
	// Calculate to-hit
	const toHitNumber = calculateDFAToHit(attacker, target, terrain, weather, jumpDistance);
	
	// Roll 2d6 to determine hit
	const diceRoll = rollDice(2, 6);
	
	// Calculate damage
	const { targetDamage, attackerDamage, targetLocations, attackerLocations } = calculateDFADamage(attacker, target);
	
	// Determine result
	let result;
	let message;
	let actualTargetDamage = 0;
	let actualAttackerDamage = 0;
	
	if (diceRoll >= toHitNumber) {
		// Successful hit
		result = DFA_RESULT.SUCCESS;
		message = "Death From Above attack successful!";
		actualTargetDamage = targetDamage;
		actualAttackerDamage = attackerDamage;
		
		// Apply damage to target
		applyDFADamage(target, actualTargetDamage, targetLocations);
		
		// Apply self damage to attacker
		applyDFADamage(attacker, actualAttackerDamage, attackerLocations);
		
		// Additional effects
		applyDFAEffects(attacker, target);
	} else {
		// Attack failed - determine how badly
		const failMargin = toHitNumber - diceRoll;
		
		if (failMargin >= 3) {
			// Catastrophic failure - attacker crashes
			result = DFA_RESULT.ATTACKER_FELL;
			message = "Death From Above attack failed! Attacker crashes down.";
			actualAttackerDamage = attackerDamage * 2;
			
			// Apply crash damage to attacker
			applyDFADamage(attacker, actualAttackerDamage, attackerLocations);
			
			// Force attacker prone
			attacker.isProne = true;
		} else {
			// Regular miss - attacker lands nearby
			result = DFA_RESULT.MISSED;
			message = "Death From Above attack missed! Attacker lands nearby.";
			actualAttackerDamage = attackerDamage * 0.5;
			
			// Apply landing damage to attacker
			applyDFADamage(attacker, actualAttackerDamage, attackerLocations);
			
			// Set attacker's position to be adjacent to target
			moveToAdjacentHex(attacker, target);
		}
	}
	
	// Piloting skill roll to avoid falling after landing
	if (result !== DFA_RESULT.ATTACKER_FELL) {
		const pilotingRoll = rollDice(2, 6);
		if (pilotingRoll < attacker.pilotSkill) {
			// Failed piloting roll - attacker falls after attack
			message += " Attacker loses balance after landing and falls.";
			attacker.isProne = true;
			
			// Additional damage from falling
			const fallDamage = Math.floor(attacker.tonnage / 20);
			applyDFADamage(attacker, fallDamage, attackerLocations);
			actualAttackerDamage += fallDamage;
		}
	}
	
	return {
		result,
		message,
		roll: diceRoll,
		toHitNumber,
		targetDamage: actualTargetDamage,
		attackerDamage: actualAttackerDamage
	};
}

/**
 * Apply DFA damage to a mech
 * @param {Object} mech - The mech receiving damage
 * @param {number} damage - Amount of damage
 * @param {Object} locationDistribution - Distribution of damage by location
 */
function applyDFADamage(mech, damage, locationDistribution) {
	// This would connect to the damage system
	// Implementation depends on how damage is handled in the engine
	console.log(`Applying ${damage} DFA damage to ${mech.id}`);
	
	// Distribute damage by location according to distribution
	Object.entries(locationDistribution).forEach(([location, percentage]) => {
		const locationDamage = Math.floor(damage * percentage);
		// Apply damage to specific location
		console.log(`- ${locationDamage} to ${location}`);
	});
}

/**
 * Apply additional effects from DFA attack
 * @param {Object} attacker - The attacking mech
 * @param {Object} target - The target mech
 */
function applyDFAEffects(attacker, target) {
	// Knock down target with high probability
	const knockdownChance = 0.8;
	if (Math.random() < knockdownChance) {
		target.isProne = true;
		console.log(`Target ${target.id} knocked down by DFA`);
	}
	
	// Critical hit chance on target
	const criticalHitChance = 0.4;
	if (Math.random() < criticalHitChance) {
		// Roll for random location
		const locationOptions = [
			MECH_LOCATION.HEAD,
			MECH_LOCATION.CENTER_TORSO,
			MECH_LOCATION.LEFT_TORSO,
			MECH_LOCATION.RIGHT_TORSO
		];
		const hitLocation = locationOptions[Math.floor(Math.random() * locationOptions.length)];
		
		// Apply critical hit
		console.log(`Critical hit on ${target.id} at ${hitLocation} from DFA`);
	}
	
	// Heat generation for the attacker
	attacker.heat = (attacker.heat || 0) + 2;
	console.log(`Attacker ${attacker.id} generates 2 heat from DFA`);
}

/**
 * Move attacker to an adjacent hex from the target
 * @param {Object} attacker - The attacking mech
 * @param {Object} target - The target mech
 */
function moveToAdjacentHex(attacker, target) {
	// This would connect to the movement system
	// For now, just a placeholder that would be implemented based on hex grid
	console.log(`Moving ${attacker.id} to hex adjacent to ${target.id}`);
	
	// Set attacker position to be adjacent to target
	// This is a simplified example - real implementation would use hex coordinates
	attacker.position = {
		x: target.position.x + 1,
		y: target.position.y
	};
}

/**
 * Check if a position is valid for a DFA landing
 * @param {Object} position - The position {x, y}
 * @param {Object} terrain - Terrain information
 * @returns {boolean} Whether the position is valid
 */
function isValidDFALandingPosition(position, terrain) {
	// Invalid terrain types for landing
	const invalidTerrainTypes = [
		TERRAIN_TYPE.WATER_DEEP,
		TERRAIN_TYPE.LAVA,
		TERRAIN_TYPE.BUILDING_HEAVY
	];
	
	// Check if terrain type at position is invalid
	if (invalidTerrainTypes.includes(terrain.type)) {
		return false;
	}
	
	return true;
}

/**
 * Calculate potential DFA damage for UI preview
 * @param {Object} attacker - The attacking mech
 * @param {Object} target - The target mech
 * @returns {Object} Potential damage information
 */
function calculatePotentialDFADamage(attacker, target) {
	const { targetDamage, attackerDamage } = calculateDFADamage(attacker, target);
	
	return {
		pseudoTargetDamage: targetDamage,
		pseudoAttackerDamage: attackerDamage,
		knockdownChance: '80%',
		criticalHitChance: '40%'
	};
}

/**
 * Get available DFA targets within jump range
 * @param {Object} attacker - The attacking mech
 * @param {Array} potentialTargets - List of potential targets
 * @param {number} jumpRange - Maximum jump range in hexes
 * @returns {Array} List of valid DFA targets with their distances
 */
function getAvailableDFATargets(attacker, potentialTargets, jumpRange) {
	if (!attacker.jumpCapable) {
		return [];
	}
	
	return potentialTargets
		.filter(target => 
			target.type === 'MECH' && 
			calculateDistance(attacker, target) <= jumpRange
		)
		.map(target => ({
			target,
			distance: calculateDistance(attacker, target),
			toHit: calculateDFAToHit(
				attacker, 
				target, 
				{ type: TERRAIN_TYPE.OPEN }, // Simplified terrain for preview
				{ visibility: 'NORMAL' },    // Simplified weather for preview
				calculateDistance(attacker, target)
			)
		}));
}

/**
 * Calculate distance between two units
 * @param {Object} unitA - First unit
 * @param {Object} unitB - Second unit
 * @returns {number} Distance in hexes
 */
function calculateDistance(unitA, unitB) {
        return Math.sqrt(
                Math.pow(unitA.position.x - unitB.position.x, 2) +
                Math.pow(unitA.position.y - unitB.position.y, 2)
        );
}

module.exports = {
        DFA_RESULT,
        canPerformDFA,
        calculateDFAToHit,
        calculateDFADamage,
        executeDFAAttack,
        isValidDFALandingPosition,
        calculatePotentialDFADamage,
        getAvailableDFATargets
}
