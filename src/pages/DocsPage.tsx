export default function DocsPage() {
  return (
    <div className="bg-zinc-950 text-zinc-300 font-sans min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-20">

        {/* Header */}
        <div className="mb-16">
          <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest mb-4">Documentation</p>
          <h1 className="text-3xl font-bold text-white mb-4">Puzzle DSL reference</h1>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
            Puzzles are defined in a small text-based domain-specific language. A level file specifies a grid, a tile legend, and agent declarations. The same format is used by the visual editor, the AI solver, and the AI generator — they all read and write the same text.
          </p>
        </div>

        <div className="space-y-16">

          {/* Full example */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-3">
              <span className="font-mono text-[10px] text-zinc-600 border border-zinc-800 rounded px-2 py-0.5">01</span>
              Full example
            </h2>
            <CodeBlock>{`level "Switch Puzzle" 8x6

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
            <p className="text-zinc-500 text-sm mt-4 leading-relaxed">
              An orange agent starts at (1,4). It must step on the blue switch to open the blue door, then navigate to the goal at (6,3).
            </p>
          </section>

          {/* Structure */}
          <section>
            <h2 className="text-base font-semibold text-white mb-6 flex items-center gap-3">
              <span className="font-mono text-[10px] text-zinc-600 border border-zinc-800 rounded px-2 py-0.5">02</span>
              File structure
            </h2>
            <div className="space-y-6">
              <div className="border-l border-zinc-800 pl-5">
                <p className="font-mono text-sm text-zinc-200 mb-1">Header</p>
                <CodeBlock>{`level "Level Name" WxH`}</CodeBlock>
                <p className="text-zinc-500 text-xs mt-2">Name in quotes, then grid dimensions. Required, must be first line.</p>
              </div>
              <div className="border-l border-zinc-800 pl-5">
                <p className="font-mono text-sm text-zinc-200 mb-1">Grid</p>
                <CodeBlock>{`grid = [
  W W W W W,
  W R R R W,
  W W W W W,
]`}</CodeBlock>
                <p className="text-zinc-500 text-xs mt-2">
                  Each row is a space-separated sequence of characters. Rows are separated by commas.
                  <br />Built-in chars: <code className="font-mono text-zinc-400">W</code> = wall, <code className="font-mono text-zinc-400">R</code> = floor, <code className="font-mono text-zinc-400">.</code> = void (empty/impassable).
                  Any other character is looked up in the tile legend below.
                </p>
              </div>
              <div className="border-l border-zinc-800 pl-5">
                <p className="font-mono text-sm text-zinc-200 mb-1">Tile legend</p>
                <CodeBlock>{`tile S = tiles.switch(blue)
tile D = tiles.door(blue)
tile G = tiles.goal(orange)`}</CodeBlock>
                <p className="text-zinc-500 text-xs mt-2">Maps a single character to a tile type and optional color. Characters must be single non-whitespace chars other than W, R, or .</p>
              </div>
              <div className="border-l border-zinc-800 pl-5">
                <p className="font-mono text-sm text-zinc-200 mb-1">Agents</p>
                <CodeBlock>{`agent(orange) start(1,4) and reach(6,3)
agent(blue) start(3,1)`}</CodeBlock>
                <p className="text-zinc-500 text-xs mt-2">
                  Color in parentheses, start position as (x,y). <code className="font-mono text-zinc-400">and reach(x,y)</code> is optional — omit it if an agent has no goal.
                  Only agents with <code className="font-mono text-zinc-400">reach()</code> contribute to the win condition.
                </p>
              </div>
            </div>
          </section>

          {/* Tile types */}
          <section>
            <h2 className="text-base font-semibold text-white mb-6 flex items-center gap-3">
              <span className="font-mono text-[10px] text-zinc-600 border border-zinc-800 rounded px-2 py-0.5">03</span>
              Tile types
            </h2>
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/60">
                    <th className="text-left px-5 py-3 font-mono text-[11px] text-zinc-500 font-normal">DSL syntax</th>
                    <th className="text-left px-5 py-3 font-mono text-[11px] text-zinc-500 font-normal">Behavior</th>
                    <th className="text-left px-5 py-3 font-mono text-[11px] text-zinc-500 font-normal">Passable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {[
                    { syn: 'W  (built-in)', desc: 'Wall — solid, impassable.', pass: 'Never' },
                    { syn: 'R  (built-in)', desc: 'Floor — plain walkable tile.', pass: 'Always' },
                    { syn: '.  (built-in)', desc: 'Void — outside the playable area.', pass: 'Never' },
                    { syn: 'tiles.floor(color)', desc: 'Colored floor. No special behavior.', pass: 'Always' },
                    { syn: 'tiles.goal(color)', desc: 'Goal tile. Agent must reach it to win. Accepts only agents of matching color.', pass: 'Always' },
                    { syn: 'tiles.commonGoal()', desc: 'Universal goal. Any designated agent may claim it.', pass: 'Always' },
                    { syn: 'tiles.door(color)', desc: 'Closed door. Impassable until a switch of the same color is activated.', pass: 'After switch' },
                    { syn: 'tiles.switch(color)', desc: 'Opens all doors of the same color when stepped on.', pass: 'Always' },
                    { syn: 'tiles.paint(color)', desc: 'Changes the stepping agent\'s color to match.', pass: 'Always' },
                    { syn: 'tiles.one-way(dir)', desc: 'Passable only from the indicated direction. dir: up | down | left | right.', pass: 'One direction' },
                    { syn: 'tiles.lock', desc: 'Removed when an agent of the lock\'s color steps adjacent. Impassable otherwise.', pass: 'After unlock' },
                  ].map(({ syn, desc, pass }) => (
                    <tr key={syn} className="bg-zinc-950 hover:bg-zinc-900/30 transition-colors">
                      <td className="px-5 py-3 font-mono text-[11px] text-zinc-300 align-top whitespace-nowrap">{syn}</td>
                      <td className="px-5 py-3 text-zinc-400 text-xs leading-relaxed align-top">{desc}</td>
                      <td className="px-5 py-3 text-xs align-top">
                        <span className={`font-mono ${pass === 'Always' ? 'text-emerald-500/70' : pass === 'Never' ? 'text-red-500/60' : 'text-yellow-500/60'}`}>
                          {pass}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Agent blocking */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-3">
              <span className="font-mono text-[10px] text-zinc-600 border border-zinc-800 rounded px-2 py-0.5">04</span>
              Agent rules
            </h2>
            <div className="space-y-4 text-zinc-400 text-sm leading-relaxed">
              <p>A cell occupied by another active agent is <span className="text-zinc-200">impassable</span> — treat it exactly like a wall. Agents block each other.</p>
              <p>An agent <span className="text-zinc-200">wins</span> by stepping onto its goal tile. The level is solved when all agents that have a <code className="font-mono text-xs text-zinc-300 bg-zinc-800/60 px-1.5 py-0.5 rounded">reach()</code> declaration have reached their goal.</p>
              <p>Agents without <code className="font-mono text-xs text-zinc-300 bg-zinc-800/60 px-1.5 py-0.5 rounded">and reach()</code> are helpers — they can interact with tiles (switches, paint, locks) but don't contribute to the win condition.</p>
              <p>Available agent rules (optional, appended in brackets):</p>
              <CodeBlock>{`agent(orange) start(1,4) and reach(6,3) [max-steps:20]`}</CodeBlock>
              <ul className="space-y-1 text-zinc-500 text-xs font-mono pl-4">
                <li><span className="text-zinc-400">max-steps:N</span> — agent fails if it takes more than N moves</li>
              </ul>
            </div>
          </section>

          {/* Coordinates */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-3">
              <span className="font-mono text-[10px] text-zinc-600 border border-zinc-800 rounded px-2 py-0.5">05</span>
              Coordinate system
            </h2>
            <div className="text-zinc-400 text-sm leading-relaxed space-y-3">
              <p>
                Origin <code className="font-mono text-xs text-zinc-300 bg-zinc-800/60 px-1.5 py-0.5 rounded">(0,0)</code> is the <span className="text-zinc-200">top-left</span> corner of the grid.
                X increases rightward, Y increases downward.
              </p>
              <p>Axis labels are shown on the left (Y) and bottom (X) of the grid in the designer.</p>
              <CodeBlock>{`# 5×3 grid — positions:
# (0,0) (1,0) (2,0) (3,0) (4,0)
# (0,1) (1,1) (2,1) (3,1) (4,1)
# (0,2) (1,2) (2,2) (3,2) (4,2)`}</CodeBlock>
            </div>
          </section>

          {/* Comments */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-3">
              <span className="font-mono text-[10px] text-zinc-600 border border-zinc-800 rounded px-2 py-0.5">06</span>
              Comments
            </h2>
            <CodeBlock>{`# This is a comment — ignored by the parser
level "My Level" 6x6`}</CodeBlock>
            <p className="text-zinc-500 text-sm mt-3">Lines starting with <code className="font-mono text-xs text-zinc-400">#</code> are comments. Blank lines are ignored.</p>
          </section>

        </div>
      </div>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="w-2 h-2 rounded-full bg-zinc-700" />
        <div className="w-2 h-2 rounded-full bg-zinc-700" />
        <div className="w-2 h-2 rounded-full bg-zinc-700" />
      </div>
      <pre className="bg-zinc-900/50 px-5 py-4 font-mono text-xs leading-6 text-zinc-400 overflow-x-auto whitespace-pre">{children}</pre>
    </div>
  );
}
