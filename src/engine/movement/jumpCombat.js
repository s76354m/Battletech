/**
 * jumpCombat.js
 * Implements jump-based combat mechanics including Death From Above
 */

const { rollDice, roll2d6 } = require('../../utils/dice');
const { calculateDistance } = require('../movement/movementUtils');

// Types of jump attacks
const JUMP_ATTACK_TYPES = {
	DEATH_FROM_ABOVE: 'death_from_above',
	JUMP_JET_ATTACK: 'jump_jet_attack'
};

/**
 * Check if a unit can perform a Death From Above attack
 * @param {Object} attacker - The attacking unit
 * @param {Object} target - The target unit
 * @param {Object} gameState - Current game state
 * @returns {Object} Result with validity and reason
 */
function canPerformDeathFromAbove(attacker, target, gameState) {
	// Only Mechs can perform DFA
	if (attacker.type !== 'MECH') {
		return { valid: false, reason: "Only Mechs can perform Death From Above attacks" };
	}
	
	// Target must be a Mech
	if (target.type !== 'MECH') {
		return { valid: false, reason: "Death From Above can only target Mechs" };
	}
	
	// Attacker must be in the air (jumping)
	if (!attacker.isJumping) {
		return { valid: false, reason: "Unit must be jumping to perform Death From Above" };
	}
	
	// Attacker must have working jump jets
	if (!attacker.jumpCapable || attacker.jumpJets <= 0) {
		return { valid: false, reason: "Unit requires working jump jets" };
	}
	
	// Attacker must have remaining movement points
	if (attacker.currentMovement <= 0) {
		return { valid: false, reason: "No movement points remaining" };
	}
	
	// Check if target is within jump range
	const distance = calculateDistance(attacker.position, target.position);
	const maxJumpDistance = attacker.jumpJets;
	
	if (distance > maxJumpDistance) {
		return { 
			valid: false, 
			reason: `Target is out of jump range (${distance} hexes, max range ${maxJumpDistance})`
		};
	}
	
	return { valid: true };
}

/**
 * Calculate the to-hit number for a Death From Above attack
 * @param {Object} attacker - The attacking unit
 * @param {Object} target - The target unit
 * @param {Object} gameState - Current game state
 * @returns {number} Target number to hit (2d6)
 */
function calculateDFAToHit(attacker, target, gameState) {
	// Base to-hit value
	let baseToHit = 9;
	
	// Pilot skill modifier
	baseToHit -= attacker.piloting || 0;
	
	// Jump distance modifier
	const distance = calculateDistance(attacker.position, target.position);
	baseToHit += Math.max(0, distance - 1); // +1 for each hex jumped after the first
	
	// Target movement modifier
	if (target.hasMoved) {
		if (target.moveType === 'run') baseToHit += 2;
		else if (target.moveType === 'walk') baseToHit += 1;
		else if (target.moveType === 'jump') baseToHit += 3;
	}
	
	// Terrain modifiers
	const targetHex = gameState.battlefield.hexes.get(`${target.position.x},${target.position.y}`);
	if (targetHex) {
		if (targetHex.terrain === 'woods') baseToHit += 1;
		if (targetHex.terrain === 'water' && targetHex.depth > 0) baseToHit += 1;
	}
	
	// Visibility modifiers
	if (gameState.currentPhase === 'NIGHT' || gameState.weather === 'FOG') {
		baseToHit += 2;
	}
	
	// Ensure to-hit is within bounds (2-12)
	return Math.min(Math.max(baseToHit, 2), 12);
}

/**
 * Calculate damage for a Death From Above attack
 * @param {Object} attacker - The attacking unit
 * @param {Object} target - The target unit
 * @returns {Object} Damage information
 */
function calculateDFADamage(attacker, target) {
	// Damage depends on attacker's tonnage
	const tonnage = attacker.tonnage || 0;
	let attackerDamage = 0;
	let attackerLegDamage = 0;
	let targetDamage = 0;
	
	// Target damage calculation
	if (tonnage <= 20) {
		targetDamage = 1 * tonnage;
	} else if (tonnage <= 40) {
		targetDamage = 2 * tonnage;
	} else if (tonnage <= 60) {
		targetDamage = 3 * tonnage;
	} else if (tonnage <= 80) {
		targetDamage = 4 * tonnage;
	} else {
		targetDamage = 5 * tonnage;
	}
	
	// Attacker damage calculation (primarily to legs)
	attackerLegDamage = Math.ceil(tonnage / 5); // Damage per leg
	
	// Attacker may suffer general damage if the target is much heavier
	if (target.tonnage > attacker.tonnage) {
		attackerDamage = Math.ceil((target.tonnage - attacker.tonnage) / 10);
	}
	
	return {
		targetDamage,
		attackerLegDamage,
		attackerDamage
	};
}

/**
 * Execute a Death From Above attack
 * @param {Object} attacker - The attacking unit
 * @param {Object} target - The target unit
 * @param {Object} gameState - Current game state
 * @returns {Object} Result of the attack
 */
function executeDeathFromAbove(attacker, target, gameState) {
	// Check if attack is valid
	const validityCheck = canPerformDeathFromAbove(attacker, target, gameState);
	if (!validityCheck.valid) {
		return {
			success: false,
			message: validityCheck.reason
		};
	}
	
	// Calculate to-hit number
	const toHitNumber = calculateDFAToHit(attacker, target, gameState);
	
	// Roll to hit
	const hitRoll = roll2d6();
	const hit = hitRoll >= toHitNumber;
	
	// Initialize result
	const result = {
		success: true,
		hit,
		attackType: JUMP_ATTACK_TYPES.DEATH_FROM_ABOVE,
		toHitNumber,
		roll: hitRoll
	};
	
	// Attacker always ends up prone and in the same hex as the target
	result.attackerPosition = { ...target.position };
	result.attackerProne = true;
	
	// If attack hits
	if (hit) {
		// Calculate damage
		const damageInfo = calculateDFADamage(attacker, target);
		result.targetDamage = damageInfo.targetDamage;
		result.attackerLegDamage = damageInfo.attackerLegDamage;
		result.attackerDamage = damageInfo.attackerDamage;
		
		// Hit location is always head or center torso
		const locationRoll = rollDice(1, 6).sum;
		result.targetHitLocation = locationRoll <= 2 ? 'HEAD' : 'CENTER_TORSO';
		
		// Target must make a PSR to avoid falling
		result.targetPSRRequired = true;
		result.targetPSRModifier = Math.ceil(damageInfo.targetDamage / 10); // +1 per 10 damage points
		
		// Potential critical hit
		const critRoll = roll2d6();
		if (critRoll >= 10) {
			result.criticalHit = true;
			result.criticalRoll = critRoll;
			// Critical locations for target - more likely to damage legs
			const critLocation = rollDice(1, 6).sum;
			if (critLocation <= 3) result.criticalLocation = 'LEFT_LEG';
			else if (critLocation <= 5) result.criticalLocation = 'RIGHT_LEG';
			else result.criticalLocation = result.targetHitLocation; // Head or torso
		}
	} else {
		// If attack misses, determine where attacker lands
		const missDirectionRoll = rollDice(1, 6).sum;
		const missDistance = 1; // Always lands 1 hex away on miss
		
		// Convert direction roll to coordinates
		const missDirections = {
			1: { x: 0, y: -1 }, // North
			2: { x: 1, y: -1 }, // Northeast
			3: { x: 1, y: 0 },  // Southeast
			4: { x: 0, y: 1 },  // South
			5: { x: -1, y: 1 }, // Southwest
			6: { x: -1, y: 0 }  // Northwest
		};
		
		const direction = missDirections[missDirectionRoll];
		result.attackerPosition = {
			x: target.position.x + direction.x * missDistance,
			y: target.position.y + direction.y * missDistance
		};
		
		// Attacker still takes leg damage on miss
		const tonnage = attacker.tonnage || 0;
		result.attackerLegDamage = Math.ceil(tonnage / 4); // More damage on miss
		
		// Check if the attacker lands in invalid terrain
		const landingHex = gameState.battlefield.hexes.get(
			`${result.attackerPosition.x},${result.attackerPosition.y}`
		);
		
		if (!landingHex || landingHex.terrain === 'INVALID') {
			// Attacker takes extra damage for landing in invalid terrain
			result.attackerDamage = tonnage; // Significant damage for bad landing
			result.message = "Attacker landed in invalid terrain and took significant damage";
		}
	}
	
	// Attacker must make a PSR to avoid additional damage
	result.attackerPSRRequired = true;
	
	// Attacker takes PSR penalty based on height
	const jumpHeight = Math.min(attacker.jumpJets, 
							   calculateDistance(attacker.startPosition, target.position));
	result.attackerPSRModifier = jumpHeight;
	
	// Update attacker's position and status
	result.attackerNewState = {
		position: result.attackerPosition,
		prone: result.attackerProne,
		isJumping: false,
		hasMoved: true,
		currentMovement: 0
	};
	
	return result;
}

/**
 * Check if a unit can perform a jump jet attack
 * @param {Object} attacker - The attacking unit
 * @param {Object} target - The target unit
 * @param {Object} gameState - Current game state
 * @returns {Object} Result with validity and reason
 */
function canPerformJumpJetAttack(attacker, target, gameState) {
	// Only Mechs can perform jump jet attacks
	if (attacker.type !== 'MECH') {
		return { valid: false, reason: "Only Mechs can perform jump jet attacks" };
	}
	
	// Attacker must be in the air (jumping)
	if (!attacker.isJumping) {
		return { valid: false, reason: "Unit must be jumping to perform jump jet attack" };
	}
	
	// Attacker must have working jump jets
	if (!attacker.jumpCapable || attacker.jumpJets <= 0) {
		return { valid: false, reason: "Unit requires working jump jets" };
	}
	
	// Check if target is within range (adjacent to jump path)
	const jumpPath = gameState.currentPath || [];
	let isAdjacent = false;
	
	for (const pathHex of jumpPath) {
		const hexDistance = calculateDistance(pathHex, target.position);
		if (hexDistance === 1) {
			isAdjacent = true;
			break;
		}
	}
	
	if (!isAdjacent) {
		return { 
			valid: false, 
			reason: "Target must be adjacent to jump path" 
		};
	}
	
	return { valid: true };
}

/**
 * Calculate the to-hit number for a jump jet attack
 * @param {Object} attacker - The attacking unit
 * @param {Object} target - The target unit
 * @param {Object} gameState - Current game state
 * @returns {number} Target number to hit (2d6)
 */
function calculateJumpJetAttackToHit(attacker, target, gameState) {
	// Base to-hit value
	let baseToHit = 7;
	
	// Pilot skill modifier
	baseToHit -= attacker.piloting || 0;
	
	// Target movement modifier
	if (target.hasMoved) {
		if (target.moveType === 'run') baseToHit += 2;
		else if (target.moveType === 'walk') baseToHit += 1;
		else if (target.moveType === 'jump') baseToHit += 3;
	}
	
	// Jump distance modifier
	const jumpDistance = calculateDistance(attacker.startPosition, attacker.position);
	baseToHit += Math.floor(jumpDistance / 2); // +1 for every 2 hexes jumped
	
	// Ensure to-hit is within bounds (2-12)
	return Math.min(Math.max(baseToHit, 2), 12);
}

/**
 * Calculate damage for a jump jet attack
 * @param {Object} attacker - The attacking unit
 * @returns {number} Damage amount
 */
function calculateJumpJetAttackDamage(attacker) {
	// Damage is based on number of jump jets
	return Math.min(5, attacker.jumpJets);
}

/**
 * Execute a jump jet attack
 * @param {Object} attacker - The attacking unit
 * @param {Object} target - The target unit
 * @param {Object} gameState - Current game state
 * @returns {Object} Result of the attack
 */
function executeJumpJetAttack(attacker, target, gameState) {
	// Check if attack is valid
	const validityCheck = canPerformJumpJetAttack(attacker, target, gameState);
	if (!validityCheck.valid) {
		return {
			success: false,
			message: validityCheck.reason
		};
	}
	
	// Calculate to-hit number
	const toHitNumber = calculateJumpJetAttackToHit(attacker, target, gameState);
	
	// Roll to hit
	const hitRoll = roll2d6();
	const hit = hitRoll >= toHitNumber;
	
	// Initialize result
	const result = {
		success: true,
		hit,
		attackType: JUMP_ATTACK_TYPES.JUMP_JET_ATTACK,
		toHitNumber,
		roll: hitRoll
	};
	
	// If attack hits
	if (hit) {
		// Calculate damage
		const damage = calculateJumpJetAttackDamage(attacker);
		result.damage = damage;
		
		// Heat generation for attacker
		result.heatGenerated = 3;
		
		// Determine hit location
		const locationRoll = rollDice(2, 6).sum;
		
		// Standard hit location table
		switch (locationRoll) {
			case 2: result.location = 'CENTER_TORSO'; break;
			case 3: result.location = 'RIGHT_ARM'; break;
			case 4: result.location = 'RIGHT_ARM'; break;
			case 5: result.location = 'RIGHT_LEG'; break;
			case 6: result.location = 'RIGHT_LEG'; break;
			case 7: result.location = 'CENTER_TORSO'; break;
			case 8: result.location = 'LEFT_LEG'; break;
			case 9: result.location = 'LEFT_LEG'; break;
			case 10: result.location = 'LEFT_ARM'; break;
			case 11: result.location = 'LEFT_ARM'; break;
			case 12: result.location = 'HEAD'; break;
		}
		
		// Small chance of critical hit
		if (rollDice(1, 6).sum === 6) {
			result.criticalHit = true;
		}
	} else {
		// No damage on miss
		result.damage = 0;
		
		// Still generates heat
		result.heatGenerated = 2;
	}
	
	// Jump continues - update attacker's remaining movement
	result.attackerRemainingMP = Math.max(0, attacker.currentMovement - 1);
	
	return result;
}

/**
 * Resolve PSR (Piloting Skill Roll) for a unit after a jump attack
 * @param {Object} unit - The unit making the roll
 * @param {number} modifier - Modifier to apply to the roll
 * @returns {Object} Result of the PSR
 */
function resolveJumpAttackPSR(unit, modifier = 0) {
	const pilotingSkill = unit.piloting || 0;
	const targetNumber = 8 - pilotingSkill + modifier;
	
	const roll = roll2d6();
	const success = roll >= targetNumber;
	
	return {
		success,
		roll,
		targetNumber,
		fallingDamage: success ? 0 : Math.ceil(unit.tonnage / 10)
	};
}

module.exports = {
	JUMP_ATTACK_TYPES,
	canPerformDeathFromAbove,
	calculateDFAToHit,
	calculateDFADamage,
	executeDeathFromAbove,
	canPerformJumpJetAttack,
	calculateJumpJetAttackToHit,
	calculateJumpJetAttackDamage,
	executeJumpJetAttack,
	resolveJumpAttackPSR
}; 