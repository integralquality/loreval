import type { Level, Entity, Position, Tile, GameState } from './types';

function isDoorPassable(tile: Tile, entity: Entity, toggledColors: string[]): boolean {
  if (tile.type !== 'door') return true;
  const doorColor = tile.color;
  if (!doorColor) return false;
  return entity.color === doorColor || toggledColors.includes(doorColor);
}

function canEnterOneWay(tile: Tile, dx: number, dy: number): boolean {
  if (tile.type !== 'one-way') return true;
  const dir = tile.meta?.direction;
  if (!dir) return true;
  switch (dir) {
    case 'up':    return dx === 0 && dy === -1;
    case 'down':  return dx === 0 && dy === 1;
    case 'left':  return dx === -1 && dy === 0;
    case 'right': return dx === 1 && dy === 0;
    default:      return true;
  }
}

function isLockPassable(tile: Tile, entity: Entity, openedLocks: string[]): boolean {
  if (tile.type !== 'lock') return true;
  const key = `${tile.x},${tile.y}`;
  if (openedLocks.includes(key)) return true;
  return entity.color === tile.color;
}

function isTileBlocking(tile: Tile, entity: Entity, toggledColors: string[], dx: number, dy: number, openedLocks: string[] = []): boolean {
  if (tile.type === 'wall' || tile.type === 'empty') return true;
  if (tile.type === 'door' && !isDoorPassable(tile, entity, toggledColors)) return true;
  if (tile.type === 'lock' && !isLockPassable(tile, entity, openedLocks)) return true;
  if (tile.type === 'one-way' && !canEnterOneWay(tile, dx, dy)) return true;
  return false;
}

function applyTileEffects(
  tile: Tile,
  entity: Entity,
  toggledColors: string[],
  openedLocks: string[]
): { entity: Entity; toggledColors: string[]; openedLocks: string[] } {
  let newEntity = entity;
  let newToggled = toggledColors;
  let newOpenedLocks = openedLocks;

  if (tile.type === 'paint' && tile.color) {
    newEntity = { ...entity, color: tile.color };
  }

  if (tile.type === 'switch' && tile.color) {
    if (newToggled.includes(tile.color)) {
      newToggled = newToggled.filter(c => c !== tile.color);
    } else {
      newToggled = [...newToggled, tile.color];
    }
  }

  if (tile.type === 'lock' && tile.color && entity.color === tile.color) {
    const key = `${tile.x},${tile.y}`;
    if (!newOpenedLocks.includes(key)) {
      newOpenedLocks = [...newOpenedLocks, key];
    }
  }

  return { entity: newEntity, toggledColors: newToggled, openedLocks: newOpenedLocks };
}

export function executeMove(
  level: Level,
  state: GameState,
  dx: number,
  dy: number
): GameState | null {
  if (state.status !== 'playing' || !state.selectedEntityId) return null;
  if (state.finishedEntityIds.includes(state.selectedEntityId)) return null;

  const entityIndex = state.entities.findIndex(e => e.id === state.selectedEntityId);
  if (entityIndex === -1) return null;

  const entity = state.entities[entityIndex];
  const newPos = { x: entity.position.x + dx, y: entity.position.y + dy };

  // Bounds check
  if (newPos.x < 0 || newPos.x >= level.width || newPos.y < 0 || newPos.y >= level.height) return null;

  // Check if another active entity is on the target tile
  const finishedIds = state.finishedEntityIds || [];
  const occupiedByOther = state.entities.some(
    e => e.id !== entity.id && !finishedIds.includes(e.id) && e.position.x === newPos.x && e.position.y === newPos.y
  );
  if (occupiedByOther) return null;

  const targetTile = level.tiles[newPos.y][newPos.x];

  // Blocking check
  const openedLocksState = state.openedLocks || [];
  if (isTileBlocking(targetTile, entity, state.toggledColors, dx, dy, openedLocksState)) {
    if (targetTile.type === 'door' && !isDoorPassable(targetTile, entity, state.toggledColors)) {
      return {
        ...state,
        message: `Locked! You need to be ${targetTile.color || 'colored'} to pass.`
      };
    }
    if (targetTile.type === 'lock' && !isLockPassable(targetTile, entity, openedLocksState)) {
      return {
        ...state,
        message: `Locked! Only a ${targetTile.color || 'colored'} character can open this.`
      };
    }
    if (targetTile.type === 'one-way') {
      return {
        ...state,
        message: `Can't enter from this direction!`
      };
    }
    return null;
  }

  // Apply tile effects at the landing tile
  const effects = applyTileEffects(targetTile, entity, state.toggledColors, openedLocksState);
  let updatedEntity = { ...effects.entity, position: newPos };
  const toggledColors = effects.toggledColors;
  const openedLocks = effects.openedLocks;

  const newEntities = [...state.entities];
  const newMoves = { ...state.moves, [entity.id]: state.moves[entity.id] + 1 };
  const newHistory = { ...state.history, [entity.id]: [...state.history[entity.id], updatedEntity.position] };
  let message = '';

  // Check goal
  const originalEntity = level.entities.find(e => e.id === entity.id);
  const landingTile = level.tiles[updatedEntity.position.y][updatedEntity.position.x];
  if (landingTile.type === 'goal') {
    const goalRule = originalEntity?.rules.find(r => r.type === 'reach-goal');

    if (goalRule) {
      if (updatedEntity.color && landingTile.color && updatedEntity.color !== landingTile.color) {
        message = `Wrong house! This is the ${landingTile.color} house.`;
      } else {
        message = `Great job! ${entity.type} reached home safely!`;
        const newFinished = [...state.finishedEntityIds, entity.id];
        const remaining = state.entities.filter(e => !newFinished.includes(e.id) && e.id !== entity.id);
        const nextSelected = remaining.length > 0 ? remaining[0].id : null;
        const allDone = newFinished.length === level.entities.filter(e =>
          level.entities.find(le => le.id === e.id)?.rules.some(r => r.type === 'reach-goal')
        ).length;

        newEntities[entityIndex] = updatedEntity;

        return {
          entities: newEntities,
          moves: newMoves,
          history: newHistory,
          status: allDone ? 'won' : state.status,
          message: allDone ? 'You did it! All characters reached their exits!' : message,
          selectedEntityId: nextSelected,
          toggledColors,
          finishedEntityIds: newFinished,
          openedLocks,
        };
      }
    }
  }

  newEntities[entityIndex] = updatedEntity;

  return {
    entities: newEntities,
    moves: newMoves,
    history: newHistory,
    status: state.status,
    message,
    selectedEntityId: state.selectedEntityId,
    toggledColors,
    finishedEntityIds: state.finishedEntityIds,
    openedLocks,
  };
}
