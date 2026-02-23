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

function isTileBlocking(tile: Tile, entity: Entity, toggledColors: string[], dx: number, dy: number): boolean {
  if (tile.type === 'wall' || tile.type === 'empty' || tile.type === 'water') return true;
  if (tile.type === 'door' && !isDoorPassable(tile, entity, toggledColors)) return true;
  if (tile.type === 'one-way' && !canEnterOneWay(tile, dx, dy)) return true;
  return false;
}

function applyTileEffects(
  tile: Tile,
  entity: Entity,
  toggledColors: string[]
): { entity: Entity; toggledColors: string[] } {
  let newEntity = entity;
  let newToggled = toggledColors;

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

  return { entity: newEntity, toggledColors: newToggled };
}

function slideOnIce(
  level: Level,
  entity: Entity,
  toggledColors: string[],
  dx: number,
  dy: number,
  startPos: Position
): { finalPos: Position; finalEntity: Entity; toggledColors: string[]; tilesCrossed: number } {
  let currentPos = startPos;
  let currentEntity = entity;
  let currentToggled = toggledColors;
  let tilesCrossed = 0;

  while (true) {
    const nextPos = { x: currentPos.x + dx, y: currentPos.y + dy };

    if (nextPos.x < 0 || nextPos.x >= level.width || nextPos.y < 0 || nextPos.y >= level.height) break;

    const nextTile = level.tiles[nextPos.y][nextPos.x];
    if (isTileBlocking(nextTile, currentEntity, currentToggled, dx, dy)) break;

    currentPos = nextPos;
    tilesCrossed++;

    // Apply effects at each tile passed through
    const effects = applyTileEffects(nextTile, currentEntity, currentToggled);
    currentEntity = { ...effects.entity, position: currentPos };
    currentToggled = effects.toggledColors;

    // Stop sliding when landing on a non-ice tile
    if (nextTile.type !== 'ice') break;
  }

  return {
    finalPos: currentPos,
    finalEntity: { ...currentEntity, position: currentPos },
    toggledColors: currentToggled,
    tilesCrossed
  };
}

export function executeMove(
  level: Level,
  state: GameState,
  dx: number,
  dy: number
): GameState | null {
  if (state.status !== 'playing' || !state.selectedEntityId) return null;

  const entityIndex = state.entities.findIndex(e => e.id === state.selectedEntityId);
  if (entityIndex === -1) return null;

  const entity = state.entities[entityIndex];
  const newPos = { x: entity.position.x + dx, y: entity.position.y + dy };

  // Bounds check
  if (newPos.x < 0 || newPos.x >= level.width || newPos.y < 0 || newPos.y >= level.height) return null;

  const targetTile = level.tiles[newPos.y][newPos.x];

  // Blocking check
  if (isTileBlocking(targetTile, entity, state.toggledColors, dx, dy)) {
    if (targetTile.type === 'door' && !isDoorPassable(targetTile, entity, state.toggledColors)) {
      return {
        ...state,
        message: `Locked! You need to be ${targetTile.color || 'colored'} to pass.`
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
  let effects = applyTileEffects(targetTile, entity, state.toggledColors);
  let updatedEntity = { ...effects.entity, position: newPos };
  let toggledColors = effects.toggledColors;
  let totalMoves = 1;

  // Ice sliding
  if (targetTile.type === 'ice') {
    const slideResult = slideOnIce(level, updatedEntity, toggledColors, dx, dy, newPos);
    updatedEntity = slideResult.finalEntity;
    toggledColors = slideResult.toggledColors;
    totalMoves += slideResult.tilesCrossed;
  }

  const newEntities = [...state.entities];
  const newMoves = { ...state.moves, [entity.id]: state.moves[entity.id] + totalMoves };
  const newHistory = { ...state.history, [entity.id]: [...state.history[entity.id], updatedEntity.position] };
  let message = '';

  // Check alternate-colors rule
  const originalEntity = level.entities.find(e => e.id === entity.id);
  if (originalEntity) {
    for (const rule of originalEntity.rules) {
      if (rule.type === 'alternate-colors') {
        const prevPos = entity.position;
        const prevTile = level.tiles[prevPos.y][prevPos.x];
        const currTile = level.tiles[updatedEntity.position.y][updatedEntity.position.x];

        if ((prevTile.type === 'floor-white' && currTile.type === 'floor-white') ||
            (prevTile.type === 'floor-black' && currTile.type === 'floor-black')) {
          updatedEntity = { ...originalEntity };
          newMoves[entity.id] = 0;
          newHistory[entity.id] = [originalEntity.position];
          message = `Oops! ${entity.type} must alternate colors! Resetting...`;
        }
      }
    }
  }

  // Check goal + parity rules
  const landingTile = level.tiles[updatedEntity.position.y][updatedEntity.position.x];
  if (landingTile.type === 'goal') {
    const goalRule = originalEntity?.rules.find(r => r.type === 'reach-goal');

    if (goalRule) {
      if (updatedEntity.color && landingTile.color && updatedEntity.color !== landingTile.color) {
        message = `Wrong house! This is the ${landingTile.color} house.`;
      } else {
        const parityEvenRule = originalEntity?.rules.find(r => r.type === 'parity-even');
        const parityOddRule = originalEntity?.rules.find(r => r.type === 'parity-odd');

        const steps = newMoves[entity.id];
        let success = true;

        if (parityEvenRule && steps % 2 !== 0) {
          success = false;
          message = `Reached goal, but steps (${steps}) must be EVEN!`;
          updatedEntity = { ...originalEntity! };
          newMoves[entity.id] = 0;
          newHistory[entity.id] = [originalEntity!.position];
        } else if (parityOddRule && steps % 2 === 0) {
          success = false;
          message = `Reached goal, but steps (${steps}) must be ODD!`;
          updatedEntity = { ...originalEntity! };
          newMoves[entity.id] = 0;
          newHistory[entity.id] = [originalEntity!.position];
        }

        if (success) {
          message = `Great job! ${entity.type} reached home safely!`;
        }
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
    toggledColors
  };
}
