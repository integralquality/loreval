import type { Level } from './types';

export const INITIAL_LEVEL: Level = {
  id: 'demo',
  name: 'Demo Level',
  width: 10,
  height: 10,
  tiles: [], // Will be filled in initialization
  entities: [
    {
      id: 'dog-1',
      type: 'dog',
      position: { x: 2, y: 1 },
      rules: [
        { id: 'r1', type: 'reach-goal', targetId: 'goal-dog' }
      ]
    },
    {
      id: 'cat-1',
      type: 'cat',
      position: { x: 1, y: 5 },
      rules: [
        { id: 'r3', type: 'reach-goal', targetId: 'goal-cat' }
      ]
    },
    {
      id: 'rabbit-1',
      type: 'rabbit',
      position: { x: 1, y: 9 },
      rules: [
        { id: 'r5', type: 'reach-goal', targetId: 'goal-rabbit' }
      ]
    },
    {
      id: 'bot-1',
      type: 'robot',
      position: { x: 2, y: 3 },
      rules: [
        { id: 'r7', type: 'reach-goal', targetId: 'goal-bot' }
      ]
    }
  ]
};
