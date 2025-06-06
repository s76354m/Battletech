# Alpha Strike Game Master

An implementation of the BattleTech Alpha Strike tabletop game ruleset with an AI Game Master powered by Claude.

## Overview

This project implements the core rules of BattleTech Alpha Strike, a streamlined version of the BattleTech tabletop game. It includes:

- A text-based interface for gameplay
- An AI opponent powered by Anthropic's Claude
- A variety of unit types (Mechs, Vehicles, Infantry)
- Support for special abilities and equipment
- Terrain effects and line-of-sight calculations
- Heat management for Mechs
- Various combat modifiers and critical hit systems

## Features

- **AI Opponent**: Play against an AI-powered opponent that makes decisions based on the current game state
- **Game State Tracking**: Automatic tracking of unit positions, damage, and game phases
- **Rules Implementation**: Core Alpha Strike rules for movement, combat, and more
- **Menu-Based Command System**: User-friendly interface with selectable commands based on game context
- **Heat Management System**: Full implementation of BattleMech heat mechanics, including:
  - Heat generation from movement and weapons fire
  - Heat dissipation in the end phase
  - Shutdown and startup mechanics
  - Heat effects on movement and combat
- **Critical Hit System**: Comprehensive critical hit mechanics with:
  - Unit type-specific critical hit tables
  - Critical effects impacting movement, weapons, and systems
  - Engine damage, fire control, weapon damage, and more
  - Persistent critical hit tracking and effects
- **Enhanced Vehicle Subtypes**: Detailed implementation of vehicle movement mechanics:
  - Tracked vehicles - better in rough terrain, slower on roads
  - Wheeled vehicles - fast on roads, struggle in rough terrain
  - Hover vehicles - ignore water penalties, moderate cross-country mobility
  - VTOLs - flying units with altitude tracking (1-6 levels)
  - Terrain-specific movement modifiers based on vehicle type
- **Special Abilities Framework**: Comprehensive implementation of unit special abilities:
  - Hardened Armor (HARD) - reduced critical hit chances
  - Reinforced (REIN) - protection from specific critical hits
  - Precision (PRB) - improved targeting and critical hit chances
  - Direct Fire (DF) - removal of minimum range penalties
  - Electronic Warfare (ECM/ECCM) - range-based protection and counter-measures
  - Dozens of additional abilities reflecting Alpha Strike rules
- **Enhanced Infantry Implementation**:
  - Specialized infantry templates with varied equipment
  - Gradual squad damage model with proportional combat capability reduction
  - Anti-'Mech attacks for infantry with special abilities
  - Battle armor units with enhanced capabilities
- **Advanced Jump Movement**:
  - Death From Above (DFA) attacks for jump-capable units
  - Realistic heat generation from jump movement
  - Jump-specific terrain interaction rules
  - Enhanced visualization of jump movement effects
- **Enhanced ASCII Battlefield Display**: Visual representation of the battlefield in the terminal with:
  - Clear terrain visualization with distinct symbols
  - Unit indicators with directional markers and vehicle subtype identifiers
  - VTOL altitude indicators and elevation tracking
  - Comprehensive battlefield legend
  - Color-coded elements for improved readability
- **Command Parser**: Natural language command interpretation for intuitive gameplay
- **Unit Library**: Collection of pre-defined units to choose from

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Copy `.env.sample` to `.env` and add your Anthropic API key
4. Start the game: `npm start`

## Game Commands

The game now features an intuitive menu-based command system that automatically displays relevant commands based on the current game state and phase. Simply select options from the menu instead of typing commands manually.

### Available Command Categories
- **General Commands**: Help, display units, exit game
- **Setup Commands**: Set up test scenarios, add units, map manipulation
- **Phase-Specific Commands**: Commands relevant to the current game phase
  - Initiative Phase: Roll initiative
  - Movement Phase: Move units, end movement
  - Combat Phase: Attack, melee combat, end combat
  - End Phase: Next turn

### Manual Commands (Legacy Support)
If needed, you can still use the following text commands:
- `HELP` - Display available commands
- `DISPLAY` - Show the current battlefield state
- `QUIT` or `EXIT` - Exit the game

### Setup Commands
- `ADD UNIT [template_name] [player|ai] AT [x,y]` - Add a unit to the battlefield
- `ADD RANDOM [player|ai] AT [x,y]` - Add a random unit
- `MAP LIST` - Show available map templates
- `MAP LOAD [template_name] [width] [height]` - Load a predefined map template
- `MAP RANDOM [width] [height]` - Generate a random map

### Game Phase Commands
- `ROLL INITIATIVE` - Roll for initiative in the Initiative Phase
- `MOVE [unit_id] TO [x,y]` - Move a unit in the Movement Phase
- `ATTACK WITH [unit_id] TARGET [target_id]` - Perform a ranged attack
- `MELEE [unit_id] TARGET [target_id] ATTACK [attack_type]` - Perform a melee attack
- `END MOVEMENT` - End the Movement Phase
- `END COMBAT` - End the Combat Phase

## Map System

The game includes a flexible map generation system with both predefined templates and procedural generation capabilities. See the [Map Generation System](MAP_GENERATION_SYSTEM.md) document for details.

### Terrain Types
- **Clear** - No penalties to movement or combat
- **Light Woods** - +1 to-hit modifier, 1.5× movement cost
- **Heavy Woods** - +2 to-hit modifier, 2× movement cost
- **Water** - 1.5× movement cost, +2 heat dissipation
- **Rough** - +1 to-hit modifier, 1.5× movement cost
- **Hills** - +1 to-hit modifier, 2× movement cost, elevation advantage
- **Building** - +2 to-hit modifier, 2× movement cost, full cover
- **Rubble** - +1 to-hit modifier, 1.5× movement cost

## AI Capabilities

The game features an AI opponent powered by Claude that can:
- Make tactical decisions for movement and combat
- Consider terrain, unit capabilities, and battlefield conditions
- Adapt to different mission types and objectives

See the [AI Enhancement Roadmap](AI_ENHANCEMENT_ROADMAP.md) for details on current and planned AI capabilities.

## Special Abilities

Units can have various special abilities that modify their capabilities:
- **Anti-'Mech (AM)** - Infantry with enhanced anti-mech capabilities
- **Armor (ARM)** - Enhanced armor protection
- **Battle Computer (BC)** - Improved targeting
- **Melee (MEL)** - Enhanced melee combat capabilities
- ...and many more

See [Alpha Strike Rules](Alpha%20Strike%20Rules.md) for more information.

## Development

### Project Structure
- `src/ai/` - AI implementation and Claude integration
- `src/data/` - Unit templates and data definitions
- `src/engine/` - Game rules and mechanics
- `src/ui/` - User interface and command handling
- `src/utils/` - Utility functions and helpers

### Next Steps
See [NEXT_STEPS.md](NEXT_STEPS.md) for planned features and improvements.

## License

This project is for educational purposes only. BattleTech and Alpha Strike are registered trademarks of The Topps Company, Inc. and/or Catalyst Game Labs.

## Game Mechanics

### Heat System
The game implements BattleMech heat mechanics from Alpha Strike:

1. **Heat Generation**:
   - Walking: +1 heat
   - Running: +2 heat
   - Jumping: +3 heat
   - Weapons fire: +1-3 heat depending on range and weapon type

2. **Heat Effects**:
   - At 50% capacity: +1 to-hit penalty
   - At 75% capacity: +2 to-hit penalty and -1 movement
   - At 100% capacity: Risk of shutdown and automatic damage

3. **Heat Dissipation**:
   - Mechs cool by 1 heat point each End Phase
   - Shutdown mechs don't dissipate heat

4. **Shutdown and Restart**:
   - Mechs at 100% heat capacity have a risk of shutdown
   - Use the `startup` command during Movement Phase to attempt restart
   - Restarting requires a successful dice roll of 4+ on 2d6

### Critical Hit System
The game features a comprehensive critical hit system from Alpha Strike:

1. **Critical Hit Triggers**:
   - Rolling a natural 12 on attack rolls
   - Structure damage exceeding 25% of maximum structure
   - More severe effects when structure damage exceeds 50%

2. **Unit-Specific Critical Tables**:
   - **BattleMechs**: Engine hits, fire control damage, movement impairment, weapon damage, motive system failure, ammo explosions
   - **Vehicles**: Engine hits, weapon damage, motive system immobilization
   - **Infantry**: Additional damage on critical hits

3. **Critical Effects**:
   - Engine Hits: Generate additional heat (Mechs) or reduce movement by 50% (Vehicles)
   - Fire Control Hits: +1 penalty to all attack rolls
   - Movement Hits: -2" to all movement values
   - Weapon Hits: -1 to all damage values
   - Motive System Hits: Complete immobilization
   - Ammo Explosions: 2 points of direct structure damage

4. **Critical Status Tracking**:
   - Critical hits persist until repaired (not implemented yet)
   - Multiple criticals of the same type have cumulative effects
   - Critical hit effects are displayed in unit status 