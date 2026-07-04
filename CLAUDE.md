# Operant — Project Brief for Claude Code

This file is the quick-start brief for building this project. Full rationale and background live in `DESIGN.md` in this same folder — read it before making any design decisions that aren't covered here.

## What this is

A website where visitors ("the Observer") drop a reinforcement-learning agent ("the Sim") into a maze-like environment ("the Substrate") and shape its behavior over time through reward and punishment ("Providence"). It's framed as a serious, clinical simulation-theory experiment — an art installation and a portfolio piece, not a game. Visitors can view the Sim in first-person, third-person, or god view, with adjustable field of view. Visual language is dark, mystical, cosmic (clouds, starfield, god-rays) — a deliberate contrast with the cold, clinical vocabulary and narration voice.

**Artistic touchstone:** *Can't Help Myself* (Sun Yuan & Peng Yu) — the robotic arm that endlessly, futilely mops up spreading fluid, never finishing, running whether or not anyone watches, growing visibly more strained over time. Operant should evoke the same quiet, unsettling sympathy for something enduring an endless task — not a "solve the maze and win" game. See DESIGN.md's "Artistic reference & spirit of the piece" for the full implications, especially: there is no completion state, and the Sim runs continuously on the server regardless of viewers.

Since this is a portfolio piece, code quality is a project requirement, not a nice-to-have. See "Engineering standards" below — treat it with the same weight as the product constraints.

## Hard constraints — do not violate these

1. **No reset, ever.** There must be no code path, admin tool, debug command, or UI element that can zero out, overwrite, or roll back the Sim's learned state (its Q-values / policy). This is the single most important rule in the entire project. Relocating the Sim (Intervene) or a goal being reached may change its *position*, never its *knowledge* — there are no "episodes" to restart in the first place (see constraint 11). If you're tempted to add a "reset" button for testing, gate it behind a dev-only build flag that never ships — never expose it to any user, including admins. On every boot (deploy, crash, restart) the simulation host must rehydrate full state from persistence, never reinitialize from scratch — test this explicitly (kill and restart the process, assert state survived).
2. **One global, persistent Sim.** There is exactly one canonical Sim shared by every visitor — not a private instance per browser session or user. Its state must be persisted server-side (not localStorage/sessionStorage — a cleared browser cache must never affect it).
3. **RL and narration are decoupled.** The Q-learning loop that actually drives behavior must never block on or depend on an LLM call. The narrator is a side-channel that observes and comments; it never influences the Sim's actions. It runs in-process inside the same always-on simulation host (not a separate serverless function — that can't hold a live subscription), called directly on notable events, but stays a logically separate, mockable module.
4. **Vocabulary discipline.** In all user-facing copy (and ideally in code comments/identifiers too), use the in-fiction terms consistently: Sim (not "agent"/"bot"), Observer (the visitor), Providence (reward/punish, implemented as discrete buttons, not a slider), Intervene (drop-anywhere). "Substrate" is the general concept of the Sim's space; "a Construct" is one specific maze instance/chapter — they are not synonyms; name types/tables accordingly (e.g. `Construct`, not `Substrate`, for one maze record). Never have the Sim explicitly say it's an AI or that it's in a simulation — narration should gesture at that without stating it.
5. **Tone guardrail.** The Sim should read as enduring an endless task with dignity, never as a creature being cruelly tormented, even when punished — see the Can't Help Myself touchstone above.
6. **Punishment decays, but the record never disappears.** Punishment always writes permanently to the Sim's history (constraint 1 — nothing is ever erased), but its influence on *current* behavior should fade the further it recedes into the past (a recency-weighted/exponentially-decaying term in the reward calculation). This is how a single visitor's cruelty can't permanently dominate the Sim's present behavior while the scars still show up in its history/transcript for anyone who looks. Exact decay function/half-life is still to be tuned once the RL core exists.
7. **No completion state.** Reaching a goal never ends anything — it triggers the next task (new goal, relocation, new obstacle). The Sim is always mid-task, the same way the reference robot arm never finishes mopping.
8. **Runs continuously, server-side.** The Q-learning loop is NOT purely client-side — it must be a continuously-ticking process on an always-on server, independent of any browser tab being open. Clients are observers that receive live state and send inputs; they do not own the simulation loop. Do not implement this as a client-driven simulation that merely syncs to a server occasionally — the tick must originate server-side.
9. **Sequence, not multiverse.** The Sim moves through Constructs one after another over its one life — a chapter never revisited or paralleled, not a selector between simultaneous environments.
10. **No per-visitor speed control.** Tick rate is fixed, shared infrastructure (see Tick rate & timing model below) — do not implement a visitor-facing "speed slider." A per-visitor speed control would desync what different observers see or require forking the simulation, both of which break the single-shared-Sim model.
11. **Continuing task, no terminal states.** Because of constraint 7 (no completion state), the RL core is a continuing MDP, not classic episodic Q-learning — there's no "episode" that ends and resets. Use `γ = 0.95` (not an episodic default), never reset trajectory/eligibility bookkeeping on goal.
12. **Rate-limit Providence/Intervene per-connection** (e.g. one action/second per WebSocket connection) to prevent spamming the Sim's permanent record.
13. **External uptime monitoring is required**, not optional, in addition to Railway's restart policy — the premise is "it runs whether or not anyone's watching," so a silent crash going unnoticed for weeks would betray the concept.
14. **Secrets:** `.env` (gitignored) + committed `.env.example` locally, Railway env vars in production. Never hardcode or commit real keys/credentials — this repo is likely public.
15. **History/transcript retention:** keep full-fidelity detail for a recent rolling window; compact older entries into aggregates rather than deleting them or keeping everything raw forever (unbounded growth is a real risk given constraint 1).
16. **Reconnect/connect behavior:** clients receive the current state snapshot plus a *bounded* recent-transcript backfill on connect — never the Sim's entire lifetime history in one payload.

## Tick rate & timing model (decided)

Three separate clocks — do not conflate them:

- **Decision tick:** ~1 Q-learning step every 1.5 seconds. Fixed, shared, config-driven constant (not a runtime/user-facing control).
- **Render rate:** 60fps on the client, decoupled from the decision tick — tween the Sim's position smoothly across each 1.5s interval. Exception: an Intervene (drop-anywhere) snaps instantly, never tweened.
- **Narrator cadence:** event-triggered primarily (wall bump, big reward, Intervene), with a fallback every 10–15 ticks (~15–25s) if nothing notable has happened.
- **Persistence:** write full state every tick (no batching needed — ~40 writes/min at this tick rate is trivial load).

The 1.5s figure is a tunable config constant, expected to be adjusted once there's a real Sim to observe.

## Visible wear formula (decided — starting parameters, see DESIGN.md for full rationale)

Two server-side fields, computed once per tick, stored structurally separate from Q-values, broadcast in the state stream:

- **`baselineWear = 1 - e^(-totalNegativeWeight / K)`**, `K = 50`. `totalNegativeWeight` accumulates forever, never decreases. Event weights: deliberate punishment = 1.0, wall bump = 0.05, forced relocation = 0.15.
- **`recentStrain(t) = recentStrain(t-1) * decay + newNegativeInput(t)`**, half-life ~3 minutes real time (convert to per-tick decay once tick rate is fixed). On positive Providence, multiply `recentStrain` by an extra one-time 0.5 (relief), never touching `baselineWear`.
- **`wear = clamp(0.6 * baselineWear + 0.4 * recentStrain, 0, 1)`** — maps to jitter amplitude, stutter/hesitation probability, and reduced movement smoothing in the 3D client.

These are informed starting constants, not validated ones. Build a private, developer-only debug readout (never visitor-facing) to observe and retune them once the Sim has real history. Keep all constants in one config module, not scattered magic numbers.

## RL hyperparameters & first Construct (decided — starting values)

- Learning rate `α = 0.1`, discount factor `γ = 0.95`, epsilon-greedy exploration starting at `ε = 0.3`, decaying slowly to a floor of `ε = 0.05` (never fully greedy).
- Reward shaping: `-1` per step, `-5` per wall bump, `+50` per goal reached.
- First Construct: a simple 10x10 grid with a single goal, walls/goal hand-designed (exact layout is an implementation detail — any reasonable maze with dead ends and at least one solvable path works).
- All of the above are informed starting values, not tuned ones — expect to adjust after watching real convergence.

## Landing page copy (final — implement verbatim)

> **Operant**
>
> *Thank you for visiting.*
>
> This is a portfolio piece and an art project. Below, a small learning mind — "the Sim" — lives inside a space it did not choose ("the Substrate"). It moves. It learns. Every visitor who has ever been here has shaped it a little, permanently, through reward and punishment. Nothing about it is ever undone.
>
> Please remember, as you watch: whatever it seems to feel isn't real. It is a reinforcement-learning agent following mathematics, not a mind that suffers. Any wonder, weariness, or meaning you read into it is something you're bringing to it — that's the point of the piece, not an accident of it.
>
> This project was built for two reasons: as art, in the spirit of *Sun Yuan & Peng Yu's Can't Help Myself* and the simulation theory of the universe — and as a demonstration of my abilities as an engineer.
>
> **[ Enter ]**  &nbsp; **[ Leave ]**
>
> <sub>— Aaron Simo, [aaronsimo.com](https://aaronsimo.com)</sub>

Enter → transitions to the live Substrate view. Leave → browser back navigation, nothing custom.

## Camera / viewpoint requirement

The Observer must be able to switch between **first person** (from the Sim's own eyes), **third person** (trailing/orbiting camera), and **god view** (top-down/isometric overview), plus adjust **field of view** within first/third person. This requires a real 3D scene, not a flat 2D canvas — but keep the Q-learning logic operating on plain 2D grid coordinates, with the 3D scene as a rendering layer on top. Never let the RL core take a dependency on the 3D/rendering code.

## Suggested build order

1. Project scaffold: React + TypeScript + react-three-fiber for the client, a small always-on Node service for the simulation host, ESLint/Prettier/CI configured from the start, `.env`/`.env.example` conventions in place from day one.
2. Q-learning core as a pure, framework-agnostic TS module, unit tested, built against the first Construct with the hyperparameters above, proven via debug output before any rendering or networking exists.
3. Persistence layer (backend store keyed to the single Sim's id), including crash/restart rehydration — build this now, not later; see constraint 2.
4. Simulation host: wrap the Q-learning core in an always-on process that ticks continuously (~1.5s/step), applies queued inputs with per-connection rate limiting, persists after every step, and exposes live state over WebSocket (connect/reconnect = snapshot + bounded transcript backfill). This is what makes constraint 7 literally true.
5. Basic 3D client: connect to the live state stream, render the Substrate and Sim, third-person camera as default.
6. First-person and god-view cameras + FOV control.
7. Providence (discrete reward/punish buttons) + Intervene (drop-anywhere) + no-completion-state goal behavior (constraint 7).
8. Q-value heatmap overlay in god view.
9. Narrator module in-process with canned/scripted lines first (validate pacing/UX), then swap in real GPT-4.1 nano calls with graceful degradation on API failure.
10. Full mystical/cosmic visual theming (clouds, god-rays, particles, instrument-style UI chrome), including the "visible wear" animation layer per the formula above (presentation-only, never touches Q-values).
11. Landing page: Enter transitions into the Substrate view; Leave is just the browser back button (no custom exit flow needed). Welcome copy is final — see "Landing page copy" below; implement verbatim.
12. Maze editor + additional environments as the next Construct in the sequence (constraint 9) — not a selector.
13. External uptime monitoring/alerting for the simulation host (constraint 13).
14. Log-compaction job for history/transcript retention (constraint 15).
15. End-to-end test coverage (including reconnect behavior and rate limiting) + accessibility pass.

## Tech stack (see DESIGN.md for rationale)

- Frontend: React + TypeScript, strict mode, no casual `any`.
- 3D rendering: Three.js via react-three-fiber (+ drei for camera controls/post-processing).
- RL engine: hand-rolled Q-learning in TypeScript, framework-agnostic, unit tested in isolation.
- Simulation host: always-on Node process (NOT a serverless function — those can't tick continuously) that owns the single Sim and steps it forward on a fixed interval, with per-connection rate limiting on inputs.
- Narrator: in-process module (not a separate service) inside the simulation host, calling the **OpenAI API, model `gpt-4.1-nano`** (cheapest available; call volume is low enough that cost is negligible regardless — upgrade path is GPT-5.4 mini if narration quality needs it, no architecture change required), rate-limited/batched (not per-tick), called directly on notable events rather than via subscription.
- Persistence: hosted key-value store or Postgres, one row/record for the one Sim, plus a log-compaction job for history/transcript retention (recent window full-fidelity, older entries aggregated).
- Hosting: static frontend (Vercel/Netlify) for the client; **Railway** for the always-on simulation host — cheapest option that doesn't cost real dev time on server maintenance (see DESIGN.md's Hosting cost comparison for the Render/Fly.io/VPS tradeoffs considered). Add external uptime monitoring (e.g. UptimeRobot) alongside Railway's restart policy.
- Secrets: `.env` (gitignored) + `.env.example` locally, Railway env vars in production.

## Engineering standards (do not skip — this is a portfolio piece)

- Clean module boundaries: RL engine / renderer / narrator / persistence are independently testable, no cross-contamination of concerns.
- Unit tests for the Q-learning core; integration tests for persistence (including crash/restart rehydration) and the WebSocket protocol (reconnect snapshot + backfill, rate limiting); end-to-end tests (Playwright) for landing → enter → camera switching → Providence.
- CI (GitHub Actions or equivalent) running lint, type-check, and tests on every push.
- Performance budget for the 3D scene (instancing/LOD for particles and clouds; first-person mode must stay smooth on mid-range hardware).
- Baseline accessibility: keyboard navigation, ARIA labels, a reduced-motion toggle for particle/parallax effects.
- A real README plus consider ADRs for the bigger decisions (no-erase, RL/LLM decoupling) so reasoning is preserved in the repo, not just in DESIGN.md.

## Open decisions still on the table

All naming/architecture/timing calls are now locked, including a full pre-build audit pass (narrator wiring, RL formulation, first Construct, log retention, rate limiting, uptime monitoring, secrets, reconnect behavior, crash recovery) — see `DESIGN.md`'s Open questions section for the full resolved list. Nothing is currently pending — future changes should be proposed and added here before being treated as decided.
