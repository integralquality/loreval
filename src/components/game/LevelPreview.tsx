import type { Level } from '../../types';
import { TILE_SIZE } from '../../types';
import { TileIcon } from './TileIcon';
import { EntityIcon } from './EntityIcon';

const ENTITY_COLORS: Record<string, string> = {
  orange: '#fb923c',
  purple: '#c084fc',
  pink: '#f472b6',
  blue: '#60a5fa',
  green: '#6ee7b7',
  red: '#f87171',
};

export function LevelPreview({ level, maxWidth = 400 }: { level: Level; maxWidth?: number }) {
  const gridW = level.width * TILE_SIZE;
  const scale = Math.min(1, maxWidth / gridW);

  return (
    <div
      className="origin-top-left"
      style={{
        width: gridW * scale,
        height: level.height * TILE_SIZE * scale,
      }}
    >
      <div
        className="relative"
        style={{
          width: gridW,
          height: level.height * TILE_SIZE,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {/* Tile grid */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${level.width}, ${TILE_SIZE}px)`,
            gridTemplateRows: `repeat(${level.height}, ${TILE_SIZE}px)`,
          }}
        >
          {level.tiles.flat().map((tile) => (
            <div key={`${tile.x}-${tile.y}`} style={{ width: TILE_SIZE, height: TILE_SIZE }}>
              <TileIcon type={tile.type} color={tile.color} meta={tile.meta} />
            </div>
          ))}
        </div>

        {/* Entities */}
        {level.entities.map((entity) => (
          <div
            key={entity.id}
            className="absolute flex items-center justify-center"
            style={{
              left: entity.position.x * TILE_SIZE,
              top: entity.position.y * TILE_SIZE,
              width: TILE_SIZE,
              height: TILE_SIZE,
            }}
          >
            <EntityIcon
              type={entity.type}
              color={entity.color ? (ENTITY_COLORS[entity.color] || entity.color) : '#a1a1aa'}
              className="w-7 h-7"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
