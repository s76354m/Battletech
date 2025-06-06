/**
 * Enhanced Infantry Combat System
 * Extends the basic infantry combat with anti-mech capabilities,
 * special equipment, and advanced tactics
 */

const { calculateToHit, applyDamage, getUnitState } = require('./unitUtils')
const { distanceBetweenHexes } = require('../movement/mapUtils')
const { rollDice } = require('../../utils/diceRolls')
const { INFANTRY_TYPE, INFANTRY_EQUIPMENT } = require('./infantry')
const { TERRAIN_TYPE } = require('../movement/terrainEffects')
const { calculateLineOfSight } = require('../combat/lineOfSight')
const { MECH_LOCATION } = require('./mechLocations')

// Enhanced infantry types beyond basic types
const ENHANCED_INFANTRY_TYPE = {
  FOOT: 'FOOT',
  MOTORIZED: 'MOTORIZED',
  MECHANIZED: 'MECHANIZED',
  JUMP: 'JUMP',
  BATTLE_ARMOR: 'BATTLE_ARMOR',    // New type: Battle Armor (small power armor)
  POWER_ARMOR: 'POWER_ARMOR',      // New type: Heavier power armor
  SPECIAL_FORCES: 'SPECIAL_FORCES' // New type: Elite units with special abilities
}

// Specialized infantry equipment
const INFANTRY_EQUIPMENT = {
  // Basic weapons (from existing code)
  STANDARD: { name: 'Standard Weapons', damageMultiplier: 1, range: 1 },
  LASER: { name: 'Laser Rifles', damageMultiplier: 1.2, range: 2 },
  SRM: { name: 'SRM Launchers', damageMultiplier: 1.5, range: 3 },
  
  // Enhanced equipment
  VIBRO_BLADE: { 
    name: 'Vibro-Blades', 
    damageMultiplier: 1.3, 
    range: 0, 
    antiMech: true,
    description: 'Vibrating blades capable of cutting through mech armor joints'
  },
  INFERNO: { 
    name: 'Inferno SRMs', 
    damageMultiplier: 1.2, 
    range: 3, 
    heatDamage: 3,
    antiMech: true,
    description: 'Special SRMs that cause heat damage to mechs'
  },
  DEMO_CHARGE: { 
    name: 'Demolition Charges', 
    damageMultiplier: 2.5, 
    range: 0, 
    antiMech: true,
    oneTimeUse: true,
    description: 'Powerful explosives that can severely damage mech legs'
  },
  SUPPORT_WEAPON: { 
    name: 'Heavy Support Weapons', 
    damageMultiplier: 1.8, 
    range: 4,
    setupTime: 1,
    description: 'Heavy weapons that require setup time before firing'
  },
  ECM: { 
    name: 'ECM Suite', 
    damageMultiplier: 0.8, 
    range: 2,
    ecmRange: 3,
    description: 'Electronic countermeasures that provide protection against targeting'
  },
  MG_ARRAY: { 
    name: 'Machine Gun Array', 
    damageMultiplier: 1.4, 
    range: 2,
    antiInfantry: true,
    description: 'Specialized for anti-infantry combat'
  },
  RECON: { 
    name: 'Recon Equipment', 
    damageMultiplier: 0.7, 
    range: 1,
    spotting: 2,
    description: 'Advanced sensors for battlefield intelligence'
  }
}

// Special abilities for infantry units
const INFANTRY_ABILITIES = {
  INFILTRATION: {
    name: 'Infiltration',
    description: 'Can deploy behind enemy lines',
    usesPerGame: 1
  },
  STEALTH: {
    name: 'Stealth Training',
    description: 'Harder to detect and +1 to-hit modifier against this unit',
    passive: true
  },
  ENTRENCHMENT: {
    name: 'Entrenchment',
    description: 'Can dig in to increase defense at cost of mobility',
    cooldown: 2
  },
  AMBUSH: {
    name: 'Ambush',
    description: 'Bonus damage on first attack if undetected',
    passive: true
  },
  GUERRILLA: {
    name: 'Guerrilla Tactics',
    description: 'Better performance in woods and urban terrain',
    passive: true
  },
  REPAIR: {
    name: 'Field Repairs',
    description: 'Can perform minor repairs on friendly mechs',
    usesPerBattle: 2
  }
}

// Anti-mech specialized equipment types
const ANTI_MECH_EQUIPMENT = {
  INFERNO_SRM: 'INFERNO_SRM',
  VIBRO_BLADE: 'VIBRO_BLADE',
  DEMO_CHARGE: 'DEMO_CHARGE',
  SUPPORT_LASER: 'SUPPORT_LASER',
  LEG_ATTACK: 'LEG_ATTACK',
  MAGNETIC_CLAMP: 'MAGNETIC_CLAMP'
};

// Anti-mech attack types
const ANTI_MECH_ATTACK = {
  SWARM: 'SWARM',
  LEG_ATTACK: 'LEG_ATTACK',
  SUPPORT_WEAPON: 'SUPPORT_WEAPON',
  INFERNO_ATTACK: 'INFERNO_ATTACK',
  MINE_PLACEMENT: 'MINE_PLACEMENT'
};

// Enhanced infantry squad formation types
const SQUAD_FORMATION = {
  DISPERSED: 'DISPERSED',     // Spread out for reduced damage from area attacks
  CONCENTRATED: 'CONCENTRATED', // Focused for increased damage output
  STEALTH: 'STEALTH',         // Reduced visibility for ambush opportunities
  DEFENSIVE: 'DEFENSIVE'      // Increased protection at the cost of mobility
};

/**
 * Creates an enhanced infantry platoon with special equipment and abilities
 * @param {string} type - Type of infantry unit
 * @param {number} strength - Number of troopers (typically 28)
 * @param {Array} equipment - Array of equipment objects
 * @param {Array} abilities - Array of special ability keys
 * @param {Object} stats - Additional unit stats
 * @return {Object} - The created infantry platoon
 */
function createEnhancedInfantryPlatoon(type, strength, equipment = [], abilities = [], stats = {}) {
  // Validate infantry type
  if (!Object.values(ENHANCED_INFANTRY_TYPE).includes(type)) {
    throw new Error(`Invalid infantry type: ${type}`)
  }
  
  // Base movement points based on infantry type
  let movementPoints = 1
  if (type === ENHANCED_INFANTRY_TYPE.MOTORIZED) movementPoints = 3
  else if (type === ENHANCED_INFANTRY_TYPE.MECHANIZED) movementPoints = 2
  else if (type === ENHANCED_INFANTRY_TYPE.JUMP) movementPoints = 2
  else if (type === ENHANCED_INFANTRY_TYPE.BATTLE_ARMOR) movementPoints = 2
  else if (type === ENHANCED_INFANTRY_TYPE.POWER_ARMOR) movementPoints = 3
  else if (type === ENHANCED_INFANTRY_TYPE.SPECIAL_FORCES) movementPoints = 2
  
  // Base armor points
  let armorPoints = 0
  if (type === ENHANCED_INFANTRY_TYPE.MECHANIZED) armorPoints = 2
  else if (type === ENHANCED_INFANTRY_TYPE.BATTLE_ARMOR) armorPoints = 5
  else if (type === ENHANCED_INFANTRY_TYPE.POWER_ARMOR) armorPoints = 8
  
  // Process equipment
  const processedEquipment = equipment.map(item => {
    if (typeof item === 'string') {
      // Convert string equipment type to full equipment object
      return INFANTRY_EQUIPMENT[item] || INFANTRY_EQUIPMENT.STANDARD
    }
    return item
  })
  
  // Process abilities
  const processedAbilities = abilities.map(ability => {
    if (typeof ability === 'string') {
      // Convert string ability key to full ability object
      return { 
        ...INFANTRY_ABILITIES[ability],
        key: ability,
        used: false,
        cooldownRemaining: 0
      }
    }
    return ability
  })
  
  // Create the infantry unit
  return {
    id: `INF_${Date.now()}`, // Generate unique ID
    type: 'INFANTRY',
    infantryType: type,
    strength: strength || 28, // Default to standard platoon size
    maxStrength: strength || 28,
    equipment: processedEquipment,
    abilities: processedAbilities,
    movementPoints,
    currentMovementPoints: movementPoints,
    armorPoints,
    currentArmorPoints: armorPoints,
    status: {
      entrenched: false,
      prone: false,
      hidden: false,
      suppressed: false
    },
    position: { x: 0, y: 0 }, // Default position
    damageTrack: [],
    ...stats, // Override with any additional stats
    formation: SQUAD_FORMATION.DISPERSED,
    hasSwarmAttack: processedEquipment.some(e => e.antiMech),
    isSwarmingTarget: null,
    morale: 10, // 0-10 scale
    experience: 3, // 0-5 scale (rookie to veteran)
    isAntiMechSpecialized: processedEquipment.filter(e => e.antiMech).length >= 2,
    fatigue: 0, // 0-10 scale
    hasMovedThisTurn: false,
    hasAttackedThisTurn: false,
    antiMechEquipment: [],
    defenseModifier: 0,
    attackModifier: 0,
    movementModifier: 0
  }
}

/**
 * Calculate base damage for enhanced infantry unit
 * @param {Object} infantry - The infantry unit
 * @return {number} - The base damage value
 */
function calculateEnhancedInfantryDamage(infantry) {
  // Base damage is proportional to strength
  let baseDamage = Math.max(1, Math.floor(infantry.strength / 5))
  
  // Apply equipment multipliers
  if (infantry.equipment && infantry.equipment.length > 0) {
    // Find the best damage multiplier among equipped items
    const bestDamageMultiplier = Math.max(
      ...infantry.equipment.map(e => e.damageMultiplier || 1)
    )
    
    baseDamage = Math.floor(baseDamage * bestDamageMultiplier)
  }
  
  // Special forces get bonus damage
  if (infantry.infantryType === ENHANCED_INFANTRY_TYPE.SPECIAL_FORCES) {
    baseDamage += 1
  }
  
  // Battle armor and power armor get significant bonuses
  if (infantry.infantryType === ENHANCED_INFANTRY_TYPE.BATTLE_ARMOR) {
    baseDamage = Math.floor(baseDamage * 1.5)
  } else if (infantry.infantryType === ENHANCED_INFANTRY_TYPE.POWER_ARMOR) {
    baseDamage = Math.floor(baseDamage * 2)
  }
  
  // Check for entrenched bonus for defensive fire
  if (infantry.status.entrenched) {
    baseDamage = Math.floor(baseDamage * 1.2)
  }
  
  // Check for suppression penalty
  if (infantry.status.suppressed) {
    baseDamage = Math.floor(baseDamage * 0.5)
  }
  
  // Ambush ability provides bonus damage when hidden
  const hasAmbush = infantry.abilities?.some(a => 
    a.key === 'AMBUSH' && !a.used
  )
  
  if (hasAmbush && infantry.status.hidden) {
    baseDamage = Math.floor(baseDamage * 1.5)
    
    // Mark ambush as used if it's not passive
    const ambushAbility = infantry.abilities.find(a => a.key === 'AMBUSH')
    if (ambushAbility && !ambushAbility.passive) {
      ambushAbility.used = true
    }
  }
  
  return Math.max(1, baseDamage) // Minimum damage of 1
}

/**
 * Calculate to-hit number for enhanced infantry attack
 * @param {Object} attacker - The attacking infantry unit
 * @param {Object} defender - The defending unit
 * @param {number} range - Distance to target
 * @param {Object} gameState - Current game state
 * @return {Object} - To-hit calculation details
 */
function calculateEnhancedInfantryToHit(attacker, defender, range, gameState) {
  // Base to-hit number
  let baseToHit = 7
  
  // Modifiers array to track all bonuses/penalties
  const modifiers = []
  let totalModifier = 0
  
  // Range modifier - infantry is less effective at longer ranges
  const rangeModifier = Math.max(0, range - 1)
  if (rangeModifier > 0) {
    modifiers.push(`Range: +${rangeModifier}`)
    totalModifier += rangeModifier
  }
  
  // Check if the infantry has appropriate equipment for this range
  let hasRangeEquipment = false
  
  attacker.equipment.forEach(eq => {
    if (eq.range >= range) hasRangeEquipment = true
  })
  
  if (!hasRangeEquipment && range > 1) {
    modifiers.push('No suitable ranged weapons: +2')
    totalModifier += 2
  }
  
  // Movement modifiers
  if (attacker.moved) {
    const moveModifier = attacker.infantryType === ENHANCED_INFANTRY_TYPE.FOOT ? 2 : 1
    modifiers.push(`Attacker moved: +${moveModifier}`)
    totalModifier += moveModifier
  }
  
  if (defender.moved) {
    modifiers.push('Target moved: +1')
    totalModifier += 1
  }
  
  // Terrain modifiers
  const attackerTerrain = gameState?.terrain?.[attacker.position.x]?.[attacker.position.y] || 'CLEAR'
  const defenderTerrain = gameState?.terrain?.[defender.position.x]?.[defender.position.y] || 'CLEAR'
  
  if (defenderTerrain === 'WOODS' || defenderTerrain === 'HEAVY_WOODS') {
    modifiers.push('Target in woods: +1')
    totalModifier += 1
  }
  
  if (defenderTerrain === 'BUILDING' || defenderTerrain === 'RUBBLE') {
    modifiers.push('Target in urban terrain: +1')
    totalModifier += 1
  }
  
  // Guerrilla ability helps in woods
  const hasGuerrilla = attacker.abilities?.some(a => a.key === 'GUERRILLA')
  if (hasGuerrilla && 
     (attackerTerrain === 'WOODS' || attackerTerrain === 'HEAVY_WOODS' || 
      attackerTerrain === 'BUILDING' || attackerTerrain === 'RUBBLE')) {
    modifiers.push('Guerrilla tactics: -1')
    totalModifier -= 1
  }
  
  // Infantry type modifiers
  if (attacker.infantryType === ENHANCED_INFANTRY_TYPE.BATTLE_ARMOR ||
      attacker.infantryType === ENHANCED_INFANTRY_TYPE.POWER_ARMOR) {
    modifiers.push('Advanced targeting systems: -1')
    totalModifier -= 1
  } else if (attacker.infantryType === ENHANCED_INFANTRY_TYPE.SPECIAL_FORCES) {
    modifiers.push('Elite training: -1')
    totalModifier -= 1
  }
  
  // Status effects
  if (attacker.status.entrenched) {
    modifiers.push('Entrenched: -1')
    totalModifier -= 1
  }
  
  if (attacker.status.suppressed) {
    modifiers.push('Suppressed: +2')
    totalModifier += 2
  }
  
  if (defender.status.prone) {
    modifiers.push('Target prone: -2')
    totalModifier -= 2
  }
  
  // Stealth ability of target makes them harder to hit
  const defenderHasStealth = defender.abilities?.some(a => a.key === 'STEALTH')
  if (defenderHasStealth) {
    modifiers.push('Target has stealth: +1')
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
 * Execute an enhanced infantry attack
 * @param {Object} attacker - The attacking infantry unit
 * @param {Object} defender - The defending unit
 * @param {Object} gameState - Current game state
 * @return {Object} - Attack result details
 */
function executeEnhancedInfantryAttack(attacker, defender, gameState) {
  // Calculate range between units
  const range = distanceBetweenHexes(attacker.position, defender.position)
  
  // Check range limitations
  const maxRange = Math.max(...attacker.equipment.map(e => e.range || 1))
  
  if (range > maxRange) {
    return {
      success: false,
      message: `Target out of range (max range: ${maxRange}, actual range: ${range})`
    }
  }
  
  // Calculate to-hit number
  const toHitInfo = calculateEnhancedInfantryToHit(attacker, defender, range, gameState)
  
  // Roll for hit
  const attackRoll = rollDice(2, 6)
  const hit = attackRoll <= toHitInfo.toHitTarget
  
  // Initialize result object
  const result = {
    attacker: attacker.id,
    defender: defender.id,
    attackType: 'INFANTRY',
    hit,
    attackRoll,
    targetNumber: toHitInfo.toHitTarget,
    modifiers: toHitInfo.modifiers,
    damage: 0,
    effects: []
  }
  
  // If hit, calculate and apply damage
  if (hit) {
    // Calculate base damage
    let damage = calculateEnhancedInfantryDamage(attacker)
    
    // Check for target type-specific effects
    if (defender.type === 'INFANTRY') {
      // Infantry is more effective against other infantry
      const hasAntiInfantry = attacker.equipment.some(e => e.antiInfantry)
      
      if (hasAntiInfantry) {
        damage = Math.floor(damage * 1.5)
        result.effects.push('Anti-infantry weapons: 50% bonus damage')
      }
      
      // Additional morale effect
      if (attackRoll <= 3) {
        result.effects.push('Suppression effect')
        defender.status.suppressed = true
      }
    } else if (defender.type === 'MECH') {
      // Infantry is less effective against mechs unless they have anti-mech gear
      const hasAntiMech = attacker.equipment.some(e => e.antiMech)
      
      if (!hasAntiMech) {
        damage = Math.floor(damage / 2)
        result.effects.push('No anti-mech capability: 50% reduced damage')
      } else {
        // Apply special anti-mech effects based on equipment
        applyAntiMechEffects(attacker, defender, result)
      }
    } else if (defender.type === 'VEHICLE') {
      // Standard effectiveness against vehicles
      if (defender.vehicleType === 'HOVER' || defender.vehicleType === 'VTOL') {
        damage = Math.floor(damage * 1.2)
        result.effects.push('Vulnerable target: 20% bonus damage')
      }
    }
    
    // Apply the calculated damage
    applyDamage(defender, damage)
    result.damage = damage
    
    // Track that this unit has fired (affects movement later)
    attacker.hasFired = true
    
    // If using inferno SRMs, apply additional heat effect to mechs
    const hasInferno = attacker.equipment.find(e => e.type === 'INFERNO' || e.name === 'Inferno SRMs')
    if (hasInferno && defender.type === 'MECH') {
      const heatDamage = hasInferno.heatDamage || 3
      
      // This assumes there's a function to add heat to mechs
      if (typeof defender.addHeat === 'function') {
        defender.addHeat(heatDamage)
        result.effects.push(`Added ${heatDamage} heat to target mech`)
      }
    }
    
    // Handle one-time use equipment
    attacker.equipment = attacker.equipment.filter(e => !e.oneTimeUse)
  } else {
    result.effects.push('Attack missed')
  }
  
  // If infantry has special recon equipment, it reveals enemy units
  const hasRecon = attacker.equipment.some(e => e.spotting)
  if (hasRecon) {
    const spotRange = attacker.equipment.find(e => e.spotting)?.spotting || 2
    
    if (range <= spotRange) {
      defender.status.hidden = false
      result.effects.push('Target revealed by recon equipment')
    }
  }
  
  return result
}

/**
 * Apply special effects from anti-mech equipment
 * @param {Object} infantry - The attacking infantry unit
 * @param {Object} mech - The target mech
 * @param {Object} result - The attack result object to modify
 */
function applyAntiMechEffects(infantry, mech, result) {
  // Look for anti-mech equipment
  for (const equipment of infantry.equipment) {
    if (!equipment.antiMech) continue
    
    if (equipment.type === 'VIBRO_BLADE' || equipment.name === 'Vibro-Blades') {
      // Vibro blades have a chance to damage actuators or critical components
      if (rollDice(2, 6) >= 10) {
        result.effects.push('Vibro-blade critical hit!')
        
        // Roll for location
        const locationRoll = rollDice(1, 6)
        let location
        
        if (locationRoll <= 4) {
          location = 'LEGS'
          mech.movementPenalty = (mech.movementPenalty || 0) + 1
          result.effects.push('Target movement reduced')
        } else {
          location = 'ARMS'
          mech.accuracyPenalty = (mech.accuracyPenalty || 0) + 1
          result.effects.push('Target accuracy reduced')
        }
      }
    } else if (equipment.type === 'INFERNO' || equipment.name === 'Inferno SRMs') {
      // Additional effect - chance to force shutdown check
      if (rollDice(2, 6) >= 9) {
        result.effects.push('Mech must make shutdown check from excess heat')
        
        // This assumes the mech unit has a method to check for shutdown
        if (typeof mech.checkForShutdown === 'function') {
          const shutdownCheck = mech.checkForShutdown(2) // Harder to avoid
          if (shutdownCheck.shutdown) {
            result.effects.push('Mech shut down from excess heat!')
          }
        }
      }
    } else if (equipment.type === 'DEMO_CHARGE' || equipment.name === 'Demolition Charges') {
      // Demo charges are extremely effective but single-use
      result.damage = Math.floor(result.damage * 2.5)
      result.effects.push('Demo charge: massive damage bonus')
      
      // Force piloting skill roll to avoid falling
      result.effects.push('Target must make piloting skill roll')
      
      // This assumes the mech unit has a method to make piloting rolls
      if (typeof mech.makePilotingRoll === 'function') {
        const pilotingCheck = mech.makePilotingRoll(3) // Hard to avoid
        if (!pilotingCheck.success) {
          mech.status.prone = true
          result.effects.push('Mech knocked down!')
        }
      }
      
      // Remove the demo charge from inventory (one-time use)
      infantry.equipment = infantry.equipment.filter(e => 
        e.type !== 'DEMO_CHARGE' && e.name !== 'Demolition Charges'
      )
    }
  }
}

/**
 * Entrench the infantry unit, improving defense at the cost of mobility
 * @param {Object} infantry - The infantry unit to entrench
 * @return {Object} - Result of the entrenchment action
 */
function entrenchInfantry(infantry) {
  // Check if entrenchment is possible
  if (infantry.hasMoved || infantry.hasFired) {
    return {
      success: false,
      message: 'Cannot entrench after moving or firing'
    }
  }
  
  // Check for entrenchment ability
  const entrenchAbility = infantry.abilities?.find(a => a.key === 'ENTRENCHMENT')
  if (entrenchAbility && entrenchAbility.cooldownRemaining > 0) {
    return {
      success: false,
      message: `Entrenchment on cooldown for ${entrenchAbility.cooldownRemaining} turns`
    }
  }
  
  // Apply entrenchment
  infantry.status.entrenched = true
  infantry.hasActed = true // Counts as the unit's action for the turn
  
  // Set cooldown if applicable
  if (entrenchAbility) {
    entrenchAbility.cooldownRemaining = entrenchAbility.cooldown || 2
  }
  
  return {
    success: true,
    message: 'Infantry unit entrenched successfully',
    effects: [
      'Defense improved',
      'Attack accuracy improved',
      'Movement disabled until entrenchment abandoned'
    ]
  }
}

/**
 * Allow infantry to abandon entrenchment
 * @param {Object} infantry - The infantry unit
 * @return {Object} - Result of abandoning entrenchment
 */
function abandonEntrenchment(infantry) {
  if (!infantry.status.entrenched) {
    return {
      success: false,
      message: 'Unit is not entrenched'
    }
  }
  
  infantry.status.entrenched = false
  
  return {
    success: true,
    message: 'Entrenchment abandoned',
    effects: ['Unit can move normally next turn']
  }
}

/**
 * Perform infiltration deployment for special forces infantry
 * @param {Object} infantry - The infantry unit
 * @param {Object} position - The target position
 * @param {Object} gameState - Current game state
 * @return {Object} - Result of the infiltration attempt
 */
function performInfiltration(infantry, position, gameState) {
  // Check for infiltration ability
  const infiltrationAbility = infantry.abilities?.find(a => a.key === 'INFILTRATION')
  
  if (!infiltrationAbility) {
    return {
      success: false,
      message: 'Unit does not have infiltration ability'
    }
  }
  
  if (infiltrationAbility.used) {
    return {
      success: false,
      message: 'Infiltration ability already used this game'
    }
  }
  
  // Check if target position is valid
  if (!gameState.isValidPosition(position)) {
    return {
      success: false,
      message: 'Invalid infiltration position'
    }
  }
  
  // Check if position is already occupied
  if (gameState.isPositionOccupied(position)) {
    return {
      success: false,
      message: 'Target position already occupied'
    }
  }
  
  // Perform the infiltration
  infantry.position = position
  infantry.status.hidden = true
  
  // Mark ability as used
  infiltrationAbility.used = true
  
  return {
    success: true,
    message: 'Infiltration successful',
    effects: [
      'Unit deployed at target position',
      'Unit is hidden until it moves or attacks'
    ]
  }
}

/**
 * Repair a friendly mech in the same hex (for infantry with repair ability)
 * @param {Object} infantry - The infantry unit performing repairs
 * @param {Object} target - The target mech to repair
 * @return {Object} - Result of the repair attempt
 */
function performFieldRepairs(infantry, target) {
  // Check for repair ability
  const repairAbility = infantry.abilities?.find(a => a.key === 'REPAIR')
  
  if (!repairAbility) {
    return {
      success: false,
      message: 'Unit does not have field repair ability'
    }
  }
  
  if (repairAbility.usesPerBattle <= 0) {
    return {
      success: false,
      message: 'No repair attempts remaining this battle'
    }
  }
  
  // Check if target is a mech
  if (target.type !== 'MECH') {
    return {
      success: false,
      message: 'Can only repair BattleMechs'
    }
  }
  
  // Check if in same hex
  if (infantry.position.x !== target.position.x || 
      infantry.position.y !== target.position.y) {
    return {
      success: false,
      message: 'Must be in same hex as target mech'
    }
  }
  
  // Check if mech is shut down or immobile
  if (!target.status.shutdown && !target.status.immobile && !target.status.prone) {
    return {
      success: false,
      message: 'Mech must be shut down, immobile, or prone for field repairs'
    }
  }
  
  // Determine repair effect
  const repairRoll = rollDice(2, 6)
  const result = {
    success: true,
    repairRoll,
    effects: []
  }
  
  if (repairRoll >= 10) {
    // Critical system repair
    result.message = 'Critical system repaired'
    
    // Clear a critical hit effect
    if (target.criticalHits && target.criticalHits.length > 0) {
      const repairedCrit = target.criticalHits.pop()
      result.effects.push(`Repaired: ${repairedCrit.location} ${repairedCrit.system}`)
    } else {
      result.effects.push('No critical hits to repair')
    }
  } else if (repairRoll >= 7) {
    // Armor repair
    const repairPoints = rollDice(1, 3)
    target.currentArmor = Math.min(target.maxArmor, target.currentArmor + repairPoints)
    
    result.message = 'Armor patched'
    result.effects.push(`Repaired ${repairPoints} armor points`)
  } else if (repairRoll >= 5) {
    // Movement repair
    if (target.movementPenalty && target.movementPenalty > 0) {
      target.movementPenalty -= 1
      result.message = 'Movement system repaired'
      result.effects.push('Movement penalty reduced by 1')
    } else {
      result.message = 'Basic systems check'
      result.effects.push('No movement issues to repair')
    }
  } else {
    // Failed repair
    result.message = 'Repair attempt failed'
    result.effects.push('No systems repaired')
  }
  
  // Decrement repair uses
  repairAbility.usesPerBattle -= 1
  result.effects.push(`Repair attempts remaining: ${repairAbility.usesPerBattle}`)
  
  return result
}

/**
 * Check if infantry can perform an anti-mech attack
 * @param {Object} infantry - The infantry platoon
 * @param {Object} target - The target mech
 * @param {string} attackType - Type of anti-mech attack
 * @returns {boolean} Whether the attack can be performed
 */
function canPerformAntiMechAttack(infantry, target, attackType) {
  // Basic checks
  if (!infantry || !target || target.type !== 'MECH') {
    return false;
  }
  
  // Check troop count - need enough soldiers
  if (infantry.troopCount < 5) {
    return false;
  }
  
  // Check attack type requirements
  switch (attackType) {
    case ANTI_MECH_ATTACK.LEG_ATTACK:
      // Need to be adjacent to target
      if (!areUnitsAdjacent(infantry, target)) {
        return false;
      }
      // No additional requirements
      break;
      
    case ANTI_MECH_ATTACK.SWARM:
      // Need to be adjacent to target
      if (!areUnitsAdjacent(infantry, target)) {
        return false;
      }
      // Need jump packs or anti-mech training for higher mechs
      if (target.tonnage >= 55 && 
          !hasAntiMechEquipment(infantry, ANTI_MECH_EQUIPMENT.JUMP_PACK) &&
          !hasAntiMechEquipment(infantry, ANTI_MECH_EQUIPMENT.ANTI_MECH_TRAINING)) {
        return false;
      }
      // Need magnet clamps for assaults and heavies
      if (target.tonnage >= 80 && 
          !hasAntiMechEquipment(infantry, ANTI_MECH_EQUIPMENT.MAGNETIC_CLAMP)) {
        return false;
      }
      break;
      
    case ANTI_MECH_ATTACK.EXPLOSIVE_ATTACK:
      // Need demolition charges
      if (!hasAntiMechEquipment(infantry, ANTI_MECH_EQUIPMENT.DEMO_CHARGE)) {
        return false;
      }
      // Need to be adjacent
      if (!areUnitsAdjacent(infantry, target)) {
        return false;
      }
      break;
      
    case ANTI_MECH_ATTACK.CRITICAL_SYSTEM:
      // Need to be swarming the mech already
      if (!infantry.isSwarmingTarget || infantry.swarmingTargetId !== target.id) {
        return false;
      }
      // Need vibro blades or similar equipment
      if (!hasAntiMechEquipment(infantry, ANTI_MECH_EQUIPMENT.VIBRO_BLADE)) {
        return false;
      }
      break;
      
    default:
      return false;
  }
  
  return true;
}

/**
 * Calculate to-hit number for anti-mech attack
 * @param {Object} infantry - The infantry platoon
 * @param {Object} target - The target mech
 * @param {string} attackType - Type of anti-mech attack
 * @returns {number} To-hit number (2-12 scale, lower is better)
 */
function calculateAntiMechToHit(infantry, target, attackType) {
  // Base to-hit number (standard difficulty)
  let baseToHit = 8;
  
  // Apply infantry skill (lower skill = better chance)
  baseToHit += (infantry.skill - 4);
  
  // Apply attack type modifiers
  switch (attackType) {
    case ANTI_MECH_ATTACK.LEG_ATTACK:
      // Easier to hit legs
      baseToHit -= 1;
      break;
      
    case ANTI_MECH_ATTACK.SWARM:
      // Harder to swarm larger mechs
      if (target.tonnage >= 80) {
        baseToHit += 2;
      } else if (target.tonnage >= 55) {
        baseToHit += 1;
      }
      
      // Equipment bonuses
      if (hasAntiMechEquipment(infantry, ANTI_MECH_EQUIPMENT.JUMP_PACK)) {
        baseToHit -= 1;
      }
      if (hasAntiMechEquipment(infantry, ANTI_MECH_EQUIPMENT.MAGNETIC_CLAMP)) {
        baseToHit -= 1;
      }
      if (hasAntiMechEquipment(infantry, ANTI_MECH_EQUIPMENT.ANTI_MECH_TRAINING)) {
        baseToHit -= 2;
      }
      break;
      
    case ANTI_MECH_ATTACK.EXPLOSIVE_ATTACK:
      // Standard difficulty
      break;
      
    case ANTI_MECH_ATTACK.CRITICAL_SYSTEM:
      // Harder to hit specific systems
      baseToHit += 2;
      // Equipment bonuses
      if (hasAntiMechEquipment(infantry, ANTI_MECH_EQUIPMENT.VIBRO_BLADE)) {
        baseToHit -= 2;
      }
      break;
  }
  
  // Target movement modifiers
  if (target.currentMovement > target.walkSpeed) {
    baseToHit += 2; // Running target is harder to hit
  }
  
  // Troop count affects effectiveness (fewer troops = harder)
  const troopRatio = infantry.troopCount / infantry.maxTroopCount;
  if (troopRatio < 0.5) {
    baseToHit += 2;
  } else if (troopRatio < 0.8) {
    baseToHit += 1;
  }
  
  // Formation modifiers
  if (infantry.formation === SQUAD_FORMATION.CONCENTRATED && 
      (attackType === ANTI_MECH_ATTACK.SWARM || attackType === ANTI_MECH_ATTACK.LEG_ATTACK)) {
    baseToHit -= 1;
  }
  
  // Target already prone modifier
  if (target.isProne && attackType === ANTI_MECH_ATTACK.LEG_ATTACK) {
    baseToHit -= 2;
  }
  
  // Tactical bonuses
  if (infantry.antiMechBonus) {
    baseToHit -= infantry.antiMechBonus;
  }
  
  // Clamp to valid range
  return Math.max(2, Math.min(12, baseToHit));
}

/**
 * Calculate damage for anti-mech attack
 * @param {Object} infantry - The infantry platoon
 * @param {Object} target - The target mech
 * @param {string} attackType - Type of anti-mech attack
 * @returns {number} Damage amount
 */
function calculateAntiMechDamage(infantry, target, attackType) {
  // Base damage is dependent on troop count and attack type
  let baseDamage = 0;
  const troopRatio = infantry.troopCount / infantry.maxTroopCount;
  
  switch (attackType) {
    case ANTI_MECH_ATTACK.LEG_ATTACK:
      // Less damage but easier to execute
      baseDamage = Math.ceil(infantry.troopCount / 3);
      break;
      
    case ANTI_MECH_ATTACK.SWARM:
      // Damage scales with troop count
      baseDamage = Math.ceil(infantry.troopCount / 2);
      
      // Bonus for anti-mech training
      if (hasAntiMechEquipment(infantry, ANTI_MECH_EQUIPMENT.ANTI_MECH_TRAINING)) {
        baseDamage += 2;
      }
      break;
      
    case ANTI_MECH_ATTACK.EXPLOSIVE_ATTACK:
      // High damage but requires demo charges
      const demoCharges = countAntiMechEquipment(infantry, ANTI_MECH_EQUIPMENT.DEMO_CHARGE);
      baseDamage = 5 * demoCharges;
      break;
      
    case ANTI_MECH_ATTACK.CRITICAL_SYSTEM:
      // Low damage but can cause critical effects
      baseDamage = 3;
      
      // Bonus for vibro blades
      if (hasAntiMechEquipment(infantry, ANTI_MECH_EQUIPMENT.VIBRO_BLADE)) {
        baseDamage += 2;
      }
      break;
  }
  
  // Apply fatigue penalty
  if (infantry.fatigue > 5) {
    baseDamage = Math.floor(baseDamage * (1 - (infantry.fatigue - 5) / 10));
  }
  
  // Tactical bonus for anti-mech specialization
  if (infantry.antiMechBonus) {
    baseDamage += infantry.antiMechBonus;
  }
  
  return Math.max(1, baseDamage);
}

/**
 * Execute an anti-mech attack
 * @param {Object} infantry - The infantry platoon
 * @param {Object} target - The target mech
 * @param {string} attackType - Type of anti-mech attack
 * @returns {Object} Attack result information
 */
function executeAntiMechAttack(infantry, target, attackType) {
  // Check if attack can be performed
  if (!canPerformAntiMechAttack(infantry, target, attackType)) {
    return {
      success: false,
      message: "Cannot perform this anti-mech attack",
      damage: 0
    };
  }
  
  // Calculate to-hit
  const toHitNumber = calculateAntiMechToHit(infantry, target, attackType);
  
  // Roll 2d6 to determine hit
  const diceRoll = rollDice(2, 6);
  
  let success = diceRoll >= toHitNumber;
  let message = '';
  let damage = 0;
  let criticalHit = false;
  let locationHit = null;
  let effectsApplied = [];
  
  // Mark infantry as having attacked
  infantry.hasAttackedThisTurn = true;
  
  // Increase fatigue based on attack type
  switch (attackType) {
    case ANTI_MECH_ATTACK.LEG_ATTACK:
      infantry.fatigue = (infantry.fatigue || 0) + 1;
      break;
    case ANTI_MECH_ATTACK.SWARM:
      infantry.fatigue = (infantry.fatigue || 0) + 2;
      break;
    case ANTI_MECH_ATTACK.EXPLOSIVE_ATTACK:
      infantry.fatigue = (infantry.fatigue || 0) + 1;
      break;
    case ANTI_MECH_ATTACK.CRITICAL_SYSTEM:
      infantry.fatigue = (infantry.fatigue || 0) + 3;
      break;
  }
  
  if (success) {
    // Calculate damage
    damage = calculateAntiMechDamage(infantry, target, attackType);
    
    // Handle attack-specific effects
    switch (attackType) {
      case ANTI_MECH_ATTACK.LEG_ATTACK:
        message = "Infantry successfully attacks mech's legs!";
        locationHit = Math.random() < 0.5 ? MECH_LOCATION.LEFT_LEG : MECH_LOCATION.RIGHT_LEG;
        
        // Piloting roll to avoid falling
        const pilotingRoll = rollDice(2, 6);
        if (pilotingRoll < target.pilotSkill) {
          target.isProne = true;
          effectsApplied.push('PRONE');
          message += " Mech loses balance and falls!";
        }
        break;
        
      case ANTI_MECH_ATTACK.SWARM:
        message = "Infantry successfully swarms the mech!";
        
        // Set swarming status
        infantry.isSwarmingTarget = true;
        infantry.swarmingTargetId = target.id;
        effectsApplied.push('SWARMED');
        
        // Random location hit - torso most common
        const locationRoll = rollDice(1, 6);
        if (locationRoll <= 3) {
          locationHit = MECH_LOCATION.CENTER_TORSO;
        } else if (locationRoll === 4) {
          locationHit = MECH_LOCATION.LEFT_TORSO;
        } else if (locationRoll === 5) {
          locationHit = MECH_LOCATION.RIGHT_TORSO;
        } else {
          locationHit = MECH_LOCATION.HEAD;
          effectsApplied.push('COCKPIT_HIT');
          message += " Infantry reaches the cockpit!";
        }
        
        // Apply heat effect
        if (hasAntiMechEquipment(infantry, ANTI_MECH_EQUIPMENT.INFERNO_SRM)) {
          target.heat = (target.heat || 0) + 3;
          effectsApplied.push('HEAT');
          message += " Inferno weapons increase mech heat!";
        }
        break;
        
      case ANTI_MECH_ATTACK.EXPLOSIVE_ATTACK:
        message = "Infantry detonates explosives on the mech!";
        
        // Consume demolition charges
        const demosUsed = Math.min(
          3,  // Max 3 charges per attack
          countAntiMechEquipment(infantry, ANTI_MECH_EQUIPMENT.DEMO_CHARGE)
        );
        
        // Remove consumed equipment
        for (let i = 0; i < demosUsed; i++) {
          removeAntiMechEquipment(infantry, ANTI_MECH_EQUIPMENT.DEMO_CHARGE);
        }
        
        // Critical hit chance
        if (Math.random() < 0.3) {
          criticalHit = true;
          effectsApplied.push('CRITICAL');
          message += " The explosion causes critical damage!";
        }
        
        // Random location hit - leg or torso
        const explosiveLocationRoll = rollDice(1, 6);
        if (explosiveLocationRoll <= 2) {
          locationHit = Math.random() < 0.5 ? MECH_LOCATION.LEFT_LEG : MECH_LOCATION.RIGHT_LEG;
        } else if (explosiveLocationRoll <= 5) {
          locationHit = MECH_LOCATION.CENTER_TORSO;
        } else {
          locationHit = Math.random() < 0.5 ? MECH_LOCATION.LEFT_TORSO : MECH_LOCATION.RIGHT_TORSO;
        }
        break;
        
      case ANTI_MECH_ATTACK.CRITICAL_SYSTEM:
        message = "Infantry targets critical system!";
        
        // Always a critical hit
        criticalHit = true;
        effectsApplied.push('CRITICAL');
        
        // Target specific locations
        const criticalLocationOptions = [
          { location: MECH_LOCATION.HEAD, name: "cockpit", chance: 0.1 },
          { location: MECH_LOCATION.CENTER_TORSO, name: "engine", chance: 0.2 },
          { location: MECH_LOCATION.LEFT_TORSO, name: "weapon systems", chance: 0.35 },
          { location: MECH_LOCATION.RIGHT_TORSO, name: "weapon systems", chance: 0.35 }
        ];
        
        // Choose location based on chances
        let randomValue = Math.random();
        let cumulativeChance = 0;
        
        for (const option of criticalLocationOptions) {
          cumulativeChance += option.chance;
          if (randomValue <= cumulativeChance) {
            locationHit = option.location;
            message += ` Targeting the ${option.name}!`;
            break;
          }
        }
        break;
    }
  } else {
    message = `Infantry fails ${attackType.toLowerCase().replace('_', ' ')} against the mech`;
    
    // Special failure effects
    if (attackType === ANTI_MECH_ATTACK.SWARM && diceRoll <= 2) {
      // Catastrophic failure - infantry takes damage from mech defense
      const failureDamage = Math.ceil(target.tonnage / 20);
      applyDamageToInfantry(infantry, failureDamage);
      message += ` and suffers ${failureDamage} damage from mech defenses!`;
    }
  }
  
  return {
    success,
    message,
    damage,
    diceRoll,
    toHitNumber,
    criticalHit,
    locationHit,
    effectsApplied
  };
}

/**
 * Check if infantry has specific anti-mech equipment
 * @param {Object} infantry - The infantry platoon
 * @param {string} equipmentType - Type of equipment to check
 * @returns {boolean} Whether infantry has the equipment
 */
function hasAntiMechEquipment(infantry, equipmentType) {
  if (!infantry.antiMechEquipment || !Array.isArray(infantry.antiMechEquipment)) {
    return false;
  }
  
  return infantry.antiMechEquipment.some(eq => eq.type === equipmentType);
}

/**
 * Count how many of a specific anti-mech equipment infantry has
 * @param {Object} infantry - The infantry platoon
 * @param {string} equipmentType - Type of equipment to count
 * @returns {number} Count of equipment
 */
function countAntiMechEquipment(infantry, equipmentType) {
  if (!infantry.antiMechEquipment || !Array.isArray(infantry.antiMechEquipment)) {
    return 0;
  }
  
  return infantry.antiMechEquipment.filter(eq => eq.type === equipmentType).length;
}

/**
 * Remove one piece of consumed anti-mech equipment
 * @param {Object} infantry - The infantry platoon
 * @param {string} equipmentType - Type of equipment to remove
 * @returns {boolean} Whether equipment was removed
 */
function removeAntiMechEquipment(infantry, equipmentType) {
  if (!infantry.antiMechEquipment || !Array.isArray(infantry.antiMechEquipment)) {
    return false;
  }
  
  const index = infantry.antiMechEquipment.findIndex(eq => eq.type === equipmentType);
  if (index >= 0) {
    infantry.antiMechEquipment.splice(index, 1);
    return true;
  }
  
  return false;
}

/**
 * Apply damage to infantry platoon
 * @param {Object} infantry - The infantry platoon
 * @param {number} damage - Amount of damage to apply
 * @returns {number} Number of troops lost
 */
function applyDamageToInfantry(infantry, damage) {
  // Calculate troops lost (1 troop per 2 damage, rounded up)
  const troopsLost = Math.ceil(damage / 2);
  
  // Apply losses
  infantry.troopCount = Math.max(0, infantry.troopCount - troopsLost);
  
  return troopsLost;
}

/**
 * Check if units are adjacent to each other
 * @param {Object} unitA - First unit
 * @param {Object} unitB - Second unit
 * @returns {boolean} Whether units are adjacent
 */
function areUnitsAdjacent(unitA, unitB) {
  // This would connect to the hex grid system
  // For now, a simple implementation based on position
  const distance = Math.sqrt(
    Math.pow(unitA.position.x - unitB.position.x, 2) + 
    Math.pow(unitA.position.y - unitB.position.y, 2)
  );
  
  // Adjacent is distance of 1
  return distance <= 1;
}

/**
 * Add anti-mech equipment to infantry
 * @param {Object} infantry - The infantry platoon
 * @param {string} equipmentType - Type of equipment to add
 * @param {number} quantity - Number of equipment to add
 * @returns {Object} Updated infantry object
 */
function addAntiMechEquipment(infantry, equipmentType, quantity = 1) {
  // Initialize equipment array if needed
  if (!infantry.antiMechEquipment) {
    infantry.antiMechEquipment = [];
  }
  
  // Add equipment
  for (let i = 0; i < quantity; i++) {
    infantry.antiMechEquipment.push({
      type: equipmentType,
      id: `${equipmentType}_${Date.now()}_${i}`
    });
  }
  
  return infantry;
}

/**
 * Change infantry formation
 * @param {Object} infantry - The infantry platoon
 * @param {string} newFormation - New formation to adopt
 * @returns {Object} Updated infantry object
 */
function changeInfantryFormation(infantry, newFormation) {
  // Validate formation
  if (!Object.values(SQUAD_FORMATION).includes(newFormation)) {
    return infantry;
  }
  
  // Change formation
  infantry.formation = newFormation;
  
  // Apply formation change effects
  infantry.fatigue = (infantry.fatigue || 0) + 1;
  
  // Reset modifiers
  infantry.defenseModifier = 0;
  infantry.attackModifier = 0;
  infantry.movementModifier = 0;
  
  // Apply formation-specific modifiers
  switch (newFormation) {
    case SQUAD_FORMATION.DISPERSED:
      infantry.defenseModifier = 1;
      infantry.movementModifier = 1;
      break;
      
    case SQUAD_FORMATION.CONCENTRATED:
      infantry.attackModifier = 1;
      infantry.defenseModifier = -1;
      break;
      
    case SQUAD_FORMATION.STEALTH:
      infantry.defenseModifier = 2;
      infantry.movementModifier = -1;
      break;
      
    case SQUAD_FORMATION.DEFENSIVE:
      infantry.defenseModifier = 3;
      infantry.movementModifier = -2;
      infantry.attackModifier = -1;
      break;
  }
  
  return infantry;
}

/**
 * Get available anti-mech attack options
 * @param {Object} infantry - The infantry platoon
 * @param {Object} target - The target mech
 * @returns {Array} List of available attack options with their to-hit values
 */
function getAvailableAntiMechAttacks(infantry, target) {
  if (!infantry || !target || target.type !== 'MECH') {
    return [];
  }
  
  const attackOptions = [];
  
  // Check each attack type
  Object.values(ANTI_MECH_ATTACK).forEach(attackType => {
    if (canPerformAntiMechAttack(infantry, target, attackType)) {
      attackOptions.push({
        type: attackType,
        name: attackType.replace('_', ' ').toLowerCase(),
        toHit: calculateAntiMechToHit(infantry, target, attackType),
        damage: calculateAntiMechDamage(infantry, target, attackType),
        fatigueIncrease: attackType === ANTI_MECH_ATTACK.SWARM ? 2 : 
                         attackType === ANTI_MECH_ATTACK.CRITICAL_SYSTEM ? 3 : 1
      });
    }
  });
  
  return attackOptions;
}

/**
 * Update infantry fatigue state at end of turn
 * @param {Object} infantry - The infantry platoon
 * @returns {Object} Updated infantry object
 */
function updateInfantryFatigue(infantry) {
  // Reset turn flags
  infantry.hasMovedThisTurn = false;
  infantry.hasAttackedThisTurn = false;
  
  // Recover from fatigue if not swarming
  if (!infantry.isSwarmingTarget) {
    infantry.fatigue = Math.max(0, infantry.fatigue - 1);
  }
  
  return infantry;
}

/**
 * Detach infantry from swarmed mech
 * @param {Object} infantry - The infantry platoon
 * @returns {Object} Updated infantry object
 */
function detachFromSwarmAttack(infantry) {
  infantry.isSwarmingTarget = false;
  infantry.swarmingTargetId = null;
  infantry.fatigue = (infantry.fatigue || 0) + 2;
  
  return infantry;
}

module.exports = {
  ENHANCED_INFANTRY_TYPE,
  INFANTRY_EQUIPMENT,
  INFANTRY_ABILITIES,
  createEnhancedInfantryPlatoon,
  calculateEnhancedInfantryDamage,
  calculateEnhancedInfantryToHit,
  executeEnhancedInfantryAttack,
  entrenchInfantry,
  abandonEntrenchment,
  performInfiltration,
  performFieldRepairs
} 