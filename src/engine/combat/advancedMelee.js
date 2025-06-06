/**
 * advancedMelee.js
 * Advanced Melee Combat System for BattleTech
 * Integrates different melee attack types with environmental factors
 */

const { rollDice } = require('../../utils/dice');

// Import melee types from meleeCombat
const MELEE_TYPES = {
	PUNCH: 'punch',
	KICK: 'kick',
	CHARGE: 'charge',
	DFA: 'death_from_above',
	PUSH: 'push',
	CLUB: 'club',
	HATCHET: 'hatchet',
	SWORD: 'sword',
	AXE: 'axe'
};

/**
 * Calculate melee attack modifiers based on environmental conditions
 * @param {Object} attacker - Attacking unit
 * @param {Object} target - Target unit
 * @param {Object} battlefield - Battlefield state
 * @returns {Object} Environmental modifiers
 */
function calculateEnvironmentalModifiers(attacker, target, battlefield) {
	const modifiers = {
		toHit: 0,
		damage: 0
	};
	
	// Get terrain at attacker and target positions
	const attackerHex = battlefield.hexes.get(`${attacker.position.x},${attacker.position.y}`);
	const targetHex = battlefield.hexes.get(`${target.position.x},${target.position.y}`);
	
	// Terrain modifiers
	if (attackerHex) {
		const attackerTerrain = attackerHex.terrain;
		
		if (attackerTerrain === 'water' && attackerHex.depth > 0) {
			modifiers.toHit += 1; // Harder to attack from water
		}
		
		if (attackerTerrain === 'rough') {
			modifiers.toHit += 1; // Harder to attack from rough terrain
		}
	}
	
	if (targetHex) {
		const targetTerrain = targetHex.terrain;
		
		if (targetTerrain === 'water' && targetHex.depth > 0) {
			modifiers.toHit += 1; // Harder to hit in water
			modifiers.damage -= 1; // Less effective in water
		}
		
		if (targetTerrain === 'woods' || targetTerrain === 'light_woods') {
			modifiers.toHit += 1; // Harder to hit in woods
		}
		
		if (targetTerrain === 'heavy_woods') {
			modifiers.toHit += 2; // Much harder to hit in heavy woods
		}
	}
	
	// Elevation differences
	const attackerElevation = (attackerHex && attackerHex.elevation) || 0;
	const targetElevation = (targetHex && targetHex.elevation) || 0;
	const elevationDiff = attackerElevation - targetElevation;
	
	if (elevationDiff > 0) {
		modifiers.toHit -= 1; // Easier to hit from higher ground
		modifiers.damage += 1; // More effective from higher ground
	} else if (elevationDiff < 0) {
		modifiers.toHit += 1; // Harder to hit from lower ground
	}
	
	return modifiers;
}

/**
 * Determine critical hit effects for melee attacks
 * @param {Object} attacker - Attacking unit
 * @param {Object} target - Target unit
 * @param {string} meleeType - Type of melee attack
 * @param {number} roll - Attack roll result
 * @returns {Object} Critical hit effects
 */
function determineCriticalEffects(attacker, target, meleeType, roll) {
	// Only critical on rolls of 10+
	if (roll < 10) return null;
	
	const effects = [];
	
	switch (meleeType) {
		case MELEE_TYPES.PUNCH:
			// 50% chance to damage arm actuator
			if (rollDice(1, 2).sum === 1) {
				effects.push({
					type: 'ACTUATOR_DAMAGE',
					location: Math.random() < 0.5 ? 'LEFT_ARM' : 'RIGHT_ARM',
					severity: 1
				});
			}
			break;
			
		case MELEE_TYPES.KICK:
			// 50% chance to cause target to fall
			if (rollDice(1, 2).sum === 1) {
				effects.push({
					type: 'FORCED_PSR',
					modifier: 2,
					message: 'Target must make a PSR +2 or fall'
				});
			}
			break;
			
		case MELEE_TYPES.CHARGE:
			// Always knock target back one hex
			effects.push({
				type: 'KNOCKBACK',
				distance: 1,
				message: 'Target is pushed back 1 hex'
			});
			// 30% chance to cause internal damage
			if (rollDice(1, 10).sum <= 3) {
				effects.push({
					type: 'INTERNAL_DAMAGE',
					location: 'CENTER_TORSO',
					damage: Math.ceil(attacker.tonnage / 20),
					message: 'Charge causes internal damage'
				});
			}
			break;
			
		case MELEE_TYPES.DFA:
			// 70% chance for head hit on critical
			if (rollDice(1, 10).sum <= 7) {
				effects.push({
					type: 'HIT_LOCATION_OVERRIDE',
					location: 'HEAD',
					message: 'DFA critical hits the head!'
				});
			}
			break;
			
		case MELEE_TYPES.HATCHET:
		case MELEE_TYPES.AXE:
		case MELEE_TYPES.SWORD:
			// Bladed weapons have a chance to slice off limbs or critical components
			const locationRoll = rollDice(1, 6).sum;
			let location;
			
			if (locationRoll <= 2) location = 'RIGHT_ARM';
			else if (locationRoll <= 4) location = 'LEFT_ARM';
			else if (locationRoll === 5) location = 'RIGHT_TORSO';
			else location = 'LEFT_TORSO';
			
			effects.push({
				type: 'CRITICAL_HIT',
				location: location,
				criticals: rollDice(1, 3).sum,
				message: `Weapon slices into ${location.toLowerCase().replace('_', ' ')}`
			});
			break;
			
		case MELEE_TYPES.CLUB:
			// Clubs have a chance to stun or concuss pilot
			if (rollDice(1, 6).sum <= 2) {
				effects.push({
					type: 'PILOT_EFFECT',
					effect: 'STUNNED',
					duration: 1,
					message: 'Pilot is stunned for 1 turn'
				});
			}
			break;
	}
	
	return effects.length > 0 ? effects : null;
}

/**
 * Apply melee attack critical effects
 * @param {Object} target - Target unit to apply effects to
 * @param {Array} effects - Array of critical effects
 * @returns {Object} Result of applying effects with messages
 */
function applyCriticalEffects(target, effects) {
	if (!effects || effects.length === 0) {
		return { 
			applied: false,
			message: 'No critical effects to apply'
		};
	}
	
	const results = {
		applied: true,
		effectsApplied: [],
		messages: []
	};
	
	effects.forEach(effect => {
		switch (effect.type) {
			case 'ACTUATOR_DAMAGE':
				// Apply actuator damage to the target
				if (!target.damage) target.damage = {};
				if (!target.damage.actuators) target.damage.actuators = {};
				
				target.damage.actuators[effect.location] = 
					(target.damage.actuators[effect.location] || 0) + effect.severity;
				
				results.effectsApplied.push('ACTUATOR_DAMAGE');
				results.messages.push(`${effect.location.replace('_', ' ')} actuator damaged`);
				break;
				
			case 'FORCED_PSR':
				// Mark that target needs to make a PSR
				target.pilotingRollRequired = true;
				target.pilotingRollModifier = (target.pilotingRollModifier || 0) + effect.modifier;
				
				results.effectsApplied.push('FORCED_PSR');
				results.messages.push(effect.message);
				break;
				
			case 'KNOCKBACK':
				// Mark that target is knocked back
				target.knockback = {
					distance: effect.distance,
					direction: calculateKnockbackDirection(target)
				};
				
				results.effectsApplied.push('KNOCKBACK');
				results.messages.push(effect.message);
				break;
				
			case 'INTERNAL_DAMAGE':
				// Apply internal damage directly
				if (!target.damage) target.damage = {};
				if (!target.damage.internal) target.damage.internal = {};
				
				target.damage.internal[effect.location] = 
					(target.damage.internal[effect.location] || 0) + effect.damage;
				
				results.effectsApplied.push('INTERNAL_DAMAGE');
				results.messages.push(`${effect.damage} internal damage to ${effect.location.replace('_', ' ')}`);
				break;
				
			case 'HIT_LOCATION_OVERRIDE':
				// Just store the information for hit location determination
				target.overrideHitLocation = effect.location;
				
				results.effectsApplied.push('HIT_LOCATION_OVERRIDE');
				results.messages.push(effect.message);
				break;
				
			case 'CRITICAL_HIT':
				// Apply critical hits to the location
				if (!target.criticals) target.criticals = {};
				if (!target.criticals[effect.location]) target.criticals[effect.location] = 0;
				
				target.criticals[effect.location] += effect.criticals;
				
				results.effectsApplied.push('CRITICAL_HIT');
				results.messages.push(`${effect.criticals} critical hit(s) on ${effect.location.replace('_', ' ')}`);
				break;
				
			case 'PILOT_EFFECT':
				// Apply effect to the pilot
				if (!target.pilot) target.pilot = {};
				if (!target.pilot.effects) target.pilot.effects = [];
				
				target.pilot.effects.push({
					type: effect.effect,
					duration: effect.duration,
					turnsRemaining: effect.duration
				});
				
				results.effectsApplied.push('PILOT_EFFECT');
				results.messages.push(effect.message);
				break;
		}
	});
	
	return results;
}

/**
 * Calculate knockback direction based on attacker and target positions
 * @param {Object} target - Target unit being knocked back
 * @returns {string} Direction of knockback
 */
function calculateKnockbackDirection(target) {
	// This would normally use relative positions, but for now return a default
	return 'BACKWARD';
}

/**
 * Determine if a weapon is a melee weapon and get its properties
 * @param {string} weaponType - Type of weapon to check
 * @returns {Object|null} Weapon properties if melee, null otherwise
 */
function getMeleeWeaponProperties(weaponType) {
	const meleeWeapons = {
		'hatchet': {
			type: MELEE_TYPES.HATCHET,
			damageMultiplier: 1.5,
			toHitModifier: 1,
			description: 'A hatchet deals 1.5x normal melee damage'
		},
		'sword': {
			type: MELEE_TYPES.SWORD,
			damageMultiplier: 1.3,
			toHitModifier: 0,
			description: 'A sword deals 1.3x normal melee damage with no to-hit penalty'
		},
		'axe': {
			type: MELEE_TYPES.AXE,
			damageMultiplier: 1.4,
			toHitModifier: 2,
			description: 'An axe deals 1.4x normal melee damage but has +2 to-hit penalty'
		},
		'mace': {
			type: MELEE_TYPES.CLUB,
			damageMultiplier: 1.2,
			toHitModifier: 1,
			description: 'A mace deals 1.2x normal melee damage'
		},
		'club': {
			type: MELEE_TYPES.CLUB,
			damageMultiplier: 1.1,
			toHitModifier: 1,
			description: 'A basic club deals 1.1x normal melee damage'
		}
	};
	
	return meleeWeapons[weaponType.toLowerCase()] || null;
}

module.exports = {
	MELEE_TYPES,
	calculateEnvironmentalModifiers,
	determineCriticalEffects,
	applyCriticalEffects,
	getMeleeWeaponProperties
}; 