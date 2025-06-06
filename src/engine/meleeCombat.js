/**
 * Melee Combat System for Alpha Strike
 * 
 * This module implements the melee combat rules for Alpha Strike,
 * including different types of physical attacks like charges, kicks,
 * punches, and standard melee attacks.
 */

const { hasSpecialAbility } = require('./specialAbilities');
const { calculateDistance } = require('./movement');
const { performSkillCheck } = require('./combat');

// Define melee attack types
const MELEE_ATTACK_TYPES = {
	STANDARD: 'standard',
	CHARGE: 'charge',
	KICK: 'kick',
	PUNCH: 'punch',
	WEAPON: 'weapon'
};

/**
 * Check if a unit can perform melee attacks
 * @param {Object} unit - The unit to check
 * @returns {boolean} Whether the unit can perform melee attacks
 */
function canPerformMeleeAttacks(unit) {
	// Check unit type
	const isInfantry = unit.type === 'Infantry';
	const isMech = unit.type === 'Mech';
	const isBattleArmor = unit.type === 'BattleArmor';
	const isVehicle = unit.type === 'Vehicle';

	// Infantry can't perform melee unless they have the required special ability
	if (isInfantry && !hasSpecialAbility(unit, 'MEL')) {
		return false;
	}

	// Non-quad Mechs can always perform melee
	if (isMech && !hasSpecialAbility(unit, 'QUAD')) {
		return true;
	}

	// Battle Armor can perform melee if they have the MEL ability
	if (isBattleArmor && hasSpecialAbility(unit, 'MEL')) {
		return true;
	}

	// Vehicles can only perform charges unless they have the MEL ability
	if (isVehicle) {
		return hasSpecialAbility(unit, 'MEL');
	}

	// Quad Mechs can only charge or kick
	if (isMech && hasSpecialAbility(unit, 'QUAD')) {
		return true; // Can only charge or kick, but this will be checked in the specific attack type function
	}

	return false;
}

/**
 * Check if a unit can perform a specific type of melee attack
 * @param {Object} gameState - The current game state
 * @param {Object} unit - The attacking unit
 * @param {Object} target - The target unit
 * @param {string} attackType - The type of melee attack
 * @returns {Object} Result object with success status and reason
 */
function canPerformMeleeAttackType(gameState, unit, target, attackType) {
	// Base check for melee capability
	if (!canPerformMeleeAttacks(unit)) {
		return { 
			success: false, 
			reason: `${unit.name} cannot perform melee attacks.` 
		};
	}

	// Check if the unit has already moved
	if (!unit.status.hasMoved) {
		return { 
			success: false, 
			reason: `${unit.name} must move before performing melee attacks.` 
		};
	}

	// Check if the target is valid
	const distance = calculateDistance(unit.position, target.position);

	// Standard melee attack checks
	if (attackType === MELEE_ATTACK_TYPES.STANDARD) {
		// Must be adjacent
		if (distance > 1) {
			return { 
				success: false, 
				reason: `Target is too far away for a standard melee attack. Must be adjacent.` 
			};
		}

		// Can't perform melee if immobile
		if (unit.status.immobile) {
			return { 
				success: false, 
				reason: `Immobile units cannot perform melee attacks.` 
			};
		}

		// Infantry can only melee if they have the MEL special ability
		if (unit.type === 'Infantry' && !hasSpecialAbility(unit, 'MEL')) {
			return { 
				success: false, 
				reason: `Infantry without the MEL special ability cannot perform melee attacks.` 
			};
		}

		// Battle Armor needs the MEL special ability
		if (unit.type === 'BattleArmor' && !hasSpecialAbility(unit, 'MEL')) {
			return { 
				success: false, 
				reason: `Battle Armor without the MEL special ability cannot perform melee attacks.` 
			};
		}
	}

	// Charge attack checks
	else if (attackType === MELEE_ATTACK_TYPES.CHARGE) {
		// Must have moved at least 3 hexes this turn
		if (unit.status.distanceMoved < 3) {
			return { 
				success: false, 
				reason: `Unit must move at least 3 hexes to perform a charge attack.` 
			};
		}

		// Must be adjacent
		if (distance > 1) {
			return { 
				success: false, 
				reason: `Target is too far away for a charge attack. Must be adjacent at end of movement.` 
			};
		}

		// Target size check - can't charge units that are 2+ size classes larger
		if (getSizeClass(target) - getSizeClass(unit) >= 2) {
			return { 
				success: false, 
				reason: `Cannot charge a unit that is 2 or more size classes larger.` 
			};
		}
	}

	// Kick attack checks
	else if (attackType === MELEE_ATTACK_TYPES.KICK) {
		// Only mechs can kick
		if (unit.type !== 'Mech') {
			return { 
				success: false, 
				reason: `Only 'Mech units can perform kick attacks.` 
			};
		}

		// Must be adjacent
		if (distance > 1) {
			return { 
				success: false, 
				reason: `Target is too far away for a kick attack. Must be adjacent.` 
			};
		}

		// Can't kick airborne units
		if (target.movement.type === 'Aerodyne' || target.movement.type === 'Spheroid') {
			return { 
				success: false, 
				reason: `Cannot kick airborne units.` 
			};
		}

		// Size restrictions - can't kick units more than 1 size class larger
		if (getSizeClass(target) - getSizeClass(unit) > 1) {
			return { 
				success: false, 
				reason: `Cannot kick a unit that is more than 1 size class larger.` 
			};
		}
	}

	// Punch attack checks
	else if (attackType === MELEE_ATTACK_TYPES.PUNCH) {
		// Only mechs can punch
		if (unit.type !== 'Mech') {
			return { 
				success: false, 
				reason: `Only 'Mech units can perform punch attacks.` 
			};
		}

		// Quad mechs can't punch
		if (hasSpecialAbility(unit, 'QUAD')) {
			return { 
				success: false, 
				reason: `Quad 'Mechs cannot perform punch attacks.` 
			};
		}

		// Must be adjacent
		if (distance > 1) {
			return { 
				success: false, 
				reason: `Target is too far away for a punch attack. Must be adjacent.` 
			};
		}

		// Size restrictions - can't punch units more than 1 size class larger
		if (getSizeClass(target) - getSizeClass(unit) > 1) {
			return { 
				success: false, 
				reason: `Cannot punch a unit that is more than 1 size class larger.` 
			};
		}
	}

	// Weapon melee attack checks
	else if (attackType === MELEE_ATTACK_TYPES.WEAPON) {
		// Only units with MEL can use weapon attacks
		if (!hasSpecialAbility(unit, 'MEL')) {
			return { 
				success: false, 
				reason: `Only units with the MEL special ability can perform weapon melee attacks.` 
			};
		}

		// Must be adjacent
		if (distance > 1) {
			return { 
				success: false, 
				reason: `Target is too far away for a weapon melee attack. Must be adjacent.` 
			};
		}
	}
	
	// If we get here, the attack is valid
	return { success: true };
}

/**
 * Get the size class of a unit
 * @param {Object} unit - The unit to check
 * @returns {number} Size class value
 */
function getSizeClass(unit) {
	const sizeClasses = {
		'0': 0,   // Battle Armor/Infantry
		'1': 1,   // Light
		'2': 2,   // Medium
		'3': 3,   // Heavy
		'4': 4    // Assault
	};

	// Handle Battle Armor and Infantry
	if (unit.type === 'BattleArmor' || unit.type === 'Infantry') {
		return 0;
	}

	// Check if the unit has an explicit size class
	if (unit.sizeClass && sizeClasses[unit.sizeClass] !== undefined) {
		return sizeClasses[unit.sizeClass];
	}

	// For mechs, determine size class by tonnage
	if (unit.type === 'Mech' && unit.tonnage) {
		if (unit.tonnage <= 35) return 1;      // Light
		if (unit.tonnage <= 55) return 2;      // Medium
		if (unit.tonnage <= 75) return 3;      // Heavy
		return 4;                              // Assault
	}

	// For vehicles, determine size class by tonnage
	if (unit.type === 'Vehicle' && unit.tonnage) {
		if (unit.tonnage <= 35) return 1;      // Light
		if (unit.tonnage <= 55) return 2;      // Medium
		if (unit.tonnage <= 75) return 3;      // Heavy
		return 4;                              // Assault
	}

	// Default to medium if we can't determine
	return 2;
}

/**
 * Calculate the base damage for a melee attack
 * @param {Object} unit - The attacking unit
 * @param {Object} target - The target unit
 * @param {string} attackType - The type of melee attack
 * @returns {number} The calculated damage value
 */
function calculateMeleeDamage(unit, target, attackType) {
	const unitSize = getSizeClass(unit);
	let damage = 0;

	// Standard melee attack damage
	if (attackType === MELEE_ATTACK_TYPES.STANDARD) {
		// Base damage by size class
		if (unitSize === 0) damage = 0;       // Battle Armor/Infantry
		else if (unitSize === 1) damage = 1;  // Light
		else if (unitSize === 2) damage = 2;  // Medium
		else if (unitSize === 3) damage = 3;  // Heavy
		else if (unitSize === 4) damage = 4;  // Assault

		// Battle armor gets bonus damage against non-infantry
		if (unit.type === 'BattleArmor' && target.type !== 'Infantry') {
			damage += 1;
		}

		// Units with MEL special ability get +1 damage
		if (hasSpecialAbility(unit, 'MEL')) {
			damage += 1;
		}
	}

	// Charge attack damage
	else if (attackType === MELEE_ATTACK_TYPES.CHARGE) {
		// Base damage = size class + 2
		damage = unitSize + 2;

		// Minimum damage of 1 even for Battle Armor
		damage = Math.max(1, damage);
	}

	// Kick attack damage
	else if (attackType === MELEE_ATTACK_TYPES.KICK) {
		// Base damage = size class + 1
		damage = unitSize + 1;
	}

	// Punch attack damage
	else if (attackType === MELEE_ATTACK_TYPES.PUNCH) {
		// Base damage = size class
		damage = unitSize;
	}

	// Weapon melee attack damage
	else if (attackType === MELEE_ATTACK_TYPES.WEAPON) {
		// Base damage by size class
		if (unitSize === 0) damage = 1;       // Battle Armor
		else if (unitSize === 1) damage = 2;  // Light
		else if (unitSize === 2) damage = 3;  // Medium
		else if (unitSize === 3) damage = 4;  // Heavy
		else if (unitSize === 4) damage = 5;  // Assault
	}

	return damage;
}

/**
 * Calculate self-damage from a melee attack
 * @param {Object} unit - The attacking unit
 * @param {Object} target - The target unit
 * @param {string} attackType - The type of melee attack
 * @returns {number} The calculated self damage
 */
function calculateMeleeSelfDamage(unit, target, attackType) {
	const unitSize = getSizeClass(unit);
	const targetSize = getSizeClass(target);
	let selfDamage = 0;

	// Charge attacks always cause self damage
	if (attackType === MELEE_ATTACK_TYPES.CHARGE) {
		// Self damage based on size difference
		if (targetSize > unitSize) {
			// Charging a larger unit causes increased self damage
			selfDamage = unitSize + (targetSize - unitSize);
		} else {
			// Base self damage
			selfDamage = unitSize;
		}

		// Minimum self damage of 1
		selfDamage = Math.max(1, selfDamage);
	}

	// Other attack types generally don't cause self damage
	// but might in special cases (future expansion)

	return selfDamage;
}

/**
 * Perform a melee attack
 * @param {Object} gameState - The current game state
 * @param {string} attackerUnitId - The ID of the attacking unit
 * @param {string} targetUnitId - The ID of the target unit
 * @param {string} attackType - The type of melee attack
 * @returns {Object} Result of the attack
 */
function performMeleeAttack(gameState, attackerUnitId, targetUnitId, attackType = MELEE_ATTACK_TYPES.STANDARD) {
	// Get units
	const attacker = gameState.battlefield.units.get(attackerUnitId);
	const target = gameState.battlefield.units.get(targetUnitId);

	if (!attacker || !target) {
		return {
			success: false,
			reason: 'Invalid unit IDs'
		};
	}

	// Validate attack type
	if (!Object.values(MELEE_ATTACK_TYPES).includes(attackType)) {
		return {
			success: false,
			reason: `Invalid attack type: ${attackType}`
		};
	}

	// Check if the attack is valid
	const attackCheck = canPerformMeleeAttackType(gameState, attacker, target, attackType);
	if (!attackCheck.success) {
		return attackCheck;
	}

	// Skill check for attacker
	const skillCheckResult = performSkillCheck(attacker);
	
	// If skill check fails, the attack misses
	if (!skillCheckResult.success) {
		// Add to combat log
		gameState.combatLog.push({
			type: 'MELEE_ATTACK',
			attackerId: attackerUnitId,
			targetId: targetUnitId,
			attackType: attackType,
			outcome: 'MISS',
			reason: 'Failed skill check'
		});

		return {
			success: true,
			attackType: attackType,
			hit: false,
			damage: 0,
			selfDamage: 0,
			description: `Attack missed due to failed skill check (rolled ${skillCheckResult.roll}, needed ${skillCheckResult.target} or less).`
		};
	}

	// Calculate base damage
	const damage = calculateMeleeDamage(attacker, target, attackType);
	
	// Calculate self damage
	const selfDamage = calculateMeleeSelfDamage(attacker, target, attackType);

	// Initialize prone status
	let targetProne = false;
	let attackerProne = false;

	// Special effects based on attack type
	if (attackType === MELEE_ATTACK_TYPES.CHARGE) {
		// Piloting skill check for target to avoid falling
		const targetPilotingCheck = performSkillCheck(target, 1); // +1 difficulty
		if (!targetPilotingCheck.success) {
			targetProne = true;
			
			// Update target status
			target.status.prone = true;
		}

		// Piloting skill check for attacker to avoid falling
		const attackerPilotingCheck = performSkillCheck(attacker, 1); // +1 difficulty
		if (!attackerPilotingCheck.success) {
			attackerProne = true;
			
			// Update attacker status
			attacker.status.prone = true;
		}
	}
	else if (attackType === MELEE_ATTACK_TYPES.KICK) {
		// Piloting skill check for target to avoid falling
		const targetPilotingCheck = performSkillCheck(target);
		if (!targetPilotingCheck.success) {
			targetProne = true;
			
			// Update target status
			target.status.prone = true;
		}

		// Piloting skill check for attacker to avoid falling
		const attackerPilotingCheck = performSkillCheck(attacker, 1); // +1 difficulty
		if (!attackerPilotingCheck.success) {
			attackerProne = true;
			
			// Update attacker status
			attacker.status.prone = true;
		}
	}

	// Apply damage to target
	if (damage > 0) {
		// Apply damage to armor first
		const armorDamage = Math.min(target.armor, damage);
		target.armor -= armorDamage;
		
		// If armor is depleted, apply remaining damage to structure
		const structureDamage = damage - armorDamage;
		if (structureDamage > 0) {
			target.structure -= structureDamage;
		}
		
		// Check if target is destroyed
		if (target.structure <= 0) {
			target.structure = 0;
			target.status.destroyed = true;
		}
	}

	// Apply self damage to attacker
	if (selfDamage > 0) {
		// Apply self damage to armor first
		const armorDamage = Math.min(attacker.armor, selfDamage);
		attacker.armor -= armorDamage;
		
		// If armor is depleted, apply remaining damage to structure
		const structureDamage = selfDamage - armorDamage;
		if (structureDamage > 0) {
			attacker.structure -= structureDamage;
		}
		
		// Check if attacker is destroyed
		if (attacker.structure <= 0) {
			attacker.structure = 0;
			attacker.status.destroyed = true;
		}
	}

	// Heat generation for Mechs
	if (attacker.type === 'Mech') {
		if (attackType === MELEE_ATTACK_TYPES.CHARGE) {
			attacker.heat = Math.min(attacker.heatCapacity || 4, (attacker.heat || 0) + 2);
		} else if (attackType === MELEE_ATTACK_TYPES.KICK || attackType === MELEE_ATTACK_TYPES.PUNCH) {
			attacker.heat = Math.min(attacker.heatCapacity || 4, (attacker.heat || 0) + 1);
		}
	}

	// Add to combat log
	gameState.combatLog.push({
		type: 'MELEE_ATTACK',
		attackerId: attackerUnitId,
		targetId: targetUnitId,
		attackType: attackType,
		outcome: 'HIT',
		damage: damage,
		selfDamage: selfDamage,
		targetProne: targetProne,
		attackerProne: attackerProne
	});

	// Mark attacker as having attacked
	attacker.status.hasAttacked = true;

	// Prepare description text
	let description = `${attacker.name} successfully hit ${target.name} with a ${attackType} attack!`;

	if (target.status.destroyed) {
		description += ` ${target.name} was destroyed!`;
	}

	if (targetProne) {
		description += ` ${target.name} was knocked prone!`;
	}

	if (attackerProne) {
		description += ` ${attacker.name} fell prone from the attack!`;
	}

	// Return the result
	return {
		success: true,
		attackType: attackType,
		hit: true,
		damage: damage,
		selfDamage: selfDamage,
		targetProne: targetProne,
		attackerProne: attackerProne,
		description: description
	};
}

module.exports = {
	MELEE_ATTACK_TYPES,
	canPerformMeleeAttacks,
	canPerformMeleeAttackType,
	calculateMeleeDamage,
	calculateMeleeSelfDamage,
	performMeleeAttack
}; 