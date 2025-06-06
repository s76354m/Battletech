/**
 * Module for interacting with the Anthropic Claude API
 */
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
const { initializeLogger } = require('../utils/logger');

dotenv.config();
const logger = initializeLogger();

const apiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = new Anthropic({
  apiKey: apiKey,
});

// Default model to use
const DEFAULT_MODEL = 'claude-3-7-sonnet-latest';

/**
 * Send a prompt to Claude and get a response
 * @param {string} prompt - The prompt to send to Claude
 * @param {Object} options - Additional options for the request
 * @param {string} options.model - Optional model override
 * @returns {Promise<string>} - The response from Claude
 */
async function getClaudeResponse(prompt, options = {}) {
  try {
    const model = options.model || DEFAULT_MODEL;
    logger.info(`Using model: ${model}`);
    
    logger.debug('Sending prompt to Claude:', prompt);
    
    const response = await anthropic.messages.create({
      model: model,
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
    });

    logger.debug('Received response:', response);

    if (response && response.content && response.content.length > 0) {
      return response.content[0].text;
    } else {
      throw new Error('Empty response from Claude');
    }
  } catch (error) {
    logger.error('Error getting response from Claude:', error);
    throw error;
  }
}

/**
 * Create a prompt for the AI based on the game state and decision type
 * @param {Object} gameState - The current game state
 * @param {string} decisionType - The type of decision to make (initiative|movement|combat)
 * @returns {string} The formatted prompt
 */
function createAIPrompt(gameState, decisionType) {
  // Base system prompt
  let prompt = `You are an AI controlling a force in the BattleTech Alpha Strike tabletop game.
Based on the following game state, make the best decision for the ${decisionType} phase.

CURRENT GAME STATE:
Round: ${gameState.turnData?.round || 0}
Phase: ${gameState.turnData?.phase || 'N/A'}
Map size: ${gameState.battlefield?.dimensions?.width || 'N/A'}x${gameState.battlefield?.dimensions?.height || 'N/A'}
`;

  // Add units information
  prompt += `\nUNITS ON THE BATTLEFIELD:\n`;
  
  // Player units
  prompt += "PLAYER UNITS (opponent):\n";
  if (gameState.players && gameState.players.get('player')) {
    const playerUnits = gameState.players.get('player').units || [];
    
    if (playerUnits.length > 0) {
      playerUnits.forEach(unitId => {
        const unit = gameState.battlefield.units.get(unitId);
        if (unit) {
          // Check if unit is destroyed
          if (unit.status.effects.includes('DESTROYED')) {
            return; // Skip destroyed units
          }
          
          // Get terrain at unit's position
          const terrainKey = `${unit.position.x},${unit.position.y}`;
          const terrain = gameState.battlefield.terrain.get(terrainKey) || 'clear';
          
          // Get heat information for mechs
          let heatInfo = '';
          if (unit.type.includes('mech')) {
            const heatPercentage = Math.floor((unit.status.heat / unit.stats.heat.capacity) * 100);
            const heatEffects = unit.status.effects.filter(e => e.startsWith('HEAT_'));
            
            heatInfo = `\n  - Heat: ${unit.status.heat}/${unit.stats.heat.capacity} (${heatPercentage}%)`;
            
            if (heatEffects.length > 0) {
              const effectsDescription = [];
              
              if (heatEffects.includes('HEAT_ATTACK_PENALTY_1')) {
                effectsDescription.push('+1 to-hit penalty');
              }
              if (heatEffects.includes('HEAT_ATTACK_PENALTY_2')) {
                effectsDescription.push('+2 to-hit penalty');
              }
              if (heatEffects.includes('HEAT_MOVEMENT_PENALTY')) {
                effectsDescription.push('-1 movement penalty');
              }
              if (heatEffects.includes('HEAT_SHUTDOWN_RISK')) {
                effectsDescription.push('shutdown risk');
              }
              if (heatEffects.includes('HEAT_AUTO_DAMAGE')) {
                effectsDescription.push('auto damage');
              }
              
              if (effectsDescription.length > 0) {
                heatInfo += ` [${effectsDescription.join(', ')}]`;
              }
            }
          }
          
          // Get critical hit information
          let criticalInfo = '';
          if (unit.status.criticalHits && unit.status.criticalHits.length > 0) {
            criticalInfo = '\n  - Critical Hits:';
            unit.status.criticalHits.forEach(crit => {
              criticalInfo += `\n    • ${crit.description || crit.effect}`;
            });
          }
          
          // Include special status effects
          let statusEffects = '';
          if (unit.status.effects.includes('IMMOBILIZED')) {
            statusEffects += '\n  - IMMOBILIZED: Unit cannot move';
          }
          
          prompt += `${unit.name} (${unitId}):
  - Position: (${unit.position.x}, ${unit.position.y}) on ${terrain} terrain
  - Facing: ${unit.facing}
  - Movement: Walk: ${unit.stats.movement.walk}" | Run: ${unit.stats.movement.run}" | Jump: ${unit.stats.movement.jump}"
  - Damage values: S:${unit.stats.damage.short}/M:${unit.stats.damage.medium}/L:${unit.stats.damage.long}/E:${unit.stats.damage.extreme}
  - Armor: ${unit.stats.armor - unit.status.damage.armor}/${unit.stats.armor}
  - Structure: ${unit.stats.structure - unit.status.damage.structure}/${unit.stats.structure}${heatInfo}${criticalInfo}${statusEffects}
  - Special abilities: ${unit.stats.specialAbilities?.length > 0 ? unit.stats.specialAbilities.join(', ') : 'none'}
`;
        }
      });
    } else {
      prompt += "  No player units on the battlefield\n";
    }
  }
  
  // AI units (your units)
  prompt += "\nAI UNITS (your units):\n";
  if (gameState.players && gameState.players.get('ai')) {
    const aiUnits = gameState.players.get('ai').units || [];
    
    if (aiUnits.length > 0) {
      aiUnits.forEach(unitId => {
        const unit = gameState.battlefield.units.get(unitId);
        if (unit) {
          // Check if unit is destroyed
          if (unit.status.effects.includes('DESTROYED')) {
            return; // Skip destroyed units
          }
          
          // Get terrain at unit's position
          const terrainKey = `${unit.position.x},${unit.position.y}`;
          const terrain = gameState.battlefield.terrain.get(terrainKey) || 'clear';
          
          // Get heat information for mechs
          let heatInfo = '';
          if (unit.type.includes('mech')) {
            const heatPercentage = Math.floor((unit.status.heat / unit.stats.heat.capacity) * 100);
            const heatEffects = unit.status.effects.filter(e => e.startsWith('HEAT_'));
            
            heatInfo = `\n  - Heat: ${unit.status.heat}/${unit.stats.heat.capacity} (${heatPercentage}%)`;
            
            if (heatEffects.length > 0) {
              const effectsDescription = [];
              
              if (heatEffects.includes('HEAT_ATTACK_PENALTY_1')) {
                effectsDescription.push('+1 to-hit penalty');
              }
              if (heatEffects.includes('HEAT_ATTACK_PENALTY_2')) {
                effectsDescription.push('+2 to-hit penalty');
              }
              if (heatEffects.includes('HEAT_MOVEMENT_PENALTY')) {
                effectsDescription.push('-1 movement penalty');
              }
              if (heatEffects.includes('HEAT_SHUTDOWN_RISK')) {
                effectsDescription.push('shutdown risk');
              }
              if (heatEffects.includes('HEAT_AUTO_DAMAGE')) {
                effectsDescription.push('auto damage');
              }
              
              if (effectsDescription.length > 0) {
                heatInfo += ` [${effectsDescription.join(', ')}]`;
              }
            }
          }
          
          // Get critical hit information
          let criticalInfo = '';
          if (unit.status.criticalHits && unit.status.criticalHits.length > 0) {
            criticalInfo = '\n  - Critical Hits:';
            unit.status.criticalHits.forEach(crit => {
              criticalInfo += `\n    • ${crit.description || crit.effect}`;
            });
          }
          
          // Include special status effects
          let statusEffects = '';
          if (unit.status.effects.includes('IMMOBILIZED')) {
            statusEffects += '\n  - IMMOBILIZED: Unit cannot move';
          }
          
          // Add movement status
          let movementStatus = '';
          if (unit.status.hasMoved) {
            movementStatus = '\n  - MOVED: Unit has already moved this turn';
          }
          
          // Add attack status
          let attackStatus = '';
          if (unit.status.hasAttacked) {
            attackStatus = '\n  - ATTACKED: Unit has already attacked this turn';
          }
          
          prompt += `${unit.name} (${unitId}):
  - Position: (${unit.position.x}, ${unit.position.y}) on ${terrain} terrain
  - Facing: ${unit.facing}
  - Movement: Walk: ${unit.stats.movement.walk}" | Run: ${unit.stats.movement.run}" | Jump: ${unit.stats.movement.jump}"
  - Damage values: S:${unit.stats.damage.short}/M:${unit.stats.damage.medium}/L:${unit.stats.damage.long}/E:${unit.stats.damage.extreme}
  - Armor: ${unit.stats.armor - unit.status.damage.armor}/${unit.stats.armor}
  - Structure: ${unit.stats.structure - unit.status.damage.structure}/${unit.stats.structure}${heatInfo}${criticalInfo}${statusEffects}${movementStatus}${attackStatus}
  - Special abilities: ${unit.stats.specialAbilities?.length > 0 ? unit.stats.specialAbilities.join(', ') : 'none'}
`;
        }
      });
    } else {
      prompt += "  No AI units on the battlefield\n";
    }
  }
  
  // Add terrain information
  prompt += "\nTERRAIN INFORMATION:\n";
  prompt += `- clear: No movement or combat penalties
- light_woods: Half movement speed, +1 to-hit modifier
- heavy_woods: Half movement speed, +2 to-hit modifier
`;

  // Add heat mechanics information
  prompt += "\nHEAT MECHANICS:\n";
  prompt += `- Mechs generate heat from movement and weapons fire
- At 50% heat: +1 to-hit penalty
- At 75% heat: +2 to-hit penalty and -1 movement
- At 100% heat: Risk of shutdown and automatic damage
`;

  // Add specific guidance based on decision type
  if (decisionType === 'initiative') {
    prompt += `\nINITIATIVE PHASE DECISION:
You need to decide whether to go first or second if you win initiative.

CONSIDERATIONS:
- Going first in movement allows you to position units before opponent
- Going second in combat allows you to react to opponent's attacks
- Current unit positions and condition may influence this decision

Please output your decision in this format:
DECISION: FIRST or SECOND
REASONING: Brief explanation of your reasoning
`;
  } else if (decisionType === 'movement') {
    prompt += `\nMOVEMENT PHASE DECISION:
You need to decide where to move one of your units. Consider terrain, positions, heat levels, and critical damage.

CONSIDERATIONS:
- Movement in terrain affects your TMM and future movement options
- Consider heat generation when deciding on movement type for mechs
- Units with weapon or movement system damage should be positioned carefully
- Immobilized units cannot move at all
- Engine damage reduces movement capabilities
- Positioning affects weapon ranges and hit chances

Please output your decision in this format:
UNIT ID: <id of the unit to move>
MOVEMENT TYPE: WALK, RUN, or JUMP
DESTINATION: x,y coordinates
FACING: N, NE, E, SE, S, SW, W, or NW
REASONING: Brief explanation of your reasoning
`;
  } else if (decisionType === 'combat') {
    prompt += `\nCOMBAT OPTIONS:
1. Ranged Attack: You can attack with a unit using the format: ATTACK WITH [unit_id] TARGET [target_id]
2. Melee Attack: You can perform melee attacks with a unit using the format: MELEE WITH [unit_id] TARGET [target_id] ATTACK [attack_type]

Melee attack types:
- STANDARD: Basic melee attack, requires adjacency
- CHARGE: More powerful attack that requires movement of 3+ hexes, can cause self-damage
- KICK: 'Mech-only attack that can knock down opponent, risks attacker falling
- PUNCH: 'Mech-only attack (non-quad) with moderate damage
- WEAPON: Special attack for units with melee weapons (requires MEL special ability)

Melee Considerations:
- Melee attacks can only be performed by units that moved this turn
- Units must be adjacent to their target (distance of 1)
- Melee typically deals more damage than ranged attacks at the cost of exposure
- Consider unit types and special abilities when choosing melee attack types
- Terrain can influence melee effectiveness
- Charge attacks are available to most units including vehicles and require minimum movement

CONSIDERATIONS:
- Range affects to-hit modifier and damage potential
- Consider unit's current heat level and critical damage status
- Terrain provides defensive bonuses to the target
- Fire control damage makes it harder to hit targets
- Weapon system damage reduces the damage you can deal
- Structure damage to enemy units makes them vulnerable to critical hits

Your task is to decide which unit to attack with, which enemy unit to target, and whether to use ranged or melee combat.
Choose the option that will be most effective based on unit positions, damage capabilities, and tactical advantage.
`;
  }

  return prompt;
}

module.exports = { 
  getClaudeResponse,
  createAIPrompt
}; 