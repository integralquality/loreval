/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Square, 
  Grid3X3, 
  Save, 
  Trash2, 
  Settings, 
  Plus,
  Dog,
  Cat,
  Rabbit,
  Bot,
  User,
  Flag,
  Ban,
  Palette,
  DoorOpen,
  PaintBucket
} from 'lucide-react';
import { Level, TileType, EntityType, Entity, Position, RuleType, TILE_SIZE } from './types';
import { INITIAL_LEVEL } from './constants';

// --- Components ---

const TileIcon = ({ type, color, className = "" }: { type: TileType, color?: string, className?: string }) => {
  const style = color ? { color, borderColor: color, backgroundColor: `${color}20` } : {};
  
  switch (type) {
    case 'wall': return <div className={`w-full h-full bg-slate-800 rounded-sm ${className}`} />;
    case 'floor-white': return <div className={`w-full h-full bg-slate-100 border border-slate-200 rounded-sm ${className}`} />;
    case 'floor-black': return <div className={`w-full h-full bg-slate-900 border border-slate-800 rounded-sm ${className}`} />;
    case 'goal': return <div className={`w-full h-full bg-emerald-500/20 border-2 border-emerald-500 rounded-sm flex items-center justify-center ${className}`} style={style}><Flag size={16} className={color ? "" : "text-emerald-600"} style={color ? { color } : {}} /></div>;
    case 'water': return <div className={`w-full h-full bg-blue-400/30 border border-blue-400 rounded-sm ${className}`} />;
    case 'door': return <div className={`w-full h-full bg-slate-800 border-2 rounded-sm flex items-center justify-center ${className}`} style={{ borderColor: color || '#475569' }}><DoorOpen size={20} color={color || '#94a3b8'} /></div>;
    case 'paint': return <div className={`w-full h-full border rounded-sm flex items-center justify-center ${className}`} style={{ backgroundColor: color ? `${color}40` : '#e2e8f0', borderColor: color || '#cbd5e1' }}><PaintBucket size={16} color={color || '#64748b'} /></div>;
    default: return <div className={`w-full h-full border border-slate-200/50 rounded-sm ${className}`} />;
  }
};

const EntityIcon = ({ type, color, className = "" }: { type: EntityType, color?: string, className?: string }) => {
  const style = color ? { color } : {};
  switch (type) {
    case 'dog': return <Dog className={`text-orange-500 ${className}`} style={style} />;
    case 'cat': return <Cat className={`text-purple-500 ${className}`} style={style} />;
    case 'rabbit': return <Rabbit className={`text-pink-500 ${className}`} style={style} />;
    case 'robot': return <Bot className={`text-blue-500 ${className}`} style={style} />;
    case 'player': return <User className={`text-green-500 ${className}`} style={style} />;
    default: return <User className={`text-gray-500 ${className}`} style={style} />;
  }
};

export default function App() {
  const [level, setLevel] = useState<Level>(INITIAL_LEVEL);
  const [mode, setMode] = useState<'edit' | 'play'>('edit');
  const [selectedTool, setSelectedTool] = useState<TileType | EntityType | 'erase'>('wall');
  const [toolCategory, setToolCategory] = useState<'tiles' | 'entities'>('tiles');
  
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedTilePos, setSelectedTilePos] = useState<{x: number, y: number} | null>(null);
  
  // Play state
  const [gameState, setGameState] = useState<{
    entities: Entity[];
    moves: Record<string, number>; // entityId -> moveCount
    history: Record<string, Position[]>; // entityId -> path
    status: 'playing' | 'won' | 'lost';
    message: string;
    selectedEntityId: string | null;
  }>({
    entities: [],
    moves: {},
    history: {},
    status: 'playing',
    message: '',
    selectedEntityId: null
  });

  // Initialize grid if empty
  useEffect(() => {
    if (level.tiles.length === 0) {
      const newTiles = Array(level.height).fill(null).map((_, y) => 
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
      
      // Demo for Door/Paint
      newTiles[7][3] = { x: 3, y: 7, type: 'paint', color: 'blue' };
      newTiles[7][5] = { x: 5, y: 7, type: 'door', color: 'blue' };
      newTiles[7][7] = { x: 7, y: 7, type: 'goal', color: 'blue' };

      // Set initial entities with colors
      const initialEntities = INITIAL_LEVEL.entities.map(e => {
        if (e.type === 'dog') return { ...e, color: 'orange' };
        if (e.type === 'cat') return { ...e, color: 'purple' };
        if (e.type === 'rabbit') return { ...e, color: 'pink' };
        if (e.type === 'robot') return { ...e, color: 'red' }; // Starts red, needs blue
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
        selectedEntityId: level.entities[0]?.id || null
      });
      setSelectedEntityId(null); // Clear edit selection
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
      const newTiles = Array(level.height).fill(null).map((_, y) => 
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

    // 1. Check if clicking an entity
    const clickedEntity = level.entities.find(e => e.position.x === x && e.position.y === y);
    if (clickedEntity && selectedTool !== 'erase') {
      setSelectedEntityId(clickedEntity.id);
      setSelectedTilePos(null);
      return;
    }

    // 2. Check if clicking a configurable tile (like Goal) with the SAME tool or just selecting
    const clickedTile = level.tiles[y][x];
    if (['goal', 'door', 'paint'].includes(clickedTile.type) && selectedTool !== 'erase') {
       // If we are holding the goal tool, or maybe just any tool?
       // Let's say if we click a goal, we select it.
       // But if we want to overwrite it with a wall?
       if (selectedTool === clickedTile.type) {
         setSelectedTilePos({x, y});
         setSelectedEntityId(null);
         return;
       }
    }

    // Deselect if clicking elsewhere
    if (toolCategory === 'tiles') {
       setSelectedEntityId(null);
       setSelectedTilePos(null);
    }

    if (selectedTool === 'erase') {
      // Try to remove entity first
      const entityIndex = level.entities.findIndex(e => e.position.x === x && e.position.y === y);
      if (entityIndex >= 0) {
        const newEntities = [...level.entities];
        newEntities.splice(entityIndex, 1);
        setLevel(prev => ({ ...prev, entities: newEntities }));
        setSelectedEntityId(null);
        return;
      }
      // Otherwise reset tile
      const newTiles = [...level.tiles];
      newTiles[y][x] = { ...newTiles[y][x], type: 'empty', color: undefined };
      setLevel(prev => ({ ...prev, tiles: newTiles }));
      setSelectedTilePos(null);
      return;
    }

    if (toolCategory === 'tiles') {
      const newTiles = [...level.tiles];
      // If placing a goal, default to orange if no color set? Or keep undefined.
      const newType = selectedTool as TileType;
      // Default colors for new tiles
      let defaultColor = undefined;
      if (newType === 'goal') defaultColor = 'orange';
      if (newType === 'door') defaultColor = 'orange';
      if (newType === 'paint') defaultColor = 'orange';
      
      newTiles[y][x] = { ...newTiles[y][x], type: newType, color: defaultColor };
      setLevel(prev => ({ ...prev, tiles: newTiles }));
      
      // If we just placed a goal/door/paint, select it
      if (['goal', 'door', 'paint'].includes(newType)) {
        setSelectedTilePos({x, y});
      }
    } else {
      // Add entity
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

  const handleMove = useCallback((dx: number, dy: number) => {
    if (mode !== 'play' || gameState.status !== 'playing' || !gameState.selectedEntityId) return;

    const entityIndex = gameState.entities.findIndex(e => e.id === gameState.selectedEntityId);
    if (entityIndex === -1) return;

    const entity = gameState.entities[entityIndex];
    const newPos = { x: entity.position.x + dx, y: entity.position.y + dy };

    // Bounds check
    if (newPos.x < 0 || newPos.x >= level.width || newPos.y < 0 || newPos.y >= level.height) return;

    // Wall check
    const targetTile = level.tiles[newPos.y][newPos.x];
    if (targetTile.type === 'wall' || targetTile.type === 'empty') return;

    // Door check
    if (targetTile.type === 'door') {
      // Allow pass if entity color matches door color
      // If door has no color, maybe it's locked forever? Or open? Let's say locked if no color match.
      if (!targetTile.color || targetTile.color !== entity.color) {
        // Blocked
        setGameState(prev => ({ ...prev, message: `Locked! You need to be ${targetTile.color || 'colored'} to pass.` }));
        return;
      }
    }

    // Entity collision check (optional, maybe allow overlap?)
    // For now, let's allow overlap as they might cross paths

    // Update state
    const newEntities = [...gameState.entities];
    let updatedEntity = { ...entity, position: newPos };
    
    // Paint check
    if (targetTile.type === 'paint' && targetTile.color) {
      updatedEntity.color = targetTile.color;
    }

    newEntities[entityIndex] = updatedEntity;
    
    const newMoves = { ...gameState.moves, [entity.id]: gameState.moves[entity.id] + 1 };
    const newHistory = { ...gameState.history, [entity.id]: [...gameState.history[entity.id], newPos] };

    // Check Rules
    let status: 'playing' | 'won' | 'lost' = 'playing';
    let message = '';

    // 1. Check immediate constraints (e.g. Rabbit must alternate)
    const originalEntity = level.entities.find(e => e.id === entity.id);
    if (originalEntity) {
      for (const rule of originalEntity.rules) {
        if (rule.type === 'alternate-colors') {
          const prevPos = entity.position;
          const prevTile = level.tiles[prevPos.y][prevPos.x];
          const currTile = level.tiles[newPos.y][newPos.x];
          
          // If both are floor tiles, check colors
          if ((prevTile.type === 'floor-white' && currTile.type === 'floor-white') ||
              (prevTile.type === 'floor-black' && currTile.type === 'floor-black')) {
            // Violation! Reset entity
            updatedEntity = { ...originalEntity }; // Reset to start
            newEntities[entityIndex] = updatedEntity;
            newMoves[entity.id] = 0;
            newHistory[entity.id] = [originalEntity.position];
            message = `Oops! ${entity.type} must alternate colors! Resetting...`;
          }
        }
      }
    }

    // 2. Check Goal Conditions
    if (targetTile.type === 'goal') {
       const goalRule = originalEntity?.rules.find(r => r.type === 'reach-goal');
       
       if (goalRule) {
         // Check Color Match
         if (updatedEntity.color && targetTile.color && updatedEntity.color !== targetTile.color) {
            message = `Wrong house! This is the ${targetTile.color} house.`;
         } else {
            // Check other rules (parity)
            const parityEvenRule = originalEntity?.rules.find(r => r.type === 'parity-even');
            const parityOddRule = originalEntity?.rules.find(r => r.type === 'parity-odd');
            
            const steps = newMoves[entity.id];
            let success = true;

            if (parityEvenRule && steps % 2 !== 0) {
              success = false;
              message = `Reached goal, but steps (${steps}) must be EVEN!`;
              // Reset
              updatedEntity = { ...originalEntity! };
              newEntities[entityIndex] = updatedEntity;
              newMoves[entity.id] = 0;
              newHistory[entity.id] = [originalEntity!.position];
            } else if (parityOddRule && steps % 2 === 0) {
              success = false;
              message = `Reached goal, but steps (${steps}) must be ODD!`;
              // Reset
              updatedEntity = { ...originalEntity! };
              newEntities[entityIndex] = updatedEntity;
              newMoves[entity.id] = 0;
              newHistory[entity.id] = [originalEntity!.position];
            }

            if (success) {
              message = `Great job! ${entity.type} reached home safely!`;
              // Mark as done? For now just leave them there.
            }
         }
       }
    }

    setGameState({
      entities: newEntities,
      moves: newMoves,
      history: newHistory,
      status,
      message,
      selectedEntityId: gameState.selectedEntityId
    });

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
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Make Your Game
          </h1>
          <p className="text-slate-400 text-sm mt-1">Grid Logic Playground</p>
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
                  <ToolButton active={selectedTool === 'wall'} onClick={() => setSelectedTool('wall')} icon={<div className="w-6 h-6 bg-slate-700 rounded-sm" />} label="Wall" />
                  <ToolButton active={selectedTool === 'floor-white'} onClick={() => setSelectedTool('floor-white')} icon={<div className="w-6 h-6 bg-slate-100 rounded-sm" />} label="White" />
                  <ToolButton active={selectedTool === 'floor-black'} onClick={() => setSelectedTool('floor-black')} icon={<div className="w-6 h-6 bg-slate-900 border border-slate-700 rounded-sm" />} label="Black" />
                  <ToolButton active={selectedTool === 'goal'} onClick={() => setSelectedTool('goal')} icon={<Flag className="text-emerald-500" />} label="Goal" />
                  <ToolButton active={selectedTool === 'water'} onClick={() => setSelectedTool('water')} icon={<div className="w-6 h-6 bg-blue-500/50 rounded-sm" />} label="Water" />
                  <ToolButton active={selectedTool === 'door'} onClick={() => setSelectedTool('door')} icon={<DoorOpen className="text-slate-400" />} label="Door" />
                  <ToolButton active={selectedTool === 'paint'} onClick={() => setSelectedTool('paint')} icon={<PaintBucket className="text-slate-400" />} label="Paint" />
                </>
              ) : (
                <>
                  <ToolButton active={selectedTool === 'dog'} onClick={() => setSelectedTool('dog')} icon={<Dog className="text-orange-500" />} label="Dog" />
                  <ToolButton active={selectedTool === 'cat'} onClick={() => setSelectedTool('cat')} icon={<Cat className="text-purple-500" />} label="Cat" />
                  <ToolButton active={selectedTool === 'rabbit'} onClick={() => setSelectedTool('rabbit')} icon={<Rabbit className="text-pink-500" />} label="Rabbit" />
                  <ToolButton active={selectedTool === 'robot'} onClick={() => setSelectedTool('robot')} icon={<Bot className="text-blue-500" />} label="Bot" />
                </>
              )}
              <ToolButton active={selectedTool === 'erase'} onClick={() => setSelectedTool('erase')} icon={<Trash2 className="text-red-400" />} label="Erase" />
            </div>

            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
              <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Instructions</h3>
              <p className="text-sm text-slate-400">
                Click grid to place items. Select items to edit properties (Color, Rules).
                <br/><br/>
                <span className="text-indigo-400">Doors</span> block movement unless color matches.
                <br/>
                <span className="text-indigo-400">Paint</span> changes character color.
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

                      {/* Color Picker */}
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
                {gameState.entities.map((entity, idx) => (
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
                  <TileIcon type={tile.type} color={tile.color} />
                  
                  {/* Coordinates for debugging/visuals */}
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
                    {/* Badge for rules */}
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

function ToolButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
        active 
          ? 'bg-indigo-600/20 border border-indigo-500 text-indigo-300' 
          : 'bg-slate-800 border border-transparent text-slate-400 hover:bg-slate-700'
      }`}
    >
      <div className="mb-1">{icon}</div>
      <span className="text-[10px] uppercase font-medium">{label}</span>
    </button>
  );
}

