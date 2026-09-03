# LoREval

> **Experimental version - temporary AI generated docs**

Loreval measures how well language models do **logic and reasoning** on grid-based spatial puzzles. It's a web app for playing and designing puzzles, plus the harness that hands the same puzzles to an LLM and scores what comes back — no rubric, no judge model. A puzzle is either solved or it isn't.

Two tasks:

- **Solving** — given a puzzle as text, can the model produce a valid move sequence? Doors need switches hit first, agents block each other, one-way tiles and color-changing paint force ordering, not just pathfinding.
- **Designing** — given a difficulty, grid size, and a set of mechanics, can the model produce a well-formed, solvable puzzle that actually uses them?

Every attempt — human or model — is replayed move-by-move through the same engine, so a failure shows exactly where a plan diverges, not just that it failed.

## How it works

Levels are written in a small text DSL: a grid of characters, a legend mapping characters to tile types/colors, and agent declarations with start and goal positions.

```
level "Paint Run" 9x7
grid = [
  W W W W W W W W W,
  W R R R W W W W W,
  W R W S W W W W W,
  W R W W W N W W W,
  W R D R R R E P W,
  W W W W W W W G W,
  W W W W W W W W W,
]
tile S = tiles.switch(blue)
tile D = tiles.door(blue)
tile N = tiles.paint(green)
tile E = tiles.door(green)
tile P = tiles.paint(orange)
tile G = tiles.goal(orange)
agent(orange) start(1,1) and reach(7,5)
```

The same parser and game engine (`src/dsl/`, `src/gameLogic.ts`) that runs a human clicking through the visual designer also score a model's move list — there's no separate "eval version" of the game. Mechanics today: doors, switches, color-changing paint, one-way tiles, and locks. `roadmap/logic.md` sketches where this is headed (boolean gates, compound win conditions, counters).

## Project layout

```
src/
  dsl/            parser, serializer, tile/entity registry
  gameLogic.ts    the move engine (single source of truth for game rules)
  levels.ts       built-in levels
  lib/            supabase client, AI solve/generate clients, auth helpers
  components/     designer UI, playback, layout
  pages/          routed pages (home, designer, play, browse, docs, account, auth)
api/              Vercel serverless functions — LLM proxy for solve/generate
roadmap/          design docs for where the project is going next
```

`api/solve-level.ts` and `api/generate-level.ts` proxy a solve or generate request to an LLM (Anthropic by default, OpenAI-compatible endpoints supported) using a caller-supplied API key — the app never holds server-side model credentials for user requests. Supabase (see `roadmap/supabase-schema.md`) backs auth and stores/shares levels.

`roadmap/future-architecture.md` lays out where this is converging: a pure `packages/core` (types, DSL, engine, mechanics registry) shared by a deterministic solver, a procedural level generator, an eval harness, and a CLI — so the web app becomes one consumer among several instead of holding all the logic.

## Status

Working today: the DSL/engine/parser, the visual designer, model solve attempts with step-by-step playback and a retry loop, model-generated levels from constraints, and level saving/sharing/browsing.

Not yet: a deterministic solver (verified solvability + optimal move length), fixed benchmark suites with pass@k scoring, an interactive solve mode, logic gates, and the open-source CLI. No model comparison numbers are published yet — see the homepage (`src/pages/HomePage.tsx`) for the current build/next-up list.

## Development

Requires Node and npm.

```bash
npm install
npm run dev       # start the Vite dev server
npm run build     # typecheck + production build
npm run lint      # eslint
npm run preview   # preview a production build locally
```

The app needs Supabase credentials to run auth and level storage:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Set these in a local `.env` (not committed). Model calls (`api/solve-level.ts`, `api/generate-level.ts`) don't need a server-side key — the app collects the user's own API key at request time. Deployment target is Vercel (`vercel.json`); the API routes are Vercel serverless functions.

Stack: React 19 + TypeScript, Vite, Tailwind CSS, React Router, Supabase, Framer Motion.
