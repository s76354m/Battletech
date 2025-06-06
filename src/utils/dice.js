/**
 * dice.js
 * Utility functions for dice rolls in Battletech
 */

/**
 * Generate a random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
function getRandomInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Roll a single die with the specified number of sides
 * @param {number} sides - Number of sides on the die (default: 6)
 * @returns {number} Result of the die roll
 */
function rollDie(sides = 6) {
	return getRandomInt(1, sides);
}

/**
 * Roll multiple dice with the specified number of sides
 * @param {number} count - Number of dice to roll
 * @param {number} sides - Number of sides on each die (default: 6)
 * @returns {Object} Object containing the individual rolls and their sum
 */
function rollDice(count, sides = 6) {
	const rolls = [];
	let sum = 0;
	
	for (let i = 0; i < count; i++) {
		const roll = rollDie(sides);
		rolls.push(roll);
		sum += roll;
	}
	
	return {
		rolls,
		sum
	};
}

/**
 * Roll 2d6 (two six-sided dice)
 * @returns {number} Sum of the two dice
 */
function roll2d6() {
	return rollDice(2, 6).sum;
}

/**
 * Roll 2d6 and return detailed information
 * @returns {Object} Object containing the individual rolls and their sum
 */
function roll2d6Detailed() {
	return rollDice(2, 6);
}

/**
 * Roll a location die (2d6) and interpret the result
 * @param {Object} locationTable - Table mapping dice rolls to hit locations
 * @returns {Object} Object containing the roll and the resulting location
 */
function rollLocation(locationTable) {
	const rollResult = roll2d6();
	const location = locationTable[rollResult] || 'Center Torso'; // Default to center torso
	
	return {
		roll: rollResult,
		location
	};
}

/**
 * Generate a cluster roll for weapons that hit in clusters
 * @param {number} baseCount - Base number of missiles/projectiles
 * @returns {number} Actual number of hits
 */
function rollCluster(baseCount) {
	if (baseCount <= 0) return 0;
	
	const roll = roll2d6();
	
	// Lookup table based on BattleTech cluster hit table
	const clusterTable = {
		2: 0.0, // 0% of total
		3: 0.17, // 17% of total 
		4: 0.33, // 33% of total
		5: 0.5, // 50% of total
		6: 0.67, // 67% of total
		7: 0.83, // 83% of total
		8: 1.0, // 100% of total
		9: 1.17, // 117% of total
		10: 1.33, // 133% of total
		11: 1.5, // 150% of total
		12: 1.67 // 167% of total
	};
	
	const multiplier = clusterTable[roll] || 0.5; // Default to 50% if roll isn't in table
	const hits = Math.round(baseCount * multiplier);
	
	return Math.max(1, hits); // Minimum of 1 hit if weapon fires
}

/**
 * Roll for critical hit determination
 * @returns {boolean} True if a critical hit is scored
 */
function rollForCritical() {
	const roll = roll2d6();
	return roll >= 8; // Critical on 8+
}

/**
 * Roll a critical hit location on the critical hit table
 * @param {Object} criticalTable - Table of critical components
 * @returns {Object} Selected critical component and slot
 */
function rollCriticalLocation(criticalTable) {
	const roll = roll2d6();
	
	// Find the critical location based on the roll
	const location = criticalTable[roll] || 'No critical';
	
	return {
		roll,
		location
	};
}

/**
 * Roll a hit location with a specific modifier
 * @param {Object} locationTable - Table mapping dice rolls to hit locations
 * @param {number} modifier - Modifier to the dice roll
 * @returns {Object} Object containing the roll and the resulting location
 */
function rollLocationWithModifier(locationTable, modifier = 0) {
	const diceRoll = roll2d6();
	const modifiedRoll = Math.min(Math.max(diceRoll + modifier, 2), 12); // Constrain to 2-12
	
	const location = locationTable[modifiedRoll] || 'Center Torso'; // Default to center torso
	
	return {
		roll: diceRoll,
		modifiedRoll,
		location
	};
}

/**
 * Roll on a custom table with arbitrary values
 * @param {Object} table - Table mapping dice rolls to results
 * @returns {Object} Object containing the roll and the result
 */
function rollOnTable(table) {
	const roll = roll2d6();
	const result = table[roll] || 'No result';
	
	return {
		roll,
		result
	};
}

module.exports = {
	rollDie,
	rollDice,
	roll2d6,
	roll2d6Detailed,
	rollLocation,
	rollCluster,
	rollForCritical,
	rollCriticalLocation,
	rollLocationWithModifier,
	rollOnTable
}; 