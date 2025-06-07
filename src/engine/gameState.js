/**
 * Game State Manager for Alpha Strike AI Game Master
 */

const { initializeLogger } = require('../utils/logger');
const logger = initializeLogger();

// Game Phases
const PHASES = {
  SETUP: 'SETUP',
  INITIATIVE: 'INITIATIVE',
  MOVEMENT: 'MOVEMENT',
  COMBAT: 'COMBAT',
  END: 'END'
};

// Default battlefield dimensions
const DEFAULT_WIDTH = 24;
const DEFAULT_HEIGHT = 24;

// Direction mapping
const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// Terrain types
const TERRAIN_TYPES = {
  CLEAR: 'clear',
  LIGHT_WOODS: 'light_woods',
  HEAVY_WOODS: 'heavy_woods',
  WATER: 'water',
  ROUGH: 'rough',
  ROAD: 'road'
};

// Terrain effects
const TERRAIN_EFFECTS = {
  [TERRAIN_TYPES.CLEAR]: {
    movementModifier: 1, // Normal movement
    combatModifier: 0    // No modifier to target number
  },
  [TERRAIN_TYPES.LIGHT_WOODS]: {
    movementModifier: 0.5, // Half movement
    combatModifier: 1      // +1 to target number
  },
  [TERRAIN_TYPES.HEAVY_WOODS]: {
    movementModifier: 0.5, // Half movement
    combatModifier: 2      // +2 to target number
  },
  [TERRAIN_TYPES.WATER]: {
    movementModifier: 0.5, // Half movement
    combatModifier: 1      // +1 to target number
  },
  [TERRAIN_TYPES.ROUGH]: {
    movementModifier: 0.5, // Half movement
    combatModifier: 1      // +1 to target number
  },
  [TERRAIN_TYPES.ROAD]: {
    movementModifier: 1.5, // 50% bonus to movement
    combatModifier: 0      // No modifier to target number
  }
};

// Vehicle movement modifiers by type and terrain
const VEHICLE_MOVEMENT_MODIFIERS = {
  'tracked': {
    [TERRAIN_TYPES.CLEAR]: 1.0,   // Normal movement
    [TERRAIN_TYPES.LIGHT_WOODS]: 0.7, // 30% penalty (better than other vehicles)
    [TERRAIN_TYPES.HEAVY_WOODS]: 0.4, // 60% penalty but still passable
    [TERRAIN_TYPES.WATER]: 0,      // Impassable unless amphibious
    [TERRAIN_TYPES.ROUGH]: 0.6,    // 40% penalty (better than wheeled)
    [TERRAIN_TYPES.ROAD]: 1.3      // 30% bonus (less than wheeled)
  },
  'wheeled': {
    [TERRAIN_TYPES.CLEAR]: 1.0,   // Normal movement
    [TERRAIN_TYPES.LIGHT_WOODS]: 0.5, // 50% penalty
    [TERRAIN_TYPES.HEAVY_WOODS]: 0,   // Impassable
    [TERRAIN_TYPES.WATER]: 0,      // Impassable unless amphibious
    [TERRAIN_TYPES.ROUGH]: 0.4,    // 60% penalty (worse than tracked)
    [TERRAIN_TYPES.ROAD]: 1.5      // 50% bonus (better than tracked)
  },
  'hover': {
    [TERRAIN_TYPES.CLEAR]: 1.0,   // Normal movement
    [TERRAIN_TYPES.LIGHT_WOODS]: 0.6, // 40% penalty
    [TERRAIN_TYPES.HEAVY_WOODS]: 0.3, // 70% penalty
    [TERRAIN_TYPES.WATER]: 1.0,    // Normal movement (hover over water)
    [TERRAIN_TYPES.ROUGH]: 0.7,    // 30% penalty (better than tracked/wheeled)
    [TERRAIN_TYPES.ROAD]: 1.4      // 40% bonus
  },
  'vtol': {
    [TERRAIN_TYPES.CLEAR]: 1.0,   // Normal movement
    [TERRAIN_TYPES.LIGHT_WOODS]: 1.0, // No penalty
    [TERRAIN_TYPES.HEAVY_WOODS]: 1.0, // No penalty
    [TERRAIN_TYPES.WATER]: 1.0,    // No penalty
    [TERRAIN_TYPES.ROUGH]: 1.0,    // No penalty
    [TERRAIN_TYPES.ROAD]: 1.0      // No bonus - already fast
  }
};

// Critical Hit Tables
const CRITICAL_HIT_TABLES = {
  'mech': [
    { range: [2, 7], effect: 'ENGINE_HIT', description: 'Engine Hit - Unit gains 2 heat that cannot be dissipated until repaired' },
    { range: [8, 8], effect: 'FIRE_CONTROL_HIT', description: 'Fire Control Hit - +1 to all attack rolls until repaired' },
    { range: [9, 9], effect: 'MOVEMENT_HIT', description: 'Movement Hit - Reduce all movement values by 2" until repaired' },
    { range: [10, 10], effect: 'WEAPON_HIT', description: 'Weapon Hit - Reduce all damage values by 1 (minimum 0) until repaired' },
    { range: [11, 11], effect: 'MOTIVE_SYSTEM_HIT', description: 'Motive System Hit - Unit is immobilized until repaired' },
    { range: [12, 12], effect: 'AMMO_EXPLOSION', description: 'Ammunition Explosion - Unit immediately takes 2 points of structure damage' }
  ],
  'vehicle': [
    { range: [2, 6], effect: 'ENGINE_HIT', description: 'Engine Hit - Reduce all movement values by 50% until repaired' },
    { range: [7, 9], effect: 'WEAPON_HIT', description: 'Weapon Hit - Reduce all damage values by 1 (minimum 0) until repaired' },
    { range: [10, 12], effect: 'MOTIVE_SYSTEM_HIT', description: 'Motive System Hit - Unit is immobilized until repaired' }
  ],
  'infantry': [
    { range: [2, 12], effect: 'ADDITIONAL_DAMAGE', description: 'Additional Damage - Unit takes 1 additional point of damage' }
  ]
};

// Critical Hit Effect Implementations
const CRITICAL_EFFECTS = {
  'ENGINE_HIT': {
    apply: (unit) => {
      logger.info(`Applying ENGINE_HIT to ${unit.id}`);
      // For mechs, this generates extra heat
      if (unit.type.includes('mech')) {
        unit.status.engineDamage = (unit.status.engineDamage || 0) + 1;
        // The heat effect will be applied in the heat phase
      } 
      // For vehicles, reduce movement
      else if (unit.type.includes('vehicle')) {
        unit.status.engineDamage = (unit.status.engineDamage || 0) + 1;
        // Will need to check this during movement calculations
      }
    },
    description: (unit) => {
      if (unit.type.includes('mech')) {
        return `Engine Damage: +2 heat per turn`;
      } else {
        return `Engine Damage: Movement reduced by 50%`;
      }
    }
  },
  'FIRE_CONTROL_HIT': {
    apply: (unit) => {
      logger.info(`Applying FIRE_CONTROL_HIT to ${unit.id}`);
      unit.status.fireControlDamage = (unit.status.fireControlDamage || 0) + 1;
      // Will need to check this during attack calculations
    },
    description: () => `Fire Control Damage: +1 to all attack rolls`
  },
  'MOVEMENT_HIT': {
    apply: (unit) => {
      logger.info(`Applying MOVEMENT_HIT to ${unit.id}`);
      unit.status.movementDamage = (unit.status.movementDamage || 0) + 1;
      // Will need to check this during movement calculations
    },
    description: () => `Movement System Damage: -2" to all movement`
  },
  'WEAPON_HIT': {
    apply: (unit) => {
      logger.info(`Applying WEAPON_HIT to ${unit.id}`);
      unit.status.weaponDamage = (unit.status.weaponDamage || 0) + 1;
      // Will need to check this during damage calculations
    },
    description: () => `Weapon System Damage: -1 to all damage values`
  },
  'MOTIVE_SYSTEM_HIT': {
    apply: (unit) => {
      logger.info(`Applying MOTIVE_SYSTEM_HIT to ${unit.id}`);
      unit.status.effects.push('IMMOBILIZED');
    },
    description: () => `Motive System Failure: Unit immobilized`
  },
  'AMMO_EXPLOSION': {
    apply: (unit) => {
      logger.info(`Applying AMMO_EXPLOSION to ${unit.id}`);
      // Direct structure damage
      unit.status.damage.structure += 2;
      
      // Check if the unit is destroyed
      if (unit.status.damage.structure >= unit.stats.structure) {
        unit.status.effects.push('DESTROYED');
        logger.info(`Unit ${unit.id} destroyed by ammunition explosion!`);
      }
    },
    description: () => `Ammunition Explosion: 2 structure damage`
  },
  'ADDITIONAL_DAMAGE': {
    apply: (unit) => {
      logger.info(`Applying ADDITIONAL_DAMAGE to ${unit.id}`);
      // For infantry this is just extra damage - apply directly
      unit.status.damage.armor = Math.min(unit.stats.armor, unit.status.damage.armor + 1);
      
      // If armor is depleted, apply to structure
      if (unit.status.damage.armor >= unit.stats.armor) {
        unit.status.damage.structure += 1;
        
        // Check for destruction
        if (unit.status.damage.structure >= unit.stats.structure) {
          unit.status.effects.push('DESTROYED');
          logger.info(`Unit ${unit.id} destroyed by additional damage!`);
        }
      }
    },
    description: () => `Additional Casualties: +1 damage`
  }
};

/**
 * Create a new game state
 * @returns {Object} Initial game state
 */
function createGameState() {
  return {
    battlefield: {
      dimensions: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
      terrain: new Map(), // Position -> TerrainType
      units: new Map() // UnitID -> UnitState
    },
    turnData: {
      phase: PHASES.SETUP,
      activePlayer: null,
      round: 0,
      initiative: { winner: null, rolls: {} }
    },
    players: new Map([
      ['player', { name: 'Human Player', units: [] }],
      ['ai', { name: 'AI Opponent', units: [] }]
    ]),
    battleLog: []
  };
}

/**
 * Add a unit to the game state
 * 
 * @param {Object} gameState - Current game state
 * @param {string} playerId - ID of the player who owns the unit
 * @param {Object} unit - Unit data to add
 * @returns {Object} Updated game state with the new unit
 */
function addUnit(gameState, playerId, unit) {
  // Get or create a unique unit ID
  const unitId = unit.id || `${playerId}-${unit.type}-${Date.now().toString().slice(-4)}`;
  
  // Create unit state object
  const unitState = {
    id: unitId,
    name: unit.name || `${unit.type} ${unitId.slice(-4)}`,
    type: unit.type,
    vehicleType: unit.vehicleType || null, // For vehicle subtype (tracked, hover, etc.)
    owner: playerId,
    position: unit.position || { x: 0, y: 0 },
    facing: unit.facing || 'N',
    stats: {
      movement: unit.movement || { walk: 4, run: 6, jump: 0 },
      armor: unit.armor || 3,
      structure: unit.structure || 1,
      skill: unit.skill || 4,
      tmm: unit.tmm || 1,
      damage: unit.damage || { short: 1, medium: 1, long: 0, extreme: 0 },
      heat: { current: 0, capacity: 4, overheat: 0 },
      specialAbilities: unit.specialAbilities || []
    },
    status: {
      damage: { armor: 0, structure: 0 },
      criticalHits: [],
      heat: 0,
      effects: []
    }
  };

  // Apply special ability effects that modify base stats
  if (unitState.stats.specialAbilities.includes('HVY-CHAS')) {
    // Heavy Chassis provides +1 structure point
    unitState.stats.structure += 1;
    logger.info(`Unit ${unitId} has Heavy Chassis: +1 structure point`);
  }

  // Add unit to battlefield
  gameState.battlefield.units.set(unitId, unitState);
  
  // Add unit to player's unit list if player exists
  const player = gameState.players.get(playerId);
  if (player) {
    if (!player.units) {
      player.units = [];
    }
    player.units.push(unitId);
    logger.info(`Unit added: ${unitId} for player ${playerId}`);
  } else {
    // Create player if it doesn't exist
    gameState.players.set(playerId, {
      name: playerId === 'player' ? 'Human Player' : 
            playerId === 'ai' ? 'AI Opponent' : `Player ${playerId}`,
      units: [unitId]
    });
    logger.info(`Created new player ${playerId} and added unit ${unitId}`);
  }
  
  return gameState;
}

/**
 * Set terrain at a specific position
 * 
 * @param {Object} gameState - Current game state
 * @param {Object} position - Position {x, y}
 * @param {string} terrainType - Type of terrain (from TERRAIN_TYPES)
 * @returns {boolean} Success of the terrain placement
 */
function setTerrain(gameState, position, terrainType) {
  // Validate position
  const { width, height } = gameState.battlefield.dimensions;
  if (position.x < 0 || position.x >= width || position.y < 0 || position.y >= height) {
    logger.warn(`Terrain placement failed: Position (${position.x},${position.y}) is outside battlefield`);
    return false;
  }
  
  // Validate terrain type
  if (!Object.values(TERRAIN_TYPES).includes(terrainType)) {
    logger.warn(`Terrain placement failed: Invalid terrain type ${terrainType}`);
    logger.info(`Valid terrain types are: ${Object.values(TERRAIN_TYPES).join(', ')}`);
    return false;
  }
  
  // Create position key
  const posKey = `${position.x},${position.y}`;
  
  // Set terrain
  gameState.battlefield.terrain.set(posKey, terrainType);
  logger.info(`Terrain set at (${position.x},${position.y}): ${terrainType}`);
  return true;
}

/**
 * Get terrain at a specific position
 * 
 * @param {Object} gameState - Current game state
 * @param {Object} position - Position {x, y}
 * @returns {string} Terrain type at the position (defaults to CLEAR)
 */
function getTerrainAt(gameState, position) {
  const posKey = `${position.x},${position.y}`;
  return gameState.battlefield.terrain.get(posKey) || TERRAIN_TYPES.CLEAR;
}

/**
 * Get terrain effect for a specific position
 * 
 * @param {Object} gameState - Current game state
 * @param {Object} position - Position {x, y}
 * @returns {Object} Terrain effects at the position
 */
function getTerrainEffect(gameState, position) {
  const terrain = getTerrainAt(gameState, position);
  return TERRAIN_EFFECTS[terrain];
}

/**
 * Move a unit on the battlefield
 * 
 * @param {Object} gameState - Current game state
 * @param {string} unitId - ID of the unit to move
 * @param {Object} newPosition - New position {x, y}
 * @param {string} newFacing - New facing direction
 * @param {string} moveType - Type of movement (walk, run, jump)
 * @param {Object} options - Additional movement options
 * @returns {boolean} Success of the movement
 */
function moveUnit(gameState, unitId, newPosition, newFacing, moveType = 'walk', options = {}) {
  try {
    const unit = gameState.battlefield.units.get(unitId);
    
    if (!unit) {
      logger.warn(`Move failed: Unit ${unitId} not found`);
      return false;
    }
    
    // Check if unit is destroyed
    if (unit.status && unit.status.effects && unit.status.effects.includes('DESTROYED')) {
      logger.warn(`Move failed: Unit ${unitId} is destroyed`);
      return false;
    }
    
    // Check if unit is shutdown
    if (unit.status && unit.status.effects && unit.status.effects.includes('SHUTDOWN')) {
      logger.warn(`Move failed: Unit ${unitId} is shutdown`);
      return false;
    }
    
    // Check if unit is immobilized from critical hits
    if (unit.status && unit.status.effects && unit.status.effects.includes('IMMOBILIZED')) {
      logger.warn(`Move failed: Unit ${unitId} is immobilized due to critical damage`);
      return false;
    }
    
    // Calculate distance
    const { x: oldX, y: oldY } = unit.position;
    const { x: newX, y: newY } = newPosition;
    const distance = Math.sqrt(Math.pow(newX - oldX, 2) + Math.pow(newY - oldY, 2));
    
    // Get terrain at destination
    const destTerrain = getTerrainAt(gameState, newPosition);
    const destTerrainEffect = getTerrainEffect(gameState, newPosition);
    
    // Calculate maximum move allowed
    let maxMove = 0;
    
    // Apply movement critical hit penalties
    let movementCritPenalty = 0;
    if (unit.status && unit.status.movementDamage) {
      movementCritPenalty = unit.status.movementDamage * 2; // Each hit is -2"
      logger.info(`Unit ${unitId} has ${movementCritPenalty}" movement penalty due to movement system damage`);
    }
    
    // Apply engine damage penalties for vehicles
    let enginePenalty = 1.0; // Multiplier, default no penalty
    if (unit.type === 'vehicle' && unit.status && unit.status.engineDamage) {
      enginePenalty = 0.5; // 50% movement penalty
      logger.info(`Vehicle ${unitId} has 50% movement penalty due to engine damage`);
    }
    
    // Check for special movement abilities and vehicle-specific behavior
    let ignoreTerrainCosts = false;
    let terrainModifier = destTerrainEffect && destTerrainEffect.movementModifier ? destTerrainEffect.movementModifier : 1;
    
    // Initialize elevation data if not present (for VTOLs)
    if (unit.type === 'vehicle' && unit.vehicleType === 'vtol') {
      if (!unit.status) unit.status = {};
      if (unit.status.elevation === undefined) {
        unit.status.elevation = 1; // Default VTOL elevation
      }
    }
    
    // Handle vehicle-specific movement characteristics
    if (unit.type === 'vehicle') {
      const vehicleType = unit.vehicleType || 'tracked'; // Default to tracked if not specified
      
      // Check for amphibious ability - allows water movement
      const hasAmphibious = unit.stats && unit.stats.specialAbilities && unit.stats.specialAbilities.includes('AMP');
      
      // If the terrain is water and vehicle is not amphibious or VTOL/hover, it can't move there
      if (destTerrain === TERRAIN_TYPES.WATER && !hasAmphibious && 
          vehicleType !== 'vtol' && vehicleType !== 'hover') {
        logger.warn(`Move failed: Vehicle ${unitId} (${vehicleType}) cannot enter water terrain`);
        return false;
      }
      
      // VTOL movement handling
      if (vehicleType === 'vtol') {
        // Get desired elevation from options or maintain current
        const newElevation = options.elevation !== undefined ? 
                            options.elevation : 
                            (unit.status.elevation || 1);
        
        // Validate altitude limits (1-6 hexes for VTOLs in Alpha Strike)
        if (newElevation < 1 || newElevation > 6) {
          logger.warn(`Move failed: VTOL elevation must be between 1 and 6 (got ${newElevation})`);
          return false;
        }
        
        // Update elevation
        unit.status.elevation = newElevation;
        logger.info(`VTOL ${unitId} now at elevation ${newElevation}`);
        
        // VTOLs ignore ground terrain costs completely
        ignoreTerrainCosts = true;
      }
      
      // Apply vehicle-specific terrain modifiers
      if (VEHICLE_MOVEMENT_MODIFIERS && VEHICLE_MOVEMENT_MODIFIERS[vehicleType] && 
          VEHICLE_MOVEMENT_MODIFIERS[vehicleType][destTerrain] !== undefined) {
        terrainModifier = VEHICLE_MOVEMENT_MODIFIERS[vehicleType][destTerrain];
        logger.info(`Applied ${vehicleType} movement modifier ${terrainModifier} for ${destTerrain} terrain`);
        
        // Special case: if modifier is 0, terrain is impassable
        if (terrainModifier === 0) {
          logger.warn(`Move failed: Terrain ${destTerrain} is impassable for ${vehicleType} vehicle`);
          return false;
        }
      }
      
      // Hover vehicles ignore water movement penalties
      if (vehicleType === 'hover' && destTerrain === TERRAIN_TYPES.WATER) {
        logger.info(`Hover vehicle ${unitId} ignores water movement penalties`);
      }
      
      // VTOL ability check (separate from vehicleType, for vehicles with VTOL special ability)
      if (unit.stats && unit.stats.specialAbilities && unit.stats.specialAbilities.includes('VTOL')) {
        ignoreTerrainCosts = true;
        logger.info(`Unit ${unitId} with VTOL ability ignoring terrain movement costs`);
      }
    }
    
    // Jump movement ignores terrain movement costs
    if (moveType === 'jump') {
      ignoreTerrainCosts = true;
      
      // Can only jump if unit has jump capability
      if (!unit.stats || !unit.stats.movement || !unit.stats.movement.jump || unit.stats.movement.jump <= 0) {
        logger.warn(`Move failed: Unit ${unitId} cannot perform jump movement`);
        return false;
      }
      
      // Jump movement must be at least 1" and at most the unit's jump value
      // This enforces the "minimum jump" rule - no hopping in place
      if (distance < 1) {
        logger.warn(`Move failed: Jump movement must be at least 1" distance`);
        return false;
      }
      
      maxMove = unit.stats.movement.jump - movementCritPenalty;
      logger.info(`Jump movement selected. Max distance: ${maxMove}"`);
    } else {
      // Calculate max move based on movement type (walk or run)
      if (moveType === 'run') {
        maxMove = unit.stats.movement.run - movementCritPenalty;
        logger.info(`Run movement selected. Base max distance: ${maxMove}"`);
      } else {
        maxMove = unit.stats.movement.walk - movementCritPenalty;
        logger.info(`Walk movement selected. Base max distance: ${maxMove}"`);
      }
      
      // Apply engine damage penalty for vehicles
      if (unit.type === 'vehicle' && unit.status && unit.status.engineDamage) {
        maxMove = Math.floor(maxMove * enginePenalty);
        logger.info(`Engine damage reduces max movement to ${maxMove}"`);
      }
      
      // Apply terrain modifier unless we're ignoring terrain costs
      if (!ignoreTerrainCosts) {
        maxMove = Math.floor(maxMove * terrainModifier);
        logger.info(`Terrain modifier (${terrainModifier}) applied. Adjusted max distance: ${maxMove}"`);
      } else {
        logger.info(`Terrain movement costs ignored due to special ability or movement type`);
      }
    }
    
    // Ensure minimum movement of 2" (unless completely immobilized)
    if (maxMove < 2 && (!unit.status || !unit.status.effects || !unit.status.effects.includes('IMMOBILIZED'))) {
      maxMove = 2;
      logger.info(`Applied minimum movement rule: Unit can always move at least 2"`);
    }
    
    // Validate the move distance
    if (distance > maxMove) {
      logger.warn(`Move failed: Distance ${distance.toFixed(1)}" exceeds maximum allowed ${maxMove}"`);
      return false;
    }
    
    // Check for other units at the destination
    for (const [otherUnitId, otherUnit] of gameState.battlefield.units.entries()) {
      if (otherUnitId !== unitId && 
          otherUnit.position.x === newPosition.x && 
          otherUnit.position.y === newPosition.y) {
        
        // VTOL units can share spaces with ground units, but not with other VTOLs at same elevation
        if (unit.type === 'vehicle' && unit.vehicleType === 'vtol') {
          const isOtherVTOL = otherUnit.type === 'vehicle' && otherUnit.vehicleType === 'vtol';
          
          if (isOtherVTOL && otherUnit.status && unit.status && 
              otherUnit.status.elevation === unit.status.elevation) {
            logger.warn(`Move failed: Another VTOL unit is already at position (${newPosition.x},${newPosition.y}) at elevation ${unit.status.elevation}`);
            return false;
          }
          
          if (!isOtherVTOL) {
            // VTOL can share space with ground unit
            logger.info(`VTOL ${unitId} sharing position with ground unit ${otherUnitId}`);
          }
        } else {
          // Non-VTOL units cannot share spaces
          logger.warn(`Move failed: Another unit is already at position (${newPosition.x},${newPosition.y})`);
          return false;
        }
      }
    }
    
    // All checks passed, execute the move
    const oldPosition = { ...unit.position };
    unit.position = { ...newPosition };
    unit.facing = newFacing;
    
    // Ensure status object exists
    if (!unit.status) unit.status = {};
    
    // Store last move type for Death From Above checks
    unit.status.lastMoveType = moveType;
    unit.status.lastMoveDistance = distance;
    
    // Generate heat for movement (mechs only)
    if (unit.type === 'mech') {
      let heatGenerated = 0;
      
      if (moveType === 'jump') {
        heatGenerated = 3; // Jumping generates 3 heat
        logger.info(`Jump movement generates ${heatGenerated} heat for ${unitId}`);
      } else if (moveType === 'run') {
        heatGenerated = 2; // Running generates 2 heat
        logger.info(`Run movement generates ${heatGenerated} heat for ${unitId}`);
      } else {
        heatGenerated = 1; // Walking generates 1 heat
        logger.info(`Walk movement generates ${heatGenerated} heat for ${unitId}`);
      }
      
      // Apply heat
      if (heatGenerated > 0) {
        addHeat(gameState, unitId, heatGenerated);
      }
    }
    
    logger.info(`Unit ${unitId} successfully moved from (${oldPosition.x},${oldPosition.y}) to (${newPosition.x},${newPosition.y}) facing ${newFacing}`);
    
    // Mark that movement was successful
    return true;
  } catch (error) {
    logger.error(`Error in moveUnit function: ${error.message}`);
    console.error(error);
    return false;
  }
}

/**
 * Process an attack between two units
 * 
 * @param {Object} gameState - Current game state
 * @param {string} attackerId - ID of the attacking unit
 * @param {string} targetId - ID of the target unit
 * @param {Object} options - Attack options (e.g., attackType, indirect)
 * @returns {Object} Attack result
 */
function processAttack(gameState, attackerId, targetId, options = {}) {
  const attacker = gameState.battlefield.units.get(attackerId);
  const target = gameState.battlefield.units.get(targetId);
  
  // Import special abilities module
  const { applyAllSpecialAbilities, hasSpecialAbility } = require('./specialAbilities');
  
  if (!attacker || !target) {
    logger.warn(`Attack failed: Units not found - Attacker: ${attackerId}, Target: ${targetId}`);
    return { success: false, message: 'Units not found' };
  }
  
  // Apply fire control penalties
  let fireControlPenalty = 0;
  if (attacker.status.fireControlDamage) {
    fireControlPenalty = attacker.status.fireControlDamage;
    logger.info(`Unit ${attackerId} has +${fireControlPenalty} to-hit penalty due to fire control damage`);
  }
  
  // Calculate range between units
  const { x: ax, y: ay } = attacker.position;
  const { x: tx, y: ty } = target.position;
  const range = Math.sqrt(Math.pow(tx - ax, 2) + Math.pow(ty - ay, 2));
  
  // Determine range band
  let rangeBand;
  if (range <= 6) rangeBand = 'short';
  else if (range <= 12) rangeBand = 'medium';
  else if (range <= 24) rangeBand = 'long';
  else rangeBand = 'extreme';
  
  // Apply weapon damage penalties
  let weaponDamagePenalty = 0;
  if (attacker.status.weaponDamage) {
    weaponDamagePenalty = attacker.status.weaponDamage;
    logger.info(`Unit ${attackerId} has -${weaponDamagePenalty} damage penalty due to weapon system damage`);
  }
  
  // Get attack type (default to direct fire)
  const attackType = options.attackType || 'direct';
  
  // Determine if this is an indirect fire attack
  const isIndirectFire = attackType === 'indirect';
  
  // Check for battlefield control ability blocking indirect fire
  if (isIndirectFire) {
    // Check if any enemy unit has active battlefield control
    const enemyUnits = gameState.players.get(target.owner).units
      .map(id => gameState.battlefield.units.get(id))
      .filter(u => u && !u.status.effects.includes('DESTROYED'));
      
    const bfcBlocked = enemyUnits.some(unit => {
      if (hasSpecialAbility(unit, 'BFC')) {
        // Check if the BFC ability affects the attacker
        return applySpecialAbility(
          unit, 
          'BFC', 
          'affectsTarget',
          [unit, attacker, gameState]
        ) && applySpecialAbility(
          unit,
          'BFC',
          'preventAttackType',
          [attacker, 'indirect']
        );
      }
      return false;
    });
    
    if (bfcBlocked) {
      logger.info(`Indirect fire blocked by enemy Battlefield Control ability`);
      return { success: false, message: 'Indirect fire blocked by Battlefield Control' };
    }
  }
  
  // Check if attacker can attack at this range
  const baseDamage = attacker.stats.damage[rangeBand];
  const adjustedDamage = Math.max(0, baseDamage - weaponDamagePenalty);
  
  if (adjustedDamage <= 0) {
    logger.info(`Attack failed: No damage at ${rangeBand} range (${range} hexes)`);
    return { success: false, message: `No damage at ${rangeBand} range` };
  }
  
  // Simulate attack roll: 2d6 + attacker skill vs. target number
  const attackRoll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
  const attackerSkill = attacker.stats.skill;
  
  // Base target number is 8
  let targetNumber = 8;
  
  // Add modifiers
  // Range modifier
  if (rangeBand === 'medium') targetNumber += 2;
  else if (rangeBand === 'long') targetNumber += 4;
  else if (rangeBand === 'extreme') targetNumber += 6;
  
  // TMM modifier
  targetNumber += target.stats.tmm;
  
  // Terrain modifier - get terrain at target's position
  const targetTerrainEffect = getTerrainEffect(gameState, target.position);
  targetNumber += targetTerrainEffect.combatModifier;
  
  // Heat effects on targeting (for mechs)
  let heatModifier = 0;
  if (attacker.type === 'mech') {
    const heatEffects = applyHeatCombatEffects(gameState, attackerId);
    if (heatEffects.affected) {
      heatModifier = heatEffects.toHitModifier;
      logger.info(`Unit ${attackerId} has +${heatModifier} to-hit penalty due to heat`);
    }
  }
  
  // Check for ECM effects
  // Base modifier is 0 so abilities can increment it
  const ecmModifier = applyAllSpecialAbilities(
    target,
    'modifyTargetMovementModifier',
    [0, gameState]
  );
  if (ecmModifier > 0) {
    logger.info(`Target ${targetId} has ECM protection: +${ecmModifier} to-hit modifier`);
  }
  targetNumber += ecmModifier;
  
  // Apply special ability modifiers to attack roll
  // Base modifier is 0 so abilities can adjust it
  const attackModifier = applyAllSpecialAbilities(
    attacker,
    'modifyAttackRoll',
    [0, target, attackType]
  );
  if (attackModifier !== 0) {
    logger.info(`Unit ${attackerId} has ${attackModifier > 0 ? '+' + attackModifier : attackModifier} attack roll modifier from special abilities`);
  }
  
  // Final attack value (skill is already a penalty, lower is better)
  const attackValue = attackRoll + attackerSkill + heatModifier + fireControlPenalty + attackModifier;
  const hit = attackValue >= targetNumber;
  
  // Generate heat for mech weapons fire
  if (attacker.type === 'mech') {
    // Heat generation depends on range band and damage value
    // This is a simplification of BattleTech rules
    let heatGenerated = 0;
    
    switch (rangeBand) {
      case 'short':
        heatGenerated = Math.min(3, attacker.stats.damage.short); // Cap at 3
        break;
      case 'medium':
        heatGenerated = Math.min(2, attacker.stats.damage.medium); // Cap at 2
        break;
      case 'long':
      case 'extreme':
        heatGenerated = Math.min(1, attacker.stats.damage[rangeBand]); // Cap at 1
        break;
    }
    
    // Add extra heat for overheat attacks
    if (options.overheat) {
      heatGenerated += 2;
      logger.info(`Overheat attack adds +2 heat`);
    }
    
    if (heatGenerated > 0) {
      const heatResult = addHeat(gameState, attackerId, heatGenerated);
      logger.info(`Weapons fire generated ${heatGenerated} heat for ${attackerId} (${rangeBand} range)`);
    }
  }
  
  // Process damage if hit
  if (hit) {
    // Apply any damage modifiers from attacker's special abilities
    let damageValue = adjustedDamage;
    
    // Modify damage based on source unit's abilities
    damageValue = applyAllSpecialAbilities(
      attacker, 
      'modifyIncomingDamage', 
      [damageValue, options.attackType]
    );
    
    // Apply damage to target
    const damageResult = applyDamage(gameState, targetId, damageValue, {
      attackType: options.attackType || 'direct',
      attacker: attackerId
    });
    
    // Check for critical hit opportunity
    let criticalHit = false;
    let criticalResult = null;
    
    // Critical hit on natural 12
    if (attackRoll === 12) {
      logger.info(`Natural 12 rolled! Critical hit check for ${targetId}`);
      criticalResult = processCriticalHit(gameState, targetId, { roll: attackRoll });
      criticalHit = criticalResult.success;
    }
    // Critical hit from structure damage
    else if (damageResult.structureDamage > 0) {
      const structureRatio = target.status.damage.structure / target.stats.structure;
      
      // Structure damage severity based on unit size/structure
      if (structureRatio >= 0.25) {
        logger.info(`Structure hit! Critical hit check for ${targetId}`);
        criticalResult = processCriticalHit(gameState, targetId);
        criticalHit = criticalResult.success;
      }
    }
    
    // Critical hit from Precision weapon ability
    const hasPrecision = hasSpecialAbility(attacker, 'PRB');
    if (!criticalHit && hasPrecision && attackRoll >= 10) {
      logger.info(`Precision ability triggers additional critical hit check for ${targetId}`);
      criticalResult = processCriticalHit(gameState, targetId, { roll: attackRoll });
      criticalHit = criticalResult.success;
    }
    
    logger.info(`Attack hit! ${attackerId} dealt ${damageValue} damage to ${targetId}`);
    
    // Add detailed log entry for the attack
    addLogEntry(gameState, `${attackerId} hit ${targetId} for ${damageValue} damage at ${rangeBand} range`, {
      attackerId,
      targetId,
      rangeBand,
      attackRoll,
      attackValue,
      targetNumber,
      damage: damageValue,
      criticalHit
    });
    
    return { 
      success: true, 
      hit: true, 
      attackRoll,
      attackValue,
      targetNumber,
      damage: damageValue,
      rangeBand,
      terrainMod: targetTerrainEffect.combatModifier,
      ecmMod: ecmModifier,
      heatMod: heatModifier,
      abilityMod: attackModifier,
      criticalHit,
      criticalResult
    };
  } else {
    logger.info(`Attack missed! ${attackerId} vs ${targetId} (${attackValue} < ${targetNumber})`);
    
    // Add log entry for the missed attack
    addLogEntry(gameState, `${attackerId} missed ${targetId} at ${rangeBand} range`, {
      attackerId,
      targetId,
      rangeBand,
      attackRoll,
      attackValue,
      targetNumber
    });
    
    return { 
      success: true, 
      hit: false, 
      attackRoll,
      attackValue,
      targetNumber,
      rangeBand,
      terrainMod: targetTerrainEffect.combatModifier,
      ecmMod: ecmModifier,
      heatMod: heatModifier,
      abilityMod: attackModifier
    };
  }
}

/**
 * Helper function to apply a special ability
 * 
 * @param {Object} unit - The unit with the ability
 * @param {string} abilityCode - The code of the ability to apply
 * @param {string} functionName - The implementation function to call
 * @param {Array} params - Parameters to pass to the implementation function
 * @returns {*} The modified value or result
 */
function applySpecialAbility(unit, abilityCode, functionName, params = []) {
  // Import special abilities module
  const { applySpecialAbility: applySA } = require('./specialAbilities');
  return applySA(unit, abilityCode, functionName, params);
}

/**
 * Apply damage to a unit
 * 
 * @param {Object} gameState - Current game state
 * @param {string} unitId - ID of the unit to damage
 * @param {number} damageAmount - Amount of damage to apply
 * @param {Object} options - Additional damage options (e.g., attack type)
 * @returns {Object} Damage result
 */
function applyDamage(gameState, unitId, damageAmount, options = {}) {
  const unit = gameState.battlefield.units.get(unitId);
  
  if (!unit) {
    logger.warn(`Damage application failed: Unit ${unitId} not found`);
    return { success: false };
  }
  
  // Process special abilities that affect damage
  let modifiedDamage = damageAmount;
  
  // Import special abilities module (handle potential circular reference)
  const { applyAllSpecialAbilities, hasSpecialAbility } = require('./specialAbilities');
  
  // Apply damage modifiers from special abilities
  modifiedDamage = applyAllSpecialAbilities(
    unit, 
    'modifyIncomingDamage', 
    [modifiedDamage, options.attackType]
  );
  
  // Handle infantry damage differently - gradual reduction in capabilities
  if (unit.type === 'infantry') {
    return applyInfantryDamage(gameState, unit, modifiedDamage, options);
  }
  
  // Apply damage to armor first
  const currentArmor = unit.stats.armor - unit.status.damage.armor;
  let armorDamage = Math.min(modifiedDamage, currentArmor);
  let structureDamage = 0;
  
  // If damage exceeds remaining armor, apply to structure
  if (modifiedDamage > armorDamage) {
    structureDamage = modifiedDamage - armorDamage;
  }
  
  // Update unit status
  unit.status.damage.armor += armorDamage;
  
  // Apply structure damage if any
  if (structureDamage > 0) {
    unit.status.damage.structure += structureDamage;
    
    // Check for unit destruction
    if (unit.status.damage.structure >= unit.stats.structure) {
      logger.info(`Unit ${unitId} has been destroyed!`);
      // Mark unit as destroyed (keep in game state for record)
      unit.status.effects.push('DESTROYED');
    }
  }
  
  // Log the damage application with details about damage reduction if applicable
  if (damageAmount !== modifiedDamage) {
    logger.info(`Damage applied to ${unitId}: ${armorDamage} armor, ${structureDamage} structure (reduced from ${damageAmount} to ${modifiedDamage})`);
  } else {
    logger.info(`Damage applied to ${unitId}: ${armorDamage} armor, ${structureDamage} structure`);
  }
  
  return { 
    success: true, 
    armorDamage, 
    structureDamage, 
    originalDamage: damageAmount,
    modifiedDamage,
    destroyed: unit.status.effects.includes('DESTROYED') 
  };
}

/**
 * Apply damage to infantry units with special handling for squad reduction
 * 
 * @param {Object} gameState - Current game state
 * @param {Object} unit - Infantry unit to damage
 * @param {number} damageAmount - Amount of damage to apply
 * @param {Object} options - Additional damage options
 * @returns {Object} Damage result
 */
function applyInfantryDamage(gameState, unit, damageAmount, options = {}) {
  // For infantry, damage directly reduces combat effectiveness
  // Create a total "strength" value that combines armor and structure
  const totalStrength = unit.stats.armor + unit.stats.structure;
  const currentStrength = totalStrength - unit.status.damage.armor - unit.status.damage.structure;
  
  // Calculate what percentage of the squad is being eliminated
  const damagePercentage = Math.min(damageAmount / totalStrength, 1);
  
  // Apply proportional damage to armor first, then structure
  let armorDamage = 0;
  let structureDamage = 0;
  
  // If armor remains, apply damage there first
  const remainingArmor = unit.stats.armor - unit.status.damage.armor;
  if (remainingArmor > 0) {
    armorDamage = Math.min(damageAmount, remainingArmor);
    unit.status.damage.armor += armorDamage;
    
    // If damage exceeds armor, apply remainder to structure
    if (damageAmount > armorDamage) {
      structureDamage = damageAmount - armorDamage;
      unit.status.damage.structure += structureDamage;
    }
  } else {
    // All armor gone, apply directly to structure
    structureDamage = damageAmount;
    unit.status.damage.structure += structureDamage;
  }
  
  // Calculate new strength percentage
  const newStrength = totalStrength - unit.status.damage.armor - unit.status.damage.structure;
  const strengthRatio = Math.max(0, newStrength / totalStrength);
  
  // Apply proportional reduction to combat capabilities
  if (!unit.status.squadStrength) {
    // Initialize squad strength tracking if not present
    unit.status.squadStrength = {
      original: {
        damage: { ...unit.stats.damage },
        movement: { ...unit.stats.movement }
      },
      currentRatio: 1.0
    };
  }
  
  // Update current strength ratio
  unit.status.squadStrength.currentRatio = strengthRatio;
  
  // Apply squad strength effects to damage values
  Object.keys(unit.stats.damage).forEach(range => {
    // Don't reduce damage below a minimum of 0
    const originalDamage = unit.status.squadStrength.original.damage[range];
    unit.stats.damage[range] = Math.max(0, Math.floor(originalDamage * strengthRatio));
  });
  
  // Apply squad strength effects to movement
  Object.keys(unit.stats.movement).forEach(moveType => {
    // Don't reduce movement below 1 unless unit is destroyed
    const originalMove = unit.status.squadStrength.original.movement[moveType];
    if (originalMove > 0) {
      unit.stats.movement[moveType] = Math.max(1, Math.floor(originalMove * strengthRatio));
      
      // If unit is nearly destroyed, reduce to minimum movement
      if (strengthRatio < 0.25 && !unit.status.effects.includes('DESTROYED')) {
        unit.stats.movement[moveType] = Math.min(unit.stats.movement[moveType], 1);
      }
    }
  });
  
  // Log squad reduction effects
  logger.info(`Infantry squad ${unit.id} reduced to ${Math.round(strengthRatio * 100)}% strength`);
  
  // Check for unit destruction
  if (unit.status.damage.structure >= unit.stats.structure) {
    logger.info(`Infantry squad ${unit.id} has been destroyed!`);
    unit.status.effects.push('DESTROYED');
    
    // Zero out all combat capabilities
    Object.keys(unit.stats.damage).forEach(range => {
      unit.stats.damage[range] = 0;
    });
    
    Object.keys(unit.stats.movement).forEach(moveType => {
      unit.stats.movement[moveType] = 0;
    });
  }
  
  return {
    success: true,
    armorDamage,
    structureDamage,
    originalDamage: damageAmount,
    modifiedDamage: damageAmount,
    squadStrength: strengthRatio,
    destroyed: unit.status.effects.includes('DESTROYED') 
  };
}

/**
 * Process a critical hit for a unit
 * @param {Object} gameState - Current game state
 * @param {string} unitId - ID of the unit that suffered a critical hit
 * @param {Object} options - Critical hit options (e.g., location, modifier)
 * @returns {Object} Critical hit result
 */
function processCriticalHit(gameState, unitId, options = {}) {
  const unit = gameState.battlefield.units.get(unitId);
  
  if (!unit) {
    logger.warn(`Critical hit processing failed: Unit ${unitId} not found`);
    return { success: false };
  }
  
  // Determine the critical hit table to use
  let unitTable;
  switch (unit.type) {
    case 'mech':
      unitTable = 'mech';
      break;
    case 'vehicle':
      unitTable = 'vehicle';
      break;
    case 'infantry':
      // For infantry this is just extra damage - apply directly
      const infantryCritDamage = 1;
      applyDamage(gameState, unitId, infantryCritDamage, { ...options, isCritical: true });
      
      logger.info(`Critical hit on infantry unit ${unitId}! Additional ${infantryCritDamage} damage applied.`);
      return {
        success: true,
        effect: 'INFANTRY_CASUALTIES',
        description: `Additional squad casualties (${infantryCritDamage} damage)`,
        additionalDamage: infantryCritDamage
      };
    default:
      unitTable = 'mech';
  }
  
  // Get appropriate critical hit table
  const critTable = CRITICAL_HIT_TABLES[unitTable];
  
  // Roll for critical hit location
  let critRoll = options.roll || Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
  let modifiedRoll = critRoll;
  
  // Import special abilities module
  const { applyAllSpecialAbilities, hasSpecialAbility } = require('./specialAbilities');
  
  // Apply critical roll modifiers from special abilities (e.g., HARD, PRB)
  modifiedRoll = applyAllSpecialAbilities(unit, 'modifyCriticalRoll', [modifiedRoll]);
  
  // Ensure roll is within bounds 2-12
  modifiedRoll = Math.max(2, Math.min(12, modifiedRoll));
  
  // Find the critical effect based on the roll
  const critEffect = critTable.find(entry => 
    modifiedRoll >= entry.range[0] && modifiedRoll <= entry.range[1]
  );
  
  if (!critEffect) {
    logger.warn(`No critical effect found for roll ${modifiedRoll} on ${unitTable} table`);
    return { success: false };
  }
  
  // Get the effect to apply
  const effect = critEffect.effect;
  
  // Check if any ability prevents this type of critical hit
  const preventCrit = applyAllSpecialAbilities(unit, 'preventCriticalType', [effect]);
  if (preventCrit) {
    logger.info(`Critical hit prevented for ${unitId} due to special abilities.`);
    return { success: false, prevented: true };
  }
  
  // Apply the critical effect
  logger.info(`Critical hit! ${unit.id} suffers ${effect} (roll: ${critRoll}, modified: ${modifiedRoll})`);
  
  // Apply the effect if it exists
  if (CRITICAL_EFFECTS[effect]) {
    CRITICAL_EFFECTS[effect].apply(unit);
    
    // Add to unit's critical hits list if not already there
    if (!unit.status.criticalHits) {
      unit.status.criticalHits = [];
    }
    
    // Add with description
    unit.status.criticalHits.push({
      effect,
      description: CRITICAL_EFFECTS[effect].description(unit)
    });
    
    return {
      success: true,
      roll: critRoll,
      modifiedRoll,
      effect,
      description: critEffect.description,
      prevented: false
    };
  } else {
    logger.warn(`Effect ${effect} implementation not found`);
    return { success: false };
  }
}

/**
 * Advance to the next phase
 * 
 * @param {Object} gameState - Current game state
 * @returns {string} New phase
 */
function advancePhase(gameState) {
  const currentPhase = gameState.turnData.phase;
  let nextPhase;
  
  switch (currentPhase) {
    case PHASES.SETUP:
      nextPhase = PHASES.INITIATIVE;
      break;
    case PHASES.INITIATIVE:
      nextPhase = PHASES.MOVEMENT;
      break;
    case PHASES.MOVEMENT:
      nextPhase = PHASES.COMBAT;
      break;
    case PHASES.COMBAT:
      nextPhase = PHASES.END;
      break;
    case PHASES.END:
      // Process heat dissipation before starting a new turn
      const heatResults = processHeatDissipation(gameState);
      
      // Log heat dissipation results
      Object.entries(heatResults.units).forEach(([unitId, result]) => {
        if (result.heatDissipated > 0) {
          addLogEntry(gameState, `${unitId} dissipated ${result.heatDissipated} heat.`, result);
        }
        
        if (result.heatDamage > 0) {
          addLogEntry(gameState, `${unitId} took ${result.heatDamage} damage from excess heat!`, result);
        }
      });
      
      // Start a new turn
      nextPhase = PHASES.INITIATIVE;
      gameState.turnData.round++;
      break;
    default:
      nextPhase = PHASES.INITIATIVE;
  }
  
  gameState.turnData.phase = nextPhase;
  logger.info(`Phase advanced: ${currentPhase} → ${nextPhase}`);
  
  return nextPhase;
}

/**
 * Process initiative phase
 * 
 * @param {Object} gameState - Current game state
 * @param {Object} rolls - Initiative rolls for each player
 * @returns {string} ID of the player who won initiative
 */
function processInitiative(gameState, rolls) {
  gameState.turnData.initiative.rolls = rolls;
  
  // Import special abilities module
  const { applyAllSpecialAbilities, hasSpecialAbility } = require('./specialAbilities');
  
  // Apply initiative modifiers from special abilities
  let playerRoll = rolls.player || 0;
  let aiRoll = rolls.ai || 0;
  
  // Apply initiative modifiers from units with special abilities
  gameState.players.get('player').units.forEach(unitId => {
    const unit = gameState.battlefield.units.get(unitId);
    if (unit && !unit.status.effects.includes('DESTROYED')) {
      // Add modifiers from abilities that affect initiative
      const initiativeBonus = applyAllSpecialAbilities(unit, 'modifyInitiative', [0]);
      if (initiativeBonus > 0) {
        playerRoll += initiativeBonus;
        logger.info(`Player gets +${initiativeBonus} initiative from ${unitId}`);
      }
    }
  });
  
  gameState.players.get('ai').units.forEach(unitId => {
    const unit = gameState.battlefield.units.get(unitId);
    if (unit && !unit.status.effects.includes('DESTROYED')) {
      // Add modifiers from abilities that affect initiative
      const initiativeBonus = applyAllSpecialAbilities(unit, 'modifyInitiative', [0]);
      if (initiativeBonus > 0) {
        aiRoll += initiativeBonus;
        logger.info(`AI gets +${initiativeBonus} initiative from ${unitId}`);
      }
    }
  });
  
  // Store modified rolls
  const modifiedRolls = { 
    player: playerRoll, 
    ai: aiRoll,
    baseRolls: { ...rolls }
  };
  
  // Determine initiative winner
  const winner = playerRoll > aiRoll ? 'player' : 
                 aiRoll > playerRoll ? 'ai' : 
                 Math.random() < 0.5 ? 'player' : 'ai'; // If tied, randomly determine
  
  // Set active player to initiative winner
  gameState.turnData.activePlayer = winner;
  gameState.turnData.initiative.winner = winner;
  
  logger.info(`Initiative result: Player ${playerRoll} vs AI ${aiRoll} - Winner: ${winner}`);
  
  addLogEntry(gameState, `${winner === 'player' ? 'Player' : 'AI'} won initiative (${playerRoll} vs ${aiRoll})`, modifiedRolls);
  
  return winner;
}

/**
 * Check if game is over
 * 
 * @param {Object} gameState - Current game state
 * @returns {Object} Game over status and winner
 */
function checkGameOver(gameState) {
  // Get unit lists
  const playerUnits = gameState.players.get('player').units;
  const aiUnits = gameState.players.get('ai').units;
  
  // Check if game has started - only check for game over if there are units on both sides
  if (playerUnits.length === 0 || aiUnits.length === 0) {
    return { gameOver: false };
  }
  
  // Check if all player units are destroyed
  const playerUnitsDestroyed = playerUnits.every(unitId => {
    const unit = gameState.battlefield.units.get(unitId);
    if (!unit) return true; // Consider missing units as destroyed
    return unit.status.effects.includes('DESTROYED');
  });
  
  // Check if all AI units are destroyed
  const aiUnitsDestroyed = aiUnits.every(unitId => {
    const unit = gameState.battlefield.units.get(unitId);
    if (!unit) return true; // Consider missing units as destroyed
    return unit.status.effects.includes('DESTROYED');
  });
  
  // Game is over if either side has all units destroyed
  if (playerUnitsDestroyed) {
    return { gameOver: true, winner: 'ai' };
  } else if (aiUnitsDestroyed) {
    return { gameOver: true, winner: 'player' };
  }
  
  return { gameOver: false };
}

/**
 * Switch the active player
 * 
 * @param {Object} gameState - Current game state
 * @returns {string} ID of the new active player
 */
function switchActivePlayer(gameState) {
  const currentPlayer = gameState.turnData.activePlayer;
  const newActivePlayer = currentPlayer === 'player' ? 'ai' : 'player';
  
  gameState.turnData.activePlayer = newActivePlayer;
  logger.info(`Active player switched: ${currentPlayer} → ${newActivePlayer}`);
  
  return newActivePlayer;
}

/**
 * Add an entry to the battle log
 * 
 * @param {Object} gameState - Current game state
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 */
function addLogEntry(gameState, message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    round: gameState.turnData.round,
    phase: gameState.turnData.phase,
    message,
    data
  };
  
  gameState.battleLog.push(entry);
}

/**
 * Add heat to a unit
 * 
 * @param {Object} gameState - Current game state
 * @param {string} unitId - ID of the unit
 * @param {number} heatAmount - Amount of heat to add
 * @returns {Object} Heat result with new heat level and any heat effects
 */
function addHeat(gameState, unitId, heatAmount) {
  const unit = gameState.battlefield.units.get(unitId);
  
  if (!unit) {
    logger.warn(`Heat application failed: Unit ${unitId} not found`);
    return { success: false };
  }
  
  // Only 'mech' type units use heat
  if (!unit.type.includes('mech')) {
    logger.info(`Heat application skipped: Unit ${unitId} is not a mech (${unit.type})`);
    return { success: true, heatAdded: 0, newHeat: 0, effects: [] };
  }
  
  // Add heat to current level
  const currentHeat = unit.status.heat || 0;
  const newHeat = Math.min(currentHeat + heatAmount, unit.stats.heat.capacity);
  unit.status.heat = newHeat;
  
  // Determine heat effects
  const effects = getHeatEffects(unit);
  
  logger.info(`Heat applied to ${unitId}: +${heatAmount} (Total: ${newHeat}/${unit.stats.heat.capacity})`);
  
  // Apply effects
  if (effects.length > 0) {
    unit.status.effects = unit.status.effects.filter(e => !e.startsWith('HEAT_'));
    effects.forEach(effect => unit.status.effects.push(effect));
    logger.info(`Heat effects applied to ${unitId}: ${effects.join(', ')}`);
  }
  
  return { 
    success: true, 
    heatAdded: heatAmount,
    newHeat,
    effects
  };
}

/**
 * Get heat effects for a unit based on current heat level
 * 
 * @param {Object} unit - The unit to check
 * @returns {Array} Array of heat effects
 */
function getHeatEffects(unit) {
  if (!unit.type.includes('mech')) return [];
  
  const currentHeat = unit.status.heat || 0;
  const heatCapacity = unit.stats.heat.capacity;
  const effects = [];
  
  // Heat effects are added at different thresholds
  // These are simplified from full BattleTech rules
  
  // At 50% heat capacity: +1 to attack rolls
  if (currentHeat >= (heatCapacity * 0.5)) {
    effects.push('HEAT_ATTACK_PENALTY_1');
  }
  
  // At 75% heat capacity: +2 to attack rolls, -1" to movement
  if (currentHeat >= (heatCapacity * 0.75)) {
    effects.push('HEAT_ATTACK_PENALTY_2');
    effects.push('HEAT_MOVEMENT_PENALTY');
  }
  
  // At 100% heat capacity: Shutdown risk and automatic damage
  if (currentHeat >= heatCapacity) {
    effects.push('HEAT_SHUTDOWN_RISK');
    effects.push('HEAT_AUTO_DAMAGE');
  }
  
  return effects;
}

/**
 * Apply heat effects during the movement phase
 * 
 * @param {Object} gameState - Current game state
 * @param {string} unitId - ID of the unit
 * @returns {Object} Results of heat application
 */
function applyHeatMovementEffects(gameState, unitId) {
  const unit = gameState.battlefield.units.get(unitId);
  
  if (!unit || !unit.type.includes('mech')) {
    return { affected: false };
  }
  
  const heatEffects = unit.status.effects.filter(e => e.startsWith('HEAT_'));
  const result = { affected: false, effects: [] };
  
  // Check if unit has movement penalties from heat
  if (heatEffects.includes('HEAT_MOVEMENT_PENALTY')) {
    result.affected = true;
    result.effects.push('Movement reduced by 1"');
    logger.info(`Unit ${unitId} has reduced movement due to heat`);
  }
  
  return result;
}

/**
 * Apply heat effects during the combat phase
 * 
 * @param {Object} gameState - Current game state
 * @param {string} unitId - ID of the unit
 * @returns {Object} Results of heat application with modifiers for combat
 */
function applyHeatCombatEffects(gameState, unitId) {
  const unit = gameState.battlefield.units.get(unitId);
  
  if (!unit || !unit.type.includes('mech')) {
    return { toHitModifier: 0, affected: false };
  }
  
  const heatEffects = unit.status.effects.filter(e => e.startsWith('HEAT_'));
  const result = { toHitModifier: 0, affected: false, effects: [] };
  
  // Apply to-hit modifiers from heat
  if (heatEffects.includes('HEAT_ATTACK_PENALTY_2')) {
    result.toHitModifier = 2;
    result.affected = true;
    result.effects.push('+2 to-hit penalty');
  } else if (heatEffects.includes('HEAT_ATTACK_PENALTY_1')) {
    result.toHitModifier = 1;
    result.affected = true;
    result.effects.push('+1 to-hit penalty');
  }
  
  return result;
}

/**
 * Process heat dissipation for all units in the End phase
 * 
 * @param {Object} gameState - Current game state
 * @returns {Object} Results of heat dissipation
 */
function processHeatDissipation(gameState) {
  const results = { units: {} };
  
  // Process each unit
  gameState.battlefield.units.forEach((unit, unitId) => {
    // Only process mechs (other unit types don't have heat)
    if (!unit.type.includes('mech')) return;
    
    // Skip destroyed units
    if (unit.status.effects.includes('DESTROYED')) return;
    
    // Initialize unit result
    results.units[unitId] = {
      initialHeat: unit.status.heat,
      dissipated: 0,
      finalHeat: unit.status.heat,
      heatSource: [],
      coolingSource: []
    };
    
    // Handle engine damage adding heat
    if (unit.status.engineDamage) {
      const engineHeat = unit.status.engineDamage * 2; // Each engine crit adds 2 heat
      unit.status.heat += engineHeat;
      results.units[unitId].heatSource.push(`+${engineHeat} from engine damage`);
      logger.info(`Unit ${unitId} generated ${engineHeat} heat from engine damage`);
    }
    
    // Normal heat dissipation - only for active units
    if (!unit.status.effects.includes('SHUTDOWN')) {
      // Base cooling is 1 point
      const coolingAmount = 1;
      unit.status.heat = Math.max(0, unit.status.heat - coolingAmount);
      
      results.units[unitId].dissipated += coolingAmount;
      results.units[unitId].coolingSource.push(`-${coolingAmount} normal dissipation`);
      
      logger.info(`Unit ${unitId} dissipated ${coolingAmount} heat in End phase`);
    } else {
      logger.info(`Unit ${unitId} is shutdown and cannot dissipate heat`);
    }
    
    // Auto-damage from extreme heat
    if (unit.status.effects.includes('HEAT_AUTO_DAMAGE')) {
      // Apply 1 point of internal damage
      unit.status.damage.structure += 1;
      
      logger.info(`Unit ${unitId} took 1 internal damage from extreme heat`);
      
      // Check if the unit is destroyed
      if (unit.status.damage.structure >= unit.stats.structure) {
        unit.status.effects.push('DESTROYED');
        logger.info(`Unit ${unitId} destroyed by heat damage!`);
      }
    }
    
    // Update final heat value in results
    results.units[unitId].finalHeat = unit.status.heat;
    
    // Update heat effects
    const previousEffects = unit.status.effects.filter(e => e.startsWith('HEAT_'));
    const newEffects = getHeatEffects(unit);
    
    // Remove old heat effects
    unit.status.effects = unit.status.effects.filter(e => !e.startsWith('HEAT_'));
    
    // Add new heat effects
    newEffects.forEach(effect => {
      unit.status.effects.push(effect);
    });
    
    // Log significant heat effect changes
    if (!previousEffects.includes('HEAT_SHUTDOWN_RISK') && newEffects.includes('HEAT_SHUTDOWN_RISK')) {
      logger.info(`Unit ${unitId} is now at risk of shutdown due to heat level`);
    }
    
    if (previousEffects.includes('HEAT_SHUTDOWN_RISK') && !newEffects.includes('HEAT_SHUTDOWN_RISK')) {
      logger.info(`Unit ${unitId} is no longer at risk of shutdown from heat`);
    }
  });
  
  return results;
}

/**
 * Process shutdown checks for units with excessive heat
 * 
 * @param {Object} gameState - Current game state
 * @returns {Object} Results of shutdown checks
 */
function processShutdownChecks(gameState) {
  const results = { units: {} };
  
  // Process each unit
  gameState.battlefield.units.forEach((unit, unitId) => {
    // Only mechs can shut down from heat
    if (!unit.type.includes('mech')) return;
    
    // Skip destroyed units
    if (unit.status.effects.includes('DESTROYED')) return;
    
    // Skip units already shutdown
    if (unit.status.effects.includes('SHUTDOWN')) return;
    
    // Check if unit has shutdown risk
    if (unit.status.effects.includes('HEAT_SHUTDOWN_RISK')) {
      // Roll 2d6 for shutdown check - 8+ avoids shutdown
      const rollResult = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
      const shutdownThreshold = 8;
      
      logger.info(`Shutdown check for ${unitId}: Rolled ${rollResult}, needs ${shutdownThreshold}+ to avoid shutdown`);
      
      if (rollResult < shutdownThreshold) {
        // Unit shuts down
        unit.status.effects.push('SHUTDOWN');
        logger.info(`Unit ${unitId} has shut down due to excessive heat!`);
        
        results.units[unitId] = {
          rolled: rollResult,
          threshold: shutdownThreshold,
          shutdown: true
        };
      } else {
        // Unit avoids shutdown
        logger.info(`Unit ${unitId} avoided shutdown despite excessive heat`);
        
        results.units[unitId] = {
          rolled: rollResult,
          threshold: shutdownThreshold,
          shutdown: false
        };
      }
    }
  });
  
  return results;
}

/**
 * Attempt to restart a shutdown unit
 * 
 * @param {Object} gameState - Current game state
 * @param {string} unitId - ID of the unit to attempt startup
 * @returns {Object} Result of the startup attempt
 */
function attemptStartup(gameState, unitId) {
  const unit = gameState.battlefield.units.get(unitId);
  
  if (!unit) {
    logger.warn(`Startup attempt failed: Unit ${unitId} not found`);
    return { success: false, message: 'Unit not found' };
  }
  
  // Only mechs can be shutdown from heat
  if (!unit.type.includes('mech')) {
    return { success: false, message: 'Not a mech unit' };
  }
  
  // Check if unit is actually shutdown
  if (!unit.status.effects.includes('SHUTDOWN')) {
    return { success: false, message: 'Unit is not shutdown' };
  }
  
  // Roll 2d6 for startup check - 4+ succeeds
  const rollResult = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
  const startupThreshold = 4;
  
  logger.info(`Startup check for ${unitId}: Rolled ${rollResult}, needs ${startupThreshold}+ to restart`);
  
  if (rollResult >= startupThreshold) {
    // Unit restarts
    unit.status.effects = unit.status.effects.filter(effect => effect !== 'SHUTDOWN');
    logger.info(`Unit ${unitId} has successfully restarted`);
    
    return {
      success: true,
      rolled: rollResult,
      threshold: startupThreshold,
      restarted: true
    };
  } else {
    // Startup failed
    logger.info(`Unit ${unitId} failed to restart`);
    
    return {
      success: true,
      rolled: rollResult,
      threshold: startupThreshold,
      restarted: false
    };
  }
}

// Export all functions and constants
module.exports = {
  // Constants
  PHASES,
  DIRECTIONS,
  TERRAIN_TYPES,
  TERRAIN_EFFECTS,
  VEHICLE_MOVEMENT_MODIFIERS,
  CRITICAL_HIT_TABLES,
  
  // Game state functions
  createGameState,
  addUnit,
  setTerrain,
  getTerrainAt,
  getTerrainEffect,
  moveUnit,
  processAttack,
  applySpecialAbility,
  applyDamage,
  processCriticalHit,
  advancePhase,
  processInitiative,
  checkGameOver,
  switchActivePlayer,
  addLogEntry,
  
  // Heat management
  addHeat,
  getHeatEffects,
  applyHeatMovementEffects,
  applyHeatCombatEffects,
  processHeatDissipation,
  processShutdownChecks,
  attemptStartup
}; 