/**
 * Map Generator for Alpha Strike
 * 
 * This module provides both predefined map templates and procedurally 
 * generated maps with various terrain features. It supports different 
 * battlefield sizes and terrain distributions.
 */

const defaultMapWidth = 20;
const defaultMapHeight = 20;

// Terrain types with their properties
const TERRAIN_TYPES = {
  CLEAR: {
    name: 'clear',
    movementCost: 1,
    toHitModifier: 0,
    description: 'Open ground with no movement or combat penalties'
  },
  LIGHT_WOODS: { 
    name: 'light_woods',
    movementCost: 1.5, // Movement is half speed
    toHitModifier: 1,
    description: 'Scattered trees providing some cover'
  },
  HEAVY_WOODS: {
    name: 'heavy_woods',
    movementCost: 2, // Movement is half speed
    toHitModifier: 2,
    description: 'Dense forest providing significant cover'
  },
  WATER: {
    name: 'water',
    movementCost: 1.5,
    toHitModifier: 0,
    heatDissipation: 2, // Extra heat dissipation
    description: 'Bodies of water that can help with heat management'
  },
  ROUGH: {
    name: 'rough',
    movementCost: 1.5,
    toHitModifier: 1,
    description: 'Rough terrain with rocks and uneven ground'
  },
  HILLS: {
    name: 'hills',
    movementCost: 2,
    toHitModifier: 1,
    elevationBonus: true,
    description: 'Elevated terrain providing height advantage'
  },
  BUILDING: {
    name: 'building',
    movementCost: 2,
    toHitModifier: 2,
    cover: true,
    description: 'Urban structures providing cover and blocking movement'
  },
  RUBBLE: {
    name: 'rubble',
    movementCost: 1.5,
    toHitModifier: 1,
    description: 'Destroyed buildings and debris'
  }
};

/**
 * Generate a blank map with clear terrain
 * @param {number} width - Map width
 * @param {number} height - Map height
 * @returns {Map<string, string>} - Map with position keys and terrain values
 */
function generateBlankMap(width = defaultMapWidth, height = defaultMapHeight) {
  const terrainMap = new Map();
  
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      terrainMap.set(`${x},${y}`, TERRAIN_TYPES.CLEAR.name);
    }
  }
  
  return terrainMap;
}

/**
 * Generate a random map with varied terrain
 * @param {Object} options - Map generation options
 * @returns {Map<string, string>} - Map with position keys and terrain values
 */
function generateRandomMap(options = {}) {
  const {
    width = defaultMapWidth,
    height = defaultMapHeight,
    terrainDistribution = {
      [TERRAIN_TYPES.CLEAR.name]: 0.5,      // 50% clear terrain
      [TERRAIN_TYPES.LIGHT_WOODS.name]: 0.2, // 20% light woods
      [TERRAIN_TYPES.HEAVY_WOODS.name]: 0.1, // 10% heavy woods
      [TERRAIN_TYPES.WATER.name]: 0.1,       // 10% water
      [TERRAIN_TYPES.ROUGH.name]: 0.05,      // 5% rough terrain
      [TERRAIN_TYPES.HILLS.name]: 0.05       // 5% hills
    },
    clustering = 0.65, // Higher value means more clustered terrain
    riverChance = 0.3, // Chance of adding a river
    roadChance = 0.4   // Chance of adding roads
  } = options;
  
  // Start with a blank map
  const terrainMap = generateBlankMap(width, height);
  
  // Create initial random terrain
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const terrainRoll = Math.random();
      let cumulativeProbability = 0;
      let terrainType = TERRAIN_TYPES.CLEAR.name;
      
      for (const [terrain, probability] of Object.entries(terrainDistribution)) {
        cumulativeProbability += probability;
        if (terrainRoll < cumulativeProbability) {
          terrainType = terrain;
          break;
        }
      }
      
      terrainMap.set(`${x},${y}`, terrainType);
    }
  }
  
  // Apply terrain clustering to make more natural-looking features
  applyTerrainClustering(terrainMap, width, height, clustering);
  
  // Add a river if the random chance hits
  if (Math.random() < riverChance) {
    addRiver(terrainMap, width, height);
  }
  
  // Add roads if the random chance hits
  if (Math.random() < roadChance) {
    addRoads(terrainMap, width, height);
  }
  
  return terrainMap;
}

/**
 * Apply clustering to terrain to make more natural-looking features
 * @param {Map<string, string>} terrainMap - The map to modify
 * @param {number} width - Map width
 * @param {number} height - Map height
 * @param {number} clusteringFactor - How strongly terrain should cluster (0-1)
 */
function applyTerrainClustering(terrainMap, width, height, clusteringFactor) {
  // Make a copy of the original map
  const originalMap = new Map(terrainMap);
  
  // Apply cellular automata-like rules to cluster similar terrain
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const currentTerrain = originalMap.get(`${x},${y}`);
      
      // Look at 8 neighboring cells
      const neighbors = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            neighbors.push(originalMap.get(`${nx},${ny}`));
          }
        }
      }
      
      // Count occurrences of each terrain type in neighbors
      const terrainCounts = {};
      for (const terrain of neighbors) {
        if (!terrainCounts[terrain]) {
          terrainCounts[terrain] = 1;
        } else {
          terrainCounts[terrain]++;
        }
      }
      
      // Find the most common neighboring terrain
      let mostCommonTerrain = currentTerrain;
      let maxCount = 0;
      
      for (const [terrain, count] of Object.entries(terrainCounts)) {
        if (count > maxCount) {
          maxCount = count;
          mostCommonTerrain = terrain;
        }
      }
      
      // Apply clustering based on probability
      if (Math.random() < clusteringFactor && mostCommonTerrain !== currentTerrain) {
        terrainMap.set(`${x},${y}`, mostCommonTerrain);
      }
    }
  }
}

/**
 * Add a river to the map
 * @param {Map<string, string>} terrainMap - The map to modify
 * @param {number} width - Map width
 * @param {number} height - Map height
 */
function addRiver(terrainMap, width, height) {
  // Decide river direction (horizontal or vertical)
  const isHorizontal = Math.random() < 0.5;
  const riverWidth = Math.max(1, Math.floor(Math.random() * 3));
  
  if (isHorizontal) {
    // Create a horizontal river with some randomness
    const startY = Math.floor(height * 0.3 + Math.random() * height * 0.4);
    let currentY = startY;
    
    for (let x = 0; x < width; x++) {
      // Add some meandering
      if (Math.random() < 0.2) {
        currentY += Math.random() < 0.5 ? 1 : -1;
        currentY = Math.max(1, Math.min(height - 2, currentY));
      }
      
      // Create river with width
      for (let w = 0; w < riverWidth; w++) {
        const y = currentY + w;
        if (y < height) {
          terrainMap.set(`${x},${y}`, TERRAIN_TYPES.WATER.name);
        }
      }
    }
  } else {
    // Create a vertical river with some randomness
    const startX = Math.floor(width * 0.3 + Math.random() * width * 0.4);
    let currentX = startX;
    
    for (let y = 0; y < height; y++) {
      // Add some meandering
      if (Math.random() < 0.2) {
        currentX += Math.random() < 0.5 ? 1 : -1;
        currentX = Math.max(1, Math.min(width - 2, currentX));
      }
      
      // Create river with width
      for (let w = 0; w < riverWidth; w++) {
        const x = currentX + w;
        if (x < width) {
          terrainMap.set(`${x},${y}`, TERRAIN_TYPES.WATER.name);
        }
      }
    }
  }
}

/**
 * Add roads to the map
 * @param {Map<string, string>} terrainMap - The map to modify
 * @param {number} width - Map width
 * @param {number} height - Map height
 */
function addRoads(terrainMap, width, height) {
  // Create roads connecting opposite sides of the map
  const numRoads = 1 + Math.floor(Math.random() * 2);
  
  for (let i = 0; i < numRoads; i++) {
    if (Math.random() < 0.5) {
      // Horizontal road
      const roadY = Math.floor(Math.random() * height);
      for (let x = 0; x < width; x++) {
        // Only overwrite non-water terrain with roads
        if (terrainMap.get(`${x},${roadY}`) !== TERRAIN_TYPES.WATER.name) {
          terrainMap.set(`${x},${roadY}`, TERRAIN_TYPES.CLEAR.name);
        }
      }
    } else {
      // Vertical road
      const roadX = Math.floor(Math.random() * width);
      for (let y = 0; y < height; y++) {
        // Only overwrite non-water terrain with roads
        if (terrainMap.get(`${roadX},${y}`) !== TERRAIN_TYPES.WATER.name) {
          terrainMap.set(`${roadX},${y}`, TERRAIN_TYPES.CLEAR.name);
        }
      }
    }
  }
}

/**
 * Predefined map templates
 */
const MAP_TEMPLATES = {
  // A grasslands map with mostly clear terrain
  GRASSLANDS: {
    name: "Grasslands",
    description: "Open grasslands with scattered light woods and small water features",
    terrain: (width = defaultMapWidth, height = defaultMapHeight) => {
      const map = generateBlankMap(width, height);
      
      // Add light woods patches
      for (let i = 0; i < width * height * 0.03; i++) {
        const woodsX = Math.floor(Math.random() * width);
        const woodsY = Math.floor(Math.random() * height);
        const woodsSize = 1 + Math.floor(Math.random() * 2);
        
        for (let dx = -woodsSize; dx <= woodsSize; dx++) {
          for (let dy = -woodsSize; dy <= woodsSize; dy++) {
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist <= woodsSize) {
              const x = woodsX + dx;
              const y = woodsY + dy;
              
              if (x >= 0 && x < width && y >= 0 && y < height) {
                map.set(`${x},${y}`, TERRAIN_TYPES.LIGHT_WOODS.name);
              }
            }
          }
        }
      }
      
      // Add small water features
      for (let i = 0; i < width * height * 0.01; i++) {
        const waterX = Math.floor(Math.random() * width);
        const waterY = Math.floor(Math.random() * height);
        const waterSize = 1 + Math.floor(Math.random() * 1.5);
        
        for (let dx = -waterSize; dx <= waterSize; dx++) {
          for (let dy = -waterSize; dy <= waterSize; dy++) {
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist <= waterSize) {
              const x = waterX + dx;
              const y = waterY + dy;
              
              if (x >= 0 && x < width && y >= 0 && y < height) {
                map.set(`${x},${y}`, TERRAIN_TYPES.WATER.name);
              }
            }
          }
        }
      }
      
      return map;
    }
  },
  
  // A balanced map with a central forest and surrounding clearings
  FOREST_VALLEY: {
    name: "Forest Valley",
    description: "A valley with central forest and surrounding clearings, bisected by a river",
    terrain: (width = defaultMapWidth, height = defaultMapHeight) => {
      const map = generateBlankMap(width, height);
      const centerX = Math.floor(width / 2);
      const centerY = Math.floor(height / 2);
      
      // Create central forest area
      const forestRadius = Math.min(width, height) * 0.3;
      
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          const distanceFromCenter = Math.sqrt(
            Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
          );
          
          if (distanceFromCenter < forestRadius * 0.5) {
            // Inner forest is heavy
            map.set(`${x},${y}`, TERRAIN_TYPES.HEAVY_WOODS.name);
          } else if (distanceFromCenter < forestRadius) {
            // Outer forest is light
            map.set(`${x},${y}`, TERRAIN_TYPES.LIGHT_WOODS.name);
          }
        }
      }
      
      // Add a river through the center
      for (let x = 0; x < width; x++) {
        const riverY = centerY + Math.floor(Math.sin(x / 3) * 2);
        map.set(`${x},${riverY}`, TERRAIN_TYPES.WATER.name);
        
        // Make the river 2 hexes wide in some places
        if (x % 3 === 0 && riverY + 1 < height) {
          map.set(`${x},${riverY + 1}`, TERRAIN_TYPES.WATER.name);
        }
      }
      
      // Add hills on one side
      const hillSide = Math.random() < 0.5;
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < Math.floor(height * 0.2); y++) {
          const actualY = hillSide ? y : height - y - 1;
          if (Math.random() < 0.7) {
            map.set(`${x},${actualY}`, TERRAIN_TYPES.HILLS.name);
          }
        }
      }
      
      return map;
    }
  },
  
  // Urban combat map with buildings and rubble
  URBAN_WARFARE: {
    name: "Urban Warfare",
    description: "Dense urban environment with buildings, rubble, and roads",
    terrain: (width = defaultMapWidth, height = defaultMapHeight) => {
      const map = generateBlankMap(width, height);
      
      // Create city blocks
      const blockSize = 3;
      
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          const blockX = Math.floor(x / blockSize);
          const blockY = Math.floor(y / blockSize);
          
          // Road grid - every blockSize
          if (x % blockSize === 0 || y % blockSize === 0) {
            map.set(`${x},${y}`, TERRAIN_TYPES.CLEAR.name);
            continue;
          }
          
          // Buildings and rubble
          const buildingRoll = Math.random();
          if (buildingRoll < 0.6) {
            map.set(`${x},${y}`, TERRAIN_TYPES.BUILDING.name);
          } else if (buildingRoll < 0.8) {
            map.set(`${x},${y}`, TERRAIN_TYPES.RUBBLE.name);
          }
        }
      }
      
      // Add a central park
      const centerX = Math.floor(width / 2);
      const centerY = Math.floor(height / 2);
      const parkSize = Math.min(Math.floor(width * 0.15), Math.floor(height * 0.15));
      
      for (let dx = -parkSize; dx <= parkSize; dx++) {
        for (let dy = -parkSize; dy <= parkSize; dy++) {
          const x = centerX + dx;
          const y = centerY + dy;
          
          // Check if coordinates are valid
          if (x >= 0 && x < width && y >= 0 && y < height) {
            if (Math.random() < 0.7) {
              map.set(`${x},${y}`, TERRAIN_TYPES.LIGHT_WOODS.name);
            } else {
              map.set(`${x},${y}`, TERRAIN_TYPES.CLEAR.name);
            }
          }
        }
      }
      
      return map;
    }
  },
  
  // Desert battlefield with rough terrain and scattered hills
  DESERT_OUTPOST: {
    name: "Desert Outpost",
    description: "Arid environment with rough terrain, hills, and a central oasis",
    terrain: (width = defaultMapWidth, height = defaultMapHeight) => {
      const map = generateBlankMap(width, height);
      
      // Add rough terrain patches
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          if (Math.random() < 0.3) {
            map.set(`${x},${y}`, TERRAIN_TYPES.ROUGH.name);
          }
        }
      }
      
      // Add scattered hills
      for (let i = 0; i < width * height * 0.05; i++) {
        const hillX = Math.floor(Math.random() * width);
        const hillY = Math.floor(Math.random() * height);
        const hillSize = 1 + Math.floor(Math.random() * 3);
        
        for (let dx = -hillSize; dx <= hillSize; dx++) {
          for (let dy = -hillSize; dy <= hillSize; dy++) {
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist <= hillSize) {
              const x = hillX + dx;
              const y = hillY + dy;
              
              if (x >= 0 && x < width && y >= 0 && y < height) {
                map.set(`${x},${y}`, TERRAIN_TYPES.HILLS.name);
              }
            }
          }
        }
      }
      
      // Add central oasis
      const centerX = Math.floor(width / 2);
      const centerY = Math.floor(height / 2);
      const oasisSize = 2 + Math.floor(Math.random() * 3);
      
      for (let dx = -oasisSize; dx <= oasisSize; dx++) {
        for (let dy = -oasisSize; dy <= oasisSize; dy++) {
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          if (dist <= oasisSize) {
            const x = centerX + dx;
            const y = centerY + dy;
            
            if (x >= 0 && x < width && y >= 0 && y < height) {
              if (dist < oasisSize - 1.5) {
                map.set(`${x},${y}`, TERRAIN_TYPES.WATER.name);
              } else {
                map.set(`${x},${y}`, TERRAIN_TYPES.LIGHT_WOODS.name);
              }
            }
          }
        }
      }
      
      // Add a few buildings (outpost)
      const outpostX = centerX + Math.floor((Math.random() < 0.5 ? -1 : 1) * width * 0.3);
      const outpostY = centerY + Math.floor((Math.random() < 0.5 ? -1 : 1) * height * 0.3);
      
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          const x = outpostX + dx;
          const y = outpostY + dy;
          
          if (x >= 0 && x < width && y >= 0 && y < height && Math.random() < 0.7) {
            map.set(`${x},${y}`, TERRAIN_TYPES.BUILDING.name);
          }
        }
      }
      
      return map;
    }
  }
};

/**
 * Get a predefined map by name
 * @param {string} templateName - Name of the map template to use
 * @param {number} width - Map width
 * @param {number} height - Map height
 * @returns {Map<string, string>} - Generated terrain map
 */
function getMapTemplate(templateName, width = defaultMapWidth, height = defaultMapHeight) {
  const template = MAP_TEMPLATES[templateName];
  
  if (!template) {
    console.warn(`Map template ${templateName} not found. Using random map instead.`);
    return generateRandomMap({ width, height });
  }
  
  return template.terrain(width, height);
}

/**
 * Get a list of available map templates
 * @returns {Array<Object>} List of map templates with name and description
 */
function getAvailableMapTemplates() {
  return Object.entries(MAP_TEMPLATES).map(([key, template]) => ({
    id: key,
    name: template.name,
    description: template.description
  }));
}

module.exports = {
  TERRAIN_TYPES,
  generateBlankMap,
  generateRandomMap,
  getMapTemplate,
  getAvailableMapTemplates,
  MAP_TEMPLATES
}; 