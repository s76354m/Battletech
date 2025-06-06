/**
 * Unit templates for Alpha Strike AI Game Master
 */

// Basic BattleMech templates
const mechs = {
  // Light Mechs
  'locust': {
    type: 'mech',
    name: 'Locust LCT-1V',
    movement: { walk: 8, run: 12, jump: 0 },
    armor: 2,
    structure: 1,
    skill: 4,
    tmm: 2,
    damage: { short: 1, medium: 1, long: 0, extreme: 0 },
    specialAbilities: []
  },
  'jenner': {
    type: 'mech',
    name: 'Jenner JR7-D',
    movement: { walk: 8, run: 12, jump: 8 },
    armor: 3,
    structure: 1,
    skill: 4,
    tmm: 2,
    damage: { short: 2, medium: 2, long: 0, extreme: 0 },
    specialAbilities: ['JJ']
  },
  
  // Medium Mechs
  'shadow-hawk': {
    type: 'mech',
    name: 'Shadow Hawk SHD-2H',
    movement: { walk: 5, run: 8, jump: 5 },
    armor: 5,
    structure: 2,
    skill: 4,
    tmm: 1,
    damage: { short: 2, medium: 2, long: 1, extreme: 0 },
    specialAbilities: ['JJ']
  },
  'hunchback': {
    type: 'mech',
    name: 'Hunchback HBK-4G',
    movement: { walk: 4, run: 6, jump: 0 },
    armor: 6,
    structure: 2,
    skill: 4,
    tmm: 1,
    damage: { short: 3, medium: 2, long: 0, extreme: 0 },
    specialAbilities: []
  },
  
  // Heavy Mechs
  'marauder': {
    type: 'mech',
    name: 'Marauder MAD-3R',
    movement: { walk: 4, run: 6, jump: 0 },
    armor: 6,
    structure: 3,
    skill: 3,
    tmm: 1,
    damage: { short: 3, medium: 3, long: 2, extreme: 0 },
    specialAbilities: []
  },
  'warhammer': {
    type: 'mech',
    name: 'Warhammer WHM-6R',
    movement: { walk: 4, run: 6, jump: 0 },
    armor: 6,
    structure: 3,
    skill: 4,
    tmm: 1,
    damage: { short: 3, medium: 3, long: 2, extreme: 0 },
    specialAbilities: []
  },
  
  // Assault Mechs
  'atlas': {
    type: 'mech',
    name: 'Atlas AS7-D',
    movement: { walk: 3, run: 5, jump: 0 },
    armor: 8,
    structure: 4,
    skill: 4,
    tmm: 0,
    damage: { short: 4, medium: 4, long: 3, extreme: 1 },
    specialAbilities: []
  },
  'battlemaster': {
    type: 'mech',
    name: 'Battlemaster BLR-1G',
    movement: { walk: 4, run: 6, jump: 0 },
    armor: 7,
    structure: 4,
    skill: 4,
    tmm: 1,
    damage: { short: 4, medium: 3, long: 2, extreme: 0 },
    specialAbilities: []
  }
};

// Vehicle templates
const vehicles = {
  // Light Vehicles
  'striker': {
    type: 'vehicle',
    vehicleType: 'hover',
    name: 'Striker Light Tank',
    movement: { walk: 8, run: 12, jump: 0 },
    armor: 3,
    structure: 1,
    skill: 5,
    tmm: 2,
    damage: { short: 2, medium: 2, long: 1, extreme: 0 },
    specialAbilities: ['HVY-CHAS']
  },
  'scorpion': {
    type: 'vehicle',
    vehicleType: 'tracked',
    name: 'Scorpion Light Tank',
    movement: { walk: 6, run: 9, jump: 0 },
    armor: 4,
    structure: 1,
    skill: 5,
    tmm: 1,
    damage: { short: 2, medium: 2, long: 0, extreme: 0 },
    specialAbilities: ['ARM']
  },
  
  // Medium Vehicles
  'vedette': {
    type: 'vehicle',
    vehicleType: 'tracked',
    name: 'Vedette Medium Tank',
    movement: { walk: 5, run: 8, jump: 0 },
    armor: 5,
    structure: 2,
    skill: 5,
    tmm: 1,
    damage: { short: 2, medium: 2, long: 1, extreme: 0 },
    specialAbilities: ['ARM']
  },
  'harasser': {
    type: 'vehicle',
    vehicleType: 'hover',
    name: 'Harasser Missile Platform',
    movement: { walk: 8, run: 12, jump: 0 },
    armor: 2,
    structure: 1,
    skill: 4,
    tmm: 2,
    damage: { short: 1, medium: 1, long: 1, extreme: 0 },
    specialAbilities: ['SRCH']
  },
  
  // Heavy Vehicles
  'demolisher': {
    type: 'vehicle',
    vehicleType: 'tracked',
    name: 'Demolisher Heavy Tank',
    movement: { walk: 3, run: 5, jump: 0 },
    armor: 7,
    structure: 3,
    skill: 5,
    tmm: 0,
    damage: { short: 4, medium: 3, long: 0, extreme: 0 },
    specialAbilities: ['ARM', 'HVY-CHAS']
  },
  'bulldog': {
    type: 'vehicle',
    vehicleType: 'tracked',
    name: 'Bulldog Heavy Tank',
    movement: { walk: 4, run: 6, jump: 0 },
    armor: 6,
    structure: 3,
    skill: 4,
    tmm: 1,
    damage: { short: 3, medium: 3, long: 2, extreme: 0 },
    specialAbilities: ['ARM']
  },
  
  // VTOL
  'warrior': {
    type: 'vehicle',
    vehicleType: 'vtol',
    name: 'Warrior Attack Helicopter',
    movement: { walk: 10, run: 15, jump: 0 },
    armor: 1,
    structure: 1,
    skill: 4,
    tmm: 3,
    damage: { short: 1, medium: 1, long: 1, extreme: 0 },
    specialAbilities: ['VTOL', 'RCN']
  },
  
  // New Tracked Vehicles
  'manticore': {
    type: 'vehicle',
    vehicleType: 'tracked',
    name: 'Manticore Heavy Tank',
    movement: { walk: 4, run: 6, jump: 0 },
    armor: 7,
    structure: 3,
    skill: 4,
    tmm: 1,
    damage: { short: 3, medium: 3, long: 2, extreme: 1 },
    specialAbilities: ['ARM', 'HVY-CHAS', 'BLDG']
  },
  'partisan': {
    type: 'vehicle',
    vehicleType: 'tracked',
    name: 'Partisan Heavy Tank',
    movement: { walk: 3, run: 5, jump: 0 },
    armor: 6,
    structure: 3,
    skill: 4,
    tmm: 0,
    damage: { short: 3, medium: 3, long: 3, extreme: 2 },
    specialAbilities: ['HVY-CHAS', 'AA']
  },
  
  // New Wheeled Vehicles
  'flatbed-truck': {
    type: 'vehicle',
    vehicleType: 'wheeled',
    name: 'Flatbed Truck',
    movement: { walk: 6, run: 10, jump: 0 },
    armor: 2,
    structure: 1,
    skill: 5,
    tmm: 1,
    damage: { short: 0, medium: 0, long: 0, extreme: 0 },
    specialAbilities: ['CAR5']
  },
  'packrat': {
    type: 'vehicle',
    vehicleType: 'wheeled',
    name: 'Packrat LRPV',
    movement: { walk: 7, run: 11, jump: 0 },
    armor: 2,
    structure: 1,
    skill: 4,
    tmm: 2,
    damage: { short: 1, medium: 1, long: 0, extreme: 0 },
    specialAbilities: ['RCN', 'SRCH']
  },
  'swiftwind': {
    type: 'vehicle',
    vehicleType: 'wheeled',
    name: 'Swiftwind Scout Car',
    movement: { walk: 8, run: 12, jump: 0 },
    armor: 2,
    structure: 1,
    skill: 4,
    tmm: 2,
    damage: { short: 1, medium: 0, long: 0, extreme: 0 },
    specialAbilities: ['RCN', 'ECM']
  },
  
  // New Hover Vehicles
  'pegasus': {
    type: 'vehicle',
    vehicleType: 'hover',
    name: 'Pegasus Scout Hovertank',
    movement: { walk: 10, run: 15, jump: 0 },
    armor: 2,
    structure: 1,
    skill: 4,
    tmm: 3,
    damage: { short: 2, medium: 1, long: 0, extreme: 0 },
    specialAbilities: ['RCN', 'AMP']
  },
  'condor': {
    type: 'vehicle',
    vehicleType: 'hover',
    name: 'Condor Hover Tank',
    movement: { walk: 8, run: 12, jump: 0 },
    armor: 4,
    structure: 2,
    skill: 4,
    tmm: 2,
    damage: { short: 3, medium: 2, long: 1, extreme: 0 },
    specialAbilities: ['AMP']
  },
  
  // New VTOLs
  'yellow-jacket': {
    type: 'vehicle',
    vehicleType: 'vtol',
    name: 'Yellow Jacket Gunship',
    movement: { walk: 11, run: 17, jump: 0 },
    armor: 2,
    structure: 1,
    skill: 4,
    tmm: 3,
    damage: { short: 2, medium: 1, long: 0, extreme: 0 },
    specialAbilities: ['VTOL', 'AMP']
  },
  'karnov': {
    type: 'vehicle',
    vehicleType: 'vtol',
    name: 'Karnov UR Transport',
    movement: { walk: 7, run: 11, jump: 0 },
    armor: 3,
    structure: 2,
    skill: 5,
    tmm: 2,
    damage: { short: 1, medium: 0, long: 0, extreme: 0 },
    specialAbilities: ['VTOL', 'CAR10', 'TRN5']
  }
};

// Basic Infantry templates
const infantry = {
  'rifle-squad': {
    type: 'infantry',
    name: 'Rifle Infantry Squad',
    movement: { walk: 3, run: 5, jump: 0 },
    armor: 2,
    structure: 1,
    skill: 5,
    tmm: 1,
    damage: { short: 1, medium: 0, long: 0, extreme: 0 },
    specialAbilities: []
  },
  'jump-infantry': {
    type: 'infantry',
    name: 'Jump Infantry Platoon',
    movement: { walk: 3, run: 5, jump: 5 },
    armor: 2,
    structure: 1,
    skill: 5,
    tmm: 2,
    damage: { short: 1, medium: 0, long: 0, extreme: 0 },
    specialAbilities: ['JJ']
  },
  // New specialized infantry types
  'motorized-infantry': {
    type: 'infantry',
    name: 'Motorized Infantry Platoon',
    movement: { walk: 5, run: 8, jump: 0 },
    armor: 2,
    structure: 1, 
    skill: 5,
    tmm: 2,
    damage: { short: 1, medium: 0, long: 0, extreme: 0 },
    specialAbilities: ['MOB']
  },
  'missile-infantry': {
    type: 'infantry',
    name: 'Missile Infantry Platoon',
    movement: { walk: 2, run: 4, jump: 0 },
    armor: 2,
    structure: 1,
    skill: 4,
    tmm: 1,
    damage: { short: 1, medium: 1, long: 1, extreme: 0 },
    specialAbilities: ['LRM', 'IF']
  },
  'anti-mech-infantry': {
    type: 'infantry',
    name: 'Anti-Mech Infantry Squad',
    movement: { walk: 3, run: 5, jump: 0 },
    armor: 2,
    structure: 1,
    skill: 4,
    tmm: 1,
    damage: { short: 1, medium: 0, long: 0, extreme: 0 },
    specialAbilities: ['AC', 'MEL']
  },
  'battle-armor': {
    type: 'infantry',
    name: 'Battle Armor Squad',
    movement: { walk: 3, run: 5, jump: 5 },
    armor: 4,
    structure: 1,
    skill: 3,
    tmm: 2,
    damage: { short: 2, medium: 1, long: 0, extreme: 0 },
    specialAbilities: ['JJ', 'AC', 'ARM', 'MEL']
  },
  'heavy-battle-armor': {
    type: 'infantry',
    name: 'Heavy Battle Armor Squad',
    movement: { walk: 2, run: 3, jump: 2 },
    armor: 5,
    structure: 2,
    skill: 3,
    tmm: 1,
    damage: { short: 3, medium: 1, long: 0, extreme: 0 },
    specialAbilities: ['JJ', 'AC', 'ARM', 'HARD', 'MEL']
  },
  'stealth-infantry': {
    type: 'infantry',
    name: 'Stealth Infantry Squad',
    movement: { walk: 3, run: 5, jump: 5 },
    armor: 3,
    structure: 1,
    skill: 3,
    tmm: 3,
    damage: { short: 1, medium: 0, long: 0, extreme: 0 },
    specialAbilities: ['JJ', 'ECM', 'AC']
  }
};

// Unit ability definitions
const UNIT_ABILITIES = {
  // Movement Abilities
  'JJ': {
    name: 'Jump Jets',
    description: 'Allows jump movement, ignoring terrain movement costs'
  },
  'VTOL': {
    name: 'Vertical Take-Off and Landing',
    description: 'Vertical Take-Off and Landing, can ignore terrain movement costs but vulnerable to crashing'
  },
  'AMP': {
    name: 'Amphibious',
    description: 'Can move through water terrain without penalty'
  },
  'MOB': {
    name: 'Mobile',
    description: 'Infantry with enhanced mobility equipment for faster movement'
  },
  
  // Defensive Abilities
  'ARM': {
    name: 'Armored',
    description: 'Unit ignores 1 point of damage during damage resolution'
  },
  'HVY-CHAS': {
    name: 'Heavy Chassis',
    description: '+1 structure point to total structure'
  },
  'HARD': {
    name: 'Hardened Armor',
    description: 'Reduces critical hit chances by 1'
  },
  
  // Utility Abilities
  'RCN': {
    name: 'Recon',
    description: 'Provides +1 to initiative rolls when active'
  },
  'SRCH': {
    name: 'Search Light',
    description: 'Negates night vision penalties in a 24" radius around the unit'
  },
  'BLDG': {
    name: 'Bulldozer',
    description: 'Can clear light woods and create defensive positions'
  },
  'ECM': {
    name: 'Electronic Countermeasures',
    description: 'Provides +1 TMM to all friendly units within 2 hexes'
  },
  'CAR5': {
    name: 'Cargo (5)',
    description: 'Can transport 5 tons of cargo'
  },
  'CAR10': {
    name: 'Cargo (10)',
    description: 'Can transport 10 tons of cargo'
  },
  'TRN5': {
    name: 'Transport (5)',
    description: 'Can transport 5 infantry units'
  },
  'AA': {
    name: 'Anti-Aircraft',
    description: '+1 to attack rolls against airborne units'
  },
  // Combat Abilities
  'AC': {
    name: 'Anti-\'Mech',
    description: 'Infantry with this ability can use its full damage value against \'Mechs and perform special anti-\'Mech attacks'
  },
  'IF': {
    name: 'Indirect Fire',
    description: 'Can make indirect attacks with +1 to-hit modifier'
  },
  'LRM': {
    name: 'Long-Range Missiles',
    description: 'Has missile weapons that can use indirect fire'
  }
};

// Combine all templates
const unitTemplates = {
  ...mechs,
  ...vehicles,
  ...infantry
};

/**
 * Get a unit template by name
 * @param {string} templateName - Name of the template
 * @returns {Object|null} Unit template or null if not found
 */
function getUnitTemplate(templateName) {
  const normalizedName = templateName.toLowerCase();
  return unitTemplates[normalizedName] || null;
}

/**
 * List all available unit templates
 * @returns {Array} Array of template names
 */
function listUnitTemplates() {
  return Object.keys(unitTemplates);
}

/**
 * List all available unit templates of a specific type
 * @param {string} type - Type of units to list
 * @returns {Array} Array of template names
 */
function listUnitTemplatesByType(type) {
  return Object.entries(unitTemplates)
    .filter(([_, unit]) => unit.type === type)
    .map(([name, _]) => name);
}

/**
 * List all available unit templates of a specific vehicle type
 * @param {string} vehicleType - Type of vehicle (tracked, wheeled, hover, vtol)
 * @returns {Array} Array of template names
 */
function listUnitTemplatesByVehicleType(vehicleType) {
  return Object.entries(unitTemplates)
    .filter(([_, unit]) => unit.type === 'vehicle' && unit.vehicleType === vehicleType)
    .map(([name, _]) => name);
}

/**
 * Get a random unit template
 * @param {string} [type] - Optional type filter (mech, vehicle, infantry)
 * @param {string} [vehicleType] - Optional vehicle type filter (tracked, wheeled, hover, vtol)
 * @returns {Object} Random unit template
 */
function getRandomTemplate(type, vehicleType) {
  const templates = Object.entries(unitTemplates).filter(([_, unit]) => {
    const typeMatch = !type || unit.type === type;
    const vehicleTypeMatch = !vehicleType || (unit.type === 'vehicle' && unit.vehicleType === vehicleType);
    return typeMatch && (type !== 'vehicle' || vehicleTypeMatch);
  });
  
  if (templates.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * templates.length);
  return templates[randomIndex][1];
}

/**
 * Get details about a specific special ability
 * @param {string} abilityCode - Ability code
 * @returns {Object|null} Ability details or null if not found
 */
function getAbilityDetails(abilityCode) {
  return UNIT_ABILITIES[abilityCode] || null;
}

module.exports = {
  getUnitTemplate,
  listUnitTemplates,
  listUnitTemplatesByType,
  listUnitTemplatesByVehicleType,
  getRandomTemplate,
  getAbilityDetails,
  UNIT_ABILITIES
}; 