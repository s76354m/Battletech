# ALPHA STRIKE RULES

## Table of Contents
1. [Introduction](#introduction)
2. [Game Components](#game-components)
3. [Game Setup](#game-setup)
4. [Unit Statistics](#unit-statistics)
5. [Turn Sequence](#turn-sequence)
6. [Movement](#movement)
7. [Combat](#combat)
8. [Heat](#heat)
9. [Special Abilities](#special-abilities)
10. [Terrain](#terrain)
11. [Advanced Rules](#advanced-rules)
12. [Formation Abilities](#formation-abilities)
13. [Building a Force](#building-a-force)
14. [Scenario Rules](#scenario-rules)
15. [Record Sheets](#record-sheets)

## Introduction

Alpha Strike is a streamlined, fast-playing version of the BattleTech tabletop game. It condenses the more complex Classic BattleTech rules while maintaining the essential aspects of 31st century armored combat. Alpha Strike simplifies unit statistics and gameplay to allow for quicker games with more units on the battlefield.

### Required Materials
- Alpha Strike unit cards or record sheets
- 2D6 (two six-sided dice)
- Miniatures representing BattleMechs, vehicles, infantry, etc.
- Measuring device (inches or centimeters)
- Terrain (optional but recommended)
- Alpha Strike templates (optional)

## Game Components

### Miniatures
Alpha Strike uses miniatures to represent units on the battlefield. Each miniature represents a single unit, such as a BattleMech, vehicle, or infantry platoon.

### Unit Cards
Unit cards contain all the necessary statistics for a given unit, including movement, armor, and weapons capabilities.

### Dice
Alpha Strike uses 2D6 (two six-sided dice) for most game mechanics, including attack rolls and skill checks.

### Measuring Tools
Distance in Alpha Strike is measured in inches, with 1 inch typically representing 30 meters in the game world.

## Game Setup

1. **Select a Scenario**: Choose a scenario that outlines victory conditions, deployment zones, and special rules.
2. **Build Forces**: Each player selects units for their force based on an agreed-upon Point Value (PV).
3. **Set Up the Battlefield**: Arrange terrain features on the playing surface.
4. **Deploy Forces**: Players place their units within their designated deployment zones.

## Unit Statistics

### Basic Statistics
- **Point Value (PV)**: The cost of the unit.
- **Type**: The classification of the unit (BattleMech, Vehicle, Infantry, etc.).
- **Size**: The physical size class of the unit (1-4).
- **Movement (MV)**: Movement capacity in inches.
  - **(W)**: Walking/Cruising
  - **(R)**: Running/Flanking
  - **(J)**: Jumping
- **Armor/Structure**:
  - **Armor (A)**: Represents the unit's protective armor.
  - **Structure (S)**: The internal structure of the unit.
- **Threshold Damage (TMM)**: Target Movement Modifier indicates how difficult a unit is to hit when moving.
- **Skill (SKL)**: The unit's base skill level for all actions.

### Weapons Data
- **Damage Values**: The amount of damage a unit can inflict at different ranges.
  - **S**: Short Range (0-6")
  - **M**: Medium Range (7-12")
  - **L**: Long Range (13-24")
  - **E**: Extreme Range (25-42")
- **Overheat (OV)**: Extra damage that generates heat.

### Special Ability Notations
Special abilities are listed on unit cards as abbreviations. Understanding these notations is crucial for gameplay.

## Turn Sequence

Each game turn consists of the following phases, performed in order:

1. **Initiative Phase**: 
   - Both players roll 2D6 and add modifiers from command units or special abilities
   - The winner chooses to go first or second in both Movement and Combat phases
   - In case of ties, re-roll until a winner is determined

2. **Movement Phase**: 
   - Players alternate moving units one at a time
   - The player who won initiative chooses whether to move first or second
   - Units may move up to their full movement allowance or choose not to move
   - Record any heat generated from movement

3. **Combat Phase**: 
   - Players alternate making attacks with their units
   - The player who won initiative chooses whether to attack first or second
   - Each unit may make one attack during this phase
   - Resolve damage and effects immediately after each attack

4. **End Phase**: 
   - Resolve any persistent effects
   - Cool down units (reduce heat)
   - Remove destroyed units
   - Check victory conditions

## Movement

### Movement Types
- **Walking/Cruising**: Base movement rate, designated as (W).
- **Running/Flanking**: Enhanced movement rate, designated as (R).
- **Jumping**: Special movement that can bypass terrain, designated as (J).
- **VTOL/WiGE**: Flight movement for specific vehicle types.
- **Aerospace**: Movement for aerospace units.

### Movement Modifiers
- **Difficult Terrain**: Reduces movement by half.
- **Water**: Varies by depth, may restrict or modify movement.
- **Elevation Changes**: Costs extra movement points to climb.

### Special Movement Rules
- **Facing**: Units must face the direction they're moving.
- **Backward Movement**: Half normal movement rate.
- **Minimum Movement**: Units can always move at least 2".
- **Charge/Death From Above**: Special attack movements.

### Advanced Movement Rules
- **Sprinting**: Units may sprint at 150% of their Run value, but cannot fire weapons that turn.
- **Evading**: Units may sacrifice their attack to gain +1 to their TMM for the turn.
- **Immobile Units**: Units that cannot move (immobile) have a TMM of 0 and are easier to hit.
- **Prone Units**: Units knocked prone move at half their Walking rate and suffer +1 to all to-hit rolls against them.

## Combat

### Attack Procedure
1. **Line of Sight (LOS)**: Verify that the attacker can see the target.
2. **Range Determination**: Measure the distance to the target.
3. **Attack Roll**: Roll 2D6 + attacker's Skill (SKL) vs. a target number.
4. **Damage Resolution**: Apply damage to the target if the attack hits.

### Target Number
The base target number to hit is 8. This number is modified by:
- Target Movement Modifier (TMM)
- Range modifiers:
  - Short Range: +0
  - Medium Range: +2
  - Long Range: +4
  - Extreme Range: +6
- Terrain modifiers:
  - Light Woods/Light Smoke: +1
  - Heavy Woods/Heavy Smoke: +2
  - Water (partial cover): +1
  - Partial Cover: +1
- Special abilities
- Heat effects
- Attacker movement:
  - Attacker ran/flanked: +1
  - Attacker jumped: +2

### Damage Application
When a unit is hit, it takes damage equal to the attacking unit's damage value for the appropriate range band.

1. Damage is first applied to Armor (A).
2. If armor is reduced to 0, excess damage is applied to Structure (S).
3. When Structure is reduced to 0, the unit is destroyed.

### Critical Hits
Critical hits represent damage to vital systems and can significantly impact a unit's performance.

#### Critical Hit Triggers
- Rolling a natural 12 on the attack roll (automatic critical hit)
- Dealing enough damage to reduce structure points (specific thresholds vary by unit size)
- Certain special weapons or abilities that enhance critical hit chances

#### Critical Hit Effects
Critical hits are resolved by rolling on the following table:

1. **Critical Hit Table** (roll 2D6):
   - **2-7**: Engine Hit - Unit gains 2 heat that cannot be dissipated until repaired
   - **8**: Fire Control Hit - +1 to all attack rolls until repaired
   - **9**: Movement Hit - Reduce all movement values by 2" until repaired
   - **10**: Weapon Hit - Reduce all damage values by 1 (minimum 0) until repaired
   - **11**: Motive System Hit - Unit is immobilized until repaired
   - **12**: Ammunition Explosion - Unit immediately takes 2 points of structure damage

2. **Critical Hit Modifiers**:
   - +1 to the roll if the target has lost 50% or more of its starting structure
   - +2 if the attack came from the rear arc
   - Special abilities may provide additional modifiers

3. **Special Unit Critical Effects**:
   - **Vehicles**: Roll of 10-12 on critical hit table results in immobilization
   - **Infantry**: Critical hits cause an additional point of damage
   - **Aerospace**: Critical hits affect maneuverability or weapons systems

### Advanced Combat Tactics

#### Physical Attacks
Physical attacks represent close combat maneuvers such as punches, kicks, charges, and death from above attacks.

1. **Charge Attack**:
   - Unit must move at least 4" in a straight line directly toward the target
   - Apply damage equal to the charging unit's size
   - Attacker also takes damage equal to half the target's size (rounded up)
   - Both units make a Piloting Skill Check or become prone

2. **Death From Above (DFA)**:
   - Only jumping units can perform DFA attacks
   - Unit must jump directly onto the target
   - Apply damage equal to the attacking unit's size + 1
   - Attacker takes damage equal to the target's size
   - Both units make a Piloting Skill Check or become prone

3. **Melee Attack**:
   - Units must be adjacent (base to base contact)
   - Apply damage equal to half the unit's Size value (rounded up)
   - Units with the Melee special ability add +1 to damage

#### Multi-Unit Combat
1. **Coordinated Attacks**:
   - Units from the same formation may coordinate attacks
   - Designate a lead attacker and supporting units
   - Each supporting unit provides a +1 bonus to the lead attacker (maximum +3)
   - Supporting units cannot attack that turn

2. **Opportunity Fire**:
   - Units that haven't moved or fired can declare opportunity fire
   - They can interrupt an enemy unit's movement within their line of sight
   - -1 penalty to the attack roll
   
#### Advanced Damage Effects
1. **Breaching**:
   - When armor is reduced to 0, structure becomes vulnerable
   - Attacks against exposed structure get +1 to critical hit rolls

2. **Ammo Explosions**:
   - Units with the Explosive (EXP) special ability risk explosion when receiving critical hits
   - Roll 2D6: on a 10+, the unit suffers 2 additional structure damage

3. **Engine Hits**:
   - Engine critical hits increase heat generation by 2 points per turn
   - Multiple engine hits are cumulative
   - At 3+ engine hits, the unit cannot dissipate heat

## Heat

Units generate heat through movement and weapons fire. Heat can affect a unit's performance.

### Heat Scale
- **0-0**: No effect
- **1-2**: +1 to target number for attacks
- **3-4**: +2 to target number, -1" movement
- **5+**: Shutdown (unit cannot move or attack)

### Heat Generation
- Moving at Running speed: +1 Heat
- Jumping: +1 Heat
- Firing Overheat (OV) weapons: +Heat equal to OV value used
- Environmental factors: 
  - Fire terrain: +1 Heat
  - Extreme temperature: +1 Heat
  - Vacuum: -1 Heat dissipation

### Heat Dissipation
- Standard units dissipate 2 heat in the End Phase
- Some special abilities may modify heat dissipation:
  - Coolant System: +1 Heat dissipation
  - External Heat Sinks: +1 Heat dissipation, but vulnerable to critical hits

### Heat Management Strategies
- **Alpha Strike**: Firing all weapons at once for maximum damage, but generating maximum heat
- **Heat Management**: Carefully selecting weapons to fire to maintain optimal heat levels
- **Tactical Cooling**: Deliberately moving less or not firing to reduce heat levels

## Special Abilities

Special abilities are represented by abbreviations on unit cards. The following is a comprehensive list of key abilities:

### Offensive Abilities
- **Anti-'Mech (AM)**: +1 to attack rolls against BattleMechs.
- **Anti-Aircraft (AA)**: +1 to attack rolls against airborne units.
- **Artillery (ART#/STD)**: Can make artillery attacks at the listed value.
- **Bomb (BMB#)**: Can make bombing attacks at the listed value.
- **Direct Fire (DF)**: No minimum range for indirect fire weapons.
- **Flak (FLK#)**: Anti-aircraft artillery capability.
- **Indirect Fire (IF)**: Can attack targets outside line of sight using spotters.
- **Multi-Weapon (MW#)**: Can attack # number of different targets with a -1 penalty per additional target.
- **Precision (PRB)**: +1 to critical hit rolls.
- **Swarm (SRM)**: Infantry can perform swarm attacks against larger units.
- **Torpedo (TOR#)**: Underwater weapon attacks at the listed value.

### Defensive Abilities
- **Armor-Piercing (AP)**: Ignores 1 point of defensive special abilities.
- **Shielded (SHD)**: Reduces damage from attacks in the shielded arc by 1.
- **Hardened Armor (HARD)**: Reduces critical hit chances by 1.
- **Reactive (RCT)**: Reduces damage from all conventional weapon attacks by 1.
- **Reflective (RFL)**: Reduces damage from energy weapon attacks by 1.
- **Reinforced (REIN)**: Unit doesn't suffer movement or weapon critical hits until structures reaches 0.
- **Turret (TUR)**: Can attack in any direction regardless of facing.

### Movement Abilities
- **Amphibious (AMP)**: Can move through water terrain without penalty.
- **Cargo (CAR#)**: Can transport # number of cargo units.
- **Environmental Sealing (ES)**: Protected from environmental hazards.
- **Improved Jump Jets (IJJ)**: +2" to jump distance.
- **Jump Jets (JJ)**: Can perform jumping movement.
- **VTOL**: Vertical take-off and landing capability; can hover.
- **Submarine (SUB)**: Can move underwater.
- **Transport (TRN#)**: Can transport # number of infantry units.

### Support Abilities
- **Electronic Warfare (EW)**: +1 to TMM for all friendly units within 6", or -1 to enemy attack rolls within 6".
- **Command (CMD#)**: +# bonus to initiative rolls.
- **C3 Network (C3)**: Units in network share targeting data; +1 to attack rolls.
- **Recon (RCN)**: +1 to spotting rolls; +1 to initiative when performing scouting.
- **Repair (REP)**: Can repair 1 point of armor or structure on adjacent friendly units.
- **ECM (ECM)**: Protects against enemy EW and C3 effects within 6".
- **Stealth (STL)**: +1 to TMM against attacks from beyond 6".

## Terrain

Terrain affects movement, combat, and line of sight in various ways.

### Terrain Types
- **Clear**: No effect on movement or combat.
- **Light Woods**: +1 TMM for units within, hindered LOS.
- **Heavy Woods**: +2 TMM, severely hindered LOS.
- **Water**: 
  - Depth 1 (Shallow): No effect for most units
  - Depth 2 (Medium): -1" movement for non-amphibious units
  - Depth 3 (Deep): Only amphibious, submarines, or hovering units can enter
- **Buildings**: 
  - Light Building: Provides +1 TMM, can be occupied by infantry
  - Medium Building: Provides +2 TMM, requires a skill check to enter
  - Heavy Building: Provides +3 TMM, requires skill check to enter
- **Rough**: Difficult terrain, reduces movement by half.
- **Rubble**: Difficult terrain, reduces movement by half.
- **Roads**: +2" movement when moving along roads.
- **Elevation**: 
  - Level 1: +1 to attack rolls when firing down
  - Level 2+: +2 to attack rolls when firing down

### Line of Sight (LOS)
- Terrain may block LOS completely or partially.
- Elevation can affect LOS by providing height advantage.
- Intervening units may block LOS.
- LOS is reciprocal - if Unit A can see Unit B, then Unit B can see Unit A.

### Special Terrain Rules
- **Fire**: Units in fire terrain take 1 heat point per turn.
- **Smoke**: Light smoke adds +1 to attack rolls through it; heavy smoke adds +2.
- **Ice**: Units must make a skill check when moving or risk falling.
- **Mud**: Reduces movement by half except for hovering units.

## Advanced Rules

### Force Composition
- **Command Units**: Special units with leadership abilities.
  - Command units provide initiative bonuses equal to their CMD rating
  - Units within 6" of a command unit gain +1 to morale checks
  - If a command unit is destroyed, all friendly units must make a morale check
- **Lances/Stars/Platoons**: Organizational groupings of units.
  - Inner Sphere Lance: 4 units (typically 'Mechs)
  - Clan Star: 5 units (typically 'Mechs)
  - Vehicle Platoon: 5 vehicles
  - Infantry Platoon: 3-5 infantry units
- **Combined Arms**: Mixing different unit types.
  - Combined arms forces gain tactical flexibility
  - Special formation abilities may require specific unit type combinations
  - Some formations provide bonuses when including specific unit types

### Aerospace Operations
- **Altitude Bands**:
  - Low Altitude: Fighters can interact with ground units directly
  - Medium Altitude: Standard fighter vs. fighter combat altitude
  - High Altitude: Maximum altitude for atmospheric operations
  - Orbital: Space operations only
- **Aerospace Movement**:
  - Minimum movement requirements based on unit type
  - Velocity tracking for atmospheric entry/exit
  - Special maneuvers require skill checks:
    - Barrel Roll: Dodge incoming fire (+1 TMM for one attack)
    - Loop: Change direction 180° (requires skill check)
    - Split-S: Rapid altitude change (requires skill check)
- **Ground Support**:
  - Strafing Run: Attack all units in a straight line (reduced damage)
  - Bombing Run: Single attack with increased damage
  - Close Air Support: Provide combat bonuses to friendly ground units
- **Air-to-Air Combat**:
  - Special range bands for air-to-air combat
  - Tailing rules for pursuing enemy aircraft
  - Wing formations for coordinated fighter operations

### Artillery
- **Artillery Types**:
  - Standard (ART-S): Basic artillery with standard damage profile
  - Area-Effect (ART-A): Reduced damage but affects all units in target area
  - Precision (ART-P): Increased accuracy but reduced area effect
  - Anti-Aircraft (FLK): Specialized for targeting air units
- **Artillery Attacks**:
  - Indirect Fire: Can target areas outside line of sight with a spotter
  - Minimum Range: Artillery cannot fire at targets within minimum range
  - Fire Missions: Pre-planned artillery strikes on designated coordinates
- **Spotting**:
  - Spotters must have line of sight to the target
  - Successful Spotting Check: 2D6 + SKL ≥ 8
  - Failed spotting results in scatter (1D6" in random direction)
- **Artillery Effects**:
  - Area Effect: All units within the blast radius take damage
  - Special Munitions: Smoke, illumination, mines, etc.
  - Terrain Alteration: Artillery can create rough terrain or fires

### Electronic Warfare
- **EW Systems**:
  - Electronic Countermeasures (ECM): Defensive electronic warfare
  - Electronic Counter-Countermeasures (ECCM): Counters enemy ECM
  - Active Probe (PRB): Enhanced sensors for detecting hidden units
- **EW Effects**:
  - ECM Bubble: 6" radius that blocks enemy C3 and targeting systems
  - Stealth Systems: Increases target's TMM by 1 against attacks from beyond 6"
  - Probe Systems: Negates stealth and hiding bonuses
- **Information Warfare**:
  - Hacking: Attempt to disable enemy electronic systems
  - Communications Disruption: Break enemy command links
  - False Targeting Data: Feed misinformation to enemy units

## Campaign Rules

Campaigns connect multiple games together into an ongoing narrative with persistent units and consequences.

### Force Management
- **Unit Persistence**: Units carry damage, experience, and status between games
- **Repair and Refit**:
  - Armor Repair: 1 point per day of maintenance
  - Structure Repair: 1 point per week of maintenance
  - Critical Hit Repair: Skill check and appropriate parts required
- **MechWarrior Development**:
  - Experience Points (XP): Earned from combat actions and completing objectives
  - Skill Improvement: Spend XP to improve pilot skills
  - Special Abilities: Veterans can develop special abilities with enough XP

### Campaign Map Operations
- **Strategic Movement**: How forces move between battle locations
- **Territory Control**: Benefits from controlling specific regions
- **Supply Lines**: Maintaining logistics for your force
- **Intelligence Gathering**: Scouting and reconnaissance between battles

### Resource Management
- **C-Bills (Currency)**: Managing finances for your force
- **Spare Parts**: Tracking critical components for repairs
- **Ammunition**: Managing limited supplies of ammunition
- **Dropship Capacity**: Limits on force size and transportation

### Campaign Progression
- **Victory Points**: Long-term scoring to determine campaign success
- **Faction Relations**: How your actions affect standing with various factions
- **Timeline Advancement**: Campaign events and technological developments
- **Narrative Development**: How player actions shape the campaign story

### Random Events
- **Weather Changes**: Unexpected environmental conditions
- **Supply Problems**: Resource shortages and logistical challenges
- **Reinforcements**: Unexpected ally or enemy arrivals
- **Political Developments**: Changes in faction relations or objectives

### Technician Teams
- **Tech Skill Levels**: Affects repair times and quality
- **Specialized Technicians**: Experts in specific systems or unit types
- **Field Repairs**: Limited repairs possible between battles
- **Salvage Operations**: Recovering and repurposing destroyed enemy equipment

## Formation Abilities

Units operating together gain special abilities based on their formation type.

### Lance Abilities
- **Fire Lance**: Improved ranged combat.
- **Recon Lance**: Enhanced scouting abilities.
- **Battle Lance**: Balanced combat capabilities.
- **Command Lance**: Leadership bonuses.

### Star Abilities
- **Striker Star**: Enhanced speed and maneuverability.
- **Heavy Star**: Improved durability.
- **Battle Star**: Balance of offensive and defensive capabilities.

### Level II Abilities
- **Strike Level II**: Combined arms offensive capabilities.
- **Battle Level II**: Defensive formation abilities.

## Building a Force

### Point Value (PV)
Force building is based on Point Value (PV). Players agree on a total PV for the game and select units that add up to or below that value.

### Force Composition Rules
- **Command Units**: One command unit per force.
- **Unit Ratio**: Limits on the number of certain unit types.
- **Skill Levels**: Optional adjustments to unit skills.

### Force Abilities
- **Faction Abilities**: Special rules for specific factions.
- **Era Bonuses**: Advantages based on the game's timeline setting.
- **Experience Levels**: Bonuses for veteran or elite forces.

### Force Construction Guidelines

#### Standard Force Compositions
1. **Inner Sphere Lance**: 4 units, typically BattleMechs
2. **Clan Star**: 5 units, typically BattleMechs
3. **Combined Arms Company**: 12 units, mix of 'Mechs, vehicles, and infantry
4. **Aerospace Lance/Star**: 2-5 aerospace units

#### Force Building Steps
1. **Select Force Size**: Agree on PV limit (typical games range from 150-300 PV)
2. **Choose Command Unit**: Select a unit with the CMD special ability or upgrade a unit with Command capabilities
3. **Select Combat Units**: Build a balanced force of various unit types
4. **Form Lances/Stars**: Organize units into appropriate formations
5. **Select Skills**: Adjust unit SKL values (optional)
6. **Calculate Final PV**: Ensure the total force PV is within the agreed limit
7. **Record Force Details**: Document all units and their configurations for reference during play

#### Customization Options
1. **Skill Adjustment**:
   - Veteran (+1 SKL): -10% PV cost
   - Green (-1 SKL): +10% PV cost
   - Elite (+2 SKL): -20% PV cost
2. **Special Pilot Abilities**: Characters with unique capabilities (optional advanced rule)
3. **Custom Configurations**: Modified units with adjusted capabilities

## Scenario Rules

### Common Scenarios
- **Total Warfare**: Eliminate all enemy units.
- **Objective Control**: Control key areas of the battlefield.
- **Breakthrough**: Move units to a designated area.
- **Reconnaissance**: Gather information about specific targets.

### Victory Conditions
- **Destruction Points**: Based on destroyed enemy units.
- **Objective Points**: Based on achieving scenario goals.
- **Survival Bonus**: For keeping your units alive.

### Special Scenario Rules
- **Weather Effects**: Environmental conditions affecting gameplay.
- **Limited Visibility**: Restrictions on LOS and targeting.
- **Special Terrain**: Unique battlefield conditions.

### Advanced Scenario Types

#### Multi-Stage Operations
- **Linked Battles**: Series of connected scenarios where outcomes affect subsequent battles
- **Progressive Objectives**: Objectives that evolve as the scenario unfolds
- **Reinforcement Triggers**: Events that cause additional units to enter the battlefield

#### Special Mission Types
- **Extraction**: Retrieve a specific unit or character from the battlefield
- **Escort**: Protect a designated unit as it moves across the battlefield
- **Assassination**: Target and eliminate a specific enemy unit or character
- **Intelligence Gathering**: Obtain information from specific map locations

#### Environmental Challenges
- **Extreme Weather**: Reduced visibility, movement penalties, or heat effects
- **Environmental Hazards**: Dangerous terrain that can damage units
- **Time Constraints**: Limited number of turns to complete objectives
- **Day/Night Cycle**: Visibility changes affecting targeting and detection

## Record Sheets

The rulebook concludes with a section containing blank record sheets and templates for tracking unit status during gameplay.

## Unit Type-Specific Rules

Each unit type in Alpha Strike has unique characteristics and special rules that affect gameplay.

### BattleMechs
- **Standard BattleMechs**: The baseline unit type with balanced capabilities
- **OmniMechs**: Flexible design allows for specialized configurations
- **Industrial Mechs**: Civilian designs with lower combat capabilities but special industrial functions
- **Quad Mechs**: Four-legged designs with improved stability (+1 to resist becoming prone)
- **Superheavy Mechs**: Exceptionally large designs (Size 4+) with special movement and damage rules

### Combat Vehicles
- **Wheeled**: Fast on roads (+2" on road movement) but poor in rough terrain (-2" in difficult terrain)
- **Tracked**: Balanced mobility in most terrain
- **Hover**: Fast movement (+2" in clear terrain) but cannot enter woods or rough terrain
- **WiGE**: Can cross water and chasms but vulnerable to terrain collisions
- **VTOLs**: Flying units with vertical movement capabilities
  - Can ignore ground-based terrain
  - Cannot end movement in impassable terrain
  - Take double damage from critical hits
  - Are destroyed if they suffer a motive systems critical hit while airborne

### Infantry
- **Foot Infantry**: Basic infantry with standard movement
- **Mechanized Infantry**: Infantry with improved movement and armor
- **Battle Armor**: Elite infantry with enhanced capabilities
  - Has special anti-'Mech attack options
  - Can perform swarm attacks against larger units
  - Can mount on friendly units as "riders"
- **Infantry Deployment Rules**:
  - Infantry units can occupy buildings
  - Multiple infantry units can occupy the same hex
  - Infantry receives defensive bonuses in appropriate terrain (+1 TMM in woods, buildings)

### Aerospace Units
- **Fighters**: Fast-moving air units
  - Must maintain minimum movement each turn
  - Use special aerospace movement rules
  - Can perform strafing and bombing runs
- **Conventional Aircraft**: Non-space-capable aircraft with similar but limited capabilities compared to fighters
- **Aerospace Movement**:
  - Must declare altitude band (low, medium, high)
  - Different weapons ranges apply based on altitude
  - Special maneuvers require skill checks

### Support Units
- **Mobile Headquarters**: Provides command bonuses to nearby units
- **Mobile Repair Units**: Can repair damaged units during gameplay
- **Artillery Units**: Specialized long-range fire support
- **Anti-Aircraft Units**: Specialized for engaging aerial targets

### Special Unit Types
- **ProtoMechs**: Smaller than 'Mechs but larger than battle armor
- **Tripod Mechs**: Three-legged designs with special stability rules
- **LAMs (Land-Air Mechs)**: Transformable units that can operate as both 'Mechs and aircraft
- **Naval Units**: Specialized for water-based combat
  - Submarines must track depth level
  - Surface vessels have different movement and combat characteristics
  - Naval units often have specialized weaponry (torpedoes, depth charges)

---

This rulebook provides a comprehensive framework for playing Alpha Strike. Players are encouraged to adjust rules as needed for their specific gameplay preferences and scenarios. 