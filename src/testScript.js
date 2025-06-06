/**
 * Comprehensive Test Script for Alpha Strike AI Game Master
 * 
 * This script tests all major functionality:
 * - Game initialization
 * - Map generation and loading
 * - Adding units (player and AI)
 * - Movement
 * - Combat (attacks)
 * - Heat mechanics
 * - End-to-end gameplay
 */

const { createGameState, PHASES, addUnit, moveUnit, processAttack, applyDamage, 
        setTerrain, getTerrainAt, advancePhase, processInitiative, checkGameOver,
        switchActivePlayer, getHeatEffects, processHeatDissipation, processShutdownChecks,
        attemptStartup } = require('./engine/gameState');
const { getUnitTemplate, listUnitTemplates, getRandomTemplate } = require('./data/unitTemplates');
const mapGenerator = require('./engine/mapGenerator');
const chalk = require('chalk');
const { initializeLogger } = require('./utils/logger');

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.log(chalk.red('Unhandled Rejection at:'), promise);
  console.log(chalk.red('Reason:'), reason);
});

// Initialize logger
const logger = initializeLogger();

// Test results tracking
const testResults = {
  total: 0,
  passed: 0,
  failed: 0
};

/**
 * Test utility to check and report on a condition
 */
function assert(condition, message) {
  testResults.total++;
  
  if (condition) {
    console.log(chalk.green(`✓ PASS: ${message}`));
    testResults.passed++;
  } else {
    console.log(chalk.red(`✗ FAIL: ${message}`));
    testResults.failed++;
  }
  
  return condition;
}

/**
 * Main test function
 */
async function runTests() {
  console.log(chalk.cyan('\n========================================'));
  console.log(chalk.yellow('  ALPHA STRIKE AI GAME MASTER - TEST SUITE'));
  console.log(chalk.cyan('========================================\n'));
  
  try {
    // Start with game initialization test
    await testGameInitialization();
    
    // Test map functionality
    await testMapFunctions();
    
    // Test unit functionality
    await testUnitFunctions();
    
    // Test movement
    await testMovement();
    
    // Test combat
    await testCombat();
    
    // Test heat mechanics
    await testHeatMechanics();
    
    // Test end-to-end game flow
    await testGameFlow();
    
    // Report results
    console.log(chalk.cyan('\n========================================'));
    console.log(chalk.yellow('  TEST RESULTS'));
    console.log(chalk.cyan('========================================'));
    console.log(`Total tests: ${testResults.total}`);
    console.log(chalk.green(`Passed: ${testResults.passed}`));
    console.log(chalk.red(`Failed: ${testResults.failed}`));
    console.log(chalk.cyan('========================================\n'));
    
    // Overall pass/fail
    if (testResults.failed === 0) {
      console.log(chalk.green('✓ All tests passed!'));
    } else {
      console.log(chalk.red(`✗ ${testResults.failed} tests failed!`));
    }
  } catch (error) {
    console.error(chalk.red('\nTest execution error:'), error);
  }
}

/**
 * Test game initialization
 */
async function testGameInitialization() {
  console.log(chalk.cyan('\n--- Testing Game Initialization ---'));
  
  // Create a game state
  const gameState = createGameState();
  
  // Check basic game state properties
  assert(gameState !== null && typeof gameState === 'object', 'Game state created');
  assert(gameState.turnData.phase === PHASES.SETUP, 'Game starts in SETUP phase');
  assert(gameState.players.has('player'), 'Player entry exists');
  assert(gameState.players.has('ai'), 'AI entry exists');
}

/**
 * Test map functionality
 */
async function testMapFunctions() {
  console.log(chalk.cyan('\n--- Testing Map Functions ---'));
  
  try {
    // Get map templates
    const templates = mapGenerator.getAvailableMapTemplates();
    assert(Array.isArray(templates) && templates.length > 0, 'Map templates available');
    
    // Create a game state
    const gameState = createGameState();
    
    try {
      // Generate a grasslands map - check if the function is available
      if (typeof mapGenerator.getMapTemplate !== 'function') {
        console.log(chalk.red('mapGenerator.getMapTemplate is not a function'));
        assert(false, 'Map template function exists');
        return;
      }
      
      const grasslandsMap = mapGenerator.getMapTemplate('GRASSLANDS', 10, 10);
      assert(grasslandsMap instanceof Map, 'Grasslands map template generated');
      
      // Set the map
      gameState.battlefield.terrain = grasslandsMap;
      gameState.battlefield.dimensions = { width: 10, height: 10 };
      
      // Check terrain at a specific location
      const terrain = getTerrainAt(gameState, { x: 5, y: 5 });
      assert(terrain !== undefined, 'Can get terrain at coordinates');
      
      // Check if generateRandomMap is available
      if (typeof mapGenerator.generateRandomMap !== 'function') {
        console.log(chalk.red('mapGenerator.generateRandomMap is not a function'));
        assert(false, 'Random map function exists');
        return;
      }
      
      // Generate a random map
      const randomMap = mapGenerator.generateRandomMap(10, 10);
      assert(randomMap instanceof Map, 'Random map generated');
    } catch (err) {
      console.log(chalk.red(`Error processing map templates: ${err.message}`));
      assert(false, 'Map processing succeeded');
    }
  } catch (err) {
    console.log(chalk.red(`Error in map functions test: ${err.message}`));
    assert(false, 'Map functions test completed without errors');
  }
}

/**
 * Test unit functionality
 */
async function testUnitFunctions() {
  console.log(chalk.cyan('\n--- Testing Unit Functions ---'));
  
  // Create a game state
  const gameState = createGameState();
  
  // Set up a map
  gameState.battlefield.terrain = mapGenerator.getMapTemplate('GRASSLANDS', 20, 20);
  gameState.battlefield.dimensions = { width: 20, height: 20 };
  
  // Check unit templates
  const templates = listUnitTemplates();
  assert(Array.isArray(templates) && templates.length > 0, 'Unit templates available');
  
  // First available mech template instead of specific ID
  const mechTemplate = templates.find(t => t.type === 'mech');
  assert(mechTemplate !== null && mechTemplate.type === 'mech', 'Retrieved mech template');
  
  try {
    // Add player unit
    const playerUnitId = await addUnit(gameState, mechTemplate.id, 'player', { x: 5, y: 5 });
    assert(playerUnitId && gameState.battlefield.units.has(playerUnitId), 'Added player unit');
    assert(gameState.players.get('player').units.includes(playerUnitId), 'Player unit added to player list');
    
    // Add AI unit
    const aiUnitId = await addUnit(gameState, mechTemplate.id, 'ai', { x: 15, y: 15 });
    assert(aiUnitId && gameState.battlefield.units.has(aiUnitId), 'Added AI unit');
    assert(gameState.players.get('ai').units.includes(aiUnitId), 'AI unit added to AI list');
    
    // Check vehicle units
    const vehicleTemplate = templates.find(t => t.type === 'vehicle');
    if (vehicleTemplate) {
      const vehicleUnitId = await addUnit(gameState, vehicleTemplate.id, 'player', { x: 7, y: 7 });
      assert(vehicleUnitId && gameState.battlefield.units.has(vehicleUnitId), 'Added vehicle unit');
    }
    
    // Try to add a random unit
    const randomTemplate = getRandomTemplate();
    assert(randomTemplate !== null, 'Can get random unit template');
    
    const randomUnitId = await addUnit(gameState, randomTemplate.id, 'ai', { x: 12, y: 12 });
    assert(randomUnitId && gameState.battlefield.units.has(randomUnitId), 'Added random unit');
  } catch (err) {
    console.log(chalk.red(`Error in unit tests: ${err.message}`));
  }
}

/**
 * Test movement functionality
 */
async function testMovement() {
  console.log(chalk.cyan('\n--- Testing Movement ---'));
  
  try {
    // Create a game state
    const gameState = createGameState();
    
    // Set up a map
    gameState.battlefield.terrain = mapGenerator.getMapTemplate('GRASSLANDS', 20, 20);
    gameState.battlefield.dimensions = { width: 20, height: 20 };
    
    // Get a mech template
    const templates = listUnitTemplates();
    const mechTemplate = templates.find(t => t.type === 'mech');
    
    if (!mechTemplate) {
      console.log(chalk.red('No mech template found for movement test'));
      return;
    }
    
    // Add a player unit
    const playerUnitId = await addUnit(gameState, mechTemplate.id, 'player', { x: 5, y: 5 });
    
    if (!playerUnitId || !gameState.battlefield.units.has(playerUnitId)) {
      console.log(chalk.red('Failed to add unit for movement test'));
      return;
    }
    
    const playerUnit = gameState.battlefield.units.get(playerUnitId);
    console.log(`Player unit: ${JSON.stringify(playerUnit, null, 2)}`);
    
    if (!playerUnit || !playerUnit.position) {
      console.log(chalk.red('Player unit or position is undefined'));
      return;
    }
    
    // Test movement
    const originalPosition = { ...playerUnit.position };
    const newPosition = { x: 7, y: 7 };
    
    // Change to movement phase
    gameState.turnData.phase = PHASES.MOVEMENT;
    gameState.turnData.activePlayer = 'player';
    
    // Move the unit
    const moveResult = moveUnit(gameState, playerUnitId, newPosition, 'NE');
    
    // Check results
    assert(moveResult.success, 'Movement succeeded');
    assert(playerUnit.position.x === newPosition.x && playerUnit.position.y === newPosition.y, 
           'Unit position updated correctly');
    assert(playerUnit.facing === 'NE', 'Unit facing updated correctly');
    
    // Test invalid movement (out of bounds)
    const invalidPosition = { x: -1, y: -1 };
    const invalidMoveResult = moveUnit(gameState, playerUnitId, invalidPosition, 'N');
    assert(invalidMoveResult.success === false, 'Invalid movement rejected');
  } catch (err) {
    console.log(chalk.red(`Error in movement tests: ${err.message}`));
  }
}

/**
 * Test combat functionality
 */
async function testCombat() {
  console.log(chalk.cyan('\n--- Testing Combat ---'));
  
  try {
    // Create a game state
    const gameState = createGameState();
    
    // Set up a map
    gameState.battlefield.terrain = mapGenerator.getMapTemplate('GRASSLANDS', 20, 20);
    gameState.battlefield.dimensions = { width: 20, height: 20 };
    
    // Get a mech template
    const templates = listUnitTemplates();
    const mechTemplate = templates.find(t => t.type === 'mech');
    
    if (!mechTemplate) {
      console.log(chalk.red('No mech template found for combat test'));
      return;
    }
    
    // Add player and AI units close to each other
    const playerUnitId = await addUnit(gameState, mechTemplate.id, 'player', { x: 5, y: 5 });
    const aiUnitId = await addUnit(gameState, mechTemplate.id, 'ai', { x: 6, y: 6 });
    
    if (!playerUnitId || !aiUnitId || 
        !gameState.battlefield.units.has(playerUnitId) || 
        !gameState.battlefield.units.has(aiUnitId)) {
      console.log(chalk.red('Failed to add units for combat test'));
      return;
    }
    
    const playerUnit = gameState.battlefield.units.get(playerUnitId);
    const aiUnit = gameState.battlefield.units.get(aiUnitId);
    
    if (!playerUnit || !aiUnit) {
      console.log(chalk.red('Player or AI unit is undefined'));
      return;
    }
    
    // Set to combat phase
    gameState.turnData.phase = PHASES.COMBAT;
    gameState.turnData.activePlayer = 'player';
    
    // Record initial AI unit armor
    const initialArmor = aiUnit.stats.armor - (aiUnit.status.damage?.armor || 0);
    
    // Perform attack
    const attackParams = {
      attacker: playerUnitId,
      target: aiUnitId
    };
    
    const attackResult = processAttack(gameState, attackParams);
    assert(attackResult !== null, 'Attack processed');
    
    // Check if damage was dealt (this could sometimes fail due to random dice rolls)
    const currentArmor = aiUnit.stats.armor - (aiUnit.status.damage?.armor || 0);
    console.log(`Initial armor: ${initialArmor}, Current armor: ${currentArmor}`);
    
    // If hit connects (we can't guarantee it due to dice rolls)
    if (attackResult.hit) {
      assert(currentArmor < initialArmor, 'Attack caused damage on hit');
    }
    
    // Test direct damage application
    const directDamageResult = applyDamage(gameState, aiUnitId, 1);
    assert(directDamageResult.success, 'Direct damage applied successfully');
    
    // Check if unit can be destroyed
    const heavyDamageResult = applyDamage(gameState, aiUnitId, 100);
    assert(aiUnit.status.effects.includes('DESTROYED'), 'Unit can be destroyed with sufficient damage');
  } catch (err) {
    console.log(chalk.red(`Error in combat tests: ${err.message}`));
  }
}

/**
 * Test heat mechanics
 */
async function testHeatMechanics() {
  console.log(chalk.cyan('\n--- Testing Heat Mechanics ---'));
  
  try {
    // Create a game state
    const gameState = createGameState();
    
    // Set up a map
    gameState.battlefield.terrain = mapGenerator.getMapTemplate('GRASSLANDS', 20, 20);
    gameState.battlefield.dimensions = { width: 20, height: 20 };
    
    // Get a mech template
    const templates = listUnitTemplates();
    const mechTemplate = templates.find(t => t.type === 'mech');
    
    if (!mechTemplate) {
      console.log(chalk.red('No mech template found for heat test'));
      return;
    }
    
    // Add a mech (mechs have heat)
    const mechUnitId = await addUnit(gameState, mechTemplate.id, 'player', { x: 5, y: 5 });
    
    if (!mechUnitId || !gameState.battlefield.units.has(mechUnitId)) {
      console.log(chalk.red('Failed to add mech for heat test'));
      return;
    }
    
    const mechUnit = gameState.battlefield.units.get(mechUnitId);
    
    if (!mechUnit) {
      console.log(chalk.red('Mech unit is undefined'));
      return;
    }
    
    // Check that mech has heat capacity
    assert(mechUnit.stats.heat && mechUnit.stats.heat.capacity > 0, 'Mech has heat capacity');
    
    // Add heat to the mech
    mechUnit.status.heat = 5;
    assert(mechUnit.status.heat === 5, 'Heat added to mech');
    
    // Check heat effects
    const heatEffects = getHeatEffects(mechUnit);
    assert(heatEffects !== null, 'Heat effects can be retrieved');
    
    // Test heat dissipation
    processHeatDissipation(gameState);
    assert(mechUnit.status.heat < 5, 'Heat dissipation works');
    
    // Test shutdown for extreme heat
    mechUnit.status.heat = mechUnit.stats.heat.capacity + 5;
    processShutdownChecks(gameState);
    
    // Check for shutdown (might not happen due to random roll)
    console.log(`Mech heat: ${mechUnit.status.heat}, capacity: ${mechUnit.stats.heat.capacity}`);
    console.log(`Shutdown status: ${mechUnit.status.effects.includes('SHUTDOWN')}`);
    
    // If shutdown, test startup
    if (mechUnit.status.effects.includes('SHUTDOWN')) {
      const startupResult = attemptStartup(gameState, mechUnitId);
      // Startup can succeed or fail based on dice roll
      console.log(`Startup attempt result: ${startupResult.success ? 'Success' : 'Failed'}`);
    }
  } catch (err) {
    console.log(chalk.red(`Error in heat tests: ${err.message}`));
  }
}

/**
 * Test end-to-end game flow
 */
async function testGameFlow() {
  console.log(chalk.cyan('\n--- Testing Game Flow ---'));
  
  try {
    // Create a game state
    const gameState = createGameState();
    
    // Set up a map
    gameState.battlefield.terrain = mapGenerator.getMapTemplate('GRASSLANDS', 20, 20);
    gameState.battlefield.dimensions = { width: 20, height: 20 };
    
    // Get a mech template
    const templates = listUnitTemplates();
    const mechTemplate = templates.find(t => t.type === 'mech');
    
    if (!mechTemplate) {
      console.log(chalk.red('No mech template found for game flow test'));
      return;
    }
    
    // Add player and AI units
    const playerUnitId = await addUnit(gameState, mechTemplate.id, 'player', { x: 5, y: 5 });
    const aiUnitId = await addUnit(gameState, mechTemplate.id, 'ai', { x: 15, y: 15 });
    
    if (!playerUnitId || !aiUnitId || 
        !gameState.battlefield.units.has(playerUnitId) || 
        !gameState.battlefield.units.has(aiUnitId)) {
      console.log(chalk.red('Failed to add units for game flow test'));
      return;
    }
    
    // Start with Setup phase
    assert(gameState.turnData.phase === PHASES.SETUP, 'Game begins in Setup phase');
    
    // Move to Initiative phase
    advancePhase(gameState);
    assert(gameState.turnData.phase === PHASES.INITIATIVE, 'Can advance to Initiative phase');
    
    // Roll for initiative
    const initiativeResult = processInitiative(gameState);
    assert(initiativeResult && (gameState.turnData.activePlayer === 'player' || gameState.turnData.activePlayer === 'ai'), 
           'Initiative rolled successfully');
    
    // Advance to Movement phase
    advancePhase(gameState);
    assert(gameState.turnData.phase === PHASES.MOVEMENT, 'Can advance to Movement phase');
    
    // Move unit
    const moveResult = moveUnit(gameState, 
      gameState.turnData.activePlayer === 'player' ? playerUnitId : aiUnitId, 
      { x: 10, y: 10 }, 'N');
    assert(moveResult.success, 'Movement in movement phase successful');
    
    // Switch active player
    const originalActivePlayer = gameState.turnData.activePlayer;
    switchActivePlayer(gameState);
    assert(gameState.turnData.activePlayer !== originalActivePlayer, 'Can switch active player');
    
    // Move other unit
    const otherMoveResult = moveUnit(gameState, 
      gameState.turnData.activePlayer === 'player' ? playerUnitId : aiUnitId, 
      { x: 12, y: 12 }, 'S');
    assert(otherMoveResult.success, 'Second player movement successful');
    
    // Advance to Combat phase
    advancePhase(gameState);
    assert(gameState.turnData.phase === PHASES.COMBAT, 'Can advance to Combat phase');
    
    // Advance to End phase
    advancePhase(gameState);
    assert(gameState.turnData.phase === PHASES.END, 'Can advance to End phase');
    
    // Complete the turn
    advancePhase(gameState);
    assert(gameState.turnData.phase === PHASES.INITIATIVE && gameState.turnData.round === 2, 
           'Full turn cycle works correctly');
    
    // Check game over conditions
    const notOverYet = checkGameOver(gameState);
    assert(notOverYet.gameOver === false, 'Game not over with active units');
    
    // Destroy all AI units
    gameState.battlefield.units.get(aiUnitId).status.effects.push('DESTROYED');
    
    // Check game over again
    const gameOverCheck = checkGameOver(gameState);
    assert(gameOverCheck.gameOver === true, 'Game over when all units of a side are destroyed');
    assert(gameOverCheck.winner === 'player', 'Correct winner determined');
  } catch (err) {
    console.log(chalk.red(`Error in game flow tests: ${err.message}`));
  }
}

// Run all tests
runTests().catch(error => {
  console.error(chalk.red('Test suite error:'), error);
  process.exit(1);
}); 