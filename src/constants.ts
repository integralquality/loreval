import type { Level } from './types';

export const INITIAL_LEVEL: Level = {
  id: 'demo',
  name: 'Demo Level',
  width: 10,
  height: 10,
  tiles: [], // Will be filled in initialization
  entities: [
    {
      id: 'robot-1',
      type: 'robot',
      position: { x: 2, y: 1 },
      color: 'orange',
      rules: [
        { id: 'r1', type: 'reach-goal', targetId: 'exit-orange' }
      ]
    },
    {
      id: 'robot-2',
      type: 'robot',
      position: { x: 1, y: 5 },
      color: 'purple',
      rules: [
        { id: 'r3', type: 'reach-goal', targetId: 'exit-purple' }
      ]
    },
    {
      id: 'robot-3',
      type: 'robot',
      position: { x: 1, y: 9 },
      color: 'pink',
      rules: [
        { id: 'r5', type: 'reach-goal', targetId: 'exit-pink' }
      ]
    },
    {
      id: 'robot-4',
      type: 'robot',
      position: { x: 2, y: 3 },
      color: 'red',
      rules: [
        { id: 'r7', type: 'reach-goal', targetId: 'exit-red' }
      ]
    }
  ]
};
