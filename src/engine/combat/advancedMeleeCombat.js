/**
 * Advanced Melee Combat System
 * Implements enhanced melee mechanics with environmental factors and critical effects
 */

const { distanceBetweenHexes } = require('../movement/mapUtils')
const { rollDice } = require('../../utils/diceRolls')
const { MELEE_TYPE } = require('./meleeCombat')
const { ENHANCED_INFANTRY_TYPE } = require('../units/enhancedInfantry')

// Extended melee types beyond the basic ones
const ADVANCED_MELEE_TYPE = {
	...MELEE_TYPE, // Include basic melee types
	SHOULDER_CHECK: 'SHOULDER_CHECK',   // Slam with shoulder, chance to push
	HEAD_BUTT: 'HEAD_BUTT',             // Attack with head, targets cockpit
	BODY_SLAM: 'BODY_SLAM',             // Full body attack, high damage but risky
	DEFENSIVE_STANCE: 'DEFENSIVE_STANCE', // Prepare for melee defense
	TRIP_ATTACK: 'TRIP_ATTACK',         // Attempt to knock opponent down
	GRAPPLE: 'GRAPPLE',                 // Grab and hold opponent
	STOMP: 'STOMP'                      // Attack prone units
}

// Special melee effects
const MELEE_EFFECT = {
	KNOCKDOWN: 'KNOCKDOWN',             // Target knocked down
	CRITICAL_HIT: 'CRITICAL_HIT',       // Caused a critical hit
	PUSHED: 'PUSHED',                   // Target pushed to another hex
	LIMB_DAMAGED: 'LIMB_DAMAGED',       // Target limb specifically damaged
	WEAPON_DESTROYED: 'WEAPON_DESTROYED', // Target weapon destroyed
	AMMO_EXPLOSION: 'AMMO_EXPLOSION',   // Triggered ammo explosion
	PILOT_DAMAGE: 'PILOT_DAMAGE',       // Damage to the pilot
	HEAT_DAMAGE: 'HEAT_DAMAGE',         // Increased target heat
	ENGINE_HIT: 'ENGINE_HIT',           // Hit the engine
	IMMOBILIZED: 'IMMOBILIZED',         // Target immobilized
	SENSORS_DAMAGED: 'SENSORS_DAMAGED'  // Target sensors damaged
}

// Terrain modifiers for melee combat
const TERRAIN_MELEE_MODIFIERS = {
	CLEAR: 0,
	ROUGH: 1,
	WOODS: 1,
	HEAVY_WOODS: 2,
	WATER: 1,
	DEEP_WATER: 2,
	BUILDING: 1,
	RUBBLE: 1,
	SWAMP: 2,
	ICE: 2,
	LAVA: 3
}

/**
 * Check if a unit can perform advanced melee attack
 * @param {Object} attacker - The attacking unit
 * @param {Object} defender - The target unit
 * @param {string} meleeType - Type of melee attack
 * @param {Object} gameState - Current game state
 * @return {Object} - Result indicating if melee is possible
 */
function canPerformAdvancedMelee(attacker, defender, meleeType, gameState) {
	// First validate basic requirements
	if (!attacker || !defender) {
		return {
			success: false,
			message: 'Invalid attacker or defender'
		}
	}
	
	// Check unit type - only certain units can melee
	if (attacker.type !== 'MECH' && 
			!(attacker.type === 'INFANTRY' && 
				(attacker.infantryType === ENHANCED_INFANTRY_TYPE.BATTLE_ARMOR || 
				 attacker.infantryType === ENHANCED_INFANTRY_TYPE.POWER_ARMOR))) {
		return {
			success: false,
			message: 'Unit type cannot perform melee attacks'
		}
	}
	
	// Check if unit has already attacked
	if (attacker.hasFired) {
		return {
			success: false,
			message: 'Unit has already attacked this turn'
		}
	}
	
	// Check distance
	const distance = distanceBetweenHexes(attacker.position, defender.position)
	
	// Most melee attacks require adjacent positions
	if (distance > 1) {
		return {
			success: false,
			message: 'Target is not adjacent for melee attack'
		}
	}
	
	// Check specific melee type restrictions
	if (meleeType === ADVANCED_MELEE_TYPE.STOMP) {
		if (!defender.status?.prone) {
			return {
				success: false,
				message: 'Can only stomp prone targets'
			}
		}
		
		if (attacker.type !== 'MECH') {
			return {
				success: false,
				message: 'Only mechs can perform stomp attacks'
			}
		}
	}
	
	if (meleeType === ADVANCED_MELEE_TYPE.GRAPPLE) {
		if (attacker.type !== 'MECH' || defender.type !== 'MECH') {
			return {
				success: false,
				message: 'Grapple attacks can only be performed between mechs'
			}
		}
		
		// Check weight class - can't grapple units much larger
		if (attacker.weight < defender.weight * 0.7) {
			return {
				success: false,
				message: 'Attacker is too light to grapple the defender'
			}
		}
	}
	
	if (meleeType === ADVANCED_MELEE_TYPE.BODY_SLAM) {
		if (attacker.type !== 'MECH') {
			return {
				success: false,
				message: 'Only mechs can perform body slam attacks'
			}
		}
		
		// Must have moved this turn
		if (!attacker.hasMoved) {
			return {
				success: false,
				message: 'Must move before performing a body slam'
			}
		}
	}
	
	if (meleeType === ADVANCED_MELEE_TYPE.DEFENSIVE_STANCE) {
		// Not actually an attack, no target needed
		return {
			success: true,
			message: 'Unit can enter defensive stance'
		}
	}
	
	// Check for arm/leg damage that would prevent specific attacks
	if (attacker.type === 'MECH') {
		if ((meleeType === ADVANCED_MELEE_TYPE.PUNCH || 
			 meleeType === ADVANCED_MELEE_TYPE.SHOULDER_CHECK) && 
			(attacker.damagedLocations?.includes('LEFT_ARM') && 
			 attacker.damagedLocations?.includes('RIGHT_ARM'))) {
			return {
				success: false,
				message: 'Both arms damaged, cannot perform arm-based attacks'
			}
		}
		
		if ((meleeType === ADVANCED_MELEE_TYPE.KICK || 
			 meleeType === ADVANCED_MELEE_TYPE.TRIP_ATTACK) && 
			(attacker.damagedLocations?.includes('LEFT_LEG') && 
			 attacker.damagedLocations?.includes('RIGHT_LEG'))) {
			return {
				success: false,
				message: 'Both legs damaged, cannot perform leg-based attacks'
			}
		}
		
		if (meleeType === ADVANCED_MELEE_TYPE.HEAD_BUTT && 
			attacker.damagedLocations?.includes('HEAD')) {
			return {
				success: false,
				message: 'Head damaged, cannot perform head butt attack'
			}
		}
	}
	
	// All checks passed
	return {
		success: true,
		message: `Unit can perform ${meleeType} attack`
	}
}

/**
 * Calculate advanced melee to-hit number
 * @param {Object} attacker - The attacking unit
 * @param {Object} defender - The target unit
 * @param {string} meleeType - Type of melee attack
 * @param {Object} gameState - Current game state
 * @return {Object} - To-hit calculation details
 */
function calculateAdvancedMeleeToHit(attacker, defender, meleeType, gameState) {
	// Base to-hit value based on melee type
	let baseToHit = 0
	
	switch (meleeType) {
		case ADVANCED_MELEE_TYPE.PUNCH:
		case ADVANCED_MELEE_TYPE.SHOULDER_CHECK:
			baseToHit = 4
			break
		case ADVANCED_MELEE_TYPE.KICK:
			baseToHit = 5
			break
		case ADVANCED_MELEE_TYPE.BODY_SLAM:
		case ADVANCED_MELEE_TYPE.TRIP_ATTACK:
			baseToHit = 6
			break
		case ADVANCED_MELEE_TYPE.HEAD_BUTT:
			baseToHit = 7
			break
		case ADVANCED_MELEE_TYPE.GRAPPLE:
			baseToHit = 5
			break
		case ADVANCED_MELEE_TYPE.STOMP:
			baseToHit = 3 // Easier to hit prone targets
			break
		case ADVANCED_MELEE_TYPE.CHARGE:
			baseToHit = 5
			break
		default:
			baseToHit = 5
	}
	
	// Modifiers array to track all bonuses/penalties
	const modifiers = []
	let totalModifier = 0
	
	// Attacker skill/experience modifier
	const pilotingSkill = attacker.skills?.piloting || 4
	const modifier = pilotingSkill - 4
	if (modifier !== 0) {
		modifiers.push(`Piloting skill: ${modifier > 0 ? '+' : ''}${modifier}`)
		totalModifier += modifier
	}
	
	// Damage modifiers
	if (attacker.type === 'MECH') {
		if (meleeType === ADVANCED_MELEE_TYPE.PUNCH || 
			 meleeType === ADVANCED_MELEE_TYPE.SHOULDER_CHECK) {
			// Check arm damage
			if (attacker.damagedLocations?.includes('LEFT_ARM')) {
				modifiers.push('Left arm damaged: +1')
				totalModifier += 1
			}
			if (attacker.damagedLocations?.includes('RIGHT_ARM')) {
				modifiers.push('Right arm damaged: +1')
				totalModifier += 1
			}
		}
		
		if (meleeType === ADVANCED_MELEE_TYPE.KICK || 
			 meleeType === ADVANCED_MELEE_TYPE.TRIP_ATTACK) {
			// Check leg damage
			if (attacker.damagedLocations?.includes('LEFT_LEG')) {
				modifiers.push('Left leg damaged: +1')
				totalModifier += 1
			}
			if (attacker.damagedLocations?.includes('RIGHT_LEG')) {
				modifiers.push('Right leg damaged: +1')
				totalModifier += 1
			}
		}
		
		// High heat affects all melee attacks
		if (attacker.currentHeat >= 15) {
			const heatPenalty = Math.floor((attacker.currentHeat - 10) / 5)
			modifiers.push(`High heat: +${heatPenalty}`)
			totalModifier += heatPenalty
		}
	}
	
	// Terrain modifiers
	const attackerTerrain = gameState?.terrain?.[attacker.position.x]?.[attacker.position.y] || 'CLEAR'
	const terrainMod = TERRAIN_MELEE_MODIFIERS[attackerTerrain] || 0
	
	if (terrainMod !== 0) {
		modifiers.push(`Terrain (${attackerTerrain}): +${terrainMod}`)
		totalModifier += terrainMod
	}
	
	// Weather modifiers
	if (gameState?.weather === 'RAIN') {
		modifiers.push('Rain: +1')
		totalModifier += 1
	} else if (gameState?.weather === 'HEAVY_RAIN') {
		modifiers.push('Heavy rain: +2')
		totalModifier += 2
	} else if (gameState?.weather === 'SNOW') {
		modifiers.push('Snow: +1')
		totalModifier += 1
	} else if (gameState?.weather === 'BLIZZARD') {
		modifiers.push('Blizzard: +2')
		totalModifier += 2
	}
	
	// Target defensive stance
	if (defender.status?.defensiveStance) {
		modifiers.push('Target defensive stance: +2')
		totalModifier += 2
	}
	
	// Target movement modifiers
	if (defender.hasMoved && !defender.status?.prone) {
		if (defender.moveType === 'RUN' || defender.moveType === 'JUMP') {
			modifiers.push('Target ran/jumped: +1')
			totalModifier += 1
		}
	}
	
	// Target prone bonus
	if (defender.status?.prone) {
		if (meleeType !== ADVANCED_MELEE_TYPE.STOMP) {
			modifiers.push('Target prone: -2')
			totalModifier -= 2
		} else {
			// For stomp, even easier
			modifiers.push('Stomping prone target: -1')
			totalModifier -= 1
		}
	}
	
	// Size difference modifier
	if (attacker.type === 'MECH' && defender.type === 'MECH') {
		const sizeDiff = Math.floor((attacker.weight - defender.weight) / 20)
		if (sizeDiff !== 0) {
			modifiers.push(`Size difference: ${sizeDiff > 0 ? '-' : '+'}${Math.abs(sizeDiff)}`)
			totalModifier -= sizeDiff // Negative modifier if attacker is bigger
		}
	}
	
	// Calculate final to-hit number
	const toHitTarget = Math.max(2, Math.min(12, baseToHit + totalModifier))
	
	return {
		baseToHit,
		modifiers,
		totalModifier,
		toHitTarget
	}
}

/**
 * Calculate advanced melee damage
 * @param {Object} attacker - The attacking unit
 * @param {Object} defender - The target unit
 * @param {string} meleeType - Type of melee attack
 * @return {Object} - Damage calculation details
 */
function calculateAdvancedMeleeDamage(attacker, defender, meleeType) {
	let baseDamage = 0
	let locations = ['CENTER_TORSO'] // Default target location
	let specialEffects = []
	let attackerDamage = 0
	
	if (attacker.type === 'MECH') {
		// Calculate damage based on mech weight and melee type
		switch (meleeType) {
			case ADVANCED_MELEE_TYPE.PUNCH:
				baseDamage = Math.floor(attacker.weight / 10)
				locations = ['RIGHT_ARM', 'LEFT_ARM', 'RIGHT_TORSO', 'LEFT_TORSO']
				break
			case ADVANCED_MELEE_TYPE.KICK:
				baseDamage = Math.floor(attacker.weight / 5)
				locations = ['RIGHT_LEG', 'LEFT_LEG', 'RIGHT_TORSO', 'LEFT_TORSO']
				break
			case ADVANCED_MELEE_TYPE.BODY_SLAM:
				baseDamage = Math.floor(attacker.weight / 4)
				locations = ['CENTER_TORSO', 'RIGHT_TORSO', 'LEFT_TORSO']
				attackerDamage = Math.floor(baseDamage / 2) // Attacker takes half damage
				specialEffects.push(MELEE_EFFECT.PUSHED)
				break
			case ADVANCED_MELEE_TYPE.SHOULDER_CHECK:
				baseDamage = Math.floor(attacker.weight / 7)
				locations = ['RIGHT_ARM', 'LEFT_ARM', 'RIGHT_TORSO', 'LEFT_TORSO']
				specialEffects.push(MELEE_EFFECT.PUSHED)
				break
			case ADVANCED_MELEE_TYPE.HEAD_BUTT:
				baseDamage = Math.floor(attacker.weight / 15)
				locations = ['HEAD', 'CENTER_TORSO']
				attackerDamage = Math.max(1, Math.floor(baseDamage / 3)) // Attacker takes some damage
				specialEffects.push(MELEE_EFFECT.PILOT_DAMAGE)
				specialEffects.push(MELEE_EFFECT.SENSORS_DAMAGED)
				break
			case ADVANCED_MELEE_TYPE.TRIP_ATTACK:
				baseDamage = Math.floor(attacker.weight / 12)
				locations = ['RIGHT_LEG', 'LEFT_LEG']
				specialEffects.push(MELEE_EFFECT.KNOCKDOWN)
				break
			case ADVANCED_MELEE_TYPE.GRAPPLE:
				baseDamage = Math.floor(attacker.weight / 20) // Low damage
				locations = ['CENTER_TORSO', 'RIGHT_TORSO', 'LEFT_TORSO']
				specialEffects.push(MELEE_EFFECT.HEAT_DAMAGE)
				specialEffects.push(MELEE_EFFECT.IMMOBILIZED)
				break
			case ADVANCED_MELEE_TYPE.STOMP:
				baseDamage = Math.floor(attacker.weight / 6)
				// For prone mechs, target most central locations
				locations = ['CENTER_TORSO', 'RIGHT_TORSO', 'LEFT_TORSO'] 
				specialEffects.push(MELEE_EFFECT.CRITICAL_HIT)
				break
			case ADVANCED_MELEE_TYPE.CHARGE:
				// Damage based on speed and weight
				const speed = attacker.movementPoints || 5
				baseDamage = Math.floor((attacker.weight / 8) * (speed / 5))
				locations = ['CENTER_TORSO', 'RIGHT_TORSO', 'LEFT_TORSO']
				attackerDamage = Math.floor(baseDamage / 2) // Attacker takes half damage
				specialEffects.push(MELEE_EFFECT.PUSHED)
				break
			default:
				baseDamage = Math.floor(attacker.weight / 10)
		}
	} else if (attacker.type === 'INFANTRY') {
		// Calculate damage based on infantry strength and equipment
		const strengthFactor = attacker.strength / 10
		let multiplier = 1
		
		if (attacker.infantryType === ENHANCED_INFANTRY_TYPE.BATTLE_ARMOR) {
			multiplier = 2
			// Battle armor has better hit location targeting
			locations = defender.type === 'MECH' ? 
				['CENTER_TORSO', 'RIGHT_TORSO', 'LEFT_TORSO', 'HEAD'] : ['CENTRAL']
		} else if (attacker.infantryType === ENHANCED_INFANTRY_TYPE.POWER_ARMOR) {
			multiplier = 3
			locations = defender.type === 'MECH' ? 
				['CENTER_TORSO', 'RIGHT_TORSO', 'LEFT_TORSO', 'HEAD'] : ['CENTRAL']
		}
		
		// Add equipment bonus
		if (attacker.equipment?.some(eq => eq.type === 'VIBRO_BLADE')) {
			multiplier += 1
			specialEffects.push(MELEE_EFFECT.CRITICAL_HIT)
		}
		
		baseDamage = Math.max(1, Math.floor(strengthFactor * multiplier))
	}
	
	return {
		baseDamage,
		locations,
		specialEffects,
		attackerDamage
	}
}

/**
 * Determine hit location for melee attack
 * @param {Array} possibleLocations - Possible hit locations
 * @return {string} - Selected hit location
 */
function determineMeleeHitLocation(possibleLocations) {
	// If there's only one location, return it
	if (possibleLocations.length === 1) {
		return possibleLocations[0]
	}
	
	// Roll for location
	const roll = rollDice(1, possibleLocations.length) - 1
	return possibleLocations[roll]
}

/**
 * Apply special melee effects
 * @param {Object} attacker - The attacking unit
 * @param {Object} defender - The target unit
 * @param {Array} effects - Special effects to apply
 * @param {string} hitLocation - Location that was hit
 * @param {Object} gameState - Current game state
 * @return {Array} - Applied effects with details
 */
function applyMeleeSpecialEffects(attacker, defender, effects, hitLocation, gameState) {
	const appliedEffects = []
	
	if (!effects || effects.length === 0) {
		return appliedEffects
	}
	
	// Process each effect
	effects.forEach(effect => {
		switch (effect) {
			case MELEE_EFFECT.KNOCKDOWN:
				// Roll for knockdown based on weight difference
				const knockdownDifficulty = defender.weight > attacker.weight ? 2 : 0
				
				if (typeof defender.makePilotingRoll === 'function') {
					const pilotingCheck = defender.makePilotingRoll(2 + knockdownDifficulty)
					
					if (!pilotingCheck.success) {
						defender.status.prone = true
						appliedEffects.push({
							effect: MELEE_EFFECT.KNOCKDOWN,
							details: 'Target knocked down'
						})
					} else {
						appliedEffects.push({
							effect: MELEE_EFFECT.KNOCKDOWN,
							details: 'Target resisted knockdown'
						})
					}
				} else {
					// Simple knockdown chance if no piloting function
					const knockdownRoll = rollDice(2, 6)
					if (knockdownRoll >= 8 + knockdownDifficulty) {
						defender.status.prone = true
						appliedEffects.push({
							effect: MELEE_EFFECT.KNOCKDOWN,
							details: 'Target knocked down'
						})
					} else {
						appliedEffects.push({
							effect: MELEE_EFFECT.KNOCKDOWN,
							details: 'Target resisted knockdown'
						})
					}
				}
				break
				
			case MELEE_EFFECT.CRITICAL_HIT:
				// Roll for critical hit
				const criticalRoll = rollDice(2, 6)
				if (criticalRoll >= 8) {
					// Critical hit!
					if (typeof defender.applyCriticalHit === 'function') {
						const critResult = defender.applyCriticalHit(hitLocation)
						appliedEffects.push({
							effect: MELEE_EFFECT.CRITICAL_HIT,
							details: `Critical hit to ${hitLocation}: ${critResult.effect}`
						})
					} else {
						// Simple critical effect if no function exists
						appliedEffects.push({
							effect: MELEE_EFFECT.CRITICAL_HIT,
							details: `Critical hit to ${hitLocation}`
						})
						
						// Apply a basic effect based on location
						if (hitLocation.includes('ARM')) {
							defender.damagedLocations = [...(defender.damagedLocations || []), hitLocation]
							appliedEffects.push({
								effect: MELEE_EFFECT.LIMB_DAMAGED,
								details: `${hitLocation} damaged`
							})
						} else if (hitLocation.includes('LEG')) {
							defender.damagedLocations = [...(defender.damagedLocations || []), hitLocation]
							appliedEffects.push({
								effect: MELEE_EFFECT.LIMB_DAMAGED,
								details: `${hitLocation} damaged`
							})
						} else if (hitLocation === 'HEAD') {
							appliedEffects.push({
								effect: MELEE_EFFECT.PILOT_DAMAGE,
								details: 'Pilot takes damage'
							})
						}
					}
				} else {
					appliedEffects.push({
						effect: MELEE_EFFECT.CRITICAL_HIT,
						details: 'No critical hit'
					})
				}
				break
				
			case MELEE_EFFECT.PUSHED:
				// Determine push direction (opposite of attacker)
				const dx = defender.position.x - attacker.position.x
				const dy = defender.position.y - attacker.position.y
				
				// Calculate push position (simplified - real implementation needs better hex geometry)
				const pushPos = {
					x: defender.position.x + Math.sign(dx),
					y: defender.position.y + Math.sign(dy)
				}
				
				// Check if push position is valid
				if (gameState.isValidPosition(pushPos) && !gameState.isPositionOccupied(pushPos)) {
					// Record old position
					const oldPos = { ...defender.position }
					
					// Move defender to push position
					defender.position = pushPos
					
					appliedEffects.push({
						effect: MELEE_EFFECT.PUSHED,
						details: `Target pushed from ${oldPos.x},${oldPos.y} to ${pushPos.x},${pushPos.y}`
					})
					
					// Piloting roll to avoid falling
					if (typeof defender.makePilotingRoll === 'function') {
						const pilotingCheck = defender.makePilotingRoll(1)
						
						if (!pilotingCheck.success) {
							defender.status.prone = true
							appliedEffects.push({
								effect: MELEE_EFFECT.KNOCKDOWN,
								details: 'Target fell after being pushed'
							})
						}
					}
				} else {
					// Push against obstacle - extra damage
					const pushDamage = Math.floor(attacker.weight / 15)
					
					if (typeof defender.takeDamage === 'function') {
						defender.takeDamage(pushDamage, 'COLLISION')
					}
					
					appliedEffects.push({
						effect: MELEE_EFFECT.PUSHED,
						details: `Target collided with obstacle for ${pushDamage} damage`
					})
					
					// Higher chance of knockdown
					if (typeof defender.makePilotingRoll === 'function') {
						const pilotingCheck = defender.makePilotingRoll(3)
						
						if (!pilotingCheck.success) {
							defender.status.prone = true
							appliedEffects.push({
								effect: MELEE_EFFECT.KNOCKDOWN,
								details: 'Target fell after collision'
							})
						}
					}
				}
				break
				
			case MELEE_EFFECT.HEAT_DAMAGE:
				// Increase target heat if it's a mech
				if (defender.type === 'MECH') {
					const heatGenerated = Math.floor(attacker.weight / 15) + 2
					
					if (typeof defender.addHeat === 'function') {
						defender.addHeat(heatGenerated)
					} else {
						defender.currentHeat = (defender.currentHeat || 0) + heatGenerated
					}
					
					appliedEffects.push({
						effect: MELEE_EFFECT.HEAT_DAMAGE,
						details: `Target heat increased by ${heatGenerated}`
					})
				}
				break
				
			case MELEE_EFFECT.IMMOBILIZED:
				// Chance to immobilize
				if (rollDice(2, 6) >= 9) {
					defender.status.immobilized = true
					appliedEffects.push({
						effect: MELEE_EFFECT.IMMOBILIZED,
						details: 'Target immobilized until next turn'
					})
				} else {
					appliedEffects.push({
						effect: MELEE_EFFECT.IMMOBILIZED,
						details: 'Failed to immobilize target'
					})
				}
				break
				
			case MELEE_EFFECT.PILOT_DAMAGE:
				// Chance to damage pilot
				if (defender.type === 'MECH' && rollDice(2, 6) >= 10) {
					if (typeof defender.pilotTakeDamage === 'function') {
						defender.pilotTakeDamage(1)
					}
					
					appliedEffects.push({
						effect: MELEE_EFFECT.PILOT_DAMAGE,
						details: 'Pilot takes 1 damage'
					})
				} else {
					appliedEffects.push({
						effect: MELEE_EFFECT.PILOT_DAMAGE,
						details: 'Pilot avoids damage'
					})
				}
				break
				
			case MELEE_EFFECT.SENSORS_DAMAGED:
				// Chance to damage sensors
				if (rollDice(2, 6) >= 9) {
					defender.status.sensorsDamaged = true
					appliedEffects.push({
						effect: MELEE_EFFECT.SENSORS_DAMAGED,
						details: 'Target sensors damaged (-2 to attacks)'
					})
				} else {
					appliedEffects.push({
						effect: MELEE_EFFECT.SENSORS_DAMAGED,
						details: 'Sensors undamaged'
					})
				}
				break
		}
	})
	
	return appliedEffects
}

/**
 * Execute an advanced melee attack
 * @param {Object} attacker - The attacking unit
 * @param {Object} defender - The target unit
 * @param {string} meleeType - Type of melee attack
 * @param {Object} gameState - Current game state
 * @return {Object} - Attack result details
 */
function executeAdvancedMeleeAttack(attacker, defender, meleeType, gameState) {
	// Special case for defensive stance - it's not an attack
	if (meleeType === ADVANCED_MELEE_TYPE.DEFENSIVE_STANCE) {
		attacker.status.defensiveStance = true
		attacker.hasFired = true // Uses the unit's action
		
		return {
			success: true,
			message: 'Unit enters defensive stance',
			effects: ['Unit gains +2 to melee defense until next activation']
		}
	}
	
	// Check if melee is possible
	const canMeleeResult = canPerformAdvancedMelee(attacker, defender, meleeType, gameState)
	if (!canMeleeResult.success) {
		return canMeleeResult
	}
	
	// Calculate to-hit number
	const toHitInfo = calculateAdvancedMeleeToHit(attacker, defender, meleeType, gameState)
	
	// Roll for hit
	const attackRoll = rollDice(2, 6)
	const hit = attackRoll <= toHitInfo.toHitTarget
	
	// Initialize result object
	const result = {
		attacker: attacker.id,
		defender: defender.id,
		attackType: meleeType,
		hit,
		attackRoll,
		targetNumber: toHitInfo.toHitTarget,
		modifiers: toHitInfo.modifiers,
		damage: 0,
		attackerDamage: 0,
		hitLocation: null,
		effects: []
	}
	
	// Process hit
	if (hit) {
		// Calculate damage
		const damageInfo = calculateAdvancedMeleeDamage(attacker, defender, meleeType)
		result.potentialDamage = damageInfo.baseDamage
		
		// Determine hit location
		const hitLocation = determineMeleeHitLocation(damageInfo.locations)
		result.hitLocation = hitLocation
		
		// Apply damage to defender
		const damage = damageInfo.baseDamage
		result.damage = damage
		
		if (typeof defender.takeDamage === 'function') {
			defender.takeDamage(damage, 'PHYSICAL', hitLocation)
		}
		
		// Apply damage to attacker (if applicable)
		if (damageInfo.attackerDamage > 0) {
			const attackerDamage = damageInfo.attackerDamage
			result.attackerDamage = attackerDamage
			
			if (typeof attacker.takeDamage === 'function') {
				attacker.takeDamage(attackerDamage, 'PHYSICAL')
			}
		}
		
		// Apply special effects
		if (damageInfo.specialEffects.length > 0) {
			const appliedEffects = applyMeleeSpecialEffects(
				attacker, 
				defender, 
				damageInfo.specialEffects, 
				hitLocation, 
				gameState
			)
			
			result.specialEffects = appliedEffects
			
			// Add effect descriptions to result
			appliedEffects.forEach(effect => {
				result.effects.push(effect.details)
			})
		}
	} else {
		result.effects.push('Attack missed')
		
		// Some attacks have consequences even when missed
		if (meleeType === ADVANCED_MELEE_TYPE.BODY_SLAM || 
			 meleeType === ADVANCED_MELEE_TYPE.CHARGE) {
			// Attacker must make piloting roll or fall
			if (attacker.type === 'MECH' && typeof attacker.makePilotingRoll === 'function') {
				const pilotingCheck = attacker.makePilotingRoll(1)
				
				if (!pilotingCheck.success) {
					attacker.status.prone = true
					result.effects.push('Attacker fell after missed attack')
				}
			}
		}
	}
	
	// Mark that the unit has attacked
	attacker.hasFired = true
	
	// Reset defensive stance after attacking
	if (attacker.status?.defensiveStance) {
		delete attacker.status.defensiveStance
	}
	
	// Apply heat for mechs
	if (attacker.type === 'MECH') {
		let heatGenerated = 0
		
		switch (meleeType) {
			case ADVANCED_MELEE_TYPE.PUNCH:
			case ADVANCED_MELEE_TYPE.SHOULDER_CHECK:
				heatGenerated = 1
				break
			case ADVANCED_MELEE_TYPE.KICK:
			case ADVANCED_MELEE_TYPE.TRIP_ATTACK:
				heatGenerated = 2
				break
			case ADVANCED_MELEE_TYPE.BODY_SLAM:
				heatGenerated = 3
				break
			case ADVANCED_MELEE_TYPE.HEAD_BUTT:
				heatGenerated = 1
				break
			case ADVANCED_MELEE_TYPE.GRAPPLE:
				heatGenerated = 2
				break
			case ADVANCED_MELEE_TYPE.STOMP:
				heatGenerated = 1
				break
			case ADVANCED_MELEE_TYPE.CHARGE:
				heatGenerated = 3
				break
			default:
				heatGenerated = 1
		}
		
		if (typeof attacker.addHeat === 'function') {
			attacker.addHeat(heatGenerated)
		} else {
			attacker.currentHeat = (attacker.currentHeat || 0) + heatGenerated
		}
		
		result.heatGenerated = heatGenerated
	}
	
	return result
}

module.exports = {
	ADVANCED_MELEE_TYPE,
	MELEE_EFFECT,
	TERRAIN_MELEE_MODIFIERS,
	canPerformAdvancedMelee,
	calculateAdvancedMeleeToHit,
	calculateAdvancedMeleeDamage,
	determineMeleeHitLocation,
	applyMeleeSpecialEffects,
	executeAdvancedMeleeAttack
} 