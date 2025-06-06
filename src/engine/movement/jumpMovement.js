/**
 * Jump Movement System
 * Implements advanced jump mechanics with Death From Above attack integration
 */

import { distanceBetweenHexes } from './mapUtils'
import { rollDice } from '../../utils/diceRolls'
import { ENHANCED_INFANTRY_TYPE } from '../units/enhancedInfantry'

// Jump movement types
export const JUMP_TYPE = {
	STANDARD: 'STANDARD',   // Standard jump jet movement
	IMPROVED: 'IMPROVED',   // Improved jump jets (greater distance)
	ASSAULT: 'ASSAULT',     // Assault jump jets (heavier units)
	VTOL: 'VTOL',           // VTOL movement for vehicles
	INFANTRY: 'INFANTRY'    // Jump infantry movement
}

// Jump attack types
export const JUMP_ATTACK = {
	DEATH_FROM_ABOVE: 'DEATH_FROM_ABOVE',  // Classic BattleTech DFA attack
	STRAFING_RUN: 'STRAFING_RUN',          // Move and attack multiple targets
	JUMP_SNIPER: 'JUMP_SNIPER',            // Jump and fire with accuracy bonus
	EVASIVE_JUMP: 'EVASIVE_JUMP'           // Defensive jump with evasion bonus
}

/**
 * Check if unit can perform jump movement
 * @param {Object} unit - The unit to check
 * @param {Object} gameState - Current game state
 * @return {Object} - Result with success boolean and details
 */
export function canJump(unit, gameState) {
	// Check if unit has jump capability
	if (unit.type === 'MECH') {
		if (!unit.jumpMP || unit.jumpMP <= 0) {
			return {
				success: false,
				message: 'Mech does not have jump jets installed'
			}
		}
		
		// Check for disabled jump jets due to critical hits
		if (unit.criticalHits?.some(c => c.system === 'JUMP_JETS' && c.effect === 'DISABLED')) {
			return {
				success: false,
				message: 'Jump jets disabled due to critical damage'
			}
		}
		
		// Check for heat-related restrictions
		if (unit.currentHeat >= 25) {
			return {
				success: false,
				message: 'Jump jets inactive due to excessive heat'
			}
		}
	} else if (unit.type === 'VEHICLE' && unit.vehicleType === 'VTOL') {
		// VTOLs can always "jump" (fly)
		if (unit.status.immobilized || unit.criticalHits?.some(c => c.system === 'ENGINE' || c.system === 'ROTORS')) {
			return {
				success: false,
				message: 'VTOL flight systems damaged or disabled'
			}
		}
	} else if (unit.type === 'INFANTRY') {
		// Only jump infantry can jump
		if (unit.infantryType !== ENHANCED_INFANTRY_TYPE.JUMP && 
				unit.infantryType !== ENHANCED_INFANTRY_TYPE.BATTLE_ARMOR && 
				unit.infantryType !== ENHANCED_INFANTRY_TYPE.POWER_ARMOR) {
			return {
				success: false,
				message: 'Infantry unit does not have jump capability'
			}
		}
	} else {
		return {
			success: false,
			message: 'Unit type cannot perform jump movement'
		}
	}
	
	// Check if the unit has already moved this turn
	if (unit.hasMoved) {
		return {
			success: false,
			message: 'Unit has already moved this turn'
		}
	}
	
	// Can jump!
	return {
		success: true,
		message: 'Unit can perform jump movement'
	}
}

/**
 * Calculate the maximum jump distance for a unit
 * @param {Object} unit - The unit to check
 * @return {number} - Maximum jump distance in hexes
 */
export function getMaxJumpDistance(unit) {
	if (unit.type === 'MECH') {
		return unit.jumpMP || 0
	} else if (unit.type === 'VEHICLE' && unit.vehicleType === 'VTOL') {
		return unit.movementPoints || 0
	} else if (unit.type === 'INFANTRY') {
		// Jump infantry typically has limited jump range
		if (unit.infantryType === ENHANCED_INFANTRY_TYPE.JUMP) {
			return 2
		} else if (unit.infantryType === ENHANCED_INFANTRY_TYPE.BATTLE_ARMOR) {
			return 3
		} else if (unit.infantryType === ENHANCED_INFANTRY_TYPE.POWER_ARMOR) {
			return 4
		}
	}
	
	return 0
}

/**
 * Calculate heat generated from a jump movement
 * @param {Object} unit - The jumping unit
 * @param {number} distance - Jump distance in hexes
 * @return {number} - Heat points generated
 */
export function calculateJumpHeat(unit, distance) {
	if (unit.type !== 'MECH') return 0
	
	// Basic heat generation: minimum 3 heat, +1 for each hex jumped
	return Math.max(3, distance)
}

/**
 * Validate a jump movement path
 * @param {Object} unit - The jumping unit
 * @param {Object} startPosition - Starting hex coordinates {x, y}
 * @param {Object} endPosition - Target hex coordinates {x, y}
 * @param {Object} gameState - Current game state
 * @return {Object} - Validation result with success boolean and details
 */
export function validateJumpPath(unit, startPosition, endPosition, gameState) {
	// Calculate distance
	const distance = distanceBetweenHexes(startPosition, endPosition)
	
	// Check if distance is within range
	const maxDistance = getMaxJumpDistance(unit)
	if (distance > maxDistance) {
		return {
			success: false,
			message: `Jump distance (${distance}) exceeds unit's maximum jump range (${maxDistance})`
		}
	}
	
	// Check if destination is valid
	if (!gameState.isValidPosition(endPosition)) {
		return {
			success: false,
			message: 'Destination hex is outside the map boundaries'
		}
	}
	
	// Check if destination is blocked
	const terrain = gameState.terrain[endPosition.x][endPosition.y]
	
	if (terrain === 'WATER' && unit.type === 'INFANTRY' && 
			unit.infantryType !== ENHANCED_INFANTRY_TYPE.POWER_ARMOR) {
		return {
			success: false,
			message: 'Infantry units cannot jump into water hexes'
		}
	}
	
	if (terrain === 'LAVA' || terrain === 'DEEP_WATER') {
		return {
			success: false,
			message: `Cannot jump into ${terrain} hex`
		}
	}
	
	// Check for obstacles
	if (terrain === 'BUILDING' && unit.type === 'MECH' && unit.weight >= 75) {
		return {
			success: false,
			message: 'Heavy and assault mechs cannot jump onto building hexes'
		}
	}
	
	// Check if hex is already occupied
	if (gameState.isPositionOccupied(endPosition) && 
			!(unit.type === 'MECH' && gameState.getUnitAtPosition(endPosition).type === 'INFANTRY')) {
		return {
			success: false,
			message: 'Destination hex is already occupied by a unit'
		}
	}
	
	// All checks passed
	return {
		success: true,
		distance,
		heatGenerated: calculateJumpHeat(unit, distance)
	}
}

/**
 * Execute a jump movement
 * @param {Object} unit - The jumping unit
 * @param {Object} startPosition - Starting hex coordinates {x, y}
 * @param {Object} endPosition - Target hex coordinates {x, y}
 * @param {Object} gameState - Current game state
 * @param {string} jumpType - Type of jump movement
 * @return {Object} - Result of the jump movement
 */
export function executeJumpMovement(unit, startPosition, endPosition, gameState, jumpType = JUMP_TYPE.STANDARD) {
	// First check if unit can jump
	const canJumpResult = canJump(unit, gameState)
	if (!canJumpResult.success) {
		return canJumpResult
	}
	
	// Validate the jump path
	const pathResult = validateJumpPath(unit, startPosition, endPosition, gameState)
	if (!pathResult.success) {
		return pathResult
	}
	
	// Record the old position
	const oldPosition = { ...unit.position }
	
	// Update unit position
	unit.position = { ...endPosition }
	
	// Mark that the unit has moved
	unit.hasMoved = true
	unit.moveType = 'JUMP'
	unit.jumpDistance = pathResult.distance
	
	// Apply heat for mechs
	if (unit.type === 'MECH') {
		if (typeof unit.addHeat === 'function') {
			unit.addHeat(pathResult.heatGenerated)
		} else {
			unit.currentHeat = (unit.currentHeat || 0) + pathResult.heatGenerated
		}
	}
	
	// Piloting skill roll to avoid falling
	let pilotingCheck = null
	
	if (unit.type === 'MECH') {
		// Determine piloting skill check modifier based on terrain
		let terrainModifier = 0
		const landingTerrain = gameState.terrain[endPosition.x][endPosition.y]
		
		if (landingTerrain === 'ROUGH' || landingTerrain === 'RUBBLE') {
			terrainModifier = 1
		} else if (landingTerrain === 'WOODS') {
			terrainModifier = 2
		} else if (landingTerrain === 'HEAVY_WOODS') {
			terrainModifier = 3
		} else if (landingTerrain === 'WATER' || landingTerrain === 'ICE') {
			terrainModifier = 2
		}
		
		// Add modifiers for jump type
		if (jumpType === JUMP_TYPE.ASSAULT) {
			terrainModifier += 1
		} else if (jumpType === JUMP_TYPE.IMPROVED) {
			terrainModifier -= 1
		}
		
		// Make the piloting roll
		if (typeof unit.makePilotingRoll === 'function') {
			pilotingCheck = unit.makePilotingRoll(terrainModifier)
			
			if (!pilotingCheck.success) {
				unit.status.prone = true
				
				// Calculate falling damage
				const fallingDamage = Math.ceil(unit.weight / 10)
				
				if (typeof unit.takeDamage === 'function') {
					unit.takeDamage(fallingDamage, 'FALLING')
				}
				
				pilotingCheck.damage = fallingDamage
			}
		}
	}
	
	// Create result object
	const result = {
		success: true,
		message: `Unit jumped from ${oldPosition.x},${oldPosition.y} to ${endPosition.x},${endPosition.y}`,
		distance: pathResult.distance,
		heatGenerated: pathResult.heatGenerated,
		pilotingCheck
	}
	
	// Update unit status based on jump type
	if (jumpType === JUMP_TYPE.EVASIVE_JUMP) {
		unit.defenseBonus = 2
		result.effects = ['Unit gains +2 defense until next turn']
	}
	
	if (jumpType === JUMP_TYPE.JUMP_SNIPER) {
		unit.attackBonus = 1
		result.effects = ['Unit gains +1 attack with next ranged attack']
	}
	
	// Infantry units that jump lose their hidden status
	if (unit.type === 'INFANTRY' && unit.status.hidden) {
		unit.status.hidden = false
		if (!result.effects) result.effects = []
		result.effects.push('Unit is no longer hidden')
	}
	
	return result
}

/**
 * Check if a unit can perform a Death From Above attack
 * @param {Object} attacker - The jumping unit
 * @param {Object} defender - The target unit
 * @param {Object} gameState - Current game state
 * @return {Object} - Result indicating if DFA is possible
 */
export function canPerformDFA(attacker, defender, gameState) {
	// First check if unit can jump
	const canJumpResult = canJump(attacker, gameState)
	if (!canJumpResult.success) {
		return canJumpResult
	}
	
	// Only mechs and battle armor can perform DFA
	if (attacker.type !== 'MECH' && 
			!(attacker.type === 'INFANTRY' && 
				(attacker.infantryType === ENHANCED_INFANTRY_TYPE.BATTLE_ARMOR || 
					attacker.infantryType === ENHANCED_INFANTRY_TYPE.POWER_ARMOR))) {
		return {
			success: false,
			message: 'Only mechs and battle armor can perform Death From Above attacks'
		}
	}
	
	// Check if target is eligible
	if (defender.type !== 'MECH' && defender.type !== 'VEHICLE') {
		return {
			success: false,
			message: 'Can only perform Death From Above against mechs and vehicles'
		}
	}
	
	// Check if target is in range
	const distance = distanceBetweenHexes(attacker.position, defender.position)
	const maxJumpDistance = getMaxJumpDistance(attacker)
	
	if (distance > maxJumpDistance) {
		return {
			success: false,
			message: `Target is out of jump range (${distance} hexes, max ${maxJumpDistance})`
		}
	}
	
	return {
		success: true,
		message: 'Unit can perform Death From Above attack'
	}
}

/**
 * Calculate Death From Above to-hit number
 * @param {Object} attacker - The attacking unit
 * @param {Object} defender - The target unit
 * @param {Object} gameState - Current game state
 * @return {Object} - To-hit calculation details
 */
export function calculateDFAToHit(attacker, defender, gameState) {
	// Base to-hit value
	let baseToHit = 7
	
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
	
	// Attacker weight class modifier (heavier is better for DFA)
	if (attacker.type === 'MECH') {
		if (attacker.weight >= 85) {
			modifiers.push('Assault mech: -1')
			totalModifier -= 1
		} else if (attacker.weight <= 35) {
			modifiers.push('Light mech: +1')
			totalModifier += 1
		}
	}
	
	// Target movement modifier
	if (defender.hasMoved) {
		modifiers.push('Target moved: +1')
		totalModifier += 1
	}
	
	// Target size modifier
	if (defender.type === 'MECH') {
		if (defender.weight >= 85) {
			modifiers.push('Assault target: -1')
			totalModifier -= 1
		} else if (defender.weight <= 35) {
			modifiers.push('Light target: +1')
			totalModifier += 1
		}
	}
	
	// Terrain modifiers
	const defenderTerrain = gameState?.terrain?.[defender.position.x]?.[defender.position.y] || 'CLEAR'
	
	if (defenderTerrain === 'WOODS' || defenderTerrain === 'HEAVY_WOODS') {
		modifiers.push('Target in woods: +1')
		totalModifier += 1
	}
	
	// Weather conditions
	if (gameState?.weather === 'RAIN' || gameState?.weather === 'SNOW') {
		modifiers.push('Poor weather: +1')
		totalModifier += 1
	} else if (gameState?.weather === 'HEAVY_RAIN' || gameState?.weather === 'BLIZZARD') {
		modifiers.push('Severe weather: +2')
		totalModifier += 2
	}
	
	// Battle armor gets a bonus for this attack
	if (attacker.type === 'INFANTRY' && 
			(attacker.infantryType === ENHANCED_INFANTRY_TYPE.BATTLE_ARMOR || 
				attacker.infantryType === ENHANCED_INFANTRY_TYPE.POWER_ARMOR)) {
		modifiers.push('Battle armor bonus: -1')
		totalModifier -= 1
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
 * Calculate Death From Above damage
 * @param {Object} attacker - The attacking unit
 * @param {Object} defender - The target unit
 * @return {Object} - Damage calculation details
 */
export function calculateDFADamage(attacker) {
	let baseDamage = 0
	
	if (attacker.type === 'MECH') {
		// For mechs, damage is based on tonnage
		baseDamage = Math.floor(attacker.weight / 10)
	} else if (attacker.type === 'INFANTRY') {
		// For battle armor, damage is based on strength and type
		if (attacker.infantryType === ENHANCED_INFANTRY_TYPE.BATTLE_ARMOR) {
			baseDamage = Math.max(1, Math.floor(attacker.strength / 7))
		} else if (attacker.infantryType === ENHANCED_INFANTRY_TYPE.POWER_ARMOR) {
			baseDamage = Math.max(2, Math.floor(attacker.strength / 5))
		}
	}
	
	return {
		baseDamage,
		attackerDamage: Math.floor(baseDamage / 2) // Attacker takes half damage
	}
}

/**
 * Execute a Death From Above attack
 * @param {Object} attacker - The attacking unit
 * @param {Object} defender - The target unit
 * @param {Object} gameState - Current game state
 * @return {Object} - Attack result details
 */
export function executeDFAAttack(attacker, defender, gameState) {
	// Check if DFA is possible
	const canDFAResult = canPerformDFA(attacker, defender, gameState)
	if (!canDFAResult.success) {
		return canDFAResult
	}
	
	// Calculate to-hit number
	const toHitInfo = calculateDFAToHit(attacker, defender, gameState)
	
	// Roll for hit
	const attackRoll = rollDice(2, 6)
	const hit = attackRoll <= toHitInfo.toHitTarget
	
	// Initialize result object
	const result = {
		attacker: attacker.id,
		defender: defender.id,
		attackType: JUMP_ATTACK.DEATH_FROM_ABOVE,
		hit,
		attackRoll,
		targetNumber: toHitInfo.toHitTarget,
		modifiers: toHitInfo.modifiers,
		damage: 0,
		attackerDamage: 0,
		effects: []
	}
	
	// Calculate potential damage
	const damageInfo = calculateDFADamage(attacker)
	
	// Move attacker to target's position (or adjacent if hit fails)
	if (hit) {
		// On a hit, attacker lands in the same hex (for battle armor) or 
		// goes through to the opposite side (for mechs)
		if (attacker.type === 'INFANTRY') {
			// Battle armor stays in the same hex
			attacker.position = { ...defender.position }
		} else {
			// Determine "through" hex - opposite from approach direction
			const dx = defender.position.x - attacker.position.x
			const dy = defender.position.y - attacker.position.y
			
			// Calculate landing position (simplified - in a real game this would need more complex hex geometry)
			const landingPos = {
				x: defender.position.x + Math.sign(dx),
				y: defender.position.y + Math.sign(dy)
			}
			
			// Check if landing hex is valid
			if (gameState.isValidPosition(landingPos) && !gameState.isPositionOccupied(landingPos)) {
				attacker.position = landingPos
			} else {
				// If landing position is invalid, attacker lands in same hex
				attacker.position = { ...defender.position }
				result.effects.push('No clear landing hex - attacker stays in target hex')
			}
		}
		
		// Apply damage to defender
		const damage = damageInfo.baseDamage
		result.damage = damage
		
		if (typeof defender.takeDamage === 'function') {
			defender.takeDamage(damage, 'PHYSICAL')
		}
		
		// Target must make piloting roll or fall
		if (defender.type === 'MECH' && typeof defender.makePilotingRoll === 'function') {
			const pilotingCheck = defender.makePilotingRoll(2) // Hard to avoid
			
			if (!pilotingCheck.success) {
				defender.status.prone = true
				result.effects.push('Target knocked down')
			}
		}
		
		// Apply damage to attacker (recoil damage)
		const attackerDamage = damageInfo.attackerDamage
		result.attackerDamage = attackerDamage
		
		if (typeof attacker.takeDamage === 'function') {
			attacker.takeDamage(attackerDamage, 'FALLING')
		}
		
		// Attacker must make piloting roll or fall
		if (attacker.type === 'MECH' && typeof attacker.makePilotingRoll === 'function') {
			const pilotingCheck = attacker.makePilotingRoll(3) // Very hard to avoid
			
			if (!pilotingCheck.success) {
				attacker.status.prone = true
				result.effects.push('Attacker fell after attack')
			}
		}
	} else {
		// On a miss, attacker lands in an adjacent hex
		result.effects.push('Attack missed - attacker landing in adjacent hex')
		
		// Find a valid landing hex
		const adjacentHexes = gameState.getAdjacentHexes(defender.position)
		const validLandingHexes = adjacentHexes.filter(hex => 
			gameState.isValidPosition(hex) && !gameState.isPositionOccupied(hex)
		)
		
		if (validLandingHexes.length > 0) {
			// Select the landing hex (could be random or closest to original path)
			attacker.position = validLandingHexes[0]
		} else {
			// If no valid landing hex, attacker lands in same hex (awkward!)
			attacker.position = { ...defender.position }
			result.effects.push('No clear landing hex - attacker lands in target hex despite miss')
		}
		
		// Attacker still takes damage from the fall
		const fallDamage = Math.ceil(damageInfo.attackerDamage * 1.5) // More damage on miss
		result.attackerDamage = fallDamage
		
		if (typeof attacker.takeDamage === 'function') {
			attacker.takeDamage(fallDamage, 'FALLING')
		}
		
		// Attacker must make piloting roll at +2 difficulty or fall
		if (attacker.type === 'MECH' && typeof attacker.makePilotingRoll === 'function') {
			const pilotingCheck = attacker.makePilotingRoll(4) // Extremely hard to avoid
			
			if (!pilotingCheck.success) {
				attacker.status.prone = true
				result.effects.push('Attacker fell after missed attack')
			}
		}
	}
	
	// Mark that the unit has moved and attacked
	attacker.hasMoved = true
	attacker.hasFired = true
	attacker.moveType = 'JUMP'
	
	// Apply heat for mechs
	if (attacker.type === 'MECH') {
		const jumpDistance = distanceBetweenHexes(
			{ x: attacker.position.x, y: attacker.position.y },
			{ x: defender.position.x, y: defender.position.y }
		)
		
		const heatGenerated = calculateJumpHeat(attacker, jumpDistance) + 2 // +2 for the attack
		
		if (typeof attacker.addHeat === 'function') {
			attacker.addHeat(heatGenerated)
		} else {
			attacker.currentHeat = (attacker.currentHeat || 0) + heatGenerated
		}
		
		result.heatGenerated = heatGenerated
	}
	
	return result
}

/**
 * Execute a Jump Sniper attack (jump and fire with improved accuracy)
 * @param {Object} unit - The jumping unit
 * @param {Object} startPosition - Starting hex coordinates {x, y}
 * @param {Object} endPosition - Target hex coordinates {x, y}
 * @param {Object} gameState - Current game state
 * @return {Object} - Result of the jump sniper maneuver
 */
export function executeJumpSniper(unit, startPosition, endPosition, gameState) {
	// Perform the jump movement
	const jumpResult = executeJumpMovement(
		unit, 
		startPosition, 
		endPosition, 
		gameState, 
		JUMP_TYPE.JUMP_SNIPER
	)
	
	if (!jumpResult.success) {
		return jumpResult
	}
	
	// Add the jump sniper specific effects
	if (!jumpResult.effects) jumpResult.effects = []
	jumpResult.effects.push('Unit gains bonus accuracy for next ranged attack')
	
	// Add an attack bonus for the next attack
	unit.attackBonus = (unit.attackBonus || 0) + 1
	
	// Update to jump sniper type
	jumpResult.jumpType = JUMP_ATTACK.JUMP_SNIPER
	
	return jumpResult
}

/**
 * Execute an Evasive Jump maneuver (jump with defensive bonus)
 * @param {Object} unit - The jumping unit
 * @param {Object} startPosition - Starting hex coordinates {x, y}
 * @param {Object} endPosition - Target hex coordinates {x, y}
 * @param {Object} gameState - Current game state
 * @return {Object} - Result of the evasive jump maneuver
 */
export function executeEvasiveJump(unit, startPosition, endPosition, gameState) {
	// Perform the jump movement
	const jumpResult = executeJumpMovement(
		unit, 
		startPosition, 
		endPosition, 
		gameState, 
		JUMP_TYPE.EVASIVE_JUMP
	)
	
	if (!jumpResult.success) {
		return jumpResult
	}
	
	// Add the evasive jump specific effects
	if (!jumpResult.effects) jumpResult.effects = []
	jumpResult.effects.push('Unit gains defensive bonus until next activation')
	
	// Add a defense bonus
	unit.defenseBonus = (unit.defenseBonus || 0) + 2
	
	// Update to evasive jump type
	jumpResult.jumpType = JUMP_ATTACK.EVASIVE_JUMP
	
	return jumpResult
}

export default {
	JUMP_TYPE,
	JUMP_ATTACK,
	canJump,
	getMaxJumpDistance,
	calculateJumpHeat,
	validateJumpPath,
	executeJumpMovement,
	canPerformDFA,
	calculateDFAToHit,
	calculateDFADamage,
	executeDFAAttack,
	executeJumpSniper,
	executeEvasiveJump
} 