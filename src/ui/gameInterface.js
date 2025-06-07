/**
 * Game Interface for Alpha Strike AI Game Master
 */

const inquirer = require('inquirer');
const chalk = require('chalk');
const { parseCommand, getHelpText } = require('./commandParser');
const { initializeLogger } = require('../utils/logger');
const { 
  createGameState, PHASES, TERRAIN_TYPES, TERRAIN_EFFECTS,
  addUnit, moveUnit, processAttack, setTerrain, getTerrainAt,
  advancePhase, processInitiative, checkGameOver, switchActivePlayer,
  getHeatEffects, applyDamage, processHeatDissipation, processShutdownChecks,
  attemptStartup
} = require('../engine/gameState');
const { getUnitTemplate, listUnitTemplates, getRandomTemplate } = require('../data/unitTemplates');
const { getClaudeResponse, createAIPrompt } = require('../ai/anthropicClient');
const mapGenerator = require('../engine/mapGenerator');

const logger = initializeLogger();

// Game state (global for this module)
let gameState;

// Terrain color mapping
const TERRAIN_COLORS = {
  [TERRAIN_TYPES.CLEAR]: 'white',
  [TERRAIN_TYPES.LIGHT_WOODS]: 'green',
  [TERRAIN_TYPES.HEAVY_WOODS]: 'blue',
  [TERRAIN_TYPES.WATER]: 'cyan',
  [TERRAIN_TYPES.ROUGH]: 'yellow',
  [TERRAIN_TYPES.ROAD]: 'magenta'
};

// Terrain display characters
const TERRAIN_CHARS = {
  [TERRAIN_TYPES.CLEAR]: '.',
  [TERRAIN_TYPES.LIGHT_WOODS]: '♣',
  [TERRAIN_TYPES.HEAVY_WOODS]: '♠',
  [TERRAIN_TYPES.WATER]: '~',
  [TERRAIN_TYPES.ROUGH]: '~',
  [TERRAIN_TYPES.ROAD]: '='
};

/**
 * Display battlefield state as ASCII grid
 * @param {Object} gameState - Current game state
 */
function displayBattlefield(gameState) {
  const { width, height } = gameState.battlefield.dimensions;
  
  // Fixed cell width for consistent display
  const cellWidth = 6;
  
  // Improved header with bold and colorful title
  console.log('\n' + chalk.bold.cyan('╔═════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║ ') + chalk.bold.yellow('ALPHA STRIKE BATTLEFIELD') + chalk.bold.cyan(' '.repeat(32) + '║'));
  console.log(chalk.bold.cyan('╚═════════════════════════════════════════════════════════════╝'));

  // Create grid border characters
  const topLeftCorner = chalk.cyan('┌');
  const topRightCorner = chalk.cyan('┐');
  const bottomLeftCorner = chalk.cyan('└');
  const bottomRightCorner = chalk.cyan('┘');
  const horizontal = chalk.cyan('─');
  const vertical = chalk.cyan('│');
  const leftT = chalk.cyan('├');
  const rightT = chalk.cyan('┤');
  
  // Create empty grid with terrain
  const grid = Array(height).fill().map((_, y) => 
    Array(width).fill().map((_, x) => {
      const terrainType = getTerrainAt(gameState, { x, y });
      
      // Get base terrain character and color
      let terrainChar = TERRAIN_CHARS[terrainType];
      let terrainColor = TERRAIN_COLORS[terrainType];
      
      // Return styled terrain char
      return chalk[terrainColor](terrainChar.padEnd(cellWidth));
    })
  );
  
  // Track unit types for legend
  const playerUnits = new Set();
  const aiUnits = new Set();
  
  // Place units on grid
  for (const [unitId, unit] of gameState.battlefield.units.entries()) {
    if (unit.status.effects.includes('DESTROYED')) {
      // Display destroyed units as wreckage with gray color
      const { x, y } = unit.position;
      if (x >= 0 && x < width && y >= 0 && y < height) {
        grid[y][x] = chalk.gray('✕'.padEnd(cellWidth));
        continue;
      }
    }
    
    const { x, y } = unit.position;
    if (x >= 0 && x < width && y >= 0 && y < height) {
      // Determine symbol and color
      let unitType = unit.type;
      let symbol;
      
      // Create more descriptive but compact symbols
      switch(unitType) {
        case 'mech':
          symbol = 'M';
          break;
        case 'vehicle':
          // Use different symbols based on vehicle type
          if (unit.vehicleType) {
            switch(unit.vehicleType) {
              case 'tracked':
                symbol = 'TRK';
                break;
              case 'wheeled':
                symbol = 'WHL';
                break;
              case 'hover':
                symbol = 'HOV';
                break;
              case 'vtol':
                // Add elevation to VTOL display
                const elevation = unit.status.elevation || 1;
                symbol = `VT${elevation}`;
                break;
              default:
                symbol = 'VEH';
            }
          } else {
            symbol = 'VEH';
          }
          break;
        case 'infantry':
          symbol = 'INF';
          break;
        default:
          symbol = 'UNT';
      }
      
      // Add owner indicator
      const owner = unit.owner === 'player' ? 'P' : 'A';
      
      // For VTOLs, create more detailed legend entries
      let legendEntry = unit.name;
      if (unitType === 'vehicle' && unit.vehicleType === 'vtol') {
        const elevation = unit.status.elevation || 1;
        legendEntry = `${unit.name} (alt:${elevation})`;
      }
      
      // Add to appropriate legend set
      if (owner === 'P') {
        playerUnits.add(`${legendEntry} (${symbol})`);
      } else {
        aiUnits.add(`${legendEntry} (${symbol})`);
      }
      
      // Apply facing indicator
      let facingArrow;
      switch (unit.facing) {
        case 'N': facingArrow = '↑'; break;
        case 'NE': facingArrow = '↗'; break;
        case 'E': facingArrow = '→'; break;
        case 'SE': facingArrow = '↘'; break;
        case 'S': facingArrow = '↓'; break;
        case 'SW': facingArrow = '↙'; break;
        case 'W': facingArrow = '←'; break;
        case 'NW': facingArrow = '↖'; break;
      }
      
      // Add status indicators
      let statusIndicator = '';
      if (unit.status.effects.includes('SHUTDOWN')) {
        statusIndicator = '!'; // Shutdown indicator
      } else if (unit.type === 'mech' && unit.status.heat >= unit.stats.heat.capacity * 0.75) {
        statusIndicator = '♨'; // Hot indicator
      } else if (unit.status.effects.includes('IMMOBILIZED')) {
        statusIndicator = 'x'; // Immobilized
      }
      
      // Combine all parts into a display string
      let displayString = `${owner}${symbol}${facingArrow}${statusIndicator}`;
      
      // Padding and color determination
      let color = owner === 'P' ? 'green' : 'red';
      
      // Add damage indicators by changing unit color
      let style = color;
      const armorRatio = unit.status.damage ? 
        (unit.stats.armor - unit.status.damage.armor) / unit.stats.armor : 1;
      
      if (armorRatio <= 0) {
        // Critical damage - structure only
        style = 'redBright';
      } else if (armorRatio <= 0.3) {
        // Heavy damage - armor below 30%
        style = owner === 'P' ? 'yellowBright' : 'magentaBright';
      }
      
      // Ensure the symbol is padded to the cell width
      displayString = displayString.padEnd(cellWidth);
      
      // Place on grid with color
      grid[y][x] = chalk[style](displayString);
    }
  }
  
  // Add coordinate labels - ensure they align with grid cells
  let xLabels = '    '; // Initial padding
  for (let i = 0; i < width; i++) {
    // Show every 5th column number, but with improved alignment
    if (i % 5 === 0) {
      xLabels += chalk.bold.cyan(String(i).padStart(cellWidth));
    } else {
      xLabels += ' '.repeat(cellWidth);
    }
  }
  
  // Draw top border of grid
  let topBorder = '    ' + topLeftCorner;
  for (let i = 0; i < width * cellWidth; i++) {
    topBorder += horizontal;
  }
  topBorder += topRightCorner;
  
  // Bottom border
  let bottomBorder = '    ' + bottomLeftCorner;
  for (let i = 0; i < width * cellWidth; i++) {
    bottomBorder += horizontal;
  }
  bottomBorder += bottomRightCorner;
  
  console.log(xLabels);
  console.log(topBorder);
  
  // Print grid with y coordinates
  grid.forEach((row, y) => {
    // Add bold cyan y coordinate
    const yLabel = chalk.bold.cyan(String(y).padStart(2, ' '));
    console.log(`${yLabel} ${vertical}${row.join('')}${vertical}`);
    
    // Add divider line every 5th row for readability
    if ((y + 1) % 5 === 0 && y < height - 1) {
      let divider = '    ' + leftT;
      for (let i = 0; i < width * cellWidth; i++) {
        divider += horizontal;
      }
      divider += rightT;
      console.log(divider);
    }
  });
  
  console.log(bottomBorder);
  console.log(xLabels);
  
  // Display enhanced legend with better visual separation
  console.log('\n' + chalk.bold.cyan('╔═════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║ ') + chalk.bold.yellow('BATTLEFIELD LEGEND') + chalk.bold.cyan(' '.repeat(34) + '║'));
  console.log(chalk.bold.cyan('╚═════════════════════════════════════════════════════════════╝'));
  
  console.log(chalk.bold('Symbol Format: ') + '[Owner][Unit Type][Direction][Status]');
  console.log(chalk.bold('Owner: ') + chalk.green('P') + ' = Player, ' + chalk.red('A') + ' = AI');
  console.log(chalk.bold('Unit Types:'));
  console.log('  M = Mech');
  console.log('  Vehicle subtypes:');
  console.log('    TRK = Tracked Vehicle');
  console.log('    WHL = Wheeled Vehicle');
  console.log('    HOV = Hover Vehicle');
  console.log('    VT# = VTOL (number indicates altitude)');
  console.log('  INF = Infantry');
  console.log(chalk.bold('Direction: ') + '↑,↗,→,↘,↓,↙,←,↖ indicate unit facing');
  console.log(chalk.bold('Status: ') + '! = Shutdown, ♨ = High Heat, x = Immobilized, ' + chalk.gray('✕') + ' = Destroyed');
  
  // Display terrain legend with better visual appearance
  console.log('\n' + chalk.bold('Terrain:'));
  console.log(chalk.white(TERRAIN_CHARS[TERRAIN_TYPES.CLEAR]) + ' ' + chalk.white('Clear'));
  console.log(chalk.green(TERRAIN_CHARS[TERRAIN_TYPES.LIGHT_WOODS]) + ' ' + chalk.green('Light Woods') + ' (movement penalties vary by vehicle type)');
  console.log(chalk.blue(TERRAIN_CHARS[TERRAIN_TYPES.HEAVY_WOODS]) + ' ' + chalk.blue('Heavy Woods') + ' (movement penalties vary by vehicle type)');
  console.log(chalk.cyan(TERRAIN_CHARS[TERRAIN_TYPES.WATER]) + ' ' + chalk.cyan('Water') + ' (impassable for tracked/wheeled, normal for hover/VTOL/amphibious)');
  console.log(chalk.yellow(TERRAIN_CHARS[TERRAIN_TYPES.ROUGH]) + ' ' + chalk.yellow('Rough Terrain') + ' (movement penalties vary by vehicle type)');
  console.log(chalk.magenta(TERRAIN_CHARS[TERRAIN_TYPES.ROAD]) + ' ' + chalk.magenta('Road') + ' (movement bonuses vary by vehicle type)');
  
  // Display units with improved styling
  console.log('\n' + chalk.bold.green('⚔ Your Units: ') + chalk.green([...playerUnits].join(' | ')));
  console.log(chalk.bold.red('⚔ AI Units: ') + chalk.red([...aiUnits].join(' | ')));
}

/**
 * Display detailed information about a unit
 * @param {Object} unit - Unit to display information for
 */
function displayUnitInfo(unit) {
  console.log('\n' + chalk.bold.yellow('═════════════════════════════════════════════'));
  console.log(chalk.bold.yellow(`   UNIT STATUS: ${unit.name.toUpperCase()}  `));
  console.log(chalk.bold.yellow('═════════════════════════════════════════════'));
  
  // Type and subtype
  if (unit.type === 'vehicle' && unit.vehicleType) {
    const vehicleTypeNames = {
      'tracked': 'Tracked Vehicle',
      'wheeled': 'Wheeled Vehicle',
      'hover': 'Hover Vehicle',
      'vtol': 'VTOL Aircraft'
    };
    console.log(`  ${chalk.bold('Type:')} ${chalk.cyan(vehicleTypeNames[unit.vehicleType] || 'Vehicle')}`);
  } else if (unit.type === 'infantry') {
    console.log(`  ${chalk.bold('Type:')} ${chalk.cyan('Infantry')}`);
    
    // Show infantry squad strength
    if (unit.status.squadStrength) {
      const strengthPercent = Math.round(unit.status.squadStrength.currentRatio * 100);
      let strengthColor = 'green';
      if (strengthPercent <= 25) strengthColor = 'red';
      else if (strengthPercent <= 50) strengthColor = 'yellow';
      else if (strengthPercent <= 75) strengthColor = 'blue';
      
      console.log(`  ${chalk.bold('Squad Strength:')} ${chalk[strengthColor](strengthPercent + '%')}`);
    }
  } else {
    console.log(`  ${chalk.bold('Type:')} ${chalk.cyan(unit.type.charAt(0).toUpperCase() + unit.type.slice(1))}`);
  }
  
  // Position and facing
  console.log(`  ${chalk.bold('Position:')} ${chalk.cyan(`(${unit.position.x},${unit.position.y})`)}`);
  console.log(`  ${chalk.bold('Facing:')} ${chalk.cyan(unit.facing)}`);
  
  // Display VTOL elevation if applicable
  if (unit.type === 'vehicle' && unit.vehicleType === 'vtol') {
    console.log(`  ${chalk.bold('Elevation:')} ${chalk.cyan(unit.status.elevation || 1)}`);
  }
  
  // Damage status
  const armorMax = unit.stats.armor;
  const armorCurrent = armorMax - (unit.status.damage?.armor || 0);
  const structureMax = unit.stats.structure;
  const structureCurrent = structureMax - (unit.status.damage?.structure || 0);
  
  // Color-coded armor and structure display
  const getArmorColor = (current, max) => {
    const ratio = current / max;
    if (ratio <= 0) return 'red';
    if (ratio <= 0.3) return 'redBright';
    if (ratio <= 0.6) return 'yellow';
    return 'green';
  };
  
  // Create visual bars for armor and structure
  const createBar = (current, max, barLength = 20) => {
    const filledLength = Math.round((current / max) * barLength);
    const emptyLength = barLength - filledLength;
    
    return '█'.repeat(filledLength) + '░'.repeat(emptyLength);
  };
  
  const armorBar = createBar(armorCurrent, armorMax);
  const structureBar = createBar(structureCurrent, structureMax);
  
  console.log(`  ${chalk.bold('Armor:')} ${chalk[getArmorColor(armorCurrent, armorMax)](armorCurrent)}/${chalk.cyan(armorMax)} ${chalk[getArmorColor(armorCurrent, armorMax)](armorBar)}`);
  console.log(`  ${chalk.bold('Structure:')} ${chalk[getArmorColor(structureCurrent, structureMax)](structureCurrent)}/${chalk.cyan(structureMax)} ${chalk[getArmorColor(structureCurrent, structureMax)](structureBar)}`);
  
  // Movement values
  console.log(`  ${chalk.bold('Movement:')} ${chalk.cyan(`${chalk.bold('Walk:')} ${unit.stats.movement.walk || 0}${chalk.dim(' | ')}${chalk.cyan('Run:')} ${chalk.bold(unit.stats.movement.run || 0)}${chalk.dim(' | ')}${chalk.cyan('Jump:')} ${chalk.bold(unit.stats.movement.jump || 0)}"`)}`)
  
  // Heat for mechs
  if (unit.type === 'mech') {
    const heatCurrent = unit.status.heat || 0;
    const heatMax = unit.stats.heat.capacity;
    const heatRatio = heatCurrent / heatMax;
    let heatColor = 'green';
    
    if (heatRatio >= 0.75) heatColor = 'red';
    else if (heatRatio >= 0.5) heatColor = 'yellow';
    
    console.log(`  ${chalk.bold('Heat:')} ${chalk[heatColor](heatCurrent)}/${chalk.cyan(heatMax)}`);
  }
  
  // Damage values
  console.log(`  ${chalk.bold('Damage:')}`);
  const damageRanges = ['short', 'medium', 'long', 'extreme'];
  damageRanges.forEach(range => {
    if (unit.stats.damage[range] !== undefined) {
      console.log(`    ${chalk.cyan(range.charAt(0).toUpperCase() + range.slice(1))}: ${chalk.yellowBright(unit.stats.damage[range])}`);
    }
  });
  
  // Special abilities
  if (unit.specialAbilities && unit.specialAbilities.length > 0) {
    console.log(`  ${chalk.bold('Special Abilities:')}`);
    unit.specialAbilities.forEach(ability => {
      // Get ability details from game state
      const { getAbilityDetails } = require('../data/unitTemplates');
      const abilityDetails = getAbilityDetails(ability);
      let abilityText = ability;
      
      if (abilityDetails) {
        abilityText = `${ability} (${abilityDetails.name})`;
        console.log(`    ${chalk.cyan(abilityText)}`);
        console.log(`      ${chalk.dim(abilityDetails.description)}`);
      } else {
        console.log(`    ${chalk.cyan(ability)}`);
      }
    });
  }
  
  // Status effects
  if (unit.status.effects && unit.status.effects.length > 0) {
    console.log(`  ${chalk.bold('Status Effects:')}`);
    unit.status.effects.forEach(effect => {
      console.log(`    ${chalk.redBright(effect)}`);
    });
  }
  
  // Critical hits
  if (unit.status.criticalHits && unit.status.criticalHits.length > 0) {
    console.log(`  ${chalk.bold('Critical Hits:')}`);
    unit.status.criticalHits.forEach(critHit => {
      console.log(`    ${chalk.redBright(critHit.effect)}: ${chalk.dim(critHit.description)}`);
    });
  }
  
  // Transport capacity
  if (unit.specialAbilities && (unit.specialAbilities.includes('CAR5') || 
                               unit.specialAbilities.includes('CAR10') ||
                               unit.specialAbilities.includes('TRN5'))) {
    console.log(`  ${chalk.bold('Transport Capacity:')}`);
    
    if (unit.specialAbilities.includes('CAR5')) {
      const cargoAmount = '5 tons';
      console.log(`    • ${chalk.yellow(cargoAmount)} 📦`);
    }
    
    if (unit.specialAbilities.includes('CAR10')) {
      const cargoAmount = '10 tons';
      console.log(`    • ${chalk.yellow(cargoAmount)} 📦`);
    }
    
    if (unit.specialAbilities.includes('TRN5')) {
      const transportAmount = '5';
      console.log(`    • ${chalk.yellow(`${transportAmount} infantry units`)} 👥`);
    }
  }
}

/**
 * Display game status
 * @param {Object} gameState - Current game state
 */
function displayGameStatus(gameState) {
  // Create a fancy header
  console.log('\n' + chalk.bold.cyan('╔═════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║ ') + chalk.bold.yellow('ALPHA STRIKE GAME STATUS') + chalk.bold.cyan(' '.repeat(31) + '║'));
  console.log(chalk.bold.cyan('╚═════════════════════════════════════════════════════════════╝'));
  
  // Create a nice status box for current game state
  console.log(chalk.cyan('┌─────────────────────────────────────────────────────────────┐'));
  
  // Round information with visual indicator
  const roundStr = `Round: ${gameState.turnData.round}`;
  console.log(chalk.cyan('│ ') + 
    chalk.bold('🔄 ') + chalk.bold(roundStr) + 
    chalk.cyan(' '.repeat(60 - roundStr.length) + '│'));
  
  // Phase information with icon and color
  let phaseIcon, phaseColor;
  switch(gameState.turnData.phase) {
    case 'SETUP':
      phaseIcon = '🛠️';
      phaseColor = 'blue';
      break;
    case 'INITIATIVE':
      phaseIcon = '🎲';
      phaseColor = 'magenta';
      break;
    case 'MOVEMENT':
      phaseIcon = '🚶';
      phaseColor = 'green';
      break;
    case 'COMBAT':
      phaseIcon = '💥';
      phaseColor = 'red';
      break;
    case 'END':
      phaseIcon = '🔄';
      phaseColor = 'yellow';
      break;
    default:
      phaseIcon = '❓';
      phaseColor = 'white';
  }
  
  const phaseStr = `Phase: ${gameState.turnData.phase}`;
  console.log(chalk.cyan('│ ') + 
    phaseIcon + ' ' + chalk[phaseColor].bold(phaseStr) + 
    chalk.cyan(' '.repeat(60 - phaseStr.length - 2) + '│'));
  
  // Active player info with icon
  const playerIcon = gameState.turnData.activePlayer === 'player' ? '👤' : '🤖';
  const playerColor = gameState.turnData.activePlayer === 'player' ? 'green' : 'red';
  const activePlayerStr = `Active Player: ${gameState.turnData.activePlayer === 'player' ? 'You' : 'AI'}`;
  console.log(chalk.cyan('│ ') + 
    playerIcon + ' ' + chalk[playerColor].bold(activePlayerStr) + 
    chalk.cyan(' '.repeat(60 - activePlayerStr.length - 2) + '│'));
  
  // Initiative information if applicable
  if (gameState.turnData.phase !== 'SETUP' && gameState.turnData.initiative && gameState.turnData.initiative.winner) {
    const initiativeIcon = '🏆';
    const initiativeColor = gameState.turnData.initiative.winner === 'player' ? 'green' : 'red';
    const rollsInfo = `(Rolls: Player ${gameState.turnData.initiative.rolls.player}, AI ${gameState.turnData.initiative.rolls.ai})`;
    const winnerText = gameState.turnData.initiative.winner === 'player' ? 'You' : 'AI';
    const initiativeStr = `Initiative Winner: ${winnerText} ${rollsInfo}`;
    
    console.log(chalk.cyan('│ ') + 
      initiativeIcon + ' ' + chalk[initiativeColor].bold(`Initiative Winner: ${winnerText}`) + 
      chalk.dim(` ${rollsInfo}`) + 
      chalk.cyan(' '.repeat(Math.max(0, 60 - initiativeStr.length - 2)) + '│'));
  }
  
  // Add victory points or other game metrics (placeholders for future)
  // const victoryPoints = `Victory Points: Player ${playerVP} - AI ${aiVP}`;
  // console.log(chalk.cyan('│ ') + 
  //   '🏅 ' + chalk.bold(victoryPoints) + 
  //   chalk.cyan(' '.repeat(60 - victoryPoints.length - 2) + '│'));
  
  console.log(chalk.cyan('└─────────────────────────────────────────────────────────────┘'));
  
  // Display units only - battlefield is displayed separately
  displayUnits(gameState);
}

/**
 * Display detailed heat information for all units
 * @param {Object} gameState - Current game state
 */
function handleShowHeat() {
  // Create a fancy header
  console.log('\n' + chalk.bold.cyan('╔═════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║ ') + chalk.bold.red('MECH HEAT MANAGEMENT SYSTEM') + chalk.bold.cyan(' '.repeat(27) + '║'));
  console.log(chalk.bold.cyan('╚═════════════════════════════════════════════════════════════╝'));
  
  // Get all units that can track heat (mechs)
  const allUnits = [];
  gameState.battlefield.units.forEach(unit => {
    if (unit.type.includes('mech') && !unit.status.effects.includes('DESTROYED')) {
      allUnits.push(unit);
    }
  });
  
  if (allUnits.length === 0) {
    console.log(chalk.dim('\nNo mechs with heat tracking on the battlefield.'));
    return;
  }
  
  // First display a heat management guide in a nice box
  console.log(chalk.yellow('┌─────────────────────────────────────────────────────────────┐'));
  console.log(chalk.yellow('│ ') + chalk.bold('HEAT MANAGEMENT GUIDE') + chalk.yellow(' '.repeat(38) + '│'));
  console.log(chalk.yellow('├─────────────────────────────────────────────────────────────┤'));
  console.log(chalk.yellow('│ ') + '🔥 ' + chalk.bold('Heat Generation:') + chalk.yellow(' '.repeat(41) + '│'));
  console.log(chalk.yellow('│ ') + '  • Walking: ' + chalk.green('+1 heat') + chalk.yellow(' '.repeat(42) + '│'));
  console.log(chalk.yellow('│ ') + '  • Running: ' + chalk.yellow('+2 heat') + chalk.yellow(' '.repeat(42) + '│'));
  console.log(chalk.yellow('│ ') + '  • Jumping: ' + chalk.red('+3 heat') + chalk.yellow(' '.repeat(42) + '│'));
  console.log(chalk.yellow('│ ') + '  • Firing weapons: +1-3 heat (varies by weapon)' + chalk.yellow(' '.repeat(19) + '│'));
  console.log(chalk.yellow('│ ') + chalk.yellow(' '.repeat(59) + '│'));
  console.log(chalk.yellow('│ ') + '❄️ ' + chalk.bold('Heat Dissipation:') + chalk.yellow(' '.repeat(39) + '│'));
  console.log(chalk.yellow('│ ') + '  • End Phase: -1 heat automatically' + chalk.yellow(' '.repeat(29) + '│'));
  console.log(chalk.yellow('│ ') + chalk.yellow(' '.repeat(59) + '│'));
  console.log(chalk.yellow('│ ') + '⚠️ ' + chalk.bold('Heat Effects:') + chalk.yellow(' '.repeat(44) + '│'));
  console.log(chalk.yellow('│ ') + '  • 50-74%: ' + chalk.yellow('+1 to-hit penalty') + chalk.yellow(' '.repeat(37) + '│'));
  console.log(chalk.yellow('│ ') + '  • 75-99%: ' + chalk.redBright('+2 to-hit penalty, -1 movement') + chalk.yellow(' '.repeat(21) + '│'));
  console.log(chalk.yellow('│ ') + '  • 100%+:  ' + chalk.red('Shutdown risk + auto damage') + chalk.yellow(' '.repeat(24) + '│'));
  console.log(chalk.yellow('└─────────────────────────────────────────────────────────────┘'));
  
  // Display heat status for each unit
  allUnits.forEach(unit => {
    // Get heat data
    const heat = unit.status.heat;
    const heatCapacity = unit.stats.heatCapacity;
    const heatPercentage = Math.floor((heat / heatCapacity) * 100);
    
    // Create header for each mech with its name
    console.log('\n' + chalk.bold.magenta('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓'));
    console.log(chalk.bold(`${unit.name} Heat Status`));
    
    // Create a visual heat bar
    const barWidth = 50;
    const filledBlocks = Math.floor((heat / heatCapacity) * barWidth);
    
    // Determine color for the heat bar
    let barColor;
    if (heatPercentage >= 100) {
      barColor = 'redBright';
    } else if (heatPercentage >= 75) {
      barColor = 'red';
    } else if (heatPercentage >= 50) {
      barColor = 'yellow';
    } else if (heatPercentage >= 25) {
      barColor = 'greenBright';
    } else {
      barColor = 'green';
    }
    
    // Create the heat bar with gradient effect
    let heatBar = '';
    for (let i = 0; i < barWidth; i++) {
      if (i < filledBlocks) {
        // For filled portion, use gradient colors based on position
        if (i < barWidth * 0.25) {
          heatBar += chalk.green('█');
        } else if (i < barWidth * 0.5) {
          heatBar += chalk.greenBright('█');
        } else if (i < barWidth * 0.75) {
          heatBar += chalk.yellow('█');
        } else {
          heatBar += chalk.red('█');
        }
      } else {
        heatBar += chalk.gray('░');
      }
    }
    
    // Display the heat bar with percentages
    console.log(heatBar);
    console.log(chalk.bold(`Heat Level: ${heat}/${heatCapacity} (${heatPercentage}%)`));
    
    // Display heat effects
    const heatEffects = unit.status.effects.filter(e => e.startsWith('HEAT_'));
    if (heatEffects.length > 0) {
      console.log(chalk.bold('Active Heat Effects:'));
      
      heatEffects.forEach(effect => {
        let effectDescription = '';
        switch(effect) {
          case 'HEAT_ATTACK_PENALTY_1':
            effectDescription = chalk.yellow('⚠️ +1 to-hit penalty');
            break;
          case 'HEAT_ATTACK_PENALTY_2':
            effectDescription = chalk.red('⚠️ +2 to-hit penalty');
            break;
          case 'HEAT_MOVEMENT_PENALTY':
            effectDescription = chalk.red('🚶 -1 movement penalty');
            break;
          case 'HEAT_SHUTDOWN_RISK':
            effectDescription = chalk.redBright('💤 Shutdown risk on roll of 12');
            break;
          case 'HEAT_AUTO_DAMAGE':
            effectDescription = chalk.redBright('💥 Automatic damage at end of turn');
            break;
          default:
            effectDescription = effect;
        }
        console.log(`  ${effectDescription}`);
      });
    } else {
      console.log(chalk.green('✓ No heat effects active'));
    }
    
    // Advice for the unit based on current heat level
    console.log(chalk.bold('\nRecommendations:'));
    if (heatPercentage >= 90) {
      console.log(chalk.red('  ⚠️ Critical Heat Level - Shutdown Imminent!'));
      console.log(chalk.red('  • Consider minimum movement only'));
      console.log(chalk.red('  • Avoid all weapon fire if possible'));
      console.log(chalk.red('  • Prepare for possible shutdown'));
    } else if (heatPercentage >= 75) {
      console.log(chalk.redBright('  ⚠️ Dangerous Heat Level'));
      console.log(chalk.redBright('  • Avoid running or jumping'));
      console.log(chalk.redBright('  • Limit weapon fire to essential targets'));
      console.log(chalk.redBright('  • Consider defensive positioning'));
    } else if (heatPercentage >= 50) {
      console.log(chalk.yellow('  ⚠️ Elevated Heat Level'));
      console.log(chalk.yellow('  • Avoid jumping if possible'));
      console.log(chalk.yellow('  • Consider reduced weapon firing'));
    } else {
      console.log(chalk.green('  ✓ Heat levels within normal parameters'));
      console.log(chalk.green('  • Full operational capacity available'));
    }
  });
  
  console.log('\n');
}

/**
 * Handle user commands
 * @param {Object|string} command - Command object or string
 * @param {Object} gameState - Current game state
 * @returns {Promise<boolean>} Continue flag (false to exit game)
 */
async function handleCommand(command, gameState) {
  logger.debug('Handling command:', command);
  
  let commandType;
  
  // Determine if we have a command object or string
  if (typeof command === 'object' && command.type) {
    // Already a command object
    commandType = command.type;
  } else if (typeof command === 'string') {
    // Parse the string command
    const parsedCommand = parseCommand(command);
    command = parsedCommand; // Replace with parsed command
    commandType = parsedCommand.type;
  } else {
    console.log(chalk.yellow('Invalid command format'));
    return true;
  }
  
  // Process the command based on its type
  switch (commandType) {
    case 'QUIT':
    case 'EXIT':
      console.log('Exiting game. Thanks for playing!');
      return false;
      
    case 'HELP':
      console.log(getHelpText(gameState.turnData.phase));
      break;
      
    case 'STATUS':
      displayGameStatus(gameState);
      break;
      
    case 'LIST_UNITS':
      displayUnits(gameState);
      break;
      
    case 'SHOW_HEAT':
      handleShowHeat();
      break;
    
    case 'STARTUP':
      await handleStartupAttempt(command);
      break;
      
    case 'ADD_UNIT':
      await handleAddUnit(command);
      break;
      
    case 'START_GAME':
      // Only allow starting the game during setup phase
      if (gameState.turnData.phase !== PHASES.SETUP) {
        console.log(chalk.yellow('Game is already in progress.'));
        return;
      }
      
      // Ensure both players have at least one unit
      const playerUnits = gameState.players.get('player').units.length;
      const aiUnits = gameState.players.get('ai').units.length;
      
      if (playerUnits === 0) {
        console.log(chalk.yellow('You must add at least one unit before starting the game.'));
        console.log('Use the "Add Unit" command to add a unit.');
        return;
      }
      
      if (aiUnits === 0) {
        await addRandomAiUnit();
      }
      
      console.log(chalk.green('Setup complete. Starting the game!'));
      
      // Advance phase to initiative
      advancePhase(gameState);
      console.log(chalk.cyan(`Advancing to ${gameState.turnData.phase} phase.`));
      displayGameStatus(gameState);
      break;
      
    case 'INITIATIVE_ROLL':
    case 'ROLL_INITIATIVE':
      await handleInitiativeRoll(command);
      break;
      
    case 'MOVE':
      await handleMoveCommand(command);
      break;
      
    case 'MOVE_MENU':
      await handleMoveMenu();
      break;
      
    case 'ATTACK':
      if (gameState.turnData.phase !== PHASES.COMBAT) {
        console.log(chalk.red('You can only attack during the Combat phase.'));
        return;
      }
      await handleAttack(gameState, command.params);
      break;
      
    case 'ATTACK_MENU':
      await handleAttackMenu();
      break;
      
    case 'NEXT_PHASE':
      await handleNextPhase();
      break;

    case 'AI_TURN':
      // Handle AI turn based on the current phase
      if (command.params && command.params.phase === 'MOVEMENT') {
        await handleAiMovement();
      } else if (command.params && command.params.phase === 'COMBAT') {
        await handleAiCombat();
      } else {
        console.log(chalk.yellow('Invalid phase for AI turn command.'));
      }
      break;
      
    case 'ADD_TERRAIN':
      await handleAddTerrain(command);
      break;
      
    case 'UNKNOWN':
      console.log(chalk.yellow(`Unknown command: ${command.original || command}`));
      console.log('Type "help" for a list of commands.');
      break;
      
    case 'END_MOVEMENT':
      // Only allow in movement phase
      if (gameState.turnData.phase !== PHASES.MOVEMENT) {
        console.log(chalk.yellow('This command is only valid during the Movement phase.'));
        return true;
      }
      
      // Only allow if it's the player's turn
      if (gameState.turnData.activePlayer !== 'player') {
        console.log(chalk.yellow("It's not your turn."));
        return true;
      }
      
      console.log(chalk.cyan('Ending player movement phase...'));
      
      // Switch to AI's turn
      switchActivePlayer(gameState);
      await handleAiMovement();
      break;
      
    case 'END_COMBAT':
      // Only allow in combat phase
      if (gameState.turnData.phase !== PHASES.COMBAT) {
        console.log(chalk.yellow('This command is only valid during the Combat phase.'));
        return true;
      }
      
      // Only allow if it's the player's turn
      if (gameState.turnData.activePlayer !== 'player') {
        console.log(chalk.yellow("It's not your turn."));
        return true;
      }
      
      console.log(chalk.cyan('Ending player combat phase...'));
      
      // Switch to AI's turn
      switchActivePlayer(gameState);
      await handleAiCombat();
      break;
      
    case 'DISPLAY':
      displayBattlefield(gameState);
      break;
  }
  
  return true;
}

/**
 * Handle melee attack command
 * @param {Object} gameState - Current game state
 * @param {Object} params - Attack parameters
 * @returns {Promise<boolean>} Success status
 */
async function handleMeleeAttack(gameState, params) {
  const { unitId, targetId, attackType = 'standard' } = params;
  
  // Check if we're in the combat phase
  if (gameState.phase !== 'COMBAT_PHASE') {
    console.log('Melee attacks can only be performed during the Combat Phase.');
    return false;
  }
  
  // Validate unit IDs
  const attackingUnit = gameState.battlefield.units.get(unitId);
  const targetUnit = gameState.battlefield.units.get(targetId);
  
  if (!attackingUnit) {
    console.log(`Unit with ID ${unitId} not found.`);
    return false;
  }
  
  if (!targetUnit) {
    console.log(`Target with ID ${targetId} not found.`);
    return false;
  }
  
  // Check if the unit belongs to the active player
  if (attackingUnit.owner !== gameState.activePlayer) {
    console.log('You can only attack with your own units during your turn.');
    return false;
  }
  
  // Check if the target belongs to the enemy
  if (targetUnit.owner === gameState.activePlayer) {
    console.log('You cannot attack your own units.');
    return false;
  }
  
  // Check if the unit has already attacked this turn
  if (attackingUnit.status.hasAttacked) {
    console.log(`Unit ${unitId} has already attacked this turn.`);
    return false;
  }
  
  // Get melee attack types and validate the requested type
  const { MELEE_ATTACK_TYPES } = require('../engine/meleeCombat');
  const normalizedAttackType = attackType.toUpperCase();
  
  if (!Object.values(MELEE_ATTACK_TYPES).includes(attackType) && 
      !Object.keys(MELEE_ATTACK_TYPES).includes(normalizedAttackType)) {
    console.log(`Invalid attack type: ${attackType}`);
    console.log(`Available attack types: ${Object.keys(MELEE_ATTACK_TYPES).join(', ')}`);
    return false;
  }
  
  // Determine the actual attack type (use the value from enum if key was provided)
  const actualAttackType = Object.keys(MELEE_ATTACK_TYPES).includes(normalizedAttackType) 
    ? MELEE_ATTACK_TYPES[normalizedAttackType] 
    : attackType;
  
  // Perform the melee attack
  const { performMeleeAttack } = require('../engine/meleeCombat');
  const result = performMeleeAttack(gameState, unitId, targetId, actualAttackType);
  
  if (!result.success) {
    console.log(`Melee attack failed: ${result.reason}`);
    return false;
  }
  
  // Display the results
  console.log(`\n===== MELEE ATTACK RESULTS =====`);
  console.log(`${attackingUnit.name} performs a ${result.attackType} attack against ${targetUnit.name}!`);
  console.log(result.description);
  console.log(`Damage dealt: ${result.damage}`);
  
  if (result.selfDamage > 0) {
    console.log(`Attacker takes ${result.selfDamage} points of self-damage.`);
  }
  
  if (result.targetProne) {
    console.log(`${targetUnit.name} has been knocked PRONE!`);
  }
  
  if (result.attackerProne) {
    console.log(`${attackingUnit.name} has fallen PRONE from the attack!`);
  }
  
  // Mark the unit as having attacked
  attackingUnit.status.hasAttacked = true;
  
  // Update the battlefield display
  displayBattlefield(gameState);
  
  return true;
}

/**
 * Handle adding a unit
 * @param {Object} command - Add unit command
 */
async function handleAddUnit(command) {
  // Only allow adding units during setup phase
  if (gameState.turnData.phase !== PHASES.SETUP) {
    console.log(chalk.yellow('Units can only be added during the Setup phase.'));
    return;
  }
  
  // Get available unit types
  const availableUnits = listUnitTemplates();
  
  // If unit type wasn't specified in command, prompt user to select one
  let unitType = command.unitType;
  if (!unitType) {
    const { selectedUnitType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedUnitType',
        message: 'Select a unit type:',
        choices: availableUnits
      }
    ]);
    unitType = selectedUnitType;
  }
  
  const template = getUnitTemplate(unitType);
  
  if (!template) {
    console.log(chalk.yellow(`Unknown unit type: ${unitType}`));
    console.log('Available unit types: ' + availableUnits.join(', '));
    return;
  }
  
  // If position wasn't specified, prompt for X,Y coordinates
  let position = command.position;
  if (!position) {
    const { x, y } = await inquirer.prompt([
      {
        type: 'number',
        name: 'x',
        message: 'Enter X coordinate:',
        default: 0
      },
      {
        type: 'number',
        name: 'y',
        message: 'Enter Y coordinate:',
        default: 0
      }
    ]);
    position = { x, y };
  }
  
  // If facing wasn't specified, prompt for facing direction
  let facing = command.facing;
  if (!facing) {
    const { selectedFacing } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedFacing',
        message: 'Select facing direction:',
        choices: [
          { name: 'North', value: 'N' },
          { name: 'Northeast', value: 'NE' },
          { name: 'East', value: 'E' },
          { name: 'Southeast', value: 'SE' },
          { name: 'South', value: 'S' },
          { name: 'Southwest', value: 'SW' },
          { name: 'West', value: 'W' },
          { name: 'Northwest', value: 'NW' }
        ]
      }
    ]);
    facing = selectedFacing;
  }
  
  // Create a copy of the template
  const unitData = JSON.parse(JSON.stringify(template));
  unitData.position = position;
  unitData.facing = facing;
  
  // Add the unit to the player's force
  const unitId = addUnit(gameState, 'player', unitData);
  console.log(chalk.green(`Added ${unitData.name} at position (${position.x},${position.y}) facing ${facing}`));
  
  // If player has at least one unit, add an AI unit automatically
  if (gameState.players.get('player').units.length === 1) {
    await addRandomAiUnit();
  }
  
  displayBattlefield(gameState);
}

/**
 * Add a random unit to the AI force
 */
async function addRandomAiUnit() {
  // Match the player's unit type distribution
  const playerUnits = gameState.players.get('player').units.map(id => 
    gameState.battlefield.units.get(id)
  );
  
  // Get a random unit type from the player's units or default to mech
  const randomPlayerUnit = playerUnits[Math.floor(Math.random() * playerUnits.length)];
  const unitType = randomPlayerUnit ? randomPlayerUnit.type : 'mech';
  
  // Get a random template of the matching type
  const template = getRandomTemplate(unitType);
  
  if (!template) {
    console.log(chalk.yellow('Could not create AI unit.'));
    return;
  }
  
  // Create a copy of the template
  const unitData = JSON.parse(JSON.stringify(template));
  
  // Position on the opposite side of the map
  const { width, height } = gameState.battlefield.dimensions;
  unitData.position = { 
    x: Math.max(0, width - 5), 
    y: Math.floor(Math.random() * height)
  };
  unitData.facing = 'W'; // Face toward the player
  
  // Add the unit to the AI's force
  const unitId = addUnit(gameState, 'ai', unitData);
  console.log(chalk.yellow(`AI added ${unitData.name} at position (${unitData.position.x},${unitData.position.y})`));
}

/**
 * Handle initiative roll command
 * @param {Object} command - Initiative roll command
 */
async function handleInitiativeRoll(command) {
  // Only allow initiative rolls during the initiative phase
  if (gameState.turnData.phase !== PHASES.INITIATIVE) {
    console.log(chalk.yellow('Initiative can only be rolled during the Initiative phase.'));
    return;
  }
  
  // Generate player roll if not provided
  let playerRoll = command.roll;
  if (!playerRoll) {
    playerRoll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
  }
  
  console.log(chalk.green(`You rolled: ${playerRoll}`));
  
  // Get AI's initiative roll using Claude
  try {
    console.log('AI is rolling for initiative...');
    const aiRollPrompt = createAIPrompt(gameState, 'initiative');
    let aiRollStr = await getClaudeResponse(aiRollPrompt);
    
    // Parse the AI's roll (should be a number between 2-12)
    let aiRoll = parseInt(aiRollStr.trim(), 10);
    
    // Validate and default to random if invalid
    if (isNaN(aiRoll) || aiRoll < 2 || aiRoll > 12) {
      aiRoll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
      console.log(chalk.yellow(`AI returned invalid roll, using random roll instead.`));
    }
    
    console.log(chalk.red(`AI rolled: ${aiRoll}`));
    
    // Process initiative
    const winner = processInitiative(gameState, { player: playerRoll, ai: aiRoll });
    console.log(chalk.cyan(`Initiative winner: ${winner === 'player' ? 'You' : 'AI'}`));
    
    // Advance to movement phase
    advancePhase(gameState);
    console.log(chalk.cyan(`Advancing to ${gameState.turnData.phase} phase.`));
    
    // Display the updated game state
    displayGameStatus(gameState);
    
    // Add clear guidance on next steps
    const activePlayer = gameState.turnData.activePlayer;
    if (activePlayer === 'player') {
      console.log(chalk.bold.green('\n► You won initiative! Select "MOVE" from the menu to move your units.\n'));
    } else {
      console.log(chalk.bold.yellow('\n► AI won initiative. AI will move first. After AI moves, you will be able to move your units.\n'));
      // If AI won initiative, automatically trigger AI movement
      await handleAiMovement();
    }
  } catch (error) {
    console.error('Error during AI initiative roll:', error);
    console.log(chalk.yellow('AI encountered an error. Using random roll.'));
    
    const aiRoll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
    console.log(chalk.red(`AI rolled: ${aiRoll}`));
    
    processInitiative(gameState, { player: playerRoll, ai: aiRoll });
    advancePhase(gameState);
  }
}

/**
 * Helper function to select a player unit using a menu
 * @returns {Promise<Object>} Selected player unit object
 */
async function selectPlayerUnit() {
  try {
    // Get all non-destroyed player units
    const playerUnits = gameState.players.get('player').units
      .map(id => {
        const unit = gameState.battlefield.units.get(id);
        if (!unit) return null;
        return { id, unit };
      })
      .filter(item => item && item.unit && !item.unit.status?.effects?.includes('DESTROYED'));
    
    if (playerUnits.length === 0) {
      console.log(chalk.yellow('No valid player units available.'));
      return null;
    }
    
    // Create formatted choices
    const choices = playerUnits.map(item => ({
      name: `${item.unit.name} at (${item.unit.position.x},${item.unit.position.y})`,
      value: item.unit
    }));
    
    // Prompt user to select
    const { selectedUnit } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedUnit',
        message: 'Select your unit:',
        choices
      }
    ]);
    
    // Return the full unit object instead of just the ID
    return selectedUnit;
  } catch (error) {
    console.log(chalk.red(`Error selecting unit: ${error.message}`));
    return null;
  }
}

/**
 * Helper function to select an AI unit (target) using a menu
 * @returns {Promise<string>} Selected target unit ID
 */
async function selectTargetUnit() {
  // Get all non-destroyed AI units
  const aiUnits = gameState.players.get('ai').units
    .map(id => ({ id, unit: gameState.battlefield.units.get(id) }))
    .filter(item => !item.unit.status.effects.includes('DESTROYED'));
  
  if (aiUnits.length === 0) {
    console.log(chalk.yellow('No valid enemy units available.'));
    return null;
  }
  
  // Create formatted choices
  const choices = aiUnits.map(item => ({
    name: `${item.unit.name} at (${item.unit.position.x},${item.unit.position.y})`,
    value: item.id
  }));
  
  // Prompt user to select
  const { selectedTarget } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedTarget',
      message: 'Select target:',
      choices
    }
  ]);
  
  return selectedTarget;
}

/**
 * Handle move command
 * @param {Object} command - Move command
 * @returns {Promise<boolean>} Success flag
 */
async function handleMoveCommand(command) {
  console.log(chalk.cyan('Processing move command:', JSON.stringify(command)));
  
  // Only allow moves during the movement phase
  if (gameState.turnData.phase !== PHASES.MOVEMENT) {
    console.log(chalk.yellow('Units can only move during the Movement phase.'));
    return false;
  }
  
  // Check if it's the player's turn
  if (gameState.turnData.activePlayer !== 'player') {
    console.log(chalk.yellow('It is not your turn to move.'));
    return false;
  }
  
  // Extract parameters
  const { unitId, position, facing, moveType = 'walk', elevation } = command;
  
  console.log(chalk.cyan(`Move parameters: unitId=${unitId}, position=(${position?.x},${position?.y}), facing=${facing}, moveType=${moveType}`));
  
  // Validate unitId
  if (!unitId) {
    console.log(chalk.yellow('No unit specified for movement.'));
    return false;
  }
  
  // Get the unit
  const unit = gameState.battlefield.units.get(unitId);
  if (!unit) {
    console.log(chalk.yellow(`Unit ${unitId} not found.`));
    return false;
  }
  
  // Check if unit belongs to player
  if (unit.owner !== 'player') {
    console.log(chalk.yellow(`Unit ${unitId} does not belong to you.`));
    return false;
  }
  
  // Check if unit is destroyed
  if (unit.status && unit.status.effects && unit.status.effects.includes('DESTROYED')) {
    console.log(chalk.yellow(`Unit ${unitId} is destroyed and cannot move.`));
    return false;
  }
  
  // Check if unit is immobilized
  if (unit.status && unit.status.effects && unit.status.effects.includes('IMMOBILIZED')) {
    console.log(chalk.yellow(`Unit ${unitId} is immobilized and cannot move.`));
    return false;
  }
  
  // Validate position
  if (!position || position.x === undefined || position.y === undefined) {
    console.log(chalk.yellow('Invalid position for movement.'));
    return false;
  }
  
  // Validate facing
  if (!facing || !DIRECTIONS.includes(facing.toUpperCase())) {
    console.log(chalk.yellow(`Invalid facing direction: ${facing}. Valid options are: ${DIRECTIONS.join(', ')}`));
    return false;
  }
  
  // Validate move type
  const validMoveTypes = ['walk', 'run', 'jump'];
  if (moveType && !validMoveTypes.includes(moveType.toLowerCase())) {
    console.log(chalk.yellow(`Invalid move type: ${moveType}. Valid options are: ${validMoveTypes.join(', ')}`));
    return false;
  }
  
  const normalizedMoveType = moveType.toLowerCase();
  
  // Special handling for VTOL movement if applicable
  let moveOptions = {};
  if (unit.type === 'vehicle' && unit.vehicleType === 'vtol') {
    // If elevation is specified in command, validate and use it
    if (elevation !== undefined) {
      // Validate elevation for VTOLs (1-6 in Alpha Strike)
      if (elevation < 1 || elevation > 6) {
        console.log(chalk.yellow(`Invalid VTOL elevation: ${elevation}. Must be between 1 and 6.`));
        return false;
      }
      moveOptions.elevation = elevation;
      console.log(chalk.cyan(`VTOL ${unitId} changing elevation to ${elevation}`));
    } else {
      // Use current elevation if not specified
      moveOptions.elevation = unit.status.elevation || 1;
    }
  }
  
  // Attempt the move
  console.log(chalk.cyan(`Attempting to move unit ${unitId} to (${position.x},${position.y}) facing ${facing}`));
  
  try {
    const moveResult = moveUnit(
      gameState, 
      unitId, 
      { x: parseInt(position.x), y: parseInt(position.y) }, 
      facing.toUpperCase(), 
      normalizedMoveType,
      moveOptions
    );
    
    if (moveResult) {
      // Format elevation information for VTOLs
      let elevationInfo = '';
      if (unit.type === 'vehicle' && unit.vehicleType === 'vtol') {
        elevationInfo = ` at elevation ${unit.status.elevation}`;
      }
      
      // Format move type with vehicle subtype
      let moveTypeInfo = normalizedMoveType;
      if (unit.type === 'vehicle') {
        moveTypeInfo = `${normalizedMoveType} (${unit.vehicleType})`;
      }
      
      console.log(chalk.green(`Unit ${unitId} moved to (${position.x},${position.y})${elevationInfo} facing ${facing.toUpperCase()} using ${moveTypeInfo} movement.`));
      
      // Display updated battlefield (make sure we use the function from the same context)
      displayBattlefield(gameState);
      displayGameStatus(gameState);
      
      // Return true to indicate success
      return true;
    } else {
      console.log(chalk.red('Movement failed. Check logs for details.'));
      return false;
    }
  } catch (error) {
    console.error(chalk.red(`Error during movement execution: ${error.message}`));
    console.error(error);
    return false;
  }
}

/**
 * Handle AI movement turn
 */
async function handleAiMovement() {
  console.log(chalk.red('AI is planning its moves...'));
  
  // Get all active AI units
  const aiUnits = [];
  gameState.players.get('ai').units.forEach(unitId => {
    const unit = gameState.battlefield.units.get(unitId);
    if (!unit.status.effects.includes('DESTROYED')) {
      aiUnits.push(unit);
    }
  });
  
  // Check if any AI units are shutdown and attempt startup
  for (const unit of aiUnits) {
    if (unit.status.effects.includes('SHUTDOWN')) {
      console.log(chalk.cyan(`AI attempting to restart ${unit.name}...`));
      
      // Attempt startup
      const result = attemptStartup(gameState, unit.id);
      
      if (result.restarted) {
        console.log(chalk.green(`${unit.name} successfully restarted! (Rolled ${result.rolled}, needed ${result.threshold}+)`));
        } else {
        console.log(chalk.yellow(`${unit.name} failed to restart. (Rolled ${result.rolled}, needed ${result.threshold}+)`));
      }
    }
  }
  
  try {
    // Use Claude to make the movement decision if AI has active, non-shutdown units
    const activeUnits = aiUnits.filter(unit => !unit.status.effects.includes('SHUTDOWN'));
    
    if (activeUnits.length === 0) {
      console.log(chalk.yellow('AI has no operational units that can move.'));
      // Even if AI has no units to move, advance phase
      advancePhase(gameState);
      console.log(chalk.cyan(`AI movement phase complete. Advancing to ${gameState.turnData.phase} phase.`));
      displayGameStatus(gameState);
      return;
    }
    
    // Create AI prompt
    const prompt = createAIPrompt(gameState, 'movement');
    
    // Get Claude's response
    const response = await getClaudeResponse(prompt);
    logger.debug('Claude movement response:', response);
    
    // Parse the response
    if (response) {
      // Extract movement command
      // Format should be: MOVE [unitId] TO [x],[y] FACING [direction] [optional: ELEVATION [level]]
      const moveMatch = response.match(/MOVE\s+(\S+)\s+TO\s+(\d+),(\d+)\s+FACING\s+(\S+)(?:\s+ELEVATION\s+(\d+))?/i);
      
      if (moveMatch) {
        const [_, unitId, x, y, facing, elevation] = moveMatch;
        
        // Execute the move
        const moveParams = {
          unitId,
          position: { x: parseInt(x), y: parseInt(y) },
          facing: facing.toUpperCase()
        };
        
        // Log detailed info about the AI's move decision
        const unit = gameState.battlefield.units.get(unitId);
        if (unit) {
          console.log(chalk.cyan(`AI decides to move ${unit.name} (${unitId}) to (${x},${y}) facing ${facing}`));
          
          // Handle VTOL elevation if specified and applicable
          let moveOptions = {};
          if (unit.type === 'vehicle' && unit.vehicleType === 'vtol') {
            // Parse elevation if provided, otherwise use current elevation
            if (elevation !== undefined) {
              const elevationNum = parseInt(elevation);
              if (elevationNum >= 1 && elevationNum <= 6) {
                moveOptions.elevation = elevationNum;
                console.log(chalk.cyan(`VTOL changing to elevation ${elevationNum}`));
              }
            }
          }
        
          // Execute move - AI moves should bypass the checks in handleMoveCommand
          if (unit && unit.owner === 'ai' && !unit.status.effects.includes('DESTROYED')) {
            // Choose movement type (prefer running)
            const moveType = Math.random() < 0.7 ? 'run' : 'walk';
            
            const moveResult = moveUnit(gameState, unitId, moveParams.position, moveParams.facing, moveType, moveOptions);
            if (moveResult) {
              // Special logging for VTOLs
              if (unit.type === 'vehicle' && unit.vehicleType === 'vtol') {
                console.log(chalk.red(`VTOL now at elevation ${unit.status.elevation}`));
              }
              
              console.log(chalk.red(`AI moved ${unitId} to (${x},${y}) facing ${facing}`));
              displayBattlefield(gameState);
        } else {
              console.log(chalk.yellow(`AI move was invalid. Using fallback.`));
              await performRandomAiMove();
        }
      } else {
            console.log(chalk.yellow(`AI attempted invalid move. Using fallback.`));
            await performRandomAiMove();
          }
        } else {
          console.log(chalk.yellow(`AI specified invalid unit ${unitId}. Using fallback.`));
          await performRandomAiMove();
        }
      } else {
        // Fallback to random move if Claude's response couldn't be parsed
        logger.warn('Could not parse Claude movement response:', response);
        console.log(chalk.yellow('AI is making a random move instead.'));
        await performRandomAiMove();
      }
    } else {
      // Fallback to random move if no response from Claude
      logger.warn('No movement response from Claude');
      console.log(chalk.yellow('AI is making a random move instead.'));
      await performRandomAiMove();
    }
  } catch (error) {
    logger.error('Error during AI movement:', error);
    console.log(chalk.yellow('AI encountered an error and will make a random move instead.'));
    
    // Fallback to random move
    await performRandomAiMove();
  }
  
  // Add this section to advance phase after AI movement
  advancePhase(gameState);
  switchActivePlayer(gameState); // Set player as active for combat phase
  console.log(chalk.cyan(`AI movement phase complete. Advancing to ${gameState.turnData.phase} phase.`));
  console.log(chalk.green("Your turn for the Combat phase."));
  displayGameStatus(gameState);
}

/**
 * Perform a random AI move as fallback
 */
async function performRandomAiMove() {
  // Get all non-destroyed AI units
  const aiUnits = gameState.players.get('ai').units
    .map(id => ({ id, unit: gameState.battlefield.units.get(id) }))
    .filter(item => !item.unit.status.effects.includes('DESTROYED') && !item.unit.status.effects.includes('IMMOBILIZED'));
  
  if (aiUnits.length === 0) {
    console.log(chalk.yellow('No valid AI units available to move.'));
    return;
  }
  
  // Select a random unit
  const randomIndex = Math.floor(Math.random() * aiUnits.length);
  const { id: unitId, unit } = aiUnits[randomIndex];
  
  // Get valid positions within movement range
  const { width, height } = gameState.battlefield.dimensions;
  const validPositions = [];
  
  // Determine max movement distance
  let maxDistance = unit.stats.movement.run;
  
  // Apply movement damage penalties
  if (unit.status.movementDamage) {
    maxDistance -= (unit.status.movementDamage * 2);
  }
  
  // Apply engine damage for vehicles
  if (unit.type === 'vehicle' && unit.status.engineDamage) {
    maxDistance = Math.floor(maxDistance * 0.5);
  }
  
  // Ensure minimum movement of 2
  maxDistance = Math.max(2, maxDistance);
  
  // Vehicle-specific movement options
  let moveOptions = {};
  const isVTOL = unit.type === 'vehicle' && unit.vehicleType === 'vtol';
  
  // For VTOLs, randomly change elevation occasionally
  if (isVTOL) {
    const currentElevation = unit.status.elevation || 1;
    
    // 30% chance to change elevation
    if (Math.random() < 0.3) {
      // Random new elevation between 1-6
      let newElevation;
      if (currentElevation === 1) {
        // If at elevation 1, only go up
        newElevation = currentElevation + Math.floor(Math.random() * 3) + 1; // 2-4
      } else if (currentElevation >= 4) {
        // If high, only go down
        newElevation = currentElevation - Math.floor(Math.random() * 3) - 1; // -1 to -3
      } else {
        // Otherwise 50% chance up or down
        const direction = Math.random() < 0.5 ? 1 : -1;
        newElevation = currentElevation + (direction * (Math.floor(Math.random() * 2) + 1));
      }
      
      // Clamp to valid range
      newElevation = Math.max(1, Math.min(6, newElevation));
      
      moveOptions.elevation = newElevation;
      console.log(chalk.yellow(`VTOL ${unitId} changing elevation to ${newElevation}`));
    } else {
      // Maintain current elevation
      moveOptions.elevation = currentElevation;
    }
  }
  
  // Find valid positions within movement range
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const dx = x - unit.position.x;
      const dy = y - unit.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= maxDistance && distance > 0) {
        // Check terrain suitability for vehicle type
        if (unit.type === 'vehicle' && !isVTOL) {
          const terrainType = getTerrainAt(gameState, { x, y });
          const vehicleType = unit.vehicleType || 'tracked';
          
          // Skip water for non-amphibious ground vehicles
          if (terrainType === TERRAIN_TYPES.WATER && 
              vehicleType !== 'hover' && 
              !unit.stats.specialAbilities?.includes('AMP')) {
            continue;
          }
          
          // Skip terrain that's impassable for this vehicle type
          if (VEHICLE_MOVEMENT_MODIFIERS[vehicleType] && 
              VEHICLE_MOVEMENT_MODIFIERS[vehicleType][terrainType] === 0) {
            continue;
          }
        }
        
        // Check if position is already occupied (except for VTOLs)
        let positionOccupied = false;
        
        for (const [otherId, otherUnit] of gameState.battlefield.units.entries()) {
          if (otherId !== unitId && 
              otherUnit.position.x === x && 
              otherUnit.position.y === y) {
            
            // VTOLs can share space with ground units
            if (isVTOL) {
              const isOtherVTOL = otherUnit.type === 'vehicle' && otherUnit.vehicleType === 'vtol';
              
              // VTOLs can't share with other VTOLs at same elevation
              if (isOtherVTOL && otherUnit.status.elevation === moveOptions.elevation) {
                positionOccupied = true;
                break;
              }
              
              // Can share with ground units, so keep positionOccupied as false
            } else {
              // Non-VTOLs can't share positions
              positionOccupied = true;
              break;
            }
          }
        }
        
        if (!positionOccupied) {
          validPositions.push({ x, y });
        }
      }
    }
  }
  
  if (validPositions.length === 0) {
    console.log(chalk.yellow(`No valid positions found for AI unit ${unitId}. Skipping move.`));
    return;
  }
  
  // Select a random valid position
  const randomPosition = validPositions[Math.floor(Math.random() * validPositions.length)];
  
  // Determine facing (usually toward the player units)
  let facing = 'N';
  const playerUnits = gameState.players.get('player').units
    .map(id => gameState.battlefield.units.get(id))
    .filter(unit => !unit.status.effects.includes('DESTROYED'));
  
  if (playerUnits.length > 0) {
    // Find the closest player unit
    let closestUnit = playerUnits[0];
    let closestDistance = Number.MAX_VALUE;
    
    for (const playerUnit of playerUnits) {
      const dx = playerUnit.position.x - randomPosition.x;
      const dy = playerUnit.position.y - randomPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestUnit = playerUnit;
      }
    }
    
    // Calculate appropriate facing direction towards closest player unit
    const dx = closestUnit.position.x - randomPosition.x;
    const dy = closestUnit.position.y - randomPosition.y;
    
    // Determine facing based on angle
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    
    if (angle >= -22.5 && angle < 22.5) facing = 'E';
    else if (angle >= 22.5 && angle < 67.5) facing = 'SE';
    else if (angle >= 67.5 && angle < 112.5) facing = 'S';
    else if (angle >= 112.5 && angle < 157.5) facing = 'SW';
    else if (angle >= 157.5 || angle < -157.5) facing = 'W';
    else if (angle >= -157.5 && angle < -112.5) facing = 'NW';
    else if (angle >= -112.5 && angle < -67.5) facing = 'N';
    else if (angle >= -67.5 && angle < -22.5) facing = 'NE';
  } else {
    // Random facing if no player units
    const facings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    facing = facings[Math.floor(Math.random() * facings.length)];
  }
  
  // Choose movement type (walk or run)
  const moveType = Math.random() < 0.6 ? 'run' : 'walk';
  
  // Execute the move
  console.log(chalk.yellow(`AI randomly moving ${unitId} to (${randomPosition.x},${randomPosition.y}) facing ${facing} using ${moveType}.`));
  
  const moveResult = moveUnit(gameState, unitId, randomPosition, facing, moveType, moveOptions);
  
  if (moveResult) {
    // Special logging for VTOL elevation
    if (isVTOL) {
      console.log(chalk.yellow(`VTOL now at elevation ${unit.status.elevation}`));
    }
    
    console.log(chalk.red(`AI moved unit ${unitId} to (${randomPosition.x},${randomPosition.y}) facing ${facing}.`));
    displayBattlefield(gameState);
  } else {
    console.log(chalk.yellow(`Random AI move failed for unit ${unitId}.`));
  }
}

/**
 * Handle attack command
 * @param {Object} command - Attack command
 */
async function handleAttack(gameState, params) {
  if (!params || !params.attacker || !params.target) {
    // If no parameters provided, use menu-based selection
    const playerUnits = gameState.players.get('player').units
      .map(id => ({ id, unit: gameState.battlefield.units.get(id) }))
      .filter(item => !item.unit.status.effects.includes('DESTROYED'));
    
    const aiUnits = gameState.players.get('ai').units
      .map(id => ({ id, unit: gameState.battlefield.units.get(id) }))
      .filter(item => !item.unit.status.effects.includes('DESTROYED'));
    
    if (playerUnits.length === 0) {
      console.log(chalk.red('You have no units available to attack with.'));
      return;
    }
    
    if (aiUnits.length === 0) {
      console.log(chalk.red('There are no enemy units available to attack.'));
      return;
    }
    
    // Let the player select the attacker
    const attackerChoices = playerUnits.map(item => ({
      name: `${item.unit.name} (${item.unit.id}) at position (${item.unit.position.x},${item.unit.position.y})`,
      value: item.id
    }));
    
    const { attackerId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'attackerId',
        message: 'Select your unit to attack with:',
        choices: attackerChoices
      }
    ]);
    
    const attacker = playerUnits.find(item => item.id === attackerId);
    
    // Let the player select the target
    const targetChoices = aiUnits.map(item => ({
      name: `${item.unit.name} (${item.unit.id}) at position (${item.unit.position.x},${item.unit.position.y})`,
      value: item.id
    }));
    
    const { targetId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'targetId',
        message: 'Select an enemy unit to attack:',
        choices: targetChoices
      }
    ]);
    
    const target = aiUnits.find(item => item.id === targetId);
    
    // Now handle the attack with the selected units
    params = { attacker: attackerId, target: targetId };
  }
  
  const attacker = gameState.battlefield.units.get(params.attacker);
  const target = gameState.battlefield.units.get(params.target);
  
  if (!attacker) {
    console.log(chalk.red(`Attacker with ID ${params.attacker} not found.`));
    return;
  }
  
  if (!target) {
    console.log(chalk.red(`Target with ID ${params.target} not found.`));
    return;
  }
  
  if (attacker.owner !== 'player') {
    console.log(chalk.red(`You can only attack with your own units.`));
    return;
  }
  
  if (target.owner !== 'ai') {
    console.log(chalk.red(`You can only attack enemy units.`));
    return;
  }
  
  if (attacker.status.effects.includes('DESTROYED')) {
    console.log(chalk.red(`${attacker.name} (${attacker.id}) is destroyed and cannot attack.`));
    return;
  }
  
  if (target.status.effects.includes('DESTROYED')) {
    console.log(chalk.red(`${target.name} (${target.id}) is already destroyed.`));
    return;
  }
  
  // Calculate distance
  const distance = Math.sqrt(
    Math.pow(target.position.x - attacker.position.x, 2) + 
    Math.pow(target.position.y - attacker.position.y, 2)
  );
  
  // Get weapon damage based on range
  let damage = 0;
  if (distance <= 2) {
    damage = attacker.stats.damage.short;
    console.log(`Using short range weapons (0-2 hexes)`);
  } else if (distance <= 6) {
    damage = attacker.stats.damage.medium;
    console.log(`Using medium range weapons (3-6 hexes)`);
  } else if (distance <= 12) {
    damage = attacker.stats.damage.long;
    console.log(`Using long range weapons (7-12 hexes)`);
  } else {
    console.log(chalk.red(`Target is out of range (${distance} hexes)`));
    return;
  }
  
  // Calculate to-hit number based on movement and target size
  let toHitNumber = attacker.stats.skill + target.stats.tmm;
  console.log(`Base to-hit: ${attacker.stats.skill} (pilot skill) + ${target.stats.tmm} (target movement modifier) = ${toHitNumber}`);
  
  // Check if target is in terrain and apply modifiers
  const terrainAtTarget = getTerrainAt(gameState, target.position);
  if (terrainAtTarget) {
    const terrainModifier = terrainAtTarget.combatModifier || 0;
    if (terrainModifier !== 0) {
      toHitNumber += terrainModifier;
      console.log(`${terrainAtTarget.name} adds ${terrainModifier} to to-hit number`);
    }
  }
  
  // Roll to hit
  const hitRoll = rollDice(2, 6);
  console.log(`Rolling to hit: ${hitRoll} vs target number ${toHitNumber}`);
  
  if (hitRoll >= toHitNumber) {
    console.log(chalk.green(`Hit! ${attacker.name} (${attacker.id}) hits ${target.name} (${target.id})`));
    
    // Apply damage
    console.log(`Applying ${damage} damage to target`);
    const damageResult = applyDamage(gameState, target.id, damage);
    
    // Critical hit processing
    if (hitRoll === 12 || damageResult.structureDamage > 0) {
      const structureRatio = target.status.damage.structure / target.stats.structure;
      
      // Check for a critical hit (natural 12 or significant structure damage)
      if (hitRoll === 12 || structureRatio >= 0.25) {
        console.log(chalk.redBright(`⚠️ Critical hit check triggered!`));
        const critResult = processCriticalHit(gameState, target.id);
        
        if (critResult.success) {
          console.log(chalk.red(`💥 Critical Hit! ${target.name} suffers ${critResult.effect} (Roll: ${critResult.roll})`));
          console.log(chalk.yellow(`   ${critResult.description}`));
        }
      }
    }
    
    // Check if target is destroyed
    if (target.status.effects.includes('DESTROYED')) {
      console.log(chalk.red(`${target.name} (${target.id}) has been destroyed!`));
      
      // Check if game is over using the new function
      endGameIfOver(gameState);
    } else {
      console.log(`${target.name} (${target.id}) has ${target.stats.armor - target.status.damage.armor} armor and ${target.stats.structure - target.status.damage.structure} structure remaining`);
    }
  } else {
    console.log(chalk.yellow(`Miss! ${attacker.name} (${attacker.id}) failed to hit ${target.name} (${target.id})`));
  }
  
  // Mark the unit as has attacked
  attacker.status.effects.push('ATTACKED');
  
  // Check if all player units have attacked
  const canStillAttack = Array.from(gameState.battlefield.units.values()).some(unit => 
    unit.owner === 'player' && !unit.status.effects.includes('DESTROYED') && !unit.status.effects.includes('ATTACKED')
  );
  
  if (!canStillAttack) {
    console.log(chalk.green('All your units have attacked. Combat phase for player is complete.'));
    console.log(chalk.cyan('AI will now attack with its units...'));
    
    // Handle AI attack phase
    await handleAiCombat(gameState);
    
    // After both sides have attacked, move to next phase
    console.log(chalk.green('Combat phase complete. Moving to next round.'));
    
    // Reset attacked flag for all units
    Array.from(gameState.battlefield.units.values()).forEach(unit => {
      unit.status.effects = unit.status.effects.filter(e => !e.startsWith('ATTACKED'));
    });
    
    // Increment the round and go back to INITIATIVE phase
    gameState.turnData.round++;
    gameState.turnData.phase = PHASES.INITIATIVE;
    console.log(chalk.magenta(`Starting round ${gameState.turnData.round}`));
  }
}

/**
 * Handle AI combat phase
 */
async function handleAiCombat() {
  console.log(chalk.cyan("AI is thinking about its combat actions..."));
  
  try {
    // Create AI prompt for combat decision
    const aiCombatPrompt = createAIPrompt(gameState, 'combat');
    
    // Get AI's decision
    const aiResponse = await getClaudeResponse(aiCombatPrompt);
    
    // Try to match a melee attack command first
    // Expected format: MELEE WITH [unit_id] TARGET [target_id] ATTACK [attack_type]
    const meleeMatch = aiResponse.match(/MELEE\s+WITH\s+([a-z0-9_-]+)\s+TARGET\s+([a-z0-9_-]+)\s+ATTACK\s+([a-z0-9_-]+)/i);
    
    if (meleeMatch) {
      const attackerId = meleeMatch[1];
      const targetId = meleeMatch[2];
      const attackType = meleeMatch[3].toLowerCase();
      
      // Check if the units exist and are valid
      const attacker = gameState.battlefield.units.get(attackerId);
      const target = gameState.battlefield.units.get(targetId);
      
      const validAttacker = attacker && attackerId.startsWith('ai') && !attacker.status.effects.includes('DESTROYED');
      const validTarget = target && targetId.startsWith('player') && !target.status.effects.includes('DESTROYED');
      
      // Validate the attack type
    const { MELEE_ATTACK_TYPES } = require('../engine/meleeCombat');
      const validAttackType = Object.values(MELEE_ATTACK_TYPES).includes(attackType) || 
                             Object.keys(MELEE_ATTACK_TYPES).map(k => k.toLowerCase()).includes(attackType);
      
      if (!validAttacker || !validTarget || !validAttackType) {
        console.log(chalk.yellow(`AI attempted invalid melee attack. Choosing random attack instead.`));
        await performRandomAiAttack();
      } else {
        // Process the melee attack
        const { performMeleeAttack } = require('../engine/meleeCombat');
        const result = performMeleeAttack(gameState, attackerId, targetId, attackType);
        
        if (result.success) {
          console.log(chalk.red(`AI melee attack! ${attackerId} performs a ${attackType} attack against ${targetId}!`));
          console.log(chalk.red(`${result.description}`));
          console.log(chalk.red(`Damage dealt: ${result.damage}`));
          
          if (result.selfDamage > 0) {
            console.log(chalk.green(`${attackerId} takes ${result.selfDamage} points of self-damage.`));
          }
          
          if (result.targetProne) {
            console.log(chalk.red(`${targetId} has been knocked PRONE!`));
          }
          
          if (result.attackerProne) {
            console.log(chalk.green(`${attackerId} has fallen PRONE from the attack!`));
          }
          
          // Check if the target was destroyed
          const target = gameState.battlefield.units.get(targetId);
          if (target.status.effects.includes('DESTROYED')) {
            console.log(chalk.red.bold(`${targetId} was destroyed!`));
          }
          
          displayBattlefield(gameState);
      } else {
          console.log(chalk.yellow(`AI melee attack was invalid: ${result.reason}. Using fallback attack.`));
          await performRandomAiAttack();
      }
    }
  } else {
      // If not a melee attack, try to match a ranged attack
    // Expected format: ATTACK WITH [unit_id] TARGET [target_id]
    const attackMatch = aiResponse.match(/ATTACK\s+WITH\s+([a-z0-9_-]+)\s+TARGET\s+([a-z0-9_-]+)/i);
    
    if (attackMatch) {
      const attackerId = attackMatch[1];
      const targetId = attackMatch[2];
      
      // Check if the units exist and are valid
      const attacker = gameState.battlefield.units.get(attackerId);
      const target = gameState.battlefield.units.get(targetId);
      
      const validAttacker = attacker && attackerId.startsWith('ai') && !attacker.status.effects.includes('DESTROYED');
      const validTarget = target && targetId.startsWith('player') && !target.status.effects.includes('DESTROYED');
      
      if (!validAttacker || !validTarget) {
        console.log(chalk.yellow(`AI attempted invalid attack. Choosing random attack instead.`));
        await performRandomAiAttack();
      } else {
        // Process the attack
        const attackResult = processAttack(gameState, attackerId, targetId);
        
        if (attackResult.success) {
          if (attackResult.hit) {
            console.log(chalk.red(`AI attack hit! ${attackerId} dealt ${attackResult.damage} damage to ${targetId} at ${attackResult.rangeBand} range.`));
            
            // Check if the target was destroyed
            const target = gameState.battlefield.units.get(targetId);
            if (target.status.effects.includes('DESTROYED')) {
              console.log(chalk.red.bold(`${targetId} was destroyed!`));
            }
          } else {
            console.log(chalk.green(`AI attack missed! ${attackerId} vs ${targetId} (${attackResult.attackValue} < ${attackResult.targetNumber})`));
          }
          
          displayBattlefield(gameState);
        } else {
          console.log(chalk.yellow(`AI attack was invalid. Using fallback attack.`));
          await performRandomAiAttack();
        }
      }
    } else {
      console.log(chalk.yellow(`AI returned invalid attack command. Using fallback attack.`));
      await performRandomAiAttack();
      }
    }
  } catch (error) {
    console.error('Error during AI combat:', error);
    console.log(chalk.yellow('AI encountered an error. Using fallback attack.'));
    await performRandomAiAttack();
  }
  
  // End AI combat phase, advance to end phase
  switchActivePlayer(gameState);
  console.log(chalk.cyan("AI's combat phase complete."));
  
  advancePhase(gameState);
  console.log(chalk.cyan(`Advancing to ${gameState.turnData.phase} phase.`));
  
  displayGameStatus(gameState);
  
  // Check if game is over using the new function
  if (endGameIfOver(gameState)) {
    return;
  }
}

/**
 * Perform a random AI attack as fallback
 */
async function performRandomAiAttack() {
  // Get all non-destroyed AI units
  const aiUnits = gameState.players.get('ai').units
    .map(id => gameState.battlefield.units.get(id))
    .filter(unit => !unit.status.effects.includes('DESTROYED'));
  
  // Get all non-destroyed player units
  const playerUnits = gameState.players.get('player').units
    .map(id => gameState.battlefield.units.get(id))
    .filter(unit => !unit.status.effects.includes('DESTROYED'));
  
  if (aiUnits.length === 0 || playerUnits.length === 0) {
    console.log(chalk.yellow('No valid units for AI to attack with or no valid targets.'));
    return;
  }
  
  // Find the best attack by trying all combinations
  let bestRangedAttack = null;
  let bestMeleeAttack = null;
  let bestRange = Infinity;
  
  const { canPerformMeleeAttackType, performMeleeAttack, MELEE_ATTACK_TYPES } = require('../engine/meleeCombat');
  
  for (const attacker of aiUnits) {
    // Skip units that have already attacked
    if (attacker.status.hasAttacked) {
      continue;
    }
    
    for (const target of playerUnits) {
      // Calculate distance
      const distance = Math.sqrt(
        Math.pow(target.position.x - attacker.position.x, 2) + 
        Math.pow(target.position.y - attacker.position.y, 2)
      );
      
      // Check for melee opportunity if units are adjacent (distance = 1)
      if (distance <= 1) {
        // Check if the unit can perform melee attacks
        const standardMeleeCheck = canPerformMeleeAttackType(
          gameState, 
          attacker, 
          target, 
          MELEE_ATTACK_TYPES.STANDARD
        );
        
        if (standardMeleeCheck.success) {
          bestMeleeAttack = { 
            attackerId: attacker.id, 
            targetId: target.id, 
            attackType: MELEE_ATTACK_TYPES.STANDARD 
          };
          // Melee is usually preferable, so break out of the loop
          break;
        }
        
        // Check for charge attack if the unit moved at least 3 hexes
        if (attacker.status.distanceMoved >= 3) {
          const chargeMeleeCheck = canPerformMeleeAttackType(
            gameState, 
            attacker, 
            target, 
            MELEE_ATTACK_TYPES.CHARGE
          );
          
          if (chargeMeleeCheck.success) {
            bestMeleeAttack = { 
              attackerId: attacker.id, 
              targetId: target.id, 
              attackType: MELEE_ATTACK_TYPES.CHARGE 
            };
            break;
          }
        }
        
        // For mechs, check for punch or kick
    if (attacker.type === 'mech') {
          // Try punch first
          const punchMeleeCheck = canPerformMeleeAttackType(
            gameState, 
            attacker, 
            target, 
            MELEE_ATTACK_TYPES.PUNCH
          );
          
          if (punchMeleeCheck.success) {
            bestMeleeAttack = { 
              attackerId: attacker.id, 
              targetId: target.id, 
              attackType: MELEE_ATTACK_TYPES.PUNCH 
            };
            break;
          }
          
          // Then try kick
          const kickMeleeCheck = canPerformMeleeAttackType(
            gameState, 
            attacker, 
            target, 
            MELEE_ATTACK_TYPES.KICK
          );
          
          if (kickMeleeCheck.success) {
            bestMeleeAttack = { 
              attackerId: attacker.id, 
              targetId: target.id, 
              attackType: MELEE_ATTACK_TYPES.KICK 
            };
            break;
          }
        }
      }
      
      // Determine range band for ranged attack
      let rangeBand;
      if (distance <= 6) rangeBand = 'short';
      else if (distance <= 12) rangeBand = 'medium';
      else if (distance <= 24) rangeBand = 'long';
      else rangeBand = 'extreme';
      
      // Check if attacker can attack at this range
      if (attacker.stats.damage[rangeBand] > 0) {
        // If we found a valid attack and it's at a better range, store it
        if (distance < bestRange) {
          bestRange = distance;
          bestRangedAttack = { attackerId: attacker.id, targetId: target.id, range: distance, rangeBand };
        }
      }
    }
    
    // If we found a valid melee attack, break out of the loop
    if (bestMeleeAttack) {
      break;
    }
  }
  
  // Prioritize melee attacks over ranged attacks
  if (bestMeleeAttack) {
    // Process the melee attack
    const result = performMeleeAttack(
      gameState, 
      bestMeleeAttack.attackerId, 
      bestMeleeAttack.targetId, 
      bestMeleeAttack.attackType
    );
    
    if (result.success) {
      console.log(chalk.red(`AI melee attack! ${bestMeleeAttack.attackerId} performs a ${bestMeleeAttack.attackType} attack against ${bestMeleeAttack.targetId}!`));
      console.log(chalk.red(`${result.description}`));
      console.log(chalk.red(`Damage dealt: ${result.damage}`));
      
      if (result.selfDamage > 0) {
        console.log(chalk.green(`${bestMeleeAttack.attackerId} takes ${result.selfDamage} points of self-damage.`));
      }
      
      // Check if the target was destroyed
      const target = gameState.battlefield.units.get(bestMeleeAttack.targetId);
      if (target.status.effects.includes('DESTROYED')) {
        console.log(chalk.red.bold(`${bestMeleeAttack.targetId} was destroyed!`));
      }
      
      displayBattlefield(gameState);
      return;
    }
  }
  
  // If no valid melee attack or melee failed, try ranged attack
  if (bestRangedAttack) {
    // Process the attack
    const attackResult = processAttack(gameState, bestRangedAttack.attackerId, bestRangedAttack.targetId);
    
    if (attackResult.success) {
      if (attackResult.hit) {
        console.log(chalk.red(`AI attack hit! ${bestRangedAttack.attackerId} dealt ${attackResult.damage} damage to ${bestRangedAttack.targetId} at ${bestRangedAttack.rangeBand} range.`));
        
        // Report critical hit if one occurred
        if (attackResult.criticalHit && attackResult.criticalResult) {
          console.log(chalk.red(`⚠️ Critical Hit! ${bestRangedAttack.targetId} suffers ${attackResult.criticalResult.effect}`));
          console.log(chalk.yellow(`   ${attackResult.criticalResult.description}`));
        }
        
        // Check if the target was destroyed
        const target = gameState.battlefield.units.get(bestRangedAttack.targetId);
        if (target.status.effects.includes('DESTROYED')) {
          console.log(chalk.red.bold(`${bestRangedAttack.targetId} was destroyed!`));
        }
      } else {
        console.log(chalk.green(`AI attack missed! ${bestRangedAttack.attackerId} vs ${bestRangedAttack.targetId} (${attackResult.attackValue} < ${attackResult.targetNumber})`));
      }
      
      displayBattlefield(gameState);
    } else {
      console.log(chalk.yellow(`AI couldn't make any valid attacks.`));
    }
  } else {
    console.log(chalk.yellow(`AI couldn't find any valid attacks.`));
  }
}

/**
 * Handle next phase command
 */
async function handleNextPhase() {
  const currentPhase = gameState.turnData.phase;
  
  // Handle phase transition based on current phase
  switch (currentPhase) {
    case PHASES.SETUP:
      // Ensure both players have at least one unit
      const playerUnits = gameState.players.get('player').units.length;
      const aiUnits = gameState.players.get('ai').units.length;
      
      if (playerUnits === 0) {
        console.log(chalk.yellow('You must add at least one unit before starting the game.'));
        console.log('Use "add [unit_type]" to add a unit. Available types: ' + listUnitTemplates().join(', '));
        return;
      }
      
      if (aiUnits === 0) {
        await addRandomAiUnit();
      }
      
      console.log(chalk.cyan('Setup complete. Starting the game!'));
      advancePhase(gameState);
      break;
      
    case PHASES.INITIATIVE:
      console.log(chalk.yellow('Please roll for initiative first using the "roll" command.'));
      return;
      
    case PHASES.MOVEMENT:
      // If it's the player's turn, switch to AI
      if (gameState.turnData.activePlayer === 'player') {
        switchActivePlayer(gameState);
        await handleAiMovement();
      } else {
        // If it's the AI's turn, advance to combat
        advancePhase(gameState);
        console.log(chalk.cyan(`Advancing to ${gameState.turnData.phase} phase.`));
      }
      break;
      
    case PHASES.COMBAT:
      // If it's the player's turn, switch to AI
      if (gameState.turnData.activePlayer === 'player') {
        switchActivePlayer(gameState);
        await handleAiCombat();
      } else {
        // If it's the AI's turn, advance to end phase
        advancePhase(gameState);
        console.log(chalk.cyan(`Advancing to ${gameState.turnData.phase} phase.`));
      }
      break;
      
    case PHASES.END:
      // End phase: Process heat dissipation
      const heatResults = processHeatDissipation(gameState);
      
      // Display heat dissipation results
      console.log(chalk.cyan('End Phase: Processing heat dissipation'));
      Object.entries(heatResults.units).forEach(([unitId, result]) => {
        const unit = gameState.battlefield.units.get(unitId);
        if (result.heatDissipated > 0) {
          console.log(`${unit.name} (${unitId}) cooled by ${result.heatDissipated} heat (${result.newHeat}/${unit.stats.heat.capacity})`);
        }
        if (result.heatDamage > 0) {
          console.log(chalk.red(`${unit.name} (${unitId}) took ${result.heatDamage} damage from excess heat!`));
        }
      });
      
      // Process shutdown checks for units with HEAT_SHUTDOWN_RISK
      processShutdownChecks(gameState);
      
      // Advance to a new turn
      advancePhase(gameState);
      console.log(chalk.cyan(`Starting new round: ${gameState.turnData.round}`));
      break;
  }
  
  // Display the updated game state
  displayGameStatus(gameState);
  
  // Check if game is over
  const gameOverCheck = checkGameOver(gameState);
  if (gameOverCheck.gameOver) {
    console.log(chalk.bold.cyan(`\n===== GAME OVER =====`));
    console.log(chalk.bold(`Winner: ${gameOverCheck.winner === 'player' ? 'Player' : 'AI'}`));
  }
}

/**
 * Handle adding terrain
 * @param {Object} command - Add terrain command
 */
async function handleAddTerrain(command) {
  // Only allow adding terrain during setup phase
  if (gameState.turnData.phase !== PHASES.SETUP) {
    console.log(chalk.yellow('Terrain can only be added during the Setup phase.'));
    return;
  }
  
  // Prompt for terrain type if not provided
  let terrainType = command.terrainType;
  if (!terrainType) {
    const { selectedTerrainType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedTerrainType',
        message: 'Select a terrain type:',
        choices: Object.values(TERRAIN_TYPES)
      }
    ]);
    terrainType = selectedTerrainType;
  }
  
  // Prompt for position if not provided
  let position = command.position;
  if (!position) {
    const { x, y } = await inquirer.prompt([
      {
        type: 'number',
        name: 'x',
        message: 'Enter X coordinate:',
        default: 0
      },
      {
        type: 'number',
        name: 'y',
        message: 'Enter Y coordinate:',
        default: 0
      }
    ]);
    position = { x, y };
  }
  
  // Add terrain to the battlefield
  const success = setTerrain(gameState, position, terrainType);
  if (success) {
    console.log(chalk.green(`Added ${terrainType} terrain at position (${position.x},${position.y})`));
    displayBattlefield(gameState);
  } else {
    console.log(chalk.yellow(`Failed to add terrain at position (${position.x},${position.y})`));
  }
}

/**
 * Set up a test scenario with terrain
 * @param {Object} gameState - Current game state
 */
async function setupTestScenario(gameState) {
    console.log(chalk.magenta('Setting up test scenario with terrain...'));
    
    // Add light woods in center (10,10) to (13,13)
    for (let x = 10; x <= 13; x++) {
        for (let y = 10; y <= 13; y++) {
            setTerrain(gameState, { x, y }, TERRAIN_TYPES.LIGHT_WOODS);
            console.log(`Added light woods at (${x},${y})`);
        }
    }

    // Add heavy woods in bottom right (16,16) to (19,19)
    for (let x = 16; x <= 19; x++) {
        for (let y = 16; y <= 19; y++) {
            setTerrain(gameState, { x, y }, TERRAIN_TYPES.HEAVY_WOODS);
            console.log(`Added heavy woods at (${x},${y})`);
        }
    }

    // Add player mech (Battlemaster) at (5,12) facing East
    const battlemaster = getUnitTemplate('battlemaster');
    if (battlemaster) {
        battlemaster.position = { x: 5, y: 12 };
        battlemaster.facing = 'E';
        addUnit(gameState, 'player', battlemaster);
        console.log(`Added player Battlemaster at (5,12) facing East`);
    }

    // Add AI mech (Shadow Hawk) at (15,12) facing West
    const shadowhawk = getUnitTemplate('shadow-hawk');
    if (shadowhawk) {
        shadowhawk.position = { x: 15, y: 12 };
        shadowhawk.facing = 'W';
        addUnit(gameState, 'ai', shadowhawk);
        console.log(`Added AI Shadow Hawk at (15,12) facing West`);
    }

    // Add player mech (Wolverine) in light woods
    const wolverine = getUnitTemplate('wolverine');
    if (wolverine) {
        wolverine.position = { x: 11, y: 11 };
        wolverine.facing = 'S';
        addUnit(gameState, 'player', wolverine);
        console.log(`Added player Wolverine at (11,11) in light woods facing South`);
    }

    // Add AI mech (Trebuchet) in heavy woods
    const trebuchet = getUnitTemplate('trebuchet');
    if (trebuchet) {
        trebuchet.position = { x: 18, y: 18 };
        trebuchet.facing = 'N';
        addUnit(gameState, 'ai', trebuchet);
        console.log(`Added AI Trebuchet at (18,18) in heavy woods facing North`);
    }

    console.log(chalk.green('Terrain test scenario setup complete!'));
    
    displayBattlefield(gameState);
}

/**
 * Set up a test scenario specifically for heat mechanics
 * @param {Object} gameState - Game state to modify
 */
async function setupHeatTestScenario(gameState) {
  console.log(chalk.cyan('Setting up heat test scenario...'));
  
  // Clear existing units and terrain
  gameState.battlefield.units.clear();
  gameState.battlefield.terrain.clear();
  gameState.players.get('player').units = [];
  gameState.players.get('ai').units = [];
  
  // Add light woods in the center (10,10) to (13,13)
  for (let x = 10; x <= 13; x++) {
    for (let y = 10; y <= 13; y++) {
      setTerrain(gameState, { x, y }, TERRAIN_TYPES.LIGHT_WOODS);
      console.log(`Added light woods at (${x},${y})`);
    }
  }
  
  // Add heavy woods in the corner (16,16) to (19,19)
  for (let x = 16; x <= 19; x++) {
    for (let y = 16; y <= 19; y++) {
      setTerrain(gameState, { x, y }, TERRAIN_TYPES.HEAVY_WOODS);
      console.log(`Added heavy woods at (${x},${y})`);
    }
  }
  
  // Create player mech (Battlemaster) with medium heat level
  const battlemaster = getUnitTemplate('battlemaster');
  if (!battlemaster) {
    console.log(chalk.red('Error: Battlemaster template not found'));
    return;
  }
  
  // Set heat capacity
  if (!battlemaster.stats.heat) {
    battlemaster.stats.heat = {};
  }
  battlemaster.stats.heat.capacity = 10;
  
  // Add to game
  battlemaster.position = { x: 5, y: 12 };
  battlemaster.facing = 'E';
  const playerMechId = addUnit(gameState, 'player', battlemaster);
  
  // Set initial heat level (50%)
  const playerMech = gameState.battlefield.units.get(playerMechId);
  playerMech.status.heat = 5;
  
  // Add heat effects
  const playerHeatEffects = getHeatEffects(playerMech);
  playerMech.status.effects = playerMech.status.effects.filter(e => !e.startsWith('HEAT_'));
  playerHeatEffects.forEach(effect => playerMech.status.effects.push(effect));
  
  console.log(chalk.green(`Added player Battlemaster at (5,12) with 50% heat`));
  
  // Create another player mech (Archer) with high heat level
  const archer = getUnitTemplate('archer');
  if (archer) {
    // Set heat capacity
    if (!archer.stats.heat) {
      archer.stats.heat = {};
    }
    archer.stats.heat.capacity = 8;
    
    // Add to game
    archer.position = { x: 8, y: 8 };
    archer.facing = 'SE';
    const playerMech2Id = addUnit(gameState, 'player', archer);
    
    // Set initial heat level (75%)
    const playerMech2 = gameState.battlefield.units.get(playerMech2Id);
    playerMech2.status.heat = 6;
    
    // Add heat effects
    const playerHeatEffects2 = getHeatEffects(playerMech2);
    playerMech2.status.effects = playerMech2.status.effects.filter(e => !e.startsWith('HEAT_'));
    playerHeatEffects2.forEach(effect => playerMech2.status.effects.push(effect));
    
    console.log(chalk.green(`Added player Archer at (8,8) with 75% heat`));
  }
  
  // Create AI mech (Shadow Hawk) with moderate heat
  const shadowhawk = getUnitTemplate('shadow-hawk');
  if (!shadowhawk) {
    console.log(chalk.red('Error: Shadow Hawk template not found'));
    return;
  }
  
  // Set heat capacity
  if (!shadowhawk.stats.heat) {
    shadowhawk.stats.heat = {};
  }
  shadowhawk.stats.heat.capacity = 8;
  
  // Add to game
  shadowhawk.position = { x: 19, y: 12 };
  shadowhawk.facing = 'W';
  const aiMechId = addUnit(gameState, 'ai', shadowhawk);
  
  // Set initial heat level (38%)
  const aiMech = gameState.battlefield.units.get(aiMechId);
  aiMech.status.heat = 3;
  
  // Add heat effects
  const aiHeatEffects = getHeatEffects(aiMech);
  aiMech.status.effects = aiMech.status.effects.filter(e => !e.startsWith('HEAT_'));
  aiHeatEffects.forEach(effect => aiMech.status.effects.push(effect));
  
  console.log(chalk.red(`Added AI Shadow Hawk at (19,12) with 38% heat`));
  
  // Create another AI mech (Awesome) with critical heat
  const awesome = getUnitTemplate('awesome');
  if (awesome) {
    // Set heat capacity
    if (!awesome.stats.heat) {
      awesome.stats.heat = {};
    }
    awesome.stats.heat.capacity = 12;
    
    // Add to game
    awesome.position = { x: 17, y: 17 };
    awesome.facing = 'NW';
    const aiMech2Id = addUnit(gameState, 'ai', awesome);
    
    // Set initial heat level (100%)
    const aiMech2 = gameState.battlefield.units.get(aiMech2Id);
    aiMech2.status.heat = 12;
    
    // Add heat effects
    const aiHeatEffects2 = getHeatEffects(aiMech2);
    aiMech2.status.effects = aiMech2.status.effects.filter(e => !e.startsWith('HEAT_'));
    aiHeatEffects2.forEach(effect => aiMech2.status.effects.push(effect));
    
    console.log(chalk.red(`Added AI Awesome at (17,17) with 100% heat in heavy woods`));
  }
  
  console.log(chalk.green('Heat test scenario set up complete!'));
  
  // Advance past setup phase directly to initiative
  advancePhase(gameState);
  console.log(chalk.cyan('Advancing to Initiative phase...'));
  
  // Display the battlefield and heat information
  displayBattlefield(gameState);
  handleShowHeat();
}

/**
 * Handle attack menu to select a unit and target for attack
 */
async function handleAttackMenu() {
  try {
    // Select attacking unit - now returns the full unit object
    const attacker = await selectPlayerUnit();
    if (!attacker) return false;
    
    // Validate the attacker has all required properties
    if (!attacker.type || !attacker.status || !attacker.stats) {
      console.log(chalk.red('\nError: Selected unit is invalid or missing required properties.'));
      return false;
    }
    
    // Get all valid targets
    const possibleTargets = Array.from(gameState.battlefield.units.values())
      .filter(u => u.owner !== 'player' && !u.status.effects.includes('DESTROYED'));
    
    if (possibleTargets.length === 0) {
      console.log(chalk.yellow('\nNo valid targets available.'));
      return false;
    }
    
    // Import special abilities functions
    const { hasSpecialAbility, applySpecialAbility } = require('../engine/specialAbilities');
    
    // Check if this unit can perform special attacks - with proper error handling
    let canPerformAntiMechAttack = false;
    try {
      canPerformAntiMechAttack = attacker.type === 'infantry' && 
                                hasSpecialAbility(attacker, 'AC') &&
                                possibleTargets.some(target => 
                                  target && target.type === 'mech' && 
                                  applySpecialAbility(
                                    attacker, 
                                    'AC', 
                                    'canPerformAntiMechAttack', 
                                    [attacker, target, gameState]
                                  )
                                );
    } catch (err) {
      console.log(chalk.yellow('Warning: Could not check for Anti-Mech attack capability.'));
      canPerformAntiMechAttack = false;
    }
    
    // Check if unit can perform Death From Above attack - with proper error handling
    let canPerformDFA = false;
    try {
      canPerformDFA = hasSpecialAbility(attacker, 'JJ') && 
                      attacker.status && 
                      attacker.status.lastMoveType === 'jump' &&
                      possibleTargets.some(target => 
                        target && applySpecialAbility(
                          attacker, 
                          'JJ', 
                          'canPerformDFA', 
                          [attacker, target, gameState]
                        )
                      );
    } catch (err) {
      console.log(chalk.yellow('Warning: Could not check for Death From Above capability.'));
      canPerformDFA = false;
    }
    
    // Ask what type of attack to perform
    let attackType = 'standard';
    
    // Only ask if there are multiple options
    if (canPerformAntiMechAttack || canPerformDFA) {
      const attackChoices = [
        { name: 'Standard Attack', value: 'standard' }
      ];
      
      if (canPerformAntiMechAttack) {
        attackChoices.push({ name: 'Anti-Mech Attack (Infantry Only)', value: 'anti-mech' });
      }
      
      if (canPerformDFA) {
        attackChoices.push({ name: 'Death From Above (Jumping Units Only)', value: 'dfa' });
      }
      
      const attackTypeAnswers = await inquirer.prompt([
      {
        type: 'list',
          name: 'attackType',
          message: 'Select attack type:',
          choices: attackChoices
        }
      ]);
      
      attackType = attackTypeAnswers.attackType;
    }
    
    // Filter targets based on attack type
    let validTargets = possibleTargets;
    
    if (attackType === 'anti-mech') {
      validTargets = possibleTargets.filter(target => 
        target && target.type === 'mech' && 
        applySpecialAbility(
          attacker, 
          'AC', 
          'canPerformAntiMechAttack', 
          [attacker, target, gameState]
        )
      );
      
      if (validTargets.length === 0) {
        console.log(chalk.yellow('\nNo valid targets for Anti-Mech attack! Targets must be adjacent Mechs.'));
        return false;
      }
    } else if (attackType === 'dfa') {
      validTargets = possibleTargets.filter(target => 
        target && applySpecialAbility(
          attacker, 
          'JJ', 
          'canPerformDFA', 
          [attacker, target, gameState]
        )
      );
      
      if (validTargets.length === 0) {
        console.log(chalk.yellow('\nNo valid targets for Death From Above attack! You must have jumped onto the target this turn.'));
        return false;
      }
    }
    
    // Let the player select a target from valid targets
    const targetChoices = validTargets.map(unit => ({
      name: `${unit.name} (${unit.id}) at position (${unit.position.x},${unit.position.y})`,
      value: unit.id
    }));
    
    const { targetId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'targetId',
        message: 'Select an enemy unit to attack:',
        choices: targetChoices
      }
    ]);
    
    // Now handle the attack with the selected units
    const params = { 
      attacker: attacker.id, // Use the unit's ID from the unit object
      target: targetId, 
      attackType: attackType 
    };
    
    // Call the appropriate attack handler based on the type
    if (attackType === 'standard') {
      await handleAttack(gameState, params);
      return true;
    } else if (attackType === 'anti-mech') {
      // Call the anti-mech attack handler (if implemented)
      console.log(chalk.yellow('Anti-Mech attack is not yet fully implemented.'));
      return false;
    } else if (attackType === 'dfa') {
      // Call the Death From Above attack handler (if implemented)
      console.log(chalk.yellow('Death From Above attack is not yet fully implemented.'));
      return false;
    }
    
    return true;
  } catch (error) {
    console.log(chalk.red(`Error during attack: ${error.message}`));
    return false;
  }
}

/**
 * Start the game and run the main game loop
 */
async function startGame() {
  console.log(chalk.bold.cyan('\n========================================'));
  console.log(chalk.bold.yellow('    ALPHA STRIKE AI GAME MASTER'));
  console.log(chalk.bold.cyan('========================================\n'));

  // Initialize game state
  gameState = createGameState();
  
  // Generate initial battlefield with proper Map object
  const mapTemplate = mapGenerator.getMapTemplate('GRASSLANDS', 20, 20);
  if (mapTemplate instanceof Map) {
    gameState.battlefield.terrain = mapTemplate;
  } else {
    // Fallback to a blank map if the template isn't a Map
    gameState.battlefield.terrain = new Map();
    console.log(chalk.yellow('Warning: Could not load map template. Using blank map.'));
  }
  gameState.battlefield.dimensions = { width: 20, height: 20 };
  
  let running = true;
  
  // Show initial battlefield - only once at the start
  displayBattlefield(gameState);
  
  // Display welcome message and help
  console.log(chalk.green('\nWelcome to Alpha Strike AI Game Master! Type HELP for available commands.'));
  
  while (running) {
    try {
      // Check if the game is over at the beginning of each loop
      if (endGameIfOver(gameState)) {
        // Add a special reset option to the command choices
        commandChoices.unshift({ 
          name: chalk.bold.green('▶ NEW GAME - Start a new game'), 
          value: 'new game' 
        });
      }
      
      // Display current game status, but don't redisplay the battlefield each time
      // The battlefield will be displayed after actions that change it
      displayGameStatus(gameState);
      
      // Command choices based on game state
      const commandChoices = [
        { name: 'HELP - Show available commands', value: 'help' },
      ];
      
      // Add phase-specific commands
      if (gameState.turnData && gameState.turnData.phase) {
        switch (gameState.turnData.phase) {
          case PHASES.SETUP:
            // Add setup-specific commands
            commandChoices.push({ name: 'SETUP - Set up a test scenario', value: 'setup' });
            commandChoices.push({ name: 'ADD UNIT - Add a unit to the battlefield', value: 'add unit' });
            commandChoices.push({ name: 'MAP - Map commands (load, random)', value: 'map' });
            
            // Check if player has at least one unit to enable starting the game
            const hasPlayerUnits = gameState.players.get('player').units.length > 0;
            if (hasPlayerUnits) {
              commandChoices.push({ name: 'START GAME - Begin the battle', value: 'start game' });
            }
            break;
          case PHASES.INITIATIVE:
            // Make the ROLL INITIATIVE option the first in the list and highlight it
            commandChoices.unshift({ 
              name: chalk.bold.yellow('▶ ROLL INITIATIVE - Roll to determine who goes first'), 
              value: 'roll initiative' 
            });
            break;
          case PHASES.MOVEMENT:
            commandChoices.push({ name: 'MOVE - Move a unit', value: 'move' });
            commandChoices.push({ name: 'JUMP - Jump with a unit', value: 'jump' });
            commandChoices.push({ name: 'STARTUP - Restart a shutdown unit', value: 'startup' });
            commandChoices.push({ name: 'NEXT - Proceed to next phase', value: 'next' });
            break;
          case PHASES.COMBAT:
            commandChoices.push({ name: 'ATTACK - Attack with a unit', value: 'attack' });
            commandChoices.push({ name: 'MELEE - Perform melee attack', value: 'melee' });
            commandChoices.push({ name: 'NEXT - Proceed to next phase', value: 'next' });
            break;
          case PHASES.END:
            commandChoices.push({ name: 'NEXT - Proceed to next turn', value: 'next' });
            break;
        }
      }
      
      // Always add these commands at the end
      commandChoices.push({ name: 'SHOW UNITS - Display all units', value: 'show units' });
      commandChoices.push({ name: 'EXIT - Quit the game', value: 'exit' });
      
      // Get user selection from the list
      const { commandChoice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'commandChoice',
          message: 'Select command:',
          prefix: chalk.bold.green('►'),
          pageSize: 10,
          choices: commandChoices
        }
      ]);
      
      // Handle exit command
      if (commandChoice === 'exit') {
        console.log(chalk.yellow('Exiting game...'));
        running = false;
        continue;
      }
      
      // Handle help command directly
      if (commandChoice === 'help') {
        console.log(getHelpText());
        continue;
      }
      
      // Handle show units command
      if (commandChoice === 'show units') {
        displayUnits(gameState);
        continue;
      }
      
      // Handle setup command
      if (commandChoice === 'setup') {
        await setupTestScenario(gameState);
        continue;
      }
      
      // For other commands, map them to appropriate handlers
      switch (commandChoice) {
        case 'new game':
          // Reset the game state
          console.log(chalk.green('Starting a new game...'));
          gameState = createGameState();
          
          // Generate a new battlefield
          const newMapTemplate = mapGenerator.getMapTemplate('GRASSLANDS', 20, 20);
          if (newMapTemplate instanceof Map) {
            gameState.battlefield.terrain = newMapTemplate;
          } else {
            gameState.battlefield.terrain = new Map();
          }
          gameState.battlefield.dimensions = { width: 20, height: 20 };
          
          // Display the new battlefield
          displayBattlefield(gameState);
          break;
          
        case 'add unit':
          const { unitCategory } = await inquirer.prompt([
            {
              type: 'list',
              name: 'unitCategory',
              message: 'Select unit category:',
              choices: ['mech', 'vehicle', 'infantry', 'vtol']
            }
          ]);
          
          // Get templates that match the selected category
          let availableTemplates = [];
          const { listUnitTemplatesByType, listUnitTemplatesByVehicleType } = require('../data/unitTemplates');
          
          if (unitCategory === 'vtol') {
            availableTemplates = listUnitTemplatesByVehicleType('vtol');
          } else {
            availableTemplates = listUnitTemplatesByType(unitCategory);
          }
          
          if (availableTemplates.length === 0) {
            console.log(chalk.yellow(`No templates found for category: ${unitCategory}`));
            break;
          }
          
          // Now ask for specific unit template
          const { unitType } = await inquirer.prompt([
            {
              type: 'list',
              name: 'unitType',
              message: `Select ${unitCategory} type:`,
              choices: availableTemplates
            }
          ]);
          
          await handleAddUnit({ type: 'ADD_UNIT', unitType });
          break;
          
        case 'map':
          const { mapAction } = await inquirer.prompt([
            {
              type: 'list',
              name: 'mapAction',
              message: 'Select map action:',
              choices: [
                { name: 'Load a map template', value: 'load' },
                { name: 'Generate a random map', value: 'random' }
              ]
            }
          ]);
          await handleMapCommand(mapAction, '', gameState);
          break;
          
        case 'start game':
          // Only allow starting the game during setup phase
          if (gameState.turnData.phase !== PHASES.SETUP) {
            console.log(chalk.yellow('Game is already in progress.'));
            break;
          }
          
          // Ensure both players have at least one unit
          const playerUnits = gameState.players.get('player').units.length;
          
          if (playerUnits === 0) {
            console.log(chalk.yellow('You must add at least one unit before starting the game.'));
            break;
          }
          
          // Add an AI unit if none exist
          if (gameState.players.get('ai').units.length === 0) {
            await addRandomAiUnit();
          }
          
          console.log(chalk.green('Setup complete. Starting the game!'));
          
          // Advance phase to initiative
          advancePhase(gameState);
          console.log(chalk.cyan(`Advancing to ${gameState.turnData.phase} phase.`));
          displayGameStatus(gameState);
          
          // Add clear instructions for what to do next
          console.log(chalk.bold.yellow('\n► Next Step: Select "ROLL INITIATIVE" from the menu to determine which player goes first.\n'));
          break;
          
        case 'move':
          // Call the menu interface to handle the move command
          const { getMenuCommand } = require('./menuInterface');
          const moveCommand = await getMenuCommand(gameState);
          if (moveCommand && moveCommand.type === 'MOVE') {
            console.log(chalk.cyan(`Processing move command for unit ${moveCommand.unitId} to position (${moveCommand.position.x},${moveCommand.position.y})`));
            await handleMoveCommand(moveCommand);
          }
          break;
          
        case 'attack':
          // Implement attack menu
          await handleAttackMenu();
          break;
          
        case 'melee':
          // Implement melee menu
          // First select a unit
          const attackerId = await selectPlayerUnit();
          if (!attackerId) break;
          
          // Then select a target
          const targetId = await selectTargetUnit();
          if (!targetId) break;
          
          // Finally, select attack type
          const { MELEE_ATTACK_TYPES } = require('../engine/meleeCombat');
          
          const { selectedAttackType } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedAttackType',
              message: 'Select melee attack type:',
              choices: [
                { name: 'Standard Melee Attack', value: 'STANDARD' },
                { name: 'Charge Attack', value: 'CHARGE' },
                { name: 'Punch Attack (Mechs only)', value: 'PUNCH' },
                { name: 'Kick Attack (Mechs only)', value: 'KICK' }
              ]
            }
          ]);
          
          const meleeParams = { 
            unitId: attackerId, 
            targetId: targetId,
            attackType: selectedAttackType
          };
          
          await handleMeleeAttack(gameState, meleeParams);
          break;
          
        case 'roll initiative':
          await handleInitiativeRoll({ type: 'INITIATIVE_ROLL' });
          break;
          
        case 'next':
          await handleNextPhase();
          break;
          
        case 'jump':
          // Call the menu interface to handle jump movement
          const { handleJumpUnitMenu } = require('./menuInterface');
          const jumpCommand = await handleJumpUnitMenu(gameState);
          if (jumpCommand && jumpCommand.type === 'MOVE') {
            console.log(chalk.cyan(`Processing jump command for unit ${jumpCommand.unitId} to position (${jumpCommand.position.x},${jumpCommand.position.y})`));
            await handleMoveCommand(jumpCommand);
          }
          break;
          
        case 'startup':
          // Handle startup attempt for shutdown units
          await handleStartupAttempt({});
          break;
          
        default:
          // Pass command to command parser for handling
          const command = parseCommand(commandChoice);
          await handleCommand(command, gameState);
      }
      
    } catch (error) {
      console.error('Error:', error);
      console.log(chalk.red('Something went wrong. Please try again.'));
    }
  }
}

// Make sure to export the startGame function
module.exports = {
  startGame
};

// Add this function after the imports at the top of the file

/**
 * Roll dice
 * @param {number} numDice - Number of dice to roll
 * @param {number} sides - Number of sides on each die
 * @returns {number} Sum of the dice rolls
 */
function rollDice(numDice, sides) {
  let total = 0;
  for (let i = 0; i < numDice; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total;
}

/**
 * Handle startup attempt for a shutdown unit
 * @param {Object} command - Command object
 */
async function handleStartupAttempt(command) {
  // Only allow startup attempts during movement phase
  if (gameState.turnData.phase !== PHASES.MOVEMENT) {
    console.log(chalk.yellow('Startup attempts can only be made during the Movement phase.'));
    return;
  }
  
  // Check if it's the player's turn
  if (gameState.turnData.activePlayer !== 'player') {
    console.log(chalk.yellow('It is not your turn.'));
    return;
  }
  
  let unitId = command.unitId;
  
  // If no unit specified, let the player select from their shutdown units
  if (!unitId) {
    const shutdownUnits = [];
    gameState.players.get('player').units.forEach(id => {
      const unit = gameState.battlefield.units.get(id);
      if (unit && unit.status.effects.includes('SHUTDOWN')) {
        shutdownUnits.push({ name: `${unit.name} (${id})`, value: id });
      }
    });
    
    if (shutdownUnits.length === 0) {
      console.log(chalk.yellow('You have no shutdown units that can attempt startup.'));
      return;
    }
    
    const { selectedUnit } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedUnit',
        message: 'Select a shutdown unit to attempt startup:',
        choices: [...shutdownUnits, { name: 'Cancel', value: null }]
      }
    ]);
    
    unitId = selectedUnit;
    
    if (!unitId) {
      console.log(chalk.yellow('Startup attempt cancelled.'));
      return;
    }
  }
  
  // Attempt startup
  const result = attemptStartup(gameState, unitId);
  
  if (!result.success) {
    console.log(chalk.yellow(`Error: ${result.message}`));
    return;
  }
  
  const unit = gameState.battlefield.units.get(unitId);
  
  if (result.restarted) {
    console.log(chalk.green(`${unit.name} successfully restarted! (Rolled ${result.rolled}, needed ${result.threshold}+)`));
  } else {
    console.log(chalk.yellow(`${unit.name} failed to restart. (Rolled ${result.rolled}, needed ${result.threshold}+)`));
  }
  
  // Display updated unit status
  displayUnitInfo(unit);
}

/**
 * Display unit information
 * @param {Object} gameState - Current game state
 */
function displayUnits(gameState) {
  console.log('\n' + chalk.bold.cyan('╔═════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║ ') + chalk.bold.yellow('UNITS ON THE BATTLEFIELD') + chalk.bold.cyan(' '.repeat(32) + '║'));
  console.log(chalk.bold.cyan('╚═════════════════════════════════════════════════════════════╝'));
  
  // Player units
  const playerUnits = gameState.players.get('player').units;
  if (playerUnits && playerUnits.length > 0) {
    console.log(chalk.green.bold('\n◆ PLAYER UNITS ◆'));
    console.log(chalk.green('─'.repeat(20)));
    playerUnits.forEach(unitId => {
      const unit = gameState.battlefield.units.get(unitId);
      if (unit) {
        displayUnitInfo(unit);
      }
    });
  } else {
    console.log(chalk.dim('\nNo player units on the battlefield.'));
  }
  
  // AI units
  const aiUnits = gameState.players.get('ai').units;
  if (aiUnits && aiUnits.length > 0) {
    console.log(chalk.red.bold('\n◆ AI UNITS ◆'));
    console.log(chalk.red('─'.repeat(15)));
    aiUnits.forEach(unitId => {
      const unit = gameState.battlefield.units.get(unitId);
      if (unit) {
        displayUnitInfo(unit);
      }
    });
  } else {
    console.log(chalk.dim('\nNo AI units on the battlefield.'));
  }
  
  console.log();
}

/**
 * Handle map-related commands
 * @param {string} action - The map action to perform (load, random, list)
 * @param {string} params - Parameters for the action
 * @param {Object} gameState - Current game state
 * @returns {Promise<boolean>} Success status
 */
async function handleMapCommand(action, params, gameState) {
  switch (action) {
    case 'load':
      // MAP LOAD [template_name] [width] [height]
      const loadParams = params ? params.split(' ') : [];
      const templateName = loadParams[0];
      const width = parseInt(loadParams[1]) || 20;
      const height = parseInt(loadParams[2]) || 20;
      
      if (!templateName) {
        console.log(chalk.yellow('Usage: MAP LOAD [template_name] [width] [height]'));
        console.log('Available templates:');
        mapGenerator.getAvailableMapTemplates().forEach(template => {
          console.log(`  ${template.id}: ${template.name} - ${template.description}`);
        });
        return true;
      }
      
      try {
        // Generate terrain map from template
        const terrainMap = mapGenerator.getMapTemplate(templateName.toUpperCase(), width, height);
        
        // Update the game state with the new terrain
        gameState.battlefield.terrain = terrainMap;
        gameState.battlefield.dimensions = { width, height };
        
        console.log(chalk.green(`Map "${templateName}" loaded successfully (${width}x${height}).`));
        
        // Clear units when loading a new map
        if (confirm('Clear existing units and start fresh?')) {
          gameState.battlefield.units = new Map();
          gameState.players.get('player').units = [];
          gameState.players.get('ai').units = [];
          console.log(chalk.yellow('All units have been cleared.'));
        }
        
        // Display the new battlefield
        displayBattlefield(gameState);
      } catch (error) {
        console.log(chalk.red(`Error loading map template: ${error.message}`));
      }
      break;
      
    case 'random':
      // MAP RANDOM [width] [height]
      const randomParams = params ? params.split(' ') : [];
      const randomWidth = parseInt(randomParams[0]) || 20;
      const randomHeight = parseInt(randomParams[1]) || 20;
      
      try {
        // Generate random terrain map
        const terrainMap = mapGenerator.generateRandomMap({
          width: randomWidth,
          height: randomHeight,
          clustering: 0.65,
          riverChance: 0.5,
          roadChance: 0.5
        });
        
        // Update the game state with the new terrain
        gameState.battlefield.terrain = terrainMap;
        gameState.battlefield.dimensions = { width: randomWidth, height: randomHeight };
        
        console.log(chalk.green(`Random map generated successfully (${randomWidth}x${randomHeight}).`));
        
        // Clear units when loading a new map
        if (confirm('Clear existing units and start fresh?')) {
          gameState.battlefield.units = new Map();
          gameState.players.get('player').units = [];
          gameState.players.get('ai').units = [];
          console.log(chalk.yellow('All units have been cleared.'));
        }
        
        // Display the new battlefield
        displayBattlefield(gameState);
      } catch (error) {
        console.log(chalk.red(`Error generating random map: ${error.message}`));
      }
      break;
      
    case 'list':
      // MAP LIST - Show available map templates
      console.log(chalk.cyan('Available map templates:'));
      mapGenerator.getAvailableMapTemplates().forEach(template => {
        console.log(`  ${chalk.bold(template.id)}: ${chalk.green(template.name)} - ${template.description}`);
      });
      break;
      
    default:
      console.log(chalk.yellow('Unknown map command. Available commands:'));
      console.log('  MAP LOAD [template_name] [width] [height]');
      console.log('  MAP RANDOM [width] [height]');
      console.log('  MAP LIST');
      break;
  }
  
  return true;
}

// Helper function to simulate simple confirmation
function confirm(message) {
  // In a real terminal application, this would prompt the user
  // For now, we'll just return true
  console.log(chalk.yellow(`${message} (Y/n) [Y]`));
  return true;
}

/**
 * End the game and display the winner
 * @param {Object} gameState - Current game state
 * @returns {boolean} True if game is over, false otherwise
 */
function endGameIfOver(gameState) {
  const gameOverCheck = checkGameOver(gameState);
  if (gameOverCheck.gameOver) {
    console.log(chalk.bold.cyan(`\n===== GAME OVER =====`));
    console.log(chalk.bold(`Winner: ${gameOverCheck.winner === 'player' ? 'Player' : 'AI'}`));
    console.log(chalk.bold(`\nPress any key to start a new game or EXIT to quit.`));
    return true;
  }
  return false;
}