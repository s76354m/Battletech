const { createGameState, addUnit, processAttack, addHeat } = require('../src/engine/gameState');

describe('createGameState', () => {
  test('initializes default state', () => {
    const state = createGameState();
    expect(state).toHaveProperty('battlefield');
    expect(state.battlefield.units instanceof Map).toBe(true);
    expect(state.players.get('player')).toBeDefined();
    expect(state.players.get('ai')).toBeDefined();
    expect(state.turnData.phase).toBe('SETUP');
  });
});

describe('processAttack', () => {
  test('basic hit applies damage and heat', () => {
    const state = createGameState();
    addUnit(state, 'player', { id: 'atk', type: 'mech', skill: 4, tmm: 0, position: { x: 0, y: 0 }, damage: { short: 2, medium: 1, long: 0, extreme: 0 }, armor: 3, structure: 1 });
    addUnit(state, 'ai', { id: 'tgt', type: 'mech', tmm: 0, position: { x: 1, y: 0 }, armor: 3, structure: 1 });
    jest.spyOn(Math, 'random').mockReturnValue(0.9); // high rolls ensure a hit
    const result = processAttack(state, 'atk', 'tgt');
    Math.random.mockRestore();
    expect(result.success).toBe(true);
    expect(result.hit).toBe(true);
    const target = state.battlefield.units.get('tgt');
    expect(target.status.damage.armor).toBeGreaterThan(0);
    const attacker = state.battlefield.units.get('atk');
    expect(attacker.status.heat).toBeGreaterThan(0);
  });
});

describe('addHeat', () => {
  test('adds heat and records effects', () => {
    const state = createGameState();
    addUnit(state, 'player', { id: 'm1', type: 'mech', position: { x: 0, y: 0 } });
    const result = addHeat(state, 'm1', 3);
    expect(result.newHeat).toBe(3);
    const unit = state.battlefield.units.get('m1');
    expect(unit.status.heat).toBe(3);
    expect(unit.status.effects).toContain('HEAT_ATTACK_PENALTY_2');
  });
});
