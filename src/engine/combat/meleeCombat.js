/**
 * meleeCombat.js
 * Handles melee combat mechanics for BattleTech
 */

const { calculateAttackModifiers } = require('../combat/attackModifiers');
const { rollDice } = require('../utils/diceRolls');
const { applyDamage } = require('../combat/damageResolution');
const { checkPilotingSkillRoll } = require('../pilot/pilotingChecks');
const { calculateHitLocation } = require('../combat/hitLocation');

// Melee attack types
const MELEE_TYPES = {
	PUNCH: 'punch',
	KICK: 'kick',
	CHARGE: 'charge',
	DFA: 'death_from_above',
	PUSH: 'push',
	CLUB: 'club'
};

/**
 * Check if a mech can perform a melee attack against a target
 * @param {Object} attacker - The attacking mech
 * @param {Object} target - The target mech
 * @param {string} meleeType - Type of melee attack
 * @param {Object} gameState - Current game state
 * @returns {boolean} Whether the melee attack is possible
 */
function canPerformMeleeAttack(attacker, target, meleeType, gameState) {
	// Check if mechs are on the same map
	if (!attacker.position || !target.position) {
		return false;
	}
	
	// Get distance between attacker and target
	const distance = calculateDistance(attacker.position, target.position);
	
	// Check if target is within melee range
	if (meleeType === MELEE_TYPES.PUNCH || meleeType === MELEE_TYPES.PUSH) {
		// Punch and push require adjacency (distance = 1)
		if (distance !== 1) {
			return false;
		}
	} else if (meleeType === MELEE_TYPES.KICK) {
		// Kick requires adjacency (distance = 1)
		if (distance !== 1) {
			return false;
		}
	} else if (meleeType === MELEE_TYPES.CHARGE) {
		// Charge requires the attacker to have moved this turn and end adjacent
		if (distance !== 1 || !attacker.hasMoved) {
			return false;
		}
	} else if (meleeType === MELEE_TYPES.DFA) {
		// DFA requires the attacker to have jumped this turn and end adjacent
		if (distance !== 1 || attacker.moveType !== 'jump') {
			return false;
		}
	} else if (meleeType === MELEE_TYPES.CLUB) {
		// Club requires adjacency and the attacker to have a club weapon
		if (distance !== 1 || !attacker.hasClub) {
			return false;
		}
	}
	
	// Check limb availability for specific attack types
	if (meleeType === MELEE_TYPES.PUNCH) {
		// Need at least one functioning arm
		if (!attacker.leftArmFunctional && !attacker.rightArmFunctional) {
			return false;
		}
	} else if (meleeType === MELEE_TYPES.KICK) {
		// Need at least one functioning leg
		if (!attacker.leftLegFunctional && !attacker.rightLegFunctional) {
			return false;
		}
	}
	
	return true;
}

/**
 * Calculate the to-hit number for a melee attack
 * @param {Object} attacker - The attacking mech
 * @param {Object} target - The target mech
 * @param {string} meleeType - Type of melee attack
 * @param {Object} gameState - Current game state
 * @returns {number} The to-hit target number
 */
function calculateMeleeToHit(attacker, target, meleeType, gameState) {
	let baseToHit = attacker.pilotingSkill; // Base to-hit is the pilot's skill
	
	// Add modifiers based on melee type
	if (meleeType === MELEE_TYPES.PUNCH) {
		baseToHit += 0; // No inherent modifier for punches
	} else if (meleeType === MELEE_TYPES.KICK) {
		baseToHit += 2; // +2 difficulty for kicks
	} else if (meleeType === MELEE_TYPES.CHARGE) {
		baseToHit += 1; // +1 difficulty for charges
	} else if (meleeType === MELEE_TYPES.DFA) {
		baseToHit += 3; // +3 difficulty for DFA
	} else if (meleeType === MELEE_TYPES.PUSH) {
		baseToHit += 1; // +1 difficulty for push
	} else if (meleeType === MELEE_TYPES.CLUB) {
		baseToHit += 1; // +1 difficulty for club attacks
	}
	
	// Add target movement modifiers
	baseToHit += target.defenseModifier || 0;
	
	// Add attacker status modifiers
	if (attacker.prone) {
		baseToHit += 2; // +2 difficulty if attacker is prone
	}
	
	// Add target status modifiers
	if (target.prone) {
		baseToHit -= 2; // -2 difficulty (easier) if target is prone
	}
	
	// Add terrain modifiers
	const targetHex = gameState.map.getHex(target.position.x, target.position.y);
	if (targetHex && targetHex.cover) {
		baseToHit += 1; // +1 difficulty if target has partial cover
	}
	
	return baseToHit;
}

/**
 * Calculate damage for a melee attack
 * @param {Object} attacker - The attacking mech
 * @param {string} meleeType - Type of melee attack
 * @returns {number} Damage amount
 */
function calculateMeleeDamage(attacker, meleeType) {
	const tonnage = attacker.tonnage;
	
	if (meleeType === MELEE_TYPES.PUNCH) {
		// Punch damage is tonnage/10, rounded to nearest 5
		return Math.round((tonnage / 10) / 5) * 5;
	} else if (meleeType === MELEE_TYPES.KICK) {
		// Kick damage is tonnage/5, rounded to nearest 5
		return Math.round((tonnage / 5) / 5) * 5;
	} else if (meleeType === MELEE_TYPES.CHARGE) {
		// Charge damage is tonnage/10 per hex moved
		const hexesMoved = attacker.moveDistance || 1;
		return Math.round((tonnage / 10) * hexesMoved);
	} else if (meleeType === MELEE_TYPES.DFA) {
		// DFA damage is 3 points per 5 tons
		return Math.floor(tonnage / 5) * 3;
	} else if (meleeType === MELEE_TYPES.PUSH) {
		// Push does no damage, but may force PSR
		return 0;
	} else if (meleeType === MELEE_TYPES.CLUB) {
		// Club damage depends on the club weapon
		return attacker.clubDamage || Math.round(tonnage / 7);
	}
	
	return 0;
}

/**
 * Calculate attacker damage from charge or DFA attacks
 * @param {Object} attacker - The attacking mech
 * @param {string} meleeType - Type of melee attack
 * @returns {number} Self-damage amount
 */
function calculateSelfDamage(attacker, meleeType) {
	const tonnage = attacker.tonnage;
	
	if (meleeType === MELEE_TYPES.CHARGE) {
		// Attacker takes damage equal to half the damage inflicted
		return Math.round(calculateMeleeDamage(attacker, meleeType) / 2);
	} else if (meleeType === MELEE_TYPES.DFA) {
		// Attacker takes damage equal to tonnage/10 to each leg
		return Math.round(tonnage / 10);
	} else {
		return 0;
	}
}

/**
 * Calculate PSR modifier for melee attack
 * @param {Object} target - The target mech
 * @param {string} meleeType - Type of melee attack
 * @param {number} damage - Damage inflicted
 * @returns {number} PSR modifier
 */
function calculatePSRModifier(target, meleeType, damage) {
	if (meleeType === MELEE_TYPES.KICK) {
		return 2; // Kicks cause +2 to PSR
	} else if (meleeType === MELEE_TYPES.CHARGE) {
		return 2; // Charges cause +2 to PSR
	} else if (meleeType === MELEE_TYPES.DFA) {
		return 3; // DFA causes +3 to PSR
	} else if (meleeType === MELEE_TYPES.PUSH) {
		return 1; // Push causes +1 to PSR
	} else {
		// Punches and clubs only cause PSR if they do significant damage
		return (damage >= 10) ? 1 : 0;
	}
}

/**
 * Execute a melee attack
 * @param {Object} attacker - The attacking mech
 * @param {Object} target - The target mech
 * @param {string} meleeType - Type of melee attack
 * @param {Object} gameState - Current game state
 * @returns {Object} Result of the melee attack
 */
function executeMeleeAttack(attacker, target, meleeType, gameState) {
	// Check if attack is possible
	if (!canPerformMeleeAttack(attacker, target, meleeType, gameState)) {
		return {
			success: false,
			message: "Melee attack not possible"
		};
	}
	
	// Calculate to-hit number
	const toHitNumber = calculateMeleeToHit(attacker, target, meleeType, gameState);
	
	// Roll 2d6 to hit
	const hitRoll = rollDice(2, 6);
	const hit = hitRoll >= toHitNumber;
	
	// Initialize result
	const result = {
		success: true,
		hit,
		meleeType,
		toHitNumber,
		roll: hitRoll
	};
	
	// If hit, calculate and apply damage
	if (hit) {
		const damage = calculateMeleeDamage(attacker, meleeType);
		const selfDamage = calculateSelfDamage(attacker, meleeType);
		const psrModifier = calculatePSRModifier(target, meleeType, damage);
		
		// Add damage details to result
		result.damage = damage;
		result.selfDamage = selfDamage;
		result.psrModifier = psrModifier;
		result.psrRequired = psrModifier > 0;
		
		// Determine hit location (melee typically hits the torso)
		result.location = 'center_torso';
		
		// Special case for kicks
		if (meleeType === MELEE_TYPES.KICK) {
			// 50% chance to hit right or left leg
			result.location = Math.random() < 0.5 ? 'right_leg' : 'left_leg';
		}
		
		// For charge and DFA, attacker also needs PSR
		if (meleeType === MELEE_TYPES.CHARGE || meleeType === MELEE_TYPES.DFA) {
			result.attackerPSRRequired = true;
			result.attackerPSRModifier = (meleeType === MELEE_TYPES.DFA) ? 3 : 2;
		}
	}
	
	return result;
}

/**
 * Get available melee attack options for a mech
 * @param {Object} attacker - The attacking mech
 * @param {Object} gameState - Current game state
 * @returns {Array} Array of available melee attack types
 */
function getAvailableMeleeOptions(attacker, gameState) {
	const availableOptions = [];
	
	// Check for adjacent targets
	const adjacentTargets = getAdjacentTargets(attacker, gameState);
	const hasAdjacentTarget = adjacentTargets.length > 0;
	
	// Check available attack types
	if (hasAdjacentTarget) {
		// Check punch
		if (attacker.leftArmFunctional || attacker.rightArmFunctional) {
			availableOptions.push(MELEE_TYPES.PUNCH);
		}
		
		// Check kick
		if (attacker.leftLegFunctional || attacker.rightLegFunctional) {
			availableOptions.push(MELEE_TYPES.KICK);
		}
		
		// Check charge - only if mech moved this turn
		if (attacker.hasMoved && attacker.moveType === 'walk' || attacker.moveType === 'run') {
			availableOptions.push(MELEE_TYPES.CHARGE);
		}
		
		// Check DFA - only if mech jumped this turn
		if (attacker.moveType === 'jump') {
			availableOptions.push(MELEE_TYPES.DFA);
		}
		
		// Check push - always available if adjacent
		availableOptions.push(MELEE_TYPES.PUSH);
		
		// Check club - only if mech has a club weapon
		if (attacker.hasClub) {
			availableOptions.push(MELEE_TYPES.CLUB);
		}
	}
	
	return availableOptions;
}

/**
 * Get targets adjacent to a mech
 * @param {Object} mech - The mech to check
 * @param {Object} gameState - Current game state
 * @returns {Array} Array of adjacent target mechs
 */
function getAdjacentTargets(mech, gameState) {
	const adjacentTargets = [];
	
	// Check all units in the game
	gameState.units.forEach(unit => {
		// Skip self
		if (unit.id === mech.id) {
			return;
		}
		
		// Skip non-mechs (infantry, vehicles etc.)
		if (unit.type !== 'mech') {
			return;
		}
		
		// Skip friendly units if not allowing friendly fire
		if (!gameState.allowFriendlyFire && unit.team === mech.team) {
			return;
		}
		
		// Check distance
		const distance = calculateDistance(mech.position, unit.position);
		if (distance === 1) {
			adjacentTargets.push(unit);
		}
	});
	
	return adjacentTargets;
}

module.exports = {
        MELEE_TYPES,
        canPerformMeleeAttack,
        calculateMeleeToHit,
        calculateMeleeDamage,
        calculateSelfDamage,
        executeMeleeAttack,
        getAvailableMeleeOptions,
        getAdjacentTargets
};
