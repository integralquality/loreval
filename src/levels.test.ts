import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LEVELS } from './levels';
import { serializeDSL } from './dsl/serializer';
import { parseDSL } from './dsl/parser';

describe('CAMPAIGN_LEVELS', () => {
  it('is non-empty and numbered sequentially from 1', () => {
    expect(CAMPAIGN_LEVELS.length).toBeGreaterThan(0);
    expect(CAMPAIGN_LEVELS.map(c => c.number)).toEqual(
      CAMPAIGN_LEVELS.map((_, i) => i + 1),
    );
  });

  it('has unique level ids', () => {
    const ids = CAMPAIGN_LEVELS.map(c => c.level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every level a name and a description', () => {
    for (const { name, description } of CAMPAIGN_LEVELS) {
      expect(name.length).toBeGreaterThan(0);
      expect(description.length).toBeGreaterThan(0);
    }
  });
});

describe.each(CAMPAIGN_LEVELS)('level $number ($name)', ({ level }) => {
  it('has a tile grid matching its declared dimensions', () => {
    expect(level.tiles).toHaveLength(level.height);
    for (const row of level.tiles) {
      expect(row).toHaveLength(level.width);
    }
  });

  it('stamps each tile with its own coordinates', () => {
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        expect(level.tiles[y][x]).toMatchObject({ x, y });
      }
    }
  });

  it('starts every entity in bounds on a tile it can stand on', () => {
    expect(level.entities.length).toBeGreaterThan(0);
    for (const entity of level.entities) {
      const { x, y } = entity.position;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(level.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(level.height);
      expect(['wall', 'empty']).not.toContain(level.tiles[y][x].type);
    }
  });

  it('gives every entity a unique id', () => {
    const ids = level.entities.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves every explicit reach-goal target to a goal tile that exists', () => {
    const goalIds = new Set(
      level.tiles.flat().filter(t => t.type === 'goal' && t.meta?.id).map(t => t.meta!.id!),
    );
    for (const entity of level.entities) {
      for (const rule of entity.rules) {
        // targetId is optional: levels may rely on color matching alone.
        if (rule.type !== 'reach-goal' || rule.targetId === undefined) continue;
        expect(goalIds).toContain(rule.targetId);
      }
    }
  });

  it('gives every entity a goal to reach', () => {
    for (const entity of level.entities) {
      expect(entity.rules.some(r => r.type === 'reach-goal')).toBe(true);
    }
  });

  it('gives every entity a goal tile its color is allowed to enter', () => {
    const goals = level.tiles.flat().filter(t => t.type === 'goal');
    for (const entity of level.entities) {
      if (!entity.rules.some(r => r.type === 'reach-goal')) continue;
      // executeMove accepts an uncolored goal from anyone, and a colored goal
      // only from an entity of that color.
      const reachable = goals.some(g => !g.color || !entity.color || g.color === entity.color);
      expect(reachable).toBe(true);
    }
  });

  it('serializes to DSL that parses back without errors', () => {
    const { errors } = parseDSL(serializeDSL(level));
    expect(errors).toEqual([]);
  });
});
