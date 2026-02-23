import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  Play,
  Grid3X3,
  Save,
  Trash2,
  Settings,
  Dog,
  Cat,
  Rabbit,
  Bot,
  LogOut,
  Ban,
  DoorOpen,
  PaintBucket,
  Snowflake,
  ToggleLeft,
  ArrowUp,
  Waves,
  Home
} from 'lucide-react';
import type { Level, Tile, TileType, EntityType, Entity, RuleType, Direction, GameState } from '../../types';
import { TILE_SIZE } from '../../types';
import { INITIAL_LEVEL } from '../../constants';
import { executeMove } from '../../gameLogic';
import { TileIcon } from './TileIcon';
import { EntityIcon } from './EntityIcon';
import { ToolButton } from './ToolButton';

const ENTITY_GLOW: Record<string, { bg: string; glow: string }> = {
  orange: { bg: '#fb923c', glow: 'rgba(251,146,60,0.4)' },
  purple: { bg: '#c084fc', glow: 'rgba(192,132,252,0.4)' },
  pink:   { bg: '#f472b6', glow: 'rgba(244,114,182,0.4)' },
  blue:   { bg: '#60a5fa', glow: 'rgba(96,165,250,0.4)' },
  green:  { bg: '#6ee7b7', glow: 'rgba(110,231,183,0.4)' },
  red:    { bg: '#f87171', glow: 'rgba(248,113,113,0.4)' },
};

export default function GameDesigner() {
  const [level, setLevel] = useState<Level>(INITIAL_LEVEL);
  const [mode, setMode] = useState<'edit' | 'play'>('edit');
  const [selectedTool, setSelectedTool] = useState<TileType | EntityType | 'erase'>('wall');
  const [toolCategory, setToolCategory] = useState<'tiles' | 'entities'>('tiles');

  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedTilePos, setSelectedTilePos] = useState<{x: number, y: number} | null>(null);

  // Play state
  const [gameState, setGameState] = useState<GameState>({
    entities: [],
    moves: {},
    history: {},
    status: 'playing',
    message: '',
    selectedEntityId: null,
    toggledColors: []
  });

  // Initialize grid if empty
  useEffect(() => {
    if (level.tiles.length === 0) {
      const newTiles: Tile[][] = Array(level.height).fill(null).map((_, y) =>
        Array(level.width).fill(null).map((_, x) => ({
          x, y, type: 'empty' as TileType
        }))
      );

      // Level layout map — each char = a tile type
      // . = empty, G = grass, R = road, W = wall, ~ = water
      // I = ice, S = switch(blue), D = door(blue), P = paint(blue), > = one-way right
      // 1 = dog goal, 2 = cat goal, 3 = rabbit goal, 4 = bot goal
      //
      // Solutions:
      // Dog (2,1)→(8,1): go right, detour via row 0 around wall at (5,1), 8 steps (even ✓)
      // Cat (1,5)→(8,5): go right through one-way, 7 steps (odd ✓)
      // Rabbit (1,9)→(8,8): go up to row 8, then right along alternating G/R tiles
      // Robot (2,3)→(8,3): step on switch, slide across ice, pass door, reach goal
      const layout = [
        //0    1    2    3    4    5    6    7    8    9
        '.    G    G    G    G    R    R    R    R    .'.split(/\s+/),  // 0 — grass park + road
        '.    G    .    R    R    W    R    R    1    .'.split(/\s+/),  // 1 — dog goal (orange)
        '.    G    G    W    W    R    W    W    R    .'.split(/\s+/),  // 2 — wall corridor
        '.    R    .    S    I    I    I    D    4    .'.split(/\s+/),  // 3 — switch → ice → door → bot goal
        '.    W    W    W    R    R    R    W    R    .'.split(/\s+/),  // 4 — wall barrier
        '.    .    R    R    R    R    >    R    2    .'.split(/\s+/),  // 5 — cat goal (purple), one-way
        '.    R    R    W    P    W    R    W    ~    .'.split(/\s+/),  // 6 — paint (blue), water
        '.    R    R    R    R    R    R    R    ~    .'.split(/\s+/),  // 7 — open area
        '.    G    R    G    R    G    R    G    3    .'.split(/\s+/),  // 8 — alternating for rabbit goal
        '.    .    R    R    R    R    R    R    R    .'.split(/\s+/),  // 9 — rabbit start area
      ];

      const charToTile: Record<string, () => Partial<Tile>> = {
        '.': () => ({ type: 'empty' }),
        'G': () => ({ type: 'floor-black' }),
        'R': () => ({ type: 'floor-white' }),
        'W': () => ({ type: 'wall' }),
        '~': () => ({ type: 'water' }),
        'I': () => ({ type: 'ice' }),
        'S': () => ({ type: 'switch', color: 'blue' }),
        'D': () => ({ type: 'door', color: 'blue' }),
        'P': () => ({ type: 'paint', color: 'blue' }),
        '>': () => ({ type: 'one-way', meta: { direction: 'right' as Direction } }),
        '1': () => ({ type: 'goal', color: 'orange', meta: { id: 'goal-dog' } }),
        '2': () => ({ type: 'goal', color: 'purple', meta: { id: 'goal-cat' } }),
        '3': () => ({ type: 'goal', color: 'pink', meta: { id: 'goal-rabbit' } }),
        '4': () => ({ type: 'goal', color: 'red', meta: { id: 'goal-bot' } }),
      };

      for (let y = 0; y < level.height; y++) {
        for (let x = 0; x < level.width; x++) {
          const ch = layout[y]?.[x] || '.';
          const maker = charToTile[ch] || charToTile['.'];
          const tile = maker();
          newTiles[y][x] = { x, y, type: tile.type as TileType, ...tile.color && { color: tile.color }, ...tile.meta && { meta: tile.meta } };
        }
      }

      // Set initial entities with colors
      const initialEntities = INITIAL_LEVEL.entities.map(e => {
        if (e.type === 'dog') return { ...e, color: 'orange' };
        if (e.type === 'cat') return { ...e, color: 'purple' };
        if (e.type === 'rabbit') return { ...e, color: 'pink' };
        if (e.type === 'robot') return { ...e, color: 'red' };
        return e;
      });

      setLevel(prev => ({ ...prev, tiles: newTiles, entities: initialEntities }));
    }
  }, []);

  // Reset game state when entering play mode
  useEffect(() => {
    if (mode === 'play') {
      setGameState({
        entities: JSON.parse(JSON.stringify(level.entities)),
        moves: level.entities.reduce((acc, e) => ({...acc, [e.id]: 0}), {}),
        history: level.entities.reduce((acc, e) => ({...acc, [e.id]: [e.position]}), {}),
        status: 'playing',
        message: 'Select a character to move!',
        selectedEntityId: level.entities[0]?.id || null,
        toggledColors: []
      });
      setSelectedEntityId(null);
      setSelectedTilePos(null);
    }
  }, [mode, level]);

  const handleSave = () => {
    const data = JSON.stringify(level);
    localStorage.setItem('my-game-level', data);
    alert('Level saved to local storage!');
  };

  const handleLoad = () => {
    const data = localStorage.getItem('my-game-level');
    if (data) {
      try {
        const loadedLevel = JSON.parse(data);
        setLevel(loadedLevel);
      } catch (e) {
        alert('Failed to load level');
      }
    } else {
      alert('No saved level found');
    }
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear the board?')) {
      const newTiles: Tile[][] = Array(level.height).fill(null).map((_, y) =>
        Array(level.width).fill(null).map((_, x) => ({
          x, y, type: 'empty' as TileType
        }))
      );
      setLevel({ ...level, tiles: newTiles, entities: [] });
      setSelectedEntityId(null);
      setSelectedTilePos(null);
    }
  };

  const handleTileClick = (x: number, y: number) => {
    if (mode !== 'edit') return;

    const clickedEntity = level.entities.find(e => e.position.x === x && e.position.y === y);
    if (clickedEntity && selectedTool !== 'erase') {
      setSelectedEntityId(clickedEntity.id);
      setSelectedTilePos(null);
      return;
    }

    const clickedTile = level.tiles[y][x];
    if (['goal', 'door', 'paint', 'switch', 'one-way'].includes(clickedTile.type) && selectedTool !== 'erase') {
       if (selectedTool === clickedTile.type) {
         setSelectedTilePos({x, y});
         setSelectedEntityId(null);
         return;
       }
    }

    if (toolCategory === 'tiles') {
       setSelectedEntityId(null);
       setSelectedTilePos(null);
    }

    if (selectedTool === 'erase') {
      const entityIndex = level.entities.findIndex(e => e.position.x === x && e.position.y === y);
      if (entityIndex >= 0) {
        const newEntities = [...level.entities];
        newEntities.splice(entityIndex, 1);
        setLevel(prev => ({ ...prev, entities: newEntities }));
        setSelectedEntityId(null);
        return;
      }
      const newTiles = [...level.tiles];
      newTiles[y][x] = { ...newTiles[y][x], type: 'empty', color: undefined };
      setLevel(prev => ({ ...prev, tiles: newTiles }));
      setSelectedTilePos(null);
      return;
    }

    if (toolCategory === 'tiles') {
      const newTiles = [...level.tiles];
      const newType = selectedTool as TileType;
      let defaultColor: string | undefined = undefined;
      if (newType === 'goal') defaultColor = 'orange';
      if (newType === 'door') defaultColor = 'orange';
      if (newType === 'paint') defaultColor = 'orange';
      if (newType === 'switch') defaultColor = 'orange';

      if (newType === 'one-way') {
        newTiles[y][x] = { ...newTiles[y][x], type: newType, color: undefined, meta: { direction: 'right' } };
      } else {
        newTiles[y][x] = { ...newTiles[y][x], type: newType, color: defaultColor };
      }
      setLevel(prev => ({ ...prev, tiles: newTiles }));

      if (['goal', 'door', 'paint', 'switch', 'one-way'].includes(newType)) {
        setSelectedTilePos({x, y});
      }
    } else {
      const filteredEntities = level.entities.filter(e => e.position.x !== x || e.position.y !== y);
      const newEntity: Entity = {
        id: `${selectedTool}-${Date.now()}`,
        type: selectedTool as EntityType,
        position: { x, y },
        color: selectedTool === 'dog' ? 'orange' : selectedTool === 'cat' ? 'purple' : selectedTool === 'rabbit' ? 'pink' : 'blue',
        rules: [{ id: `r-${Date.now()}`, type: 'reach-goal' }]
      };
      setLevel(prev => ({ ...prev, entities: [...filteredEntities, newEntity] }));
      setSelectedEntityId(newEntity.id);
      setSelectedTilePos(null);
    }
  };

  const updateEntityRule = (entityId: string, ruleType: RuleType, action: 'add' | 'remove') => {
    setLevel(prev => ({
      ...prev,
      entities: prev.entities.map(e => {
        if (e.id !== entityId) return e;
        if (action === 'add') {
          if (e.rules.some(r => r.type === ruleType)) return e;
          return { ...e, rules: [...e.rules, { id: `r-${Date.now()}`, type: ruleType }] };
        } else {
          return { ...e, rules: e.rules.filter(r => r.type !== ruleType) };
        }
      })
    }));
  };

  const updateEntityColor = (entityId: string, color: string) => {
    setLevel(prev => ({
      ...prev,
      entities: prev.entities.map(e => e.id === entityId ? { ...e, color } : e)
    }));
  };

  const updateTileColor = (x: number, y: number, color: string) => {
    const newTiles = [...level.tiles];
    newTiles[y][x] = { ...newTiles[y][x], color };
    setLevel(prev => ({ ...prev, tiles: newTiles }));
  };

  const updateTileDirection = (x: number, y: number, direction: Direction) => {
    const newTiles = [...level.tiles];
    newTiles[y][x] = { ...newTiles[y][x], meta: { ...newTiles[y][x].meta, direction } };
    setLevel(prev => ({ ...prev, tiles: newTiles }));
  };

  const handleMove = useCallback((dx: number, dy: number) => {
    if (mode !== 'play') return;
    const result = executeMove(level, gameState, dx, dy);
    if (result) {
      setGameState(result);
    }
  }, [mode, gameState, level]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'play') return;

      switch(e.key) {
        case 'ArrowUp': handleMove(0, -1); break;
        case 'ArrowDown': handleMove(0, 1); break;
        case 'ArrowLeft': handleMove(-1, 0); break;
        case 'ArrowRight': handleMove(1, 0); break;
        case '1': if (gameState.entities[0]) setGameState(prev => ({...prev, selectedEntityId: gameState.entities[0].id})); break;
        case '2': if (gameState.entities[1]) setGameState(prev => ({...prev, selectedEntityId: gameState.entities[1].id})); break;
        case '3': if (gameState.entities[2]) setGameState(prev => ({...prev, selectedEntityId: gameState.entities[2].id})); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMove, mode, gameState.entities]);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Make Your Game
              </h1>
              <p className="text-zinc-400 text-sm mt-1">Grid Logic Playground</p>
            </div>
            <Link
              to="/"
              className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
              title="Back to Home"
            >
              <Home size={18} />
            </Link>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="p-4 space-y-2">
          <div className="flex bg-zinc-800 p-1 rounded-lg">
            <button
              onClick={() => setMode('edit')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all ${
                mode === 'edit' ? 'bg-purple-600 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Grid3X3 size={18} /> Editor
            </button>
            <button
              onClick={() => setMode('play')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all ${
                mode === 'play' ? 'bg-emerald-600 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Play size={18} /> Play
            </button>
          </div>

          {mode === 'edit' && (
            <div className="flex gap-2">
              <button onClick={handleSave} className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs">
                <Save size={14} /> Save
              </button>
              <button onClick={handleLoad} className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs">
                <Settings size={14} /> Load
              </button>
              <button onClick={handleClear} className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-800 text-zinc-400 hover:text-red-400 rounded-lg text-xs">
                <Trash2 size={14} /> Clear
              </button>
            </div>
          )}
        </div>

        {/* Editor Tools */}
        {mode === 'edit' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Categories */}
            <div className="flex gap-2 border-b border-zinc-800 pb-2">
              <button
                onClick={() => setToolCategory('tiles')}
                className={`px-3 py-1 text-sm rounded-full ${toolCategory === 'tiles' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}
              >
                Tiles
              </button>
              <button
                onClick={() => setToolCategory('entities')}
                className={`px-3 py-1 text-sm rounded-full ${toolCategory === 'entities' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}
              >
                Characters
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {toolCategory === 'tiles' ? (
                <>
                  <ToolButton active={selectedTool === 'wall'} onClick={() => setSelectedTool('wall')} icon={<div className="w-6 h-6 rounded-sm" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='28' height='28' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='28' height='28' fill='%23351008'/%3E%3Crect x='0' y='0' width='26' height='12' fill='%239b3a10' rx='1'/%3E%3Crect x='0' y='14' width='12' height='12' fill='%239b3a10' rx='1'/%3E%3Crect x='14' y='14' width='14' height='12' fill='%239b3a10' rx='1'/%3E%3C/svg%3E")`, backgroundSize: '14px 14px' }} />} label="Brick" tooltip="Solid brick wall — nothing can pass through" />
                  <ToolButton active={selectedTool === 'floor-white'} onClick={() => setSelectedTool('floor-white')} icon={<div className="w-6 h-6 rounded-sm" style={{ backgroundColor: 'rgba(120,113,108,0.4)' }} />} label="Road" tooltip="Walkable road — used with alternate-terrain rule" />
                  <ToolButton active={selectedTool === 'floor-black'} onClick={() => setSelectedTool('floor-black')} icon={<div className="w-6 h-6 rounded-sm" style={{ backgroundColor: '#183a28' }} />} label="Grass" tooltip="Walkable grass — used with alternate-terrain rule" />
                  <ToolButton active={selectedTool === 'goal'} onClick={() => setSelectedTool('goal')} icon={<LogOut className="text-emerald-500" />} label="Exit" tooltip="Destination tile — characters must reach their matching goal" />
                  <ToolButton active={selectedTool === 'water'} onClick={() => setSelectedTool('water')} icon={<Waves className="text-blue-400" />} label="Water" tooltip="Impassable water tile" />
                  <ToolButton active={selectedTool === 'door'} onClick={() => setSelectedTool('door')} icon={<DoorOpen className="text-zinc-400" />} label="Door" tooltip="Blocks passage unless character color matches or a switch opens it" />
                  <ToolButton active={selectedTool === 'paint'} onClick={() => setSelectedTool('paint')} icon={<PaintBucket className="text-zinc-400" />} label="Paint" tooltip="Changes a character's color when stepped on" />
                  <ToolButton active={selectedTool === 'ice'} onClick={() => setSelectedTool('ice')} icon={<Snowflake className="text-cyan-400" />} label="Ice" tooltip="Characters slide across ice until hitting something solid" />
                  <ToolButton active={selectedTool === 'switch'} onClick={() => setSelectedTool('switch')} icon={<ToggleLeft className="text-zinc-400" />} label="Switch" tooltip="Toggles all doors of the same color open or closed" />
                  <ToolButton active={selectedTool === 'one-way'} onClick={() => setSelectedTool('one-way')} icon={<ArrowUp className="text-amber-400" />} label="1-Way" tooltip="Can only be entered from the arrow's direction" />
                </>
              ) : (
                <>
                  <ToolButton active={selectedTool === 'dog'} onClick={() => setSelectedTool('dog')} icon={<Dog className="text-orange-500" />} label="Dog" tooltip="Place a dog character" />
                  <ToolButton active={selectedTool === 'cat'} onClick={() => setSelectedTool('cat')} icon={<Cat className="text-purple-500" />} label="Cat" tooltip="Place a cat character" />
                  <ToolButton active={selectedTool === 'rabbit'} onClick={() => setSelectedTool('rabbit')} icon={<Rabbit className="text-pink-500" />} label="Rabbit" tooltip="Place a rabbit character" />
                  <ToolButton active={selectedTool === 'robot'} onClick={() => setSelectedTool('robot')} icon={<Bot className="text-blue-500" />} label="Bot" tooltip="Place a robot — future programming target" />
                </>
              )}
              <ToolButton active={selectedTool === 'erase'} onClick={() => setSelectedTool('erase')} icon={<Trash2 className="text-red-400" />} label="Erase" tooltip="Remove a tile or character from the grid" />
            </div>

            <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
              <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Instructions</h3>
              <p className="text-sm text-zinc-400">
                Click grid to place items. Select items to edit properties (Color, Rules).
                <br/><br/>
                <span className="text-purple-400">Doors</span> block unless color matches.
                <br/>
                <span className="text-purple-400">Paint</span> changes character color.
                <br/>
                <span className="text-cyan-400">Ice</span> makes characters slide until blocked.
                <br/>
                <span className="text-amber-400">Switches</span> toggle doors of matching color.
                <br/>
                <span className="text-amber-400">One-way</span> tiles only allow entry from one direction.
              </p>
            </div>

            {/* Entity Properties Panel */}
            {selectedEntityId && (
              <div className="bg-zinc-800/50 p-4 rounded-xl border border-purple-500/30 animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-purple-300">Character</h3>
                  <button onClick={() => setSelectedEntityId(null)} className="text-zinc-500 hover:text-zinc-300">
                    <Ban size={14} />
                  </button>
                </div>

                {(() => {
                  const entity = level.entities.find(e => e.id === selectedEntityId);
                  if (!entity) return null;

                  return (
                    <div className="space-y-4">
                      {/* Color Picker */}
                      <div>
                        <label className="text-xs text-zinc-400 block mb-1">Color</label>
                        <div className="flex gap-2">
                          {['orange', 'purple', 'pink', 'blue', 'green', 'red'].map(c => (
                            <button
                              key={c}
                              onClick={() => updateEntityColor(entity.id, c)}
                              className={`w-6 h-6 rounded-full border-2 ${entity.color === c ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Rules */}
                      <div>
                        <label className="text-xs text-zinc-400 block mb-1">Rules</label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={entity.rules.some(r => r.type === 'parity-even')}
                              onChange={(e) => updateEntityRule(entity.id, 'parity-even', e.target.checked ? 'add' : 'remove')}
                              className="rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500"
                            />
                            Even Steps Only
                          </label>
                          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={entity.rules.some(r => r.type === 'parity-odd')}
                              onChange={(e) => updateEntityRule(entity.id, 'parity-odd', e.target.checked ? 'add' : 'remove')}
                              className="rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500"
                            />
                            Odd Steps Only
                          </label>
                          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={entity.rules.some(r => r.type === 'alternate-colors')}
                              onChange={(e) => updateEntityRule(entity.id, 'alternate-colors', e.target.checked ? 'add' : 'remove')}
                              className="rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500"
                            />
                            Alternate Terrain
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Tile Properties Panel */}
            {selectedTilePos && (
              <div className="bg-zinc-800/50 p-4 rounded-xl border border-emerald-500/30 animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-emerald-300">Tile Properties</h3>
                  <button onClick={() => setSelectedTilePos(null)} className="text-zinc-500 hover:text-zinc-300">
                    <Ban size={14} />
                  </button>
                </div>

                {(() => {
                  const tile = level.tiles[selectedTilePos.y][selectedTilePos.x];
                  if (!tile) return null;

                  return (
                    <div className="space-y-4">
                      <div className="text-xs text-zinc-400">
                        Type: <span className="text-zinc-200 capitalize">{tile.type}</span>
                      </div>

                      {/* Color Picker - for types that use color */}
                      {['goal', 'door', 'paint', 'switch'].includes(tile.type) && (
                        <div>
                          <label className="text-xs text-zinc-400 block mb-1">Color</label>
                          <div className="flex gap-2">
                            {['orange', 'purple', 'pink', 'blue', 'green', 'red'].map(c => (
                              <button
                                key={c}
                                onClick={() => updateTileColor(selectedTilePos.x, selectedTilePos.y, c)}
                                className={`w-6 h-6 rounded-full border-2 ${tile.color === c ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Direction Picker - for one-way tiles */}
                      {tile.type === 'one-way' && (
                        <div>
                          <label className="text-xs text-zinc-400 block mb-1">Direction</label>
                          <div className="flex gap-2">
                            {(['up', 'down', 'left', 'right'] as const).map(dir => (
                              <button
                                key={dir}
                                onClick={() => updateTileDirection(selectedTilePos.x, selectedTilePos.y, dir)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-all ${
                                  tile.meta?.direction === dir
                                    ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                                    : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                                }`}
                              >
                                <ArrowUp
                                  size={14}
                                  style={{
                                    transform: `rotate(${{ up: 0, right: 90, down: 180, left: 270 }[dir]}deg)`
                                  }}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Play Stats */}
        {mode === 'play' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-300 mb-3">Characters</h3>
              <div className="space-y-2">
                {gameState.entities.map((entity) => (
                  <button
                    key={entity.id}
                    onClick={() => setGameState(prev => ({...prev, selectedEntityId: entity.id}))}
                    className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${
                      gameState.selectedEntityId === entity.id ? 'bg-purple-600/20 border border-purple-500/50' : 'bg-zinc-900 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <EntityIcon type={entity.type} className="w-5 h-5" />
                      <span className="text-sm capitalize">{entity.type}</span>
                    </div>
                    <div className="text-xs font-mono text-zinc-500">
                      {gameState.moves[entity.id]} moves
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {gameState.message && (
               <div className="bg-purple-900/30 border border-purple-500/30 p-4 rounded-xl">
                 <p className="text-purple-200 text-sm">{gameState.message}</p>
               </div>
            )}

            <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
              <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Controls</h3>
              <div className="space-y-1 text-sm text-zinc-400">
                <p>Arrow Keys: Move</p>
                <p>1, 2, 3: Select Character</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Canvas */}
      <div className="flex-1 bg-zinc-950 relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/50 to-zinc-950 -z-10" />

        {/* Grid Container */}
        <div className="relative">
          <div className="absolute inset-0 blur-3xl opacity-20 bg-purple-500/50 rounded-full scale-90 -z-10" />
          <div
            className="relative bg-zinc-800/20 rounded-lg border border-zinc-700/50 p-px"
            style={{
              width: level.width * TILE_SIZE + level.width + 1,
              height: level.height * TILE_SIZE + level.height + 1
            }}
          >
            <div
              className="grid gap-px relative"
              style={{
                gridTemplateColumns: `repeat(${level.width}, ${TILE_SIZE}px)`,
                gridTemplateRows: `repeat(${level.height}, ${TILE_SIZE}px)`
              }}
            >
            {/* Render Tiles */}
            {level.tiles.map((row, y) => (
              row.map((tile, x) => (
                <div
                  key={`${x}-${y}`}
                  onClick={() => handleTileClick(x, y)}
                  className={`w-full h-full cursor-pointer transition-colors hover:brightness-110 relative rounded-sm`}
                >
                  <TileIcon
                    type={tile.type}
                    color={tile.color}
                    meta={tile.meta}
                    isOpen={
                      mode === 'play' &&
                      tile.type === 'door' &&
                      tile.color != null &&
                      gameState.toggledColors.includes(tile.color)
                    }
                  />

                  <span className="absolute top-0.5 left-0.5 text-[8px] text-zinc-700 select-none pointer-events-none opacity-0 hover:opacity-100">
                    {x},{y}
                  </span>
                </div>
              ))
            ))}

            {/* Render Entities — glowing dots */}
            <AnimatePresence>
              {(mode === 'play' ? gameState.entities : level.entities).map((entity) => {
                const glowColor = ENTITY_GLOW[entity.color || 'blue'] || ENTITY_GLOW.blue;
                const isSelected = mode === 'play' && gameState.selectedEntityId === entity.id;
                return (
                  <motion.div
                    key={entity.id}
                    layoutId={entity.id}
                    initial={false}
                    animate={{
                      x: entity.position.x * (TILE_SIZE + 1),
                      y: entity.position.y * (TILE_SIZE + 1)
                    }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="absolute top-0 left-0 pointer-events-none flex items-center justify-center"
                    style={{ width: TILE_SIZE, height: TILE_SIZE }}
                  >
                    <div
                      className={`relative transition-transform ${isSelected ? 'scale-110' : ''}`}
                      style={{
                        filter: `drop-shadow(0 0 ${isSelected ? '10px' : '6px'} ${glowColor.glow})`,
                      }}
                    >
                      <EntityIcon type={entity.type} color={entity.color} className="w-7 h-7" />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
