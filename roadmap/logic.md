# Logic-Based DSL Concepts

Introduce discrete math and logic concepts into the puzzle DSL so players learn while solving levels.

## 1. Boolean Logic Gates (Priority: High)

Doors already respond to switches. Extend this so doors require logical combinations of switches.

### DSL Syntax

```
let A = switch:blue
let B = switch:red
let D = door:green

# Door opens only when BOTH switches are active
gate AND(A, B) -> D

# Door opens when EITHER switch is active
gate OR(A, B) -> D

# Door is open by default, closes when switch is hit
gate NOT(A) -> D

# Opens when exactly one is active
gate XOR(A, B) -> D
```

### Why it works

- Visual and tactile: toggling switches and watching doors teaches truth tables through play
- Levels can literally be truth-table puzzles ("find the combination that opens the path")
- Progressive difficulty: NOT -> OR -> AND -> XOR -> nested gates
- Naturally chains: `gate AND(OR(A, B), NOT(C)) -> D`

### Level design ideas

- **Intro NOT**: A door that's open by default. Hit the switch and it closes, blocking your path. Teaches inversion.
- **Intro AND**: Two switches in separate corridors. Both must be active to open the exit door. Requires two agents cooperating.
- **Intro XOR**: Two switches, but activating both closes the door again. Player must leave exactly one active.
- **Truth Table Challenge**: 3 switches, 1 door. Player must figure out the hidden boolean formula by experimenting.

---

## 2. Conditional Win Rules (Priority: Medium)

Compound logic in win conditions instead of just "each agent reaches its goal."

### DSL Syntax

```
agent orange start(1,1) and reach(8,5)
agent purple start(3,1) and reach(8,3)
agent red start(5,1) and reach(8,1)

# Explicit conjunction (current behavior, made explicit)
win when all reached

# Disjunction: only some need to finish
win when (orange reached) and (purple reached or red reached)

# Counting
win when count(reached) >= 2
```

### Why it works

- Players must reason about which agents to prioritize
- Teaches logical connectives (and, or) through goal planning
- Counting conditions introduce basic combinatorics reasoning

---

## 3. Predicates and Quantifiers (Priority: Medium)

Introduce `forall` and `exists` for win conditions over sets of agents.

### DSL Syntax

```
# Universal: every agent must reach its goal
win when forall agent: reached

# Existential: at least one blue agent must reach a goal
win when exists blue: reached

# Negation: no agent may step on a red tile
win when forall agent: not visited(red)
```

### Why it works

- Directly maps to first-order logic quantifiers
- "Get ALL agents to the exit" vs "get ANY agent to the exit" changes strategy completely
- Negation constraints ("avoid red tiles") add a planning dimension

---

## 4. State Machines / Cyclers (Priority: Low)

Tiles that cycle through states on interaction, teaching finite automata.

### DSL Syntax

```
# Tile cycles through states each time an agent steps on it
let C = cycle:open,closed,locked

# 3-state door: open -> closed -> locked -> open
let T = toggle:3
```

### Why it works

- Players must track state and plan the number of interactions
- Teaches modular arithmetic (step on it N times to get back to desired state)
- Combines well with multi-agent puzzles (agent A steps twice, agent B steps once)

---

## 5. Counters and Modular Arithmetic (Priority: Low)

Tiles or global counters that track numeric values.

### DSL Syntax

```
# Counter tile: starts at 3, decrements on each step, opens connected door at 0
let P = counter:3
gate ZERO(P) -> D

# Modular: resets after reaching 0
let M = counter:3:loop
```

### Why it works

- "Step on this tile exactly 3 times" teaches counting and planning
- Modular counters teach modular arithmetic
- Combined with multiple agents: who steps where and how many times?

---

## Implementation Order

1. **Logic gates** - highest impact, builds on existing switch/door system
2. **Conditional win rules** - extends existing `reach-goal` rule system
3. **Quantifiers** - natural extension of win conditions
4. **State machines** - new tile type, moderate complexity
5. **Counters** - new tile type + gate integration

## Technical Notes

- Logic gates need a new DSL block type: `gate OP(inputs) -> output`
- Parser needs to resolve tile references (legend chars) in gate expressions
- Game logic (`executeMove`) needs to evaluate gate conditions after each switch toggle
- Serializer needs to emit gate lines
- UI needs a way to visualize gate connections (maybe colored wires between switch and door?)
