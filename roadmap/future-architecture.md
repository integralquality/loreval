# Loreval — Target Architecture

Where the project should converge based on `roadmap/logic.md`, `roadmap/fable-first-review.md`, and the current codebase. The goal is to evolve from "web playground" to "evaluation instrument" without rewriting what works: the DSL, engine, designer, and playback UX stay; they get repackaged so headless consumers (solver, eval harness, CLI) can use them too.

## Design principles

1. **One source of truth for game semantics.** The engine (`executeMove` and friends) is the only place rules live. The solver, the eval scorer, the web playback, and the CLI all call the same transition function. If two components can disagree about whether a move is legal, the eval is broken.
2. **Pure core, effects at the edges.** Engine, parser, solver, and scorers are pure functions with no React, no fetch, no Supabase. UI and API are thin shells.
3. **Mechanics as data, not branches.** New tile types, gates, and win rules register behavior (blocking, effects, win evaluation) instead of adding branches to a monolithic `executeMove`. This is what makes `logic.md` (gates, counters, cyclers, quantified win rules) cheap to add — and it's the extension point for future verticals.
4. **Everything versioned for reproducibility.** A published benchmark number must pin: DSL version, engine version, suite version, prompt version, model id. Results that can't be reproduced aren't an eval.

## Component map

```
                        ┌─────────────────────────────────────────┐
                        │            packages/core                │
                        │  types · DSL parser/serializer ·        │
                        │  engine (transition fn) ·               │
                        │  mechanics registry · win-rule eval     │
                        └───────┬───────────────┬─────────────────┘
                                │               │
              ┌─────────────────┴───┐   ┌───────┴──────────────────┐
              │  packages/solver    │   │  packages/levels         │
              │  BFS/A* search ·    │   │  procedural generator    │
              │  optimal length ·   │   │  (seeded) · validators · │
              │  solvability ·      │   │  difficulty scorer ·     │
              │  load-bearing check │   │  suite definitions       │
              └─────────┬───────────┘   └───────┬──────────────────┘
                        │                       │
                        └───────┬───────────────┘
                                │
                  ┌─────────────┴──────────────────┐
                  │        packages/eval           │
                  │  task definitions (solve-plan, │
                  │  solve-interactive, generate) ·│
                  │  model adapters · runner ·     │
                  │  metrics/scoring · result      │
                  │  schema (JSON)                 │
                  └───────┬───────────────┬────────┘
                          │               │
              ┌───────────┴────┐   ┌──────┴────────────────────────┐
              │  apps/cli      │   │  apps/web (current src/)      │
              │  loreval run · │   │  designer · playback ·        │
              │  validate ·    │   │  browse/share · benchmark     │
              │  gen · report  │   │  dashboard + leaderboard      │
              └────────────────┘   └──────┬────────────────────────┘
                                          │
                                   ┌──────┴────────────────────────┐
                                   │  api/ (serverless) + Supabase │
                                   │  LLM proxy · run orchestration│
                                   │  levels/runs/results storage  │
                                   └───────────────────────────────┘
```

Concretely: a pnpm/npm workspace monorepo. `packages/*` are pure TypeScript, no DOM. `apps/web` is the current Vite app; `apps/cli` is new. `api/` stays as Vercel functions but imports from `packages/*` instead of duplicating logic.

---

## 1. `packages/core` — game semantics

**Extracted from:** `src/types.ts`, `src/dsl/*`, `src/gameLogic.ts`, `src/levels.ts`.

**Role:** the single definition of what a level *is* and how it *behaves*.

- **Types** — `Level`, `Tile`, `Entity`, `Rule`, plus new `Gate`, `WinCondition` types from `logic.md`.
- **DSL parser / serializer** — already round-trips; gains: `gate OP(...) -> target` lines, `win when ...` expressions, counter/cycler tile metadata. Carries an explicit **DSL version** in the format (`level "..." 8x6 @v2`) so old saved levels keep parsing.
- **Engine** — refactor `executeMove` from a 180-line branch tree into a small pipeline driven by a **mechanics registry**:

  ```ts
  interface TileMechanic {
    type: string;
    blocks?(ctx: MoveContext): boolean | BlockedReason;
    onEnter?(ctx: MoveContext): StateDelta;
  }
  interface WinRule {
    type: string;
    evaluate(state: GameState, level: Level): 'won' | 'lost' | 'playing';
  }
  ```

  Existing mechanics (door, switch, paint, one-way, lock) become registry entries; gates/counters/cyclers from `logic.md` are *just more entries* plus a gate-evaluation pass after each `onEnter`. The registry already has a sibling pattern in `src/dsl/registry.ts` — this generalizes it from parsing to behavior.
- **Win-rule evaluator** — replaces the hardcoded "all reach-goal agents finished" check; evaluates the boolean/quantifier/count expressions from `logic.md` §2–3 over agent state.
- **Canonical state encoding** — a stable, hashable serialization of `GameState` (agent positions+colors, toggled switches, opened locks, counter values). Needed by the solver (visited-set) and by the interactive eval task (observation format sent to the model).

**Consumers:** literally everything else.

## 2. `packages/solver` — deterministic ground truth

**New.** The keystone component: converts subjective claims ("hard", "solvable", "the switch matters") into computed facts.

- **Search** — BFS (uniform cost) or A* over `(canonical state) → moves`, using the core engine's transition function. State space at ≤12×12 with a handful of agents and boolean mechanic state is small; bitmask the toggles/locks inside the canonical encoding.
- **Outputs:**
  - `solvable: boolean` and an optimal move sequence
  - `optimalLength: number` — the difficulty primitive
  - `branchingStats`, `statesExplored` — secondary difficulty signals
  - `deadEnds` / reachability map — useful for the designer UI ("this goal is unreachable")
- **Analysis passes** built on top:
  - **Load-bearing check:** re-solve with a mechanic neutralized (door removed, switch pre-toggled). If optimal length doesn't change, the mechanic is decorative. This directly scores the generate task's "used purposefully" claim.
  - **Difficulty scoring:** map solver metrics → easy/medium/hard bands, replacing vibes.

**Consumers:** `packages/levels` (validate generated levels), `packages/eval` (score solves vs. optimal, grade generations), `apps/web` designer (live "solvable ✓ / optimal: 14 moves" badge), CLI (`loreval validate`).

## 3. `packages/levels` — level supply

**Extracted/grown from:** `src/levels.ts` (built-in levels) plus new code.

**Role:** produce and curate the levels the eval runs on.

- **Validators** — parse → solvable → constraint checks (size, requested mechanics present *and* load-bearing, difficulty band). One `validateLevel(dsl, constraints): ValidationReport` used identically by the eval scorer, the designer UI, and the publish path in the web app.
- **Procedural generator** — seeded, template/constraint-driven level synthesis (place mechanics, verify with solver, mutate until difficulty band hit). Seeds make suites reproducible and contamination-resistant: publish suite A, hold out suite B generated from private seeds.
- **Suites** — versioned, named collections: `core-v1/easy`, `gates-v1/hard`, etc. A suite is a JSON manifest (level DSLs or generator seeds + expected metadata). Stored in-repo for public suites; private suites stay out of the repo.

**Consumers:** eval harness (what to run), web app (browse/play official suites), CLI (`loreval gen`).

## 4. `packages/eval` — the harness

**New; absorbs** the prompt/response logic currently in `api/_anthropic.ts`, `api/solve-level.ts`, `api/generate-level.ts`, `src/lib/ai-solver.ts`, `src/lib/ai-generator.ts`.

**Role:** define tasks, talk to models, score results, emit a stable result format.

- **Model adapters** — one interface, multiple providers. The BYO-key guest routing in `api/_anthropic.ts` (`callLLM` → Anthropic | OpenAI-compatible) is already the right shape; it moves here and gains retries, timeout, token accounting, and cost tracking per call.
- **Task definitions** — each task is: build prompt(s) → call model → parse output → score. Three initial tasks:
  1. **`solve-plan`** (exists today): one-shot move list. Scored by replaying through the engine: solved?, moves-vs-optimal ratio, illegal-move rate, first-divergence step.
  2. **`solve-interactive`** (new): multi-turn loop — model gets canonical state observation after each move, emits next move. Same metrics plus turns-to-solve; distinguishes planning from reactive ability.
  3. **`generate`** (exists, ungraded today): scored by the `packages/levels` validation ladder — well-formed → solvable → difficulty-matched → mechanics load-bearing. Each rung is a partial score, not pass/fail.
  - Tasks implement a common interface so a fourth task (e.g. "explain why this level is unsolvable", "minimal edit to make it solvable") is additive.
- **Runner** — executes (suite × model × task × k attempts), with concurrency limits and resumability. pass@1 / pass@k aggregation.
- **Result schema** — versioned JSON: run metadata (model, suite version, engine version, prompt version, seed, timestamps, token/cost totals), per-level records (transcript, moves, score breakdown). This schema is the contract between CLI, API, database, and dashboard.
- **Prompt registry** — prompts are versioned artifacts here, not string literals scattered in `api/`. Changing a prompt creates a new prompt version; results reference it.

**Consumers:** CLI (primary), `api/` (the web app's single-attempt UX becomes "a run of size 1"), dashboard (reads result schema).

## 5. `apps/cli` — `loreval`

**New** (already advertised on the homepage). Thin wrapper over `packages/eval` + `packages/levels` + `packages/solver`:

- `loreval run --model claude-sonnet-4-6 --suite core-v1 --task solve-plan -k 3` → results JSON
- `loreval validate level.puzzle [--constraints ...]`
- `loreval solve level.puzzle` (deterministic solver, prints optimal solution)
- `loreval gen --seed 42 --difficulty hard --mechanics switches,doors`
- `loreval report results/*.json` → markdown/CSV comparison table
- Optional `loreval publish` → POST results to the hosted leaderboard.

API keys via env vars. No Supabase dependency — the CLI must work fully offline against local files; that's what makes it credible as an open-source eval.

## 6. `api/` — serverless layer

> **Status (2026-09-25):** the three functions described here have been deleted.
> Model calls now go browser → provider directly (`src/lib/llm.ts`), because an
> unauthenticated proxy that forwarded a caller-supplied base URL was an open
> relay. What follows is a greenfield design for a *new*, authenticated
> serverless layer — not an evolution of code that still exists.

**Would have evolved from** the three functions that used to live here. Role shrinks to what genuinely needs a server:

- **LLM proxy** for the hosted playground (server-held key for demo quota, BYO guest keys as today). Internally calls `packages/eval` adapters instead of its own fetch code.
- **Run orchestration** for hosted batch runs: enqueue a (suite, model, task) run, execute level-by-level within serverless limits (or fan out one invocation per level), persist incremental results to Supabase. Keeps the dashboard usable by people who won't run a CLI.
- **Results ingest** endpoint for CLI `publish` (authenticated, schema-validated).
- Rate limiting / quota on the demo key.

## 7. Supabase — data layer

**Extends** `roadmap/supabase-schema.md` (profiles, levels) with eval tables:

- `suites` — name, version, manifest ref, visibility (public/held-out).
- `runs` — model id, task, suite version, engine/prompt versions, status, aggregate metrics, token/cost totals, submitted-by.
- `run_results` — per-level: score breakdown, transcript ref (large transcripts to Storage, not rows).
- `leaderboard` — materialized view over verified runs (verified = executed by the hosted orchestrator or replay-validated on ingest: re-run the submitted move transcripts through the engine server-side; solve results are cheap to verify, which is a luxury most benchmarks don't have).
- Existing `levels` table keeps powering community share/browse — the community vertical and the eval vertical share the level format but have separate tables and lifecycles.

## 8. `apps/web` — the current app, plus a dashboard

Keeps everything that exists (designer, playback/move-log/feedback loop, browse, auth). Gains:

- **Designer integration of the solver:** live solvability badge, optimal-length display, "show solution" ghost playback, unreachable-tile highlighting. Cheap once `packages/solver` exists — it runs fine in a web worker.
- **Benchmark dashboard:** leaderboard (model × suite × task), drill-down from an aggregate score → per-level results → the *existing playback UI* replaying that exact transcript. This drill-down is the product's unfair advantage; no other benchmark lets you watch the failure.
- **Run launcher** for hosted runs (authenticated, quota'd).
- Playground solve/generate pages become thin clients of the same task definitions (a run of one level, one attempt).

---

## How a new feature lands (the scalability test)

**New mechanic (e.g. XOR gate from `logic.md`):** add a registry entry in `core` (parse syntax, blocking/effect/gate-eval behavior, serializer line, icon in web) → solver picks it up automatically because it only calls the transition function → generator gets a placement template → add a `gates-v1` suite. No changes to eval harness, CLI, schema, or dashboard.

**New task (e.g. "repair this broken level"):** implement the task interface in `eval` (prompt builder, output parser, scorer) → CLI and dashboard pick it up via the task list. No engine or solver changes.

**New provider:** one adapter in `eval`. Nothing else moves.

**New vertical (e.g. the educational/pedagogy angle from `logic.md`, or human-baseline data collection):** consumes `core` + `levels` + Supabase; lives as a new surface in `apps/web` (curriculum sequencing, human attempt recording for model-vs-human baselines). The packages don't change — that's the point of the split.

## Migration path

Each phase ships standalone value; none requires a big-bang rewrite.

1. **Extract `packages/core`** out of `src/` (mostly file moves; `api/` and `src/` import it). Introduce the mechanics registry while moving `gameLogic.ts`. *(enables everything)*
2. **Build `packages/solver`** + wire the designer solvability badge. *(first computed ground truth)*
3. **Build `packages/eval` + `apps/cli`** with `solve-plan` and `generate` tasks and the result schema; refactor `api/` onto the adapters. *(first publishable numbers — write the model-comparison post here)*
4. **Suites + Supabase eval tables + dashboard/leaderboard.** *(public benchmark)*
5. **`solve-interactive` task + logic gates** (mechanic registry makes gates a contained change). *(raises ceiling before frontier models saturate the core suite)*
6. **Procedural generator + held-out suites.** *(contamination resistance, long-term credibility)*
