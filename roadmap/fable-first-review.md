 What this is
     
  Loreval ("Logic and Reasoning Evaluation") is a web app for
  evaluating LLMs on grid-based spatial puzzles. It has three  tightly integrated pieces:
  1. A puzzle DSL + engine — levels are text (grid + legend + agent  declarations) with mechanics: walls, doors, switches, paint
  tiles, one-way tiles, locks, color-matched goals, multi-agent,
  max-steps. The parser, serializer, visual designer, and engine
  all stay in sync.
  2. Two LLM tasks — solving (model gets the DSL, returns a move
  list, which is played back step-by-step with a move log,
  skipped-move annotations, and a natural-language feedback retry
  loop) and generating (model produces a level from
  difficulty/size/mechanics constraints).
  3. Platform plumbing — Supabase auth and level sharing/browse,
  BYO-key guest mode supporting Anthropic plus any
  OpenAI-compatible provider, Vercel serverless API.

  Is the idea relevant? Yes — genuinely

  This sits in a good spot. Spatial/multi-step planning is a
  well-documented LLM weakness even in frontier models, outcomes
  are discretely verifiable (the engine executes the moves — no
  LLM-as-judge fuzziness), and the DSL is compact enough to fit in
  a prompt. The playback/debugging UX is a real differentiator:
  most evals tell you whether a model failed, this shows you where
  the plan broke. The dual solve/generate framing is also smart —
  generation quality is a harder, less-explored signal.

  The space has neighbors (ARC-AGI, BabyAI, TextWorld, PlanBench),
  but an interactive, inspectable, mechanic-composable puzzle eval
  with a visual designer is not something those offer. The
  contamination story is also strong: you can mint fresh levels
  forever.

  The gap: right now it's a playground, not an eval

  The homepage promises "LLM evaluation," but what exists is a
  single-attempt, human-in-the-loop demo. There are no fixed test
  suites, no batch runs, no aggregate metrics, no leaderboard, and
  — critically — no way to verify that a generated level is
  solvable other than a human or another LLM trying it. That's the
  credibility gap to close.

  Roadmap proposals, in priority order

  1. Deterministic solver (BFS/A* over game state) — do this first. It's the keystone: it auto-verifies that generated levels are solvable
  (grading the generate task objectively), gives you minimum solution length as a difficulty metric, validates that benchmark levels have
  solutions, and lets you score "moves vs. optimal" instead of just pass/fail. The state space (grid ≤12×12, few agents, switch/lock bitmasks)  is trivially searchable. Everything else in eval-land depends on this.
  2. Benchmark mode. Curated fixed suites bucketed by mechanic and difficulty (measured by solver metrics, not vibes), batch runs across
  models, pass@1/pass@k, illegal-move rate, efficiency ratio. Plus seeded procedural generation so you can publish results on a public suite
  while keeping a private held-out one. The homepage already links an "open source CLI" — a loreval run --model X --suite Y CLI that outputs
  JSON results is the natural shape, and publishing a model-comparison blog post off it is your single biggest growth lever.
  3. Interactive (agentic) solve mode. Today the model emits one up-front plan. Add a mode where it gets the observed state after each move
  and decides the next one. One-shot-plan vs. closed-loop is exactly the distinction agent researchers care about, and you already have the
  engine to support it.
  4. Logic gates from roadmap/logic.md. Good instinct, right priority order in your doc. Beyond the pedagogy angle, AND/OR/XOR/nested gates
  matter for the eval: current mechanics will likely saturate for frontier models, and gates raise the difficulty ceiling compositionally
  without inflating grid size. The "hidden truth table" idea is especially good for the interactive mode — it tests hypothesis-driven
  exploration.
  5. Richer scoring for the generate task. With the solver in place: well-formed (parser) → solvable (solver) → difficulty-matched (solution
  length / branching within target band) → mechanics actually load-bearing (does removing the requested switch make the level trivially
  solvable? The solver can check that too). That last check is the killer feature — it directly measures "used purposefully, not
  decoratively," which your homepage already claims.
  6. Smaller housekeeping: the model list pins claude-opus-4-6 — keep that table fresh (Opus 4.8 is current), and the README is still the
  stock Vite template, worth replacing once you want outside eyes on the repo.

  If you only do one thing next, build the solver — it converts the project from "demo of an idea" into "instrument that produces numbers,"
  and the numbers are what make an eval relevant.