import type { Level } from './types';

export const INITIAL_LEVEL: Level = {
  id: 'demo-parity',
  name: 'Parity Paths Demo',
  width: 8,
  height: 8,
  tiles: [], // Will be filled in initialization
  entities: [
    {
      id: 'dog-1',
      type: 'dog',
      position: { x: 1, y: 1 },
      rules: [
        { id: 'r1', type: 'reach-goal', targetId: 'goal-dog' },
        { id: 'r2', type: 'parity-even' }
      ]
    },
    {
      id: 'cat-1',
      type: 'cat',
      position: { x: 1, y: 3 },
      rules: [
        { id: 'r3', type: 'reach-goal', targetId: 'goal-cat' },
        { id: 'r4', type: 'parity-odd' }
      ]
    },
    {
      id: 'rabbit-1',
      type: 'rabbit',
      position: { x: 1, y: 5 },
      rules: [
        { id: 'r5', type: 'reach-goal', targetId: 'goal-rabbit' },
        { id: 'r6', type: 'alternate-colors' }
      ]
    },
    {
      id: 'bot-1',
      type: 'robot',
      position: { x: 0, y: 7 },
      rules: [
        { id: 'r7', type: 'reach-goal' }
      ]
    }
  ]
};
