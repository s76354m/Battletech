/**
 * antiMechInfantry.js
 * Implements specialized anti-mech capabilities for infantry units
 */

const { rollDice, roll2d6 } = require('../../utils/dice');
const { calculateDistance } = require('../movement/movementUtils');

// Anti-mech weapon types for infantry
const ANTI_MECH_WEAPONS = {
	// Standard weapons
	INFANTRY_RIFLE: 'infantry_rifle',
	MACHINE_GUN: 'machine_gun',
	LIGHT_SRM: 'light_srm',
	
	// Specialized anti-mech weapons
	INFERNO_SRM: 'inferno_srm',
	PORTABLE_PPC: 'portable_ppc',
	DEMO_CHARGE: 'demo_charge',
	VIBRO_BLADE: 'vibro_blade',
	MAGSHOT: 'magshot',
	TAG_DESIGNATOR: 'tag_designator'
};

// Leg attack types
const LEG_ATTACK_TYPES = {
	SWARM: 'swarm',
	LEG_ATTACK: 'leg_attack',
	MINE_PLACEMENT: 'mine_placement'
};

/**
 * Check if infantry can perform an anti-mech attack
 * @param {Object} infantry - The infantry unit
 * @param {Object} target - The target mech unit
 * @param {string} attackType - Type of attack (from LEG_ATTACK_TYPES)
 * @param {Object} gameState - Current game state
 * @returns {Object} Result with validity and reason
 */
function canPerformAntiMechAttack(infantry, target, attackType, gameState) {
	// Basic checks
	if (infantry.type !== 'INFANTRY') {
		return { valid: false, reason: "Only infantry units can perform anti-mech attacks" };
	}
	
	if (target.type !== 'MECH') {
		return { valid: false, reason: "Anti-mech attacks can only target mechs" };
	}
	
	// Check troop count - need at least a minimum number of troops
	if ((infantry.troopCount || 0) < 3) {
		return { valid: false, reason: "Not enough troops remaining to perform anti-mech attack" };
	}
	
	// Check if units are in appropriate hexes
	const distance = calculateDistance(infantry.position, target.position);
	
	switch (attackType) {
		case LEG_ATTACK_TYPES.SWARM:
			// Must be in same hex or adjacent for swarm
			if (distance > 1) {
				return { valid: false, reason: "Target must be in the same hex or adjacent for swarm attack" };
			}
			
			// Check if infantry has moved this turn (can't move and swarm in same turn)
			if (infantry.hasMoved && infantry.moveType !== 'none') {
				return { valid: false, reason: "Infantry cannot move and swarm in the same turn" };
			}
			break;
			
		case LEG_ATTACK_TYPES.LEG_ATTACK:
			// Must be in same hex for leg attack
			if (distance !== 0) {
				return { valid: false, reason: "Target must be in the same hex for leg attack" };
			}
			break;
			
		case LEG_ATTACK_TYPES.MINE_PLACEMENT:
			// Must be in same hex for mine placement
			if (distance !== 0) {
				return { valid: false, reason: "Target must be in the same hex for mine placement" };
			}
			
			// Check if infantry has demo charges
			if (!infantry.equipment.includes(ANTI_MECH_WEAPONS.DEMO_CHARGE)) {
				return { valid: false, reason: "Infantry must have demo charges for mine placement" };
			}
			break;
			
		default:
			return { valid: false, reason: "Unknown anti-mech attack type" };
	}
	
	// Check infantry equipment for special requirements
	if (attackType === LEG_ATTACK_TYPES.SWARM) {
		const hasClimbingGear = infantry.equipment.includes('climbing_gear');
		
		// Motorized and mechanized infantry can't swarm without special equipment
		if ((infantry.type === 'MOTORIZED' || infantry.type === 'MECHANIZED') && !hasClimbingGear) {
			return { valid: false, reason: "Motorized/mechanized infantry need climbing gear to swarm" };
		}
	}
	
	return { valid: true };
}

/**
 * Calculate the to-hit number for an anti-mech attack
 * @param {Object} infantry - The infantry unit
 * @param {Object} target - The target mech unit
 * @param {string} attackType - Type of attack
 * @param {Object} gameState - Current game state
 * @returns {number} Target number to hit (2d6)
 */
function calculateAntiMechToHit(infantry, target, attackType, gameState) {
	// Base to-hit value depends on attack type
	let baseToHit;
	
	switch (attackType) {
		case LEG_ATTACK_TYPES.SWARM:
			baseToHit = 8;
			break;
		case LEG_ATTACK_TYPES.LEG_ATTACK:
			baseToHit = 7;
			break;
		case LEG_ATTACK_TYPES.MINE_PLACEMENT:
			baseToHit = 6; // Easier since just placing mines around feet
			break;
		default:
			baseToHit = 8;
	}
	
	// Infantry quality modifier - better trained infantry are more effective
	const infantryQuality = infantry.quality || 'REGULAR';
	switch (infantryQuality) {
		case 'GREEN':
			baseToHit += 1;
			break;
		case 'VETERAN':
			baseToHit -= 1;
			break;
		case 'ELITE':
			baseToHit -= 2;
			break;
	}
	
	// Target movement modifier
	if (target.hasMoved) {
		if (target.moveType === 'run') baseToHit += 2;
		else if (target.moveType === 'walk') baseToHit += 1;
		else if (target.moveType === 'jump') baseToHit += 3;
	}
	
	// Mech size modifier
	const mechTonnage = target.tonnage || 0;
	if (mechTonnage < 40) {
		baseToHit += 1; // Harder to hit light mechs
	} else if (mechTonnage >= 80) {
		baseToHit -= 1; // Easier to hit assault mechs
	}
	
	// Special equipment modifiers
	if (infantry.equipment) {
		if (attackType === LEG_ATTACK_TYPES.SWARM && infantry.equipment.includes('climbing_gear')) {
			baseToHit -= 1;
		}
		
		if (attackType === LEG_ATTACK_TYPES.LEG_ATTACK && infantry.equipment.includes(ANTI_MECH_WEAPONS.VIBRO_BLADE)) {
			baseToHit -= 1;
		}
	}
	
	// Weather and time of day effects
	if (gameState.weather) {
		switch (gameState.weather) {
			case 'RAIN':
				baseToHit += 1;
				break;
			case 'SNOW':
				baseToHit += 1;
				break;
			case 'HEAVY_SNOW':
				baseToHit += 2;
				break;
		}
	}
	
	if (gameState.currentPhase === 'NIGHT') {
		baseToHit += 1;
	}
	
	// Ensure to-hit is within bounds (2-12)
	return Math.min(Math.max(baseToHit, 2), 12);
}

/**
 * Calculate damage and effects for an anti-mech attack
 * @param {Object} infantry - The infantry unit
 * @param {Object} target - The target mech unit
 * @param {string} attackType - Type of attack
 * @param {Object} gameState - Current game state
 * @returns {Object} Damage and effects information
 */
function calculateAntiMechDamage(infantry, target, attackType, gameState) {
	const troopCount = infantry.troopCount || 0;
	const mechTonnage = target.tonnage || 0;
	
	let damage = 0;
	let infantryLosses = 0;
	const effects = {};
	
	switch (attackType) {
		case LEG_ATTACK_TYPES.SWARM:
			// Base damage depends on troop count
			damage = Math.max(1, Math.floor(troopCount / 2));
			
			// Special equipment bonus
			if (infantry.equipment) {
				if (infantry.equipment.includes(ANTI_MECH_WEAPONS.INFERNO_SRM)) {
					damage += 1;
					effects.heatGenerated = 4; // Inferno SRMs generate heat
				}
				
				if (infantry.equipment.includes(ANTI_MECH_WEAPONS.VIBRO_BLADE)) {
					damage += 2;
				}
				
				if (infantry.equipment.includes(ANTI_MECH_WEAPONS.MAGSHOT)) {
					damage += 2;
				}
			}
			
			// Chance to hit critical components when swarming
			effects.criticalChance = 0.3;
			
			// Swarming infantry takes damage if mech moves or attacks
			infantryLosses = Math.ceil(troopCount / 4);
			
			// Swarming effect - infantry remains attached to mech
			effects.swarming = true;
			effects.restrictTargetMovement = true; // Reduce mech movement
			effects.targetPilotingModifier = 1; // Harder for mech to maintain balance
			
			break;
			
		case LEG_ATTACK_TYPES.LEG_ATTACK:
			// Base damage focused on legs
			damage = Math.max(1, Math.floor(troopCount / 3));
			
			// Special equipment bonus
			if (infantry.equipment) {
				if (infantry.equipment.includes(ANTI_MECH_WEAPONS.VIBRO_BLADE)) {
					damage += 3; // Vibro blades are very effective for leg attacks
				}
				
				if (infantry.equipment.includes(ANTI_MECH_WEAPONS.DEMO_CHARGE)) {
					damage += 5; // Demo charges do significant damage
					infantryLosses += Math.ceil(troopCount / 5); // Some troops lost in explosion
				}
			}
			
			// Target mech must make a piloting roll to avoid falling
			effects.requiredPSR = true;
			effects.psrModifier = Math.min(3, Math.floor(troopCount / 4)); // Max +3 modifier
			
			// Leg attacks target specific locations
			effects.forceHitLocation = true;
			effects.hitLocations = ['LEFT_LEG', 'RIGHT_LEG'];
			
			break;
			
		case LEG_ATTACK_TYPES.MINE_PLACEMENT:
			// Base damage from mines
			damage = Math.max(2, Math.floor(troopCount / 2));
			
			// Troop quality affects mine placement effectiveness
			const infantryQuality = infantry.quality || 'REGULAR';
			switch (infantryQuality) {
				case 'GREEN':
					damage -= 1;
					break;
				case 'VETERAN':
					damage += 1;
					break;
				case 'ELITE':
					damage += 2;
					break;
			}
			
			// High critical chance with mines
			effects.criticalChance = 0.4;
			
			// Mines place a hazard in the hex
			effects.placeHazard = true;
			effects.hazardType = 'MINES';
			effects.hazardDuration = 3; // Lasts 3 rounds
			
			// Some infantry may be lost setting mines
			infantryLosses = Math.ceil(troopCount / 10);
			
			break;
	}
	
	// Apply terrain modifiers to damage
	const currentHex = gameState.battlefield.hexes.get(
		`${infantry.position.x},${infantry.position.y}`
	);
	
	if (currentHex) {
		if (currentHex.terrain === 'woods' || currentHex.terrain === 'rough') {
			// Bonus to leg attacks in rough terrain
			if (attackType === LEG_ATTACK_TYPES.LEG_ATTACK) {
				damage += 1;
				effects.psrModifier = (effects.psrModifier || 0) + 1;
			}
		}
	}
	
	return {
		damage,
		infantryLosses,
		effects
	};
}

/**
 * Execute an anti-mech attack
 * @param {Object} infantry - The infantry unit
 * @param {Object} target - The target mech unit
 * @param {string} attackType - Type of attack
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
		// Calculate damage and effects
		const damageInfo = calculateAntiMechDamage(infantry, target, attackType, gameState);
		result.damage = damageInfo.damage;
		result.infantryLosses = damageInfo.infantryLosses;
		result.effects = damageInfo.effects;
		
		// Determine hit location based on attack type
		if (damageInfo.effects.forceHitLocation) {
			// For leg attacks, randomly choose between left and right leg
			const legRoll = rollDice(1, 2).sum;
			result.location = legRoll === 1 ? 'LEFT_LEG' : 'RIGHT_LEG';
		} else {
			// Standard hit location table for other attacks
			const locationRoll = rollDice(2, 6).sum;
			
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
		}
		
		// Check for critical hit
		const criticalChance = damageInfo.effects.criticalChance || 0.1;
		if (Math.random() < criticalChance) {
			result.criticalHit = true;
			
			// Determine critical hit effects based on location
			result.criticalEffects = determineAntiMechCritical(result.location, attackType);
		}
		
		// Special swarm effects - attach to target
		if (damageInfo.effects.swarming) {
			// Update status to reflect swarming
			result.swarming = true;
			result.swarmingLocation = result.location;
			
			// Add movement penalties to target
			result.movementPenalty = Math.min(2, Math.ceil(infantry.troopCount / 5));
		}
		
		// Handle mine placement
		if (damageInfo.effects.placeHazard) {
			// Add hex hazard
			result.placeHazard = true;
			result.hazardType = damageInfo.effects.hazardType;
			result.hazardDuration = damageInfo.effects.hazardDuration;
			result.hazardDamage = Math.floor(result.damage / 2); // Future damage from mines
		}
	} else {
		// If attack misses
		result.damage = 0;
		
		// Special miss effects
		if (attackType === LEG_ATTACK_TYPES.SWARM) {
			// Failed swarm still results in some infantry losses
			result.infantryLosses = Math.ceil(infantry.troopCount / 6);
			result.message = "Swarm attack failed, some troops lost in the attempt";
		} else if (attackType === LEG_ATTACK_TYPES.MINE_PLACEMENT) {
			// Mine placement failure might still place some mines
			const placementRoll = rollDice(1, 6).sum;
			if (placementRoll >= 5) {
				result.partialSuccess = true;
				result.placeHazard = true;
				result.hazardType = 'MINES';
				result.hazardDuration = 1; // Only lasts 1 round
				result.hazardDamage = 1; // Minimal damage from few mines
				result.message = "Some mines placed despite attack failure";
			}
		}
	}
	
	return result;
}

/**
 * Determine critical effects for anti-mech attacks based on hit location
 * @param {string} location - The hit location
 * @param {string} attackType - Type of attack
 * @returns {Array} List of critical effects
 */
function determineAntiMechCritical(location, attackType) {
	const effects = [];
	const rollForEffect = rollDice(1, 6).sum;
	
	// Different critical effects based on attack type
	if (attackType === LEG_ATTACK_TYPES.LEG_ATTACK) {
		// Leg attacks have specific leg-related critical effects
		if (location === 'LEFT_LEG' || location === 'RIGHT_LEG') {
			switch (rollForEffect) {
				case 1:
				case 2:
					effects.push('ACTUATOR_DAMAGED');
					break;
				case 3:
				case 4:
					effects.push('HIP_DAMAGED');
					break;
				case 5:
					effects.push('MYOMER_DAMAGED');
					break;
				case 6:
					effects.push('LEG_DESTROYED');
					break;
			}
		}
	} else if (attackType === LEG_ATTACK_TYPES.SWARM) {
		// Swarm attacks can target specific systems
		switch (location) {
			case 'HEAD':
				if (rollForEffect <= 2) effects.push('SENSORS_DAMAGED');
				else if (rollForEffect <= 4) effects.push('LIFE_SUPPORT_DAMAGED');
				else if (rollForEffect === 5) effects.push('COMMS_DAMAGED');
				else effects.push('COCKPIT_DAMAGED');
				break;
				
			case 'CENTER_TORSO':
				if (rollForEffect <= 3) effects.push('ENGINE_HIT');
				else if (rollForEffect <= 5) effects.push('GYRO_DAMAGED');
				else effects.push('FUSION_LEAK');
				break;
				
			case 'LEFT_TORSO':
			case 'RIGHT_TORSO':
				if (rollForEffect <= 2) effects.push('AMMO_EXPLOSION');
				else if (rollForEffect <= 4) effects.push('HEAT_SINK_DESTROYED');
				else effects.push('WEAPON_DAMAGED');
				break;
				
			case 'LEFT_ARM':
			case 'RIGHT_ARM':
				if (rollForEffect <= 3) effects.push('ACTUATOR_DAMAGED');
				else if (rollForEffect <= 5) effects.push('WEAPON_DAMAGED');
				else effects.push('SHOULDER_DAMAGED');
				break;
				
			case 'LEFT_LEG':
			case 'RIGHT_LEG':
				if (rollForEffect <= 3) effects.push('ACTUATOR_DAMAGED');
				else if (rollForEffect <= 5) effects.push('MYOMER_DAMAGED');
				else effects.push('FOOT_DAMAGED');
				break;
		}
	} else if (attackType === LEG_ATTACK_TYPES.MINE_PLACEMENT) {
		// Mine placement primarily damages legs
		if (location === 'LEFT_LEG' || location === 'RIGHT_LEG') {
			if (rollForEffect <= 2) effects.push('FOOT_DAMAGED');
			else if (rollForEffect <= 4) effects.push('ACTUATOR_DAMAGED');
			else if (rollForEffect === 5) effects.push('MULTIPLE_ACTUATORS_DAMAGED');
			else effects.push('LEG_DESTROYED');
		} else {
			// Non-leg locations have simpler effects for mines
			if (rollForEffect <= 3) effects.push('ARMOR_BREACH');
			else if (rollForEffect <= 5) effects.push('COMPONENT_DAMAGED');
			else effects.push('CRITICAL_COMPONENT_HIT');
		}
	}
	
	return effects;
}

/**
 * Handle continuation of a swarm attack in subsequent turns
 * @param {Object} infantry - The infantry unit
 * @param {Object} target - The target mech unit
 * @param {Object} gameState - Current game state
 * @returns {Object} Result of continued swarm
 */
function continueSwarmAttack(infantry, target, gameState) {
	// Check if swarm attack is still valid
	if (!infantry.swarming || !infantry.swarmingTarget || infantry.swarmingTarget !== target.id) {
		return {
			success: false,
			message: "Infantry is not currently swarming the target"
		};
	}
	
	const troopCount = infantry.troopCount || 0;
	
	// Calculate damage for this turn of swarming
	let damage = Math.max(1, Math.floor(troopCount / 3));
	
	// Special equipment bonus
	if (infantry.equipment) {
		if (infantry.equipment.includes(ANTI_MECH_WEAPONS.INFERNO_SRM)) {
			damage += 1;
		}
		if (infantry.equipment.includes(ANTI_MECH_WEAPONS.VIBRO_BLADE)) {
			damage += 2;
		}
	}
	
	// Calculate troop losses from mech defense systems
	// Mechs can try to dislodge swarming infantry
	let infantryLosses = Math.ceil(troopCount / 5);
	
	// Mech actions against swarming infantry increase losses
	if (target.lastAction === 'ANTI_SWARM_MOVE') {
		infantryLosses += Math.ceil(troopCount / 4);
	}
	
	// Check for critical hit
	let criticalHit = false;
	let criticalEffects = [];
	
	if (Math.random() < 0.2) { // 20% chance per turn
		criticalHit = true;
		
		// Use the location where infantry is swarming
		const swarmLocation = infantry.swarmingLocation || 'CENTER_TORSO';
		criticalEffects = determineAntiMechCritical(swarmLocation, LEG_ATTACK_TYPES.SWARM);
	}
	
	// Result of continued swarm
	return {
		success: true,
		continuing: true,
		damage,
		infantryLosses,
		location: infantry.swarmingLocation || 'CENTER_TORSO',
		criticalHit,
		criticalEffects,
		effects: {
			restrictTargetMovement: true,
			targetPilotingModifier: 1
		}
	};
}

/**
 * Handle mech attempts to dislodge swarming infantry
 * @param {Object} mech - The mech trying to remove infantry
 * @param {Object} infantry - The swarming infantry
 * @param {string} method - Method used to remove infantry ('shake', 'roll', 'water', 'fire')
 * @param {Object} gameState - Current game state
 * @returns {Object} Result of the attempt
 */
function attemptRemoveSwarmingInfantry(mech, infantry, method, gameState) {
	// Check if infantry is swarming the mech
	if (!infantry.swarming || infantry.swarmingTarget !== mech.id) {
		return {
			success: false,
			message: "Infantry is not swarming this mech"
		};
	}
	
	const troopCount = infantry.troopCount || 0;
	let removalChance = 0;
	let mechDamage = 0;
	let infantryLosses = 0;
	let effectDescription = "";
	
	switch (method) {
		case 'shake':
			// Violently shake to remove infantry
			removalChance = 0.4;
			infantryLosses = Math.ceil(troopCount / 3);
			effectDescription = "Mech violently shakes to dislodge infantry";
			
			// Mech must make piloting roll
			const shakePSR = {
				required: true,
				modifier: 1,
				description: "PSR required due to violent shaking"
			};
			break;
			
		case 'roll':
			// Roll on the ground to crush infantry
			removalChance = 0.7;
			infantryLosses = Math.ceil(troopCount / 2);
			mechDamage = Math.floor(mech.tonnage / 20); // Mech takes some damage from rolling
			effectDescription = "Mech intentionally falls to crush swarming infantry";
			
			// Mech becomes prone
			const rollEffect = {
				mechProne: true,
				description: "Mech is prone after rolling to remove infantry"
			};
			break;
			
		case 'water':
			// Move into water to drown infantry
			if (!gameState.battlefield.hexes.get(`${mech.position.x},${mech.position.y}`).terrain === 'water') {
				return {
					success: false,
					message: "Mech is not in a water hex"
				};
			}
			
			const waterDepth = gameState.battlefield.hexes.get(`${mech.position.x},${mech.position.y}`).depth || 0;
			
			if (waterDepth < 1) {
				return {
					success: false,
					message: "Water is not deep enough to affect infantry"
				};
			}
			
			removalChance = 0.3 * waterDepth;
			infantryLosses = Math.ceil(troopCount / (4 - waterDepth));
			effectDescription = `Mech submerges in depth ${waterDepth} water to drown infantry`;
			break;
			
		case 'fire':
			// Use heat to burn off infantry
			removalChance = 0.5;
			infantryLosses = Math.ceil(troopCount / 2);
			effectDescription = "Mech overheats systems to burn off infantry";
			
			// Generate extra heat
			const heatEffect = {
				heatGenerated: 5,
				description: "Additional heat from burning off infantry"
			};
			break;
			
		default:
			return {
				success: false,
				message: "Unknown method to remove infantry"
			};
	}
	
	// Roll for success
	const removalRoll = Math.random();
	const removalSuccess = removalRoll < removalChance;
	
	// Calculate final infantry losses (higher if removal succeeds)
	if (removalSuccess) {
		infantryLosses = Math.max(infantryLosses, Math.ceil(troopCount / 2));
	}
	
	return {
		success: true,
		removalSuccess,
		mechDamage,
		infantryLosses,
		description: effectDescription,
		// Include additional effects based on method
		effects: method === 'roll' ? { mechProne: true } :
				method === 'fire' ? { heatGenerated: 5 } :
				method === 'shake' ? { requiredPSR: true, psrModifier: 1 } : {}
	};
}

/**
 * Handle TAG designation from infantry for artillery or air strikes
 * @param {Object} infantry - The infantry unit with TAG equipment
 * @param {Object} target - The target unit or hex
 * @param {Object} gameState - Current game state
 * @returns {Object} Result of the TAG designation
 */
function performTAGDesignation(infantry, target, gameState) {
	// Check if infantry has TAG equipment
	if (!infantry.equipment || !infantry.equipment.includes(ANTI_MECH_WEAPONS.TAG_DESIGNATOR)) {
		return {
			success: false,
			message: "Infantry does not have TAG equipment"
		};
	}
	
	// Check if target is within range and line of sight
	const distance = calculateDistance(infantry.position, target.position);
	const maxRange = 8; // TAG range in hexes
	
	if (distance > maxRange) {
		return {
			success: false,
			message: "Target is beyond TAG range"
		};
	}
	
	// Check line of sight
	const losCheck = gameState.battlefield.hasLineOfSight(
		infantry.position, 
		target.position
	);
	
	if (!losCheck.hasLOS) {
		return {
			success: false,
			message: "No line of sight to target"
		};
	}
	
	// Calculate chance of successful designation
	let designationChance = 0.8; // Base 80% chance
	
	// Modifiers based on conditions
	if (distance > 6) designationChance -= 0.1;
	if (losCheck.intervening) designationChance -= 0.1;
	
	// Infantry quality affects TAG operation
	const infantryQuality = infantry.quality || 'REGULAR';
	switch (infantryQuality) {
		case 'GREEN':
			designationChance -= 0.1;
			break;
		case 'VETERAN':
			designationChance += 0.1;
			break;
		case 'ELITE':
			designationChance += 0.2;
			break;
	}
	
	// Weather effects
	if (gameState.weather) {
		switch (gameState.weather) {
			case 'RAIN':
				designationChance -= 0.1;
				break;
			case 'HEAVY_RAIN':
				designationChance -= 0.2;
				break;
			case 'SNOW':
				designationChance -= 0.1;
				break;
			case 'HEAVY_SNOW':
				designationChance -= 0.3;
				break;
		}
	}
	
	// Determine success
	const designationRoll = Math.random();
	const designationSuccess = designationRoll < designationChance;
	
	// Create result
	const result = {
		success: true,
		designationSuccess,
		targetPosition: target.position,
		designationDuration: designationSuccess ? 2 : 0, // Lasts 2 rounds if successful
		bonusAccuracy: designationSuccess ? 3 : 0, // +3 to hit for guided weapons
	};
	
	if (designationSuccess) {
		// Calculate potential bonus damage for guided munitions
		result.bonusDamage = 2;
		result.message = "Target successfully designated for guided weapons";
	} else {
		result.message = "Failed to establish stable laser lock on target";
	}
	
	return result;
}

module.exports = {
	ANTI_MECH_WEAPONS,
	LEG_ATTACK_TYPES,
	canPerformAntiMechAttack,
	calculateAntiMechToHit,
	calculateAntiMechDamage,
	executeAntiMechAttack,
	determineAntiMechCritical,
	continueSwarmAttack,
	attemptRemoveSwarmingInfantry,
	performTAGDesignation
}; 