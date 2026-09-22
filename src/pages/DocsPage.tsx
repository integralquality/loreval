import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { TileIcon } from '../components/game/TileIcon';
import type { TileType, TileMeta } from '../types';

export default function DocsPage() {
  return (
    <div className="text-ink min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-16">
          <p className="font-mono text-[11px] text-zinc-500 mb-4">docs / dsl-reference</p>
          <h1 className="text-3xl font-bold text-zinc-100 mb-4">Puzzle DSL reference</h1>
          <p className="text-zinc-400 text-[15px] leading-relaxed max-w-2xl">
            Puzzles are defined in a small text-based domain-specific language. A level file specifies a grid, a tile legend, and agent declarations. The same format is used by the visual editor, the AI solver, and the AI generator — they all read and write the same text.
          </p>
        </div>

        <div className="space-y-20">

          {/* Full example */}
          <Section coord="0,0" title="full example">
            <CodeBlock name="switch-puzzle.puzzle">{`level "Switch Puzzle" 8x6

grid = [
  W W W W W W W W,
  W R R S R R R W,
  W R W D W R R W,
  W R W R W R G W,
  W R R R R R R W,
  W W W W W W W W,
]

tile S = tiles.switch(blue)
tile D = tiles.door(blue)
tile G = tiles.goal(orange)

agent(orange) start(1,4) and reach(6,3)`}</CodeBlock>
            <p className="text-zinc-400 text-sm mt-4 leading-relaxed">
              An orange agent starts at (1,4). It must step on the blue switch to open the blue door, then navigate to the goal at (6,3).
            </p>
          </Section>

          {/* Structure */}
          <Section coord="0,1" title="file structure">
            <div className="space-y-8">
              <Clause label="Header">
                <CodeBlock>{`level "Level Name" WxH`}</CodeBlock>
                <Note>Name in quotes, then grid dimensions. Required, must be the first line.</Note>
              </Clause>
              <Clause label="Grid">
                <CodeBlock>{`grid = [
  W W W W W,
  W R R R W,
  W W W W W,
]`}</CodeBlock>
                <Note>
                  Each row is a space-separated sequence of characters; rows end with a comma.
                  Built-in characters: <Mono>W</Mono> = wall, <Mono>R</Mono> = floor, <Mono>.</Mono> = void (outside the playable area).
                  Any other character must be defined in the tile legend.
                </Note>
              </Clause>
              <Clause label="Tile legend">
                <CodeBlock>{`tile S = tiles.switch(blue)
tile D = tiles.door(blue)
tile G = tiles.goal(orange)`}</CodeBlock>
                <Note>Maps a single character to a tile type and optional color. Characters must be single non-whitespace characters other than <Mono>W</Mono>, <Mono>R</Mono>, or <Mono>.</Mono></Note>
              </Clause>
              <Clause label="Agents">
                <CodeBlock>{`agent(orange) start(1,4) and reach(6,3)
agent(blue) start(3,1)`}</CodeBlock>
                <Note>
                  Color in parentheses, start position as (x,y). <Mono>and reach(x,y)</Mono> is optional and must point at a goal tile.
                  Only agents with <Mono>reach()</Mono> count toward the win condition; agents without it are helpers — they can hit switches, pick up paint, and open locks, but don't need to finish.
                </Note>
              </Clause>
            </div>
          </Section>

          {/* Tile types */}
          <Section coord="0,2" title="tile types">
            <div className="rounded-lg border border-white/15 overflow-hidden bg-surface/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/15 bg-white/5">
                    <th className="text-left px-4 py-3 font-mono text-[11px] text-zinc-500 font-medium w-12">tile</th>
                    <th className="text-left px-4 py-3 font-mono text-[11px] text-zinc-500 font-medium">syntax</th>
                    <th className="text-left px-4 py-3 font-mono text-[11px] text-zinc-500 font-medium">behavior</th>
                    <th className="text-left px-4 py-3 font-mono text-[11px] text-zinc-500 font-medium">passable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {TILE_ROWS.map(({ swatch, syn, desc, pass }) => (
                    <tr key={syn}>
                      <td className="px-4 py-3 align-top">
                        <div className="w-8 h-8 rounded bg-zinc-950 p-1">
                          {swatch && <TileIcon type={swatch.type} color={swatch.color} meta={swatch.meta} />}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-zinc-200 align-top whitespace-nowrap">{syn}</td>
                      <td className="px-4 py-3 text-zinc-400 text-xs leading-relaxed align-top">{desc}</td>
                      <td className="px-4 py-3 text-xs align-top">
                        <span className={`font-mono ${pass === 'always' ? 'text-emerald-400' : pass === 'never' ? 'text-red-400/80' : 'text-orange-400'}`}>
                          {pass}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Note>
              Swatches are rendered by the same components the game uses. Goals with a color accept only agents of that color; <Mono>tiles.goal()</Mono> with no color (alias <Mono>tiles.commonGoal()</Mono>) accepts any agent.
            </Note>
          </Section>

          {/* Movement & rules */}
          <Section coord="0,3" title="movement and win condition">
            <div className="space-y-4 text-zinc-400 text-[15px] leading-relaxed">
              <p>Agents move one tile per step in four directions. A cell occupied by another active agent is <strong className="text-zinc-100 font-semibold">impassable</strong> — agents block each other, which makes ordering matter in multi-agent levels.</p>
              <p>An agent finishes by stepping onto its goal tile (color must match for colored goals). The level is <strong className="text-zinc-100 font-semibold">solved</strong> when every agent that declares <Mono>reach()</Mono> has finished. Finished agents leave the board and no longer block.</p>
              <p>Optional per-agent rules are appended in brackets:</p>
              <CodeBlock>{`agent(orange) start(1,4) and reach(6,3) [max-steps:20]`}</CodeBlock>
              <ul className="space-y-1 text-zinc-400 text-sm font-mono pl-4">
                <li><span className="text-zinc-100">max-steps:N</span> — the agent fails if it takes more than N moves</li>
              </ul>
            </div>
          </Section>

          {/* Mechanics in detail */}
          <Section coord="0,4" title="mechanics in detail">
            <div className="space-y-6">
              <Clause label="Switches and doors">
                <Note>
                  Stepping on a switch toggles all doors of the same color, everywhere on the board. Stepping on it again toggles them back — a switch is a toggle, not a one-shot. An agent whose own color matches a door passes regardless of switch state.
                </Note>
              </Clause>
              <Clause label="Paint">
                <Note>
                  A paint tile recolors the agent that steps on it. Color is identity: it decides which doors you pass, which locks you can open, and which goal accepts you. Paint makes those properties mutable mid-level.
                </Note>
              </Clause>
              <Clause label="Locks">
                <Note>
                  A lock is impassable unless the stepping agent's color matches. When a matching agent steps on it, it opens permanently — for everyone. Use a helper agent of the right color to clear the way for others.
                </Note>
              </Clause>
              <Clause label="One-way tiles">
                <Note>
                  Enterable only from the indicated direction, exitable in any direction. Useful for forcing routes and building no-return commitments into a level.
                </Note>
              </Clause>
            </div>
          </Section>

          {/* Coordinates */}
          <Section coord="0,5" title="coordinate system">
            <div className="text-zinc-400 text-[15px] leading-relaxed space-y-3">
              <p>
                Origin <Mono>(0,0)</Mono> is the <strong className="text-zinc-100 font-semibold">top-left</strong> corner. X increases rightward, Y increases downward — the same convention the move log and the playback overlay use.
              </p>
              <CodeBlock>{`# 5×3 grid — positions:
# (0,0) (1,0) (2,0) (3,0) (4,0)
# (0,1) (1,1) (2,1) (3,1) (4,1)
# (0,2) (1,2) (2,2) (3,2) (4,2)`}</CodeBlock>
            </div>
          </Section>

          {/* Comments */}
          <Section coord="0,6" title="comments">
            <CodeBlock>{`# This is a comment — ignored by the parser
level "My Level" 6x6`}</CodeBlock>
            <Note>Lines starting with <Mono>#</Mono> are comments. Blank lines are ignored.</Note>
          </Section>

        </div>

        <div className="mt-20 border-t-2 border-zinc-700 pt-8">
          <p className="text-zinc-400 text-sm mb-3">The fastest way to learn the format is to draw a level and watch the source update live.</p>
          <Link to="/designer" className="inline-flex items-center gap-2 font-mono text-sm text-orange-400 hover:text-orange-300 transition-colors">
            open the designer <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Tile table data ──────────────────────────────────────────────────────────

const TILE_ROWS: Array<{
  swatch: { type: TileType; color?: string; meta?: TileMeta } | null;
  syn: string;
  desc: string;
  pass: string;
}> = [
  { swatch: { type: 'wall' },                              syn: 'W  (built-in)',        desc: 'Wall — solid, impassable.',                                                              pass: 'never' },
  { swatch: { type: 'floor-white' },                       syn: 'R  (built-in)',        desc: 'Floor — plain walkable tile.',                                                           pass: 'always' },
  { swatch: { type: 'empty' },                             syn: '.  (built-in)',        desc: 'Void — outside the playable area.',                                                      pass: 'never' },
  { swatch: { type: 'goal', color: 'orange' },             syn: 'tiles.goal(color)',    desc: 'Goal. Accepts only agents of the matching color; colorless goal() accepts any agent.',  pass: 'always' },
  { swatch: { type: 'door', color: 'blue' },               syn: 'tiles.door(color)',    desc: 'Closed door. Opens while a same-color switch is toggled on, or for same-color agents.', pass: 'conditional' },
  { swatch: { type: 'switch', color: 'blue' },             syn: 'tiles.switch(color)',  desc: 'Toggles all doors of the same color each time an agent steps on it.',                   pass: 'always' },
  { swatch: { type: 'paint', color: 'green' },             syn: 'tiles.paint(color)',   desc: 'Recolors the stepping agent.',                                                           pass: 'always' },
  { swatch: { type: 'one-way', meta: { direction: 'right' } }, syn: 'tiles.one-way(dir)', desc: 'Enterable only from the given direction. dir: up | down | left | right.',             pass: 'one direction' },
  { swatch: { type: 'lock', color: 'red' },                syn: 'tiles.lock(color)',    desc: 'Impassable until an agent of the matching color steps on it; then open for everyone.',  pass: 'conditional' },
];

// ─── Local building blocks ────────────────────────────────────────────────────

function Section({ coord, title, children }: { coord: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="border-t-2 border-zinc-700 pt-4 mb-8 flex items-baseline justify-between gap-4">
        <h2 className="font-mono text-sm font-bold text-zinc-100 lowercase tracking-wide">{title}</h2>
        <span className="font-mono text-xs text-zinc-400">({coord})</span>
      </div>
      {children}
    </section>
  );
}

function Clause({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-white/15 pl-5">
      <p className="font-mono text-sm font-bold text-zinc-100 mb-2">{label}</p>
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-zinc-400 text-sm mt-3 leading-relaxed">{children}</p>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[12px] text-zinc-100 bg-white/[0.07] border border-white/10 px-1.5 py-0.5 rounded">{children}</code>;
}

function CodeBlock({ children, name }: { children: string; name?: string }) {
  return (
    <div className="rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 shadow-[0_8px_24px_-10px_rgba(33,32,28,0.4)] my-3">
      {name && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800">
          <div className="w-2 h-2 rounded-[2px] bg-blue-400" />
          <span className="font-mono text-xs text-zinc-500">{name}</span>
        </div>
      )}
      <pre className="px-5 py-4 font-mono text-xs leading-6 text-zinc-300 overflow-x-auto whitespace-pre">{children}</pre>
    </div>
  );
}
