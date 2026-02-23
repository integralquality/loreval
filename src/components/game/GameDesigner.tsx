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
  Flag,
  Ban,
  DoorOpen,
  PaintBucket,
  Snowflake,
  ToggleLeft,
  ArrowUp,
  Home
} from 'lucide-react';
import type { Level, Tile, TileType, EntityType, Entity, RuleType, Direction, GameState } from '../../types';
import { TILE_SIZE } from '../../types';
import { INITIAL_LEVEL } from '../../constants';
import { executeMove } from '../../gameLogic';
import { TileIcon } from './TileIcon';
import { EntityIcon } from './EntityIcon';
import { ToolButton } from './ToolButton';

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

      // Create a checkerboard pattern for demo
      for(let y=0; y<level.height; y++) {
        for(let x=0; x<level.width; x++) {
          if (x > 0 && x < level.width - 1) {
             newTiles[y][x].type = (x + y) % 2 === 0 ? 'floor-white' : 'floor-black';
          }
        }
      }

      // Set goals
      newTiles[1][6] = { x: 6, y: 1, type: 'goal', color: 'orange', meta: { id: 'goal-dog' } };
      newTiles[3][6] = { x: 6, y: 3, type: 'goal', color: 'purple', meta: { id: 'goal-cat' } };
      newTiles[5][6] = { x: 6, y: 5, type: 'goal', color: 'pink', meta: { id: 'goal-rabbit' } };

      // Ice corridor demo (row 6)
      newTiles[6][1] = { x: 1, y: 6, type: 'ice' };
      newTiles[6][2] = { x: 2, y: 6, type: 'ice' };
      newTiles[6][3] = { x: 3, y: 6, type: 'ice' };
      newTiles[6][4] = { x: 4, y: 6, type: 'ice' };
      newTiles[6][5] = { x: 5, y: 6, type: 'ice' };

      // Switch + door + one-way demo (row 7)
      newTiles[7][2] = { x: 2, y: 7, type: 'switch', color: 'blue' };
      newTiles[7][3] = { x: 3, y: 7, type: 'paint', color: 'blue' };
      newTiles[7][4] = { x: 4, y: 7, type: 'one-way', meta: { direction: 'right' } };
      newTiles[7][5] = { x: 5, y: 7, type: 'door', color: 'blue' };
      newTiles[7][7] = { x: 7, y: 7, type: 'goal', color: 'blue' };

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
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Make Your Game
              </h1>
              <p className="text-slate-400 text-sm mt-1">Grid Logic Playground</p>
            </div>
            <Link
              to="/"
              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title="Back to Home"
            >
              <Home size={18} />
            </Link>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="p-4 space-y-2">
          <div className="flex bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setMode('edit')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all ${
                mode === 'edit' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid3X3 size={18} /> Editor
            </button>
            <button
              onClick={() => setMode('play')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all ${
                mode === 'play' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Play size={18} /> Play
            </button>
          </div>

          {mode === 'edit' && (
            <div className="flex gap-2">
              <button onClick={handleSave} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs">
                <Save size={14} /> Save
              </button>
              <button onClick={handleLoad} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs">
                <Settings size={14} /> Load
              </button>
              <button onClick={handleClear} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-800 text-slate-400 hover:text-red-400 rounded-lg text-xs">
                <Trash2 size={14} /> Clear
              </button>
            </div>
          )}
        </div>

        {/* Editor Tools */}
        {mode === 'edit' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Categories */}
            <div className="flex gap-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => setToolCategory('tiles')}
                className={`px-3 py-1 text-sm rounded-full ${toolCategory === 'tiles' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
              >
                Tiles
              </button>
              <button
                onClick={() => setToolCategory('entities')}
                className={`px-3 py-1 text-sm rounded-full ${toolCategory === 'entities' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
              >
                Characters
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {toolCategory === 'tiles' ? (
                <>
                  <ToolButton active={selectedTool === 'wall'} onClick={() => setSelectedTool('wall')} icon={<div className="w-6 h-6 bg-slate-700 rounded-sm" />} label="Wall" tooltip="Solid block that nothing can pass through" />
                  <ToolButton active={selectedTool === 'floor-white'} onClick={() => setSelectedTool('floor-white')} icon={<div className="w-6 h-6 bg-slate-100 rounded-sm" />} label="White" tooltip="White floor tile — used with alternate-colors rule" />
                  <ToolButton active={selectedTool === 'floor-black'} onClick={() => setSelectedTool('floor-black')} icon={<div className="w-6 h-6 bg-slate-900 border border-slate-700 rounded-sm" />} label="Black" tooltip="Black floor tile — used with alternate-colors rule" />
                  <ToolButton active={selectedTool === 'goal'} onClick={() => setSelectedTool('goal')} icon={<Flag className="text-emerald-500" />} label="Goal" tooltip="Destination tile — characters must reach their matching goal" />
                  <ToolButton active={selectedTool === 'water'} onClick={() => setSelectedTool('water')} icon={<div className="w-6 h-6 bg-blue-500/50 rounded-sm" />} label="Water" tooltip="Impassable water tile" />
                  <ToolButton active={selectedTool === 'door'} onClick={() => setSelectedTool('door')} icon={<DoorOpen className="text-slate-400" />} label="Door" tooltip="Blocks passage unless character color matches or a switch opens it" />
                  <ToolButton active={selectedTool === 'paint'} onClick={() => setSelectedTool('paint')} icon={<PaintBucket className="text-slate-400" />} label="Paint" tooltip="Changes a character's color when stepped on" />
                  <ToolButton active={selectedTool === 'ice'} onClick={() => setSelectedTool('ice')} icon={<Snowflake className="text-cyan-400" />} label="Ice" tooltip="Characters slide across ice until hitting something solid" />
                  <ToolButton active={selectedTool === 'switch'} onClick={() => setSelectedTool('switch')} icon={<ToggleLeft className="text-slate-400" />} label="Switch" tooltip="Toggles all doors of the same color open or closed" />
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

            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
              <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Instructions</h3>
              <p className="text-sm text-slate-400">
                Click grid to place items. Select items to edit properties (Color, Rules).
                <br/><br/>
                <span className="text-indigo-400">Doors</span> block unless color matches.
                <br/>
                <span className="text-indigo-400">Paint</span> changes character color.
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
              <div className="bg-slate-800/50 p-4 rounded-xl border border-indigo-500/30 animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-indigo-300">Character</h3>
                  <button onClick={() => setSelectedEntityId(null)} className="text-slate-500 hover:text-slate-300">
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
                        <label className="text-xs text-slate-400 block mb-1">Color</label>
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
                        <label className="text-xs text-slate-400 block mb-1">Rules</label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={entity.rules.some(r => r.type === 'parity-even')}
                              onChange={(e) => updateEntityRule(entity.id, 'parity-even', e.target.checked ? 'add' : 'remove')}
                              className="rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                            />
                            Even Steps Only
                          </label>
                          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={entity.rules.some(r => r.type === 'parity-odd')}
                              onChange={(e) => updateEntityRule(entity.id, 'parity-odd', e.target.checked ? 'add' : 'remove')}
                              className="rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                            />
                            Odd Steps Only
                          </label>
                          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={entity.rules.some(r => r.type === 'alternate-colors')}
                              onChange={(e) => updateEntityRule(entity.id, 'alternate-colors', e.target.checked ? 'add' : 'remove')}
                              className="rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                            />
                            Alternate Colors
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
              <div className="bg-slate-800/50 p-4 rounded-xl border border-emerald-500/30 animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-emerald-300">Tile Properties</h3>
                  <button onClick={() => setSelectedTilePos(null)} className="text-slate-500 hover:text-slate-300">
                    <Ban size={14} />
                  </button>
                </div>

                {(() => {
                  const tile = level.tiles[selectedTilePos.y][selectedTilePos.x];
                  if (!tile) return null;

                  return (
                    <div className="space-y-4">
                      <div className="text-xs text-slate-400">
                        Type: <span className="text-slate-200 capitalize">{tile.type}</span>
                      </div>

                      {/* Color Picker - for types that use color */}
                      {['goal', 'door', 'paint', 'switch'].includes(tile.type) && (
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Color</label>
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
                          <label className="text-xs text-slate-400 block mb-1">Direction</label>
                          <div className="flex gap-2">
                            {(['up', 'down', 'left', 'right'] as const).map(dir => (
                              <button
                                key={dir}
                                onClick={() => updateTileDirection(selectedTilePos.x, selectedTilePos.y, dir)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-all ${
                                  tile.meta?.direction === dir
                                    ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                                    : 'border-slate-700 bg-slate-800 text-slate-500 hover:text-slate-300'
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
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Characters</h3>
              <div className="space-y-2">
                {gameState.entities.map((entity) => (
                  <button
                    key={entity.id}
                    onClick={() => setGameState(prev => ({...prev, selectedEntityId: entity.id}))}
                    className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${
                      gameState.selectedEntityId === entity.id ? 'bg-indigo-600/20 border border-indigo-500/50' : 'bg-slate-900 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <EntityIcon type={entity.type} className="w-5 h-5" />
                      <span className="text-sm capitalize">{entity.type}</span>
                    </div>
                    <div className="text-xs font-mono text-slate-500">
                      {gameState.moves[entity.id]} moves
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {gameState.message && (
               <div className="bg-indigo-900/30 border border-indigo-500/30 p-4 rounded-xl">
                 <p className="text-indigo-200 text-sm">{gameState.message}</p>
               </div>
            )}

            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
              <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Controls</h3>
              <div className="space-y-1 text-sm text-slate-400">
                <p>Arrow Keys: Move</p>
                <p>1, 2, 3: Select Character</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Canvas */}
      <div className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900/50 to-slate-950 -z-10" />

        {/* Grid Container */}
        <div
          className="relative bg-slate-900 rounded-lg shadow-2xl border border-slate-800 p-4"
          style={{
            width: level.width * TILE_SIZE + 32,
            height: level.height * TILE_SIZE + 32
          }}
        >
          <div
            className="grid gap-0 relative"
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
                  className={`w-full h-full border border-slate-800/30 cursor-pointer transition-colors hover:brightness-110 relative`}
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

                  <span className="absolute top-0.5 left-0.5 text-[8px] text-slate-700 select-none pointer-events-none opacity-0 hover:opacity-100">
                    {x},{y}
                  </span>
                </div>
              ))
            ))}

            {/* Render Entities */}
            <AnimatePresence>
              {(mode === 'play' ? gameState.entities : level.entities).map((entity) => (
                <motion.div
                  key={entity.id}
                  layoutId={entity.id}
                  initial={false}
                  animate={{
                    x: entity.position.x * TILE_SIZE,
                    y: entity.position.y * TILE_SIZE
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="absolute top-0 left-0 pointer-events-none flex items-center justify-center"
                  style={{ width: TILE_SIZE, height: TILE_SIZE }}
                >
                  <div className={`relative ${mode === 'play' && gameState.selectedEntityId === entity.id ? 'scale-110 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : ''}`}>
                    <EntityIcon type={entity.type} color={entity.color} className="w-8 h-8" />
                    {entity.rules.some(r => r.type === 'parity-even') && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border border-slate-900" title="Even Steps" />
                    )}
                    {entity.rules.some(r => r.type === 'parity-odd') && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full border border-slate-900" title="Odd Steps" />
                    )}
                    {entity.rules.some(r => r.type === 'alternate-colors') && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-pink-500 rounded-full border border-slate-900" title="Alternate Colors" />
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
