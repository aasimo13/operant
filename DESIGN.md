# Operant — Concept & Design Doc

## Premise

A website where visitors drop an AI agent ("the Sim") into a situation — a maze to start, more environments later — and watch it try to figure its way out through trial, error, and reward. Visitors can reward or punish it and drop it into new spots mid-run — but they can never wipe what it has learned. That permanence is the whole point: this is one continuous, unbroken life. Nothing is ever erased. The whole thing doubles as a playful, interactive riff on simulation theory: the Sim doesn't know it's in a simulation, the visitor is effectively "the Observer" pulling levers on its universe, and every one of those levers leaves a permanent mark that can never be undone.

The core loop that has to feel good before anything else: **drop it somewhere → it acts → you reward or punish → it visibly gets better.** Everything else (theming, narration, extra environments) is set dressing on top of that loop.

This project doubles as an art exhibit and a portfolio piece — visitors should feel like they've walked into an installation, and anyone reviewing the code should see engineering practices that hold up to scrutiny. Neither of those is optional polish; see **Engineering standards** and **Landing page** below.

## Artistic reference & spirit of the piece

The closest reference point, by explicit intent, is *Can't Help Myself* (Sun Yuan & Peng Yu) — the robotic arm that endlessly mops up a dark, viscous fluid that keeps spreading past the boundary it's meant to stay within. It never finishes. It can't. The task is by design unsolvable, and the piece's emotional power comes from watching something perform sincere, repetitive labor forever, with no completion state and no rest, growing visibly more strained and erratic as time wears on it. Visitors watch it with a mix of fascination, unease, and unexpected empathy for a machine that is, mechanically, "just following code."

Operant should aim for the same effect, not a literal copy of the mechanic. Concretely, this reframes several earlier decisions and adds a few new ones:

- **No completion state.** Reaching the goal in the Substrate should not end anything or feel like "winning." It should trigger the next thing — a new goal, a relocation, an obstacle the Substrate didn't have before — so the Sim is always mid-task, never done, the same way the robot arm never gets to stop mopping. Solving the maze is not an ending; it's a beat in an unbroken life.
- **It runs whether or not anyone is watching.** Like the robot arm, which moved continuously for the run of its exhibition regardless of whether anyone was in the room, the Sim's simulation must be a live, continuously running process on the server — not something that only "happens" when a browser tab has it open. This has a real architectural consequence; see the updated Tech stack section below. A visitor arriving mid-session should feel like they've walked into a room where something has been quietly happening the whole time, not like they just pressed "start."
- **Visible wear, never lost progress.** The robot arm's movements grew rougher and more erratic as it and its fluid degraded over its run. Operant can echo this without literally degrading hardware: as the Sim accumulates a long, difficult, or heavily-punished history, its movement in the 3D scene can become visibly less smooth, more hesitant, more frantic — an animation/behavior layer that reflects accumulated history, never a change to its actual learned competence (its Q-values keep improving even if its *presentation* looks worn). This is aesthetic, not functional regression — track it separately from the Q-learning state so it never contradicts the no-erase principle.
- **Tone shifts toward melancholy, not just uncanny-playful.** Revise the earlier "playful-uncanny, not bleak" guardrail: the target now is closer to what *Can't Help Myself* evokes — quiet sympathy for something enduring an endless task, tinged with dark humor rather than despair. It should be possible for a visitor to feel a little sad watching it, the way people did watching the robot arm slow down. The hard line stays the same: it should never read as a suffering creature being tormented for entertainment — the emotional target is dignified endurance, not cruelty.

### Visible wear formula (decided — starting parameters)

Two layers, computed server-side once per tick, stored as fields structurally separate from the Q-values, and broadcast in the same state stream so every observer sees the same wear state (it's one shared Sim).

**1. Baseline wear — permanent, monotonic, slow.** A running tally of lifetime negative experience, converted to a 0–1 scalar with diminishing returns so it doesn't max out early:

```
baselineWear = 1 - e^(-totalNegativeWeight / K)
```

`totalNegativeWeight` accumulates forever and never decreases (the permanent scar tissue — consistent with the no-erase principle). Event weights, feeding both this and recent strain below:

- Deliberate punishment (negative Providence) → **1.0** — the "someone meant to do this" input, weighted highest.
- Wall bump → **0.05** — these happen constantly from ordinary exploration, so they need to stay small or the Sim looks ragged within its first hour.
- Forced relocation (Intervene) → **0.15** — disorienting, but not painful; a middle weight.

Starting constant: **`K = 50`** (in weighted punishment-units) — roughly 50 weighted units reaches ~63% baseline wear, ~150 reaches ~95%. This targets "a slow climb over real weeks of visitor traffic," not something that saturates on day one.

**2. Recent strain — temporary, reactive.** An exponential moving average of *recent* negative events, updated every tick and decaying on its own:

```
recentStrain(t) = recentStrain(t-1) * decay + newNegativeInput(t)
```

Decay is defined in real time rather than ticks (so it doesn't need re-deriving once the tick rate is chosen): a half-life of **~3 minutes**, converted to per-tick decay via `decay = 0.5^(1/halfLifeInTicks)` once the tick rate is fixed. This is the visible "flinch" — jitter that spikes right after a punishment or a bad stretch, then visibly settles within a single visit.

**Reward relief.** On a positive Providence event, multiply `recentStrain` by an extra one-time **0.5** on top of normal decay — a visible "it's recovering" moment — without ever touching `baselineWear`.

**Combine and map to animation:**

```
wear = clamp(w1 * baselineWear + w2 * recentStrain, 0, 1)
```

Starting weights: **`w1 = 0.6`**, **`w2 = 0.4`**. Early in the Sim's life `baselineWear` is near zero, so `recentStrain` dominates what's visible — a "young" Sim that still visibly flinches short-term but has no permanent wear yet. That's intended behavior, not a bug to fix.

Map the combined `wear` scalar (0–1) to concrete animation parameters: jitter amplitude on position/rotation, a probability of a small stutter-step or hesitation before moving, and reduced motion smoothing (more overshoot/correction rather than clean easing). `baselineWear` alone can also justify a subtle, permanent visual "tell" (a faint shimmer or desync in the model) distinct from the momentary jitter, so a long-time observer can visually tell an old, scarred Sim from a young one at a glance.

**Tuning note.** These are informed starting values, not validated ones — build a private, developer-only debug readout (never visitor-facing) showing `baselineWear`/`recentStrain` broken out live, so the constants can be retuned once the Sim has real history to look at. Keep all of these constants in one config module, not scattered magic numbers, so retuning doesn't turn into a code hunt.

## Agent architecture: hybrid RL + LLM narration

Two separate systems, kept deliberately decoupled so each does what it's good at.

**The mover (reinforcement learning) — now server-authoritative, and a continuing task (decided).** A lightweight tabular Q-learning agent (or small neural net if we want to scale up later) that actually learns the maze. State = agent's grid position (plus maybe a local view of walls). Actions = up/down/left/right. Reward = whatever the visitor assigns, plus small built-in shaping (step penalty, reward for reaching a goal, penalty for hitting walls). Per the "it runs whether or not anyone is watching" principle above, the Q-learning loop can no longer be purely client-side — it needs to be a continuously ticking process owned by the server, stepping the Sim forward on its own clock regardless of whether a browser has it open. Connected clients become **observers**: they receive a live stream of state (position, recent history, Q-values) and send *inputs* (Providence, Intervene) back, rather than owning the simulation loop themselves. This is the single biggest architecture shift from the original client-side-only assumption, and it should be treated as foundational, not an optimization to add later.

Because of "no completion state," this is modeled as a **continuing task with no terminal states**, not classic episodic Q-learning — there is no "episode" that ends and resets. Reaching a goal gives a reward bump and the goal relocates (or the Substrate changes), but the underlying MDP never terminates; the Q-update loop runs forever without ever hitting a terminal state. Concretely this means: use a discount factor close to 1 (e.g. `γ = 0.95`) rather than an episodic default, don't reset any trajectory/eligibility bookkeeping on goal, and drop "episode" from the vocabulary anywhere it implies a reset boundary that doesn't actually exist (older drafts of this doc used "episode" loosely — treat any remaining references as informal shorthand for "since the last goal," not an actual reset point).

**Starting RL hyperparameters (decided — tune once live):** learning rate `α = 0.1`, discount factor `γ = 0.95`, epsilon-greedy exploration starting at `ε = 0.3` and decaying slowly toward a floor of `ε = 0.05` (never fully greedy — the Sim should always retain some "free will"/randomness, consistent with the free-will toggle in Core mechanics). Reward shaping: `-1` per step (small cost for taking any action, encourages efficiency), `-5` for bumping a wall, `+50` for reaching a goal. These are starting values, not tuned ones — expect to adjust after watching real convergence behavior.

**The narrator (LLM) — wired in-process (decided).** Periodically — every N steps, or on notable events like a wall bump, a big reward, or a goal reached — a small prompt goes to an LLM with the Sim's recent state (position, recent rewards, Q-value confidence, ticks since last narration) and asks for a short first-person line "from the Sim's perspective." Something like *"That wall again. I'm starting to think there's a pattern here,"* or *"You rewarded me. I don't know why, but I'll do more of that."* This is where the simulation-theory flavor lives. It's not driving behavior, just voicing it, which keeps latency and cost low since it's not on the hot path of every single step.

Architecturally, the narrator module runs **in-process inside the same always-on simulation host**, not as a separate serverless function or separate always-on service. It's called directly by the host on notable events (a plain function/module call, not a network hop), which sidesteps the problem of a serverless function trying to hold a live subscription open. It stays a logically separate, independently testable module (mockable OpenAI client) even though it shares a process with the mover — this keeps the RL/narration decoupling principle intact at the code level without adding networking complexity that isn't needed at this scale.

Keeping RL and narration logically separate means the maze never stalls waiting on an LLM call, and the narration can degrade gracefully (or be turned off, or fail silently on an OpenAI API error/timeout) without breaking the actual mechanic.

### Tick rate & timing model (decided)

Three separate clocks, deliberately decoupled from each other:

- **Decision tick (the Q-learning step): ~1 step every 1.5 seconds.** This is how often the Sim actually decides and takes an action. Fast enough to feel alive within a short visit, slow enough to feel deliberate and watchable rather than frantic — matching the slow, machine-like pacing of the *Can't Help Myself* reference rather than a twitchy loop. This is shared, fixed infrastructure (see "Retired: the per-visitor speed slider" above), not something any individual visitor controls, but it should live as a single named constant in config so it can be retuned after watching it run for real.
- **Render rate: 60fps on the client, decoupled from the decision tick.** The 3D client should smoothly tween the Sim's position across each 1.5-second decision interval rather than snapping cell to cell, so ordinary movement reads as continuous rather than robotic. The deliberate exception: an Intervene (drop-anywhere) is never tweened — it's an instant, jarring snap, since it's meant to read as a violation of the Sim's own physics, not a camera pan.
- **Narrator cadence: independent of the decision tick.** Primarily event-triggered (a wall bump, a big reward, an Intervene), with a fallback firing roughly every 10–15 ticks (~15–25 seconds) if nothing notable has happened recently, so the transcript never goes silent for long stretches.

**Persistence write cadence: write every tick, no batching.** At ~1.5s per step that's roughly 40 writes a minute — trivial load for Postgres or a hosted KV store. Don't add write-behind buffering or batching complexity here; it's unnecessary at this tick rate and simpler is better per the engineering-standards principle of not over-engineering.

## Core mechanics

**Drop-anywhere.** The visitor can click any open cell in the maze and place the Sim there directly, interrupting whatever it's currently doing. This should reset its immediate trajectory but not wipe its learned Q-values — the point is it keeps whatever it's learned about the maze's structure and has to re-orient from a new starting point, which is a nice moment for the narrator to comment on ("new spot. same walls, I think.").

**Reward/punish controls.** Simple UI: a thumbs up / thumbs down (or a slider) the visitor can hit at any time, which injects a manual reward on top of the automatic shaping rewards. Visitors effectively get to be a capricious deity shaping the Sim's values in real time — reward it for going toward walls, for standing still, whatever — and watch the policy visibly warp toward what's being reinforced rather than what's "correct." That's a strong demonstration of what reward actually does in RL, and it's thematically perfect for the simulation-theory angle (an agent whose entire sense of "good" is defined by an external, possibly whimsical force).

**Maze editing / new situations.** Start with a single maze the visitor can edit (draw walls, move the goal), then expand to a small set of preset "situations" (open room, moving-obstacle room, multi-goal room, a maze that changes layout once the agent starts succeeding). Each new situation is really just a new environment definition — same RL core, same narrator.

**No-erase principle.** There is no reset button for the Sim's memory — not a hidden one, not an admin one. Its Q-values only ever accumulate. A toggle for "free will" (epsilon/exploration rate) is fine — it changes how it behaves *right now*, not what it has learned. Since this is a continuing task with no terminal states (see Agent architecture above), there's no "episode" to restart in the first place — reaching a goal or being relocated only ever changes its *position*, never its knowledge. This is a hard design constraint, not a UX suggestion: no code path anywhere should be able to zero out or overwrite the Sim's learned state. If the current Construct changes (new walls, a new environment), the Sim carries its accumulated instincts into it and has to reconcile them — which is exactly the moment the narrator should have the most to say.

**Retired: the per-visitor "speed slider."** An earlier draft of this doc proposed letting each visitor control how many steps run per second. That doesn't fit the server-authoritative, single-shared-Sim model (see Tick rate & timing model below) — a per-visitor speed control would either desync what different observers see or require forking the simulation per visitor, both of which undermine "one continuous life, shared by everyone." Tick rate is now fixed, shared infrastructure, not a visitor-facing control.

## Camera / viewpoint modes

A first design requirement that changes the rendering approach: the Observer must be able to switch between at least three viewpoints, with adjustable field of view.

- **First person.** The camera sits at the Sim's own position and looks out through its "eyes" — this is the view that should feel most unsettling, since it's framed as the only direct feed into what the Sim itself perceives. Narration and this viewpoint should reinforce each other (its confusion about walls hits harder when the Observer is looking through them with it).
- **Third person.** A camera that trails or orbits behind and slightly above the Sim, following it through the Substrate — the most "watching a creature move through a space" view, good default for casual visitors.
- **God view.** A pulled-back, top-down or isometric overview of the entire Substrate — the Observer-as-deity view, useful for seeing the whole maze, the Q-value heatmap overlay, and the Sim's position within it at a glance.
- **FOV control.** A slider or drag control to widen/narrow the field of view within first- and third-person modes — wide FOV feels dreamlike/distorted (fitting the mystical tone), narrow FOV feels claustrophobic and focused.

**Implication for the tech stack:** true first-person/FOV camera control is a 3D-scene requirement, not something a flat 2D grid can fake convincingly. This means the rendering layer needs an actual 3D scene graph (see updated Tech stack section) even though the underlying maze logic and Q-learning state can stay a simple 2D grid — the 3D scene is a visualization layer *on top of* the 2D logic, not a replacement for it. Keep those two representations cleanly separated: the RL engine reasons in grid coordinates; only the renderer needs to know about 3D camera math.

## Simulation-theory framing (heavy — decided)

The theming is not a skin, it's the premise. Every label, interaction, and narrator line should reinforce: *you are outside this Sim's universe, pulling levers it cannot perceive as levers.*

**Vocabulary.** Rename the whole UI around the metaphor and use it consistently everywhere — in code comments, variable names, copy, and narration prompts:
- The agent → **"the Sim"** (never "the agent" or "the bot" in visible copy).
- The visitor → **"the Observer"** (decided — the more voyeuristic, less interventionist-sounding term. Worth noting the irony deliberately: an "Observer" who can reward, punish, and relocate the Sim isn't purely passive, and that quiet contradiction — watching something while also shaping it, the way an observer can affect a system just by observing it — fits the simulation-theory framing rather than undermining it).
- The maze/environment → **"the Substrate"** or **"the Construct."**
- Reward/punish input → **"Providence"** (final — decided; "Divine Input" was an earlier alternative, no longer in use) — framed as an unexplainable force from the Sim's point of view, not a scored feedback signal from ours. Implemented as discrete reward/punish buttons (see "Providence input granularity" below), not a continuous slider.
- Drop-anywhere → **"Intervene"** — every time the Observer places the Sim somewhere new, it's a violation of the Sim's own physics, and the narrator should treat it that way ("I was *there*. Now I am *here*. There was no path between them.").
- **Substrate vs. Construct (clarified — these are not synonyms).** "The Substrate" is the general concept: the space-that-exists which the Sim occupies, at any point in its life. "A Construct" is a specific instance of that space — one maze, one chapter. The Sim moves through a *sequence* of Constructs over its one life, all within "the Substrate" as a general term. Use "Substrate" when talking about the concept broadly; use "Construct" (or "the current Construct") when referring to the specific maze the Sim is in right now. This matters for code naming too — e.g. a `Construct` type/table represents one maze instance, not the whole system.

**Narrator voice.** This is the single highest-leverage piece for selling the theme, since it's the only channel where the Sim "speaks." Guidelines for the LLM prompt:
- First person, present tense, mildly bewildered — it is *building a theology* in real time out of noise (wall bumps, rewards, teleportation), not narrating gameplay.
- It should form and revise hypotheses about "the nature of things" — e.g. early on: *"When I go left here, something stops me. A law, maybe."* Later, after being teleported: *"The laws didn't change. I did. That shouldn't be possible."*
- Occasionally it should get close to breaking the fourth wall without fully doing so — wondering aloud if there's something behind the walls, whether reward has intention behind it, whether it's "just" following rules or being watched. Never have it explicitly say "I am an AI in a simulation" — the dramatic irony (we know, it's groping toward it) is the whole appeal.
- Log every narrator line to a visible, scrolling "transcript of consciousness" panel so visitors can watch its worldview evolve over a session, not just see one line at a time.

**Visual/tonal direction — mystical, dark, cosmic.** Updated per direct input: the visual language is a dark, mystical space/void aesthetic — the Substrate floats in darkness, drifting clouds or nebula-like volumetric fog, a distant starfield, soft god-ray lighting cutting through cloud layers, particle drift. Think less "server room" and more "a shrine suspended in the void that happens to also be a laboratory." This is a deliberate tonal contrast with the clinical, academic vocabulary and narration voice (Operant, Observer, Substrate, Providence) — cold, precise *language* describing a warm, numinous, almost sacred-feeling *space*. That contrast is a feature, not a conflict: the copy stays clinical so the mysticism reads as something the visitor projects onto the Sim's world, not something the interface is telling them to feel.

Concretely: a monospace/terminal font is still right for the narrator transcript (keeps the clinical voice grounded), but the 3D environment itself should feel closer to a planetarium installation — dark background, luminous fog, minimal but glowing UI chrome for camera/FOV/Providence controls, so the controls feel like instruments in an observatory rather than app buttons. A persistent, deadpan meta layer — e.g. a small readout of "cycles elapsed," "current Observer count" — still belongs, styled like an instrument readout rather than a dashboard widget.

**Copy examples for the landing page:**
- Site name: **Operant** — a quiet nod to operant conditioning, the actual mechanism running under the hood (behavior shaped by consequence), stated with clinical understatement rather than spelled out.
- Tagline: *"It doesn't know you're watching. It's starting to wonder."*
- Subhead: *"Drop a mind into a box. Reward it. Move it. Watch it build a religion out of your whims."*

**Guardrail (updated — see Artistic reference above).** Tone has shifted from "playful-uncanny, not bleak" toward something closer to *Can't Help Myself*'s register: quiet, dignified endurance of an endless task, capable of evoking real sympathy, with dark humor rather than despair. The hard line is unchanged — it should never read as a suffering creature being tormented for entertainment. Narration can carry weariness and repetition, but should stay curious and pattern-seeking underneath it, never purely miserable. See the open question below on capping how punishing "punish" can look.

## Landing page

The entry point to the whole piece, and the visitor's first impression of both the art and the craft.

- **Full-bleed hero.** Same dark/cosmic visual language as the main experience (clouds, starfield, soft lighting) so there's no jarring transition between "marketing page" and "the exhibit" — the landing page *is* the exhibit's threshold, not a separate skin.
- **Welcome + explanation (decided — final copy).**

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

  This copy should be implemented verbatim as the landing page's primary text, styled per the Visual/tonal direction section (dark, mystical, cosmic backdrop; clinical, restrained typography for the copy itself).
- **Enter / Leave (decided).** Two clear calls to action: **Enter** transitions the visitor into the live Substrate view (their choice of camera mode to start, or a default like third-person). **Leave** simply triggers the browser's back navigation — no custom goodbye screen or exit flow needed. Keep the implementation simple (`history.back()` or equivalent); don't over-engineer this button.
- **First impression = portfolio impression.** Since this page is what most visitors and reviewers see first, it should also be the strongest demonstration of engineering polish: fast load, smooth entrance animation, no layout shift, works on mobile.

## Tech stack

- **Frontend framework:** React with TypeScript. TypeScript is a hard requirement, not a nice-to-have — this is a portfolio piece, and type safety is one of the more visible/legible signals of engineering quality in the codebase.
- **3D rendering:** Three.js, most likely via **react-three-fiber** (+ `@react-three/drei` for camera controls, post-processing, and helpers) to keep the 3D scene declarative and testable rather than hand-rolled imperative Three.js scattered through the app. This is what makes the first-person/third-person/god-view camera modes and FOV control possible — see Camera / viewpoint modes above.
- **RL engine:** Hand-rolled Q-learning in TypeScript, kept as a pure, framework-agnostic module with no dependency on React or Three.js — this is what makes it unit-testable in isolation (see Engineering standards) and keeps the "2D logic, 3D visualization layer on top" separation clean. Critically, this module now runs **on the server**, on its own continuous tick, not in the visitor's browser — see "it runs whether or not anyone is watching" in Artistic reference above.
- **Simulation host process:** A small, always-on backend process (a long-running Node service, not a request/response serverless function, since serverless functions can't tick continuously on their own) that owns the single Sim's state, steps it forward on a fixed interval, applies queued Providence/Intervene inputs from observers, and persists after every step. Clients connect via WebSocket to receive live state rather than polling — on connect, a client receives the current state snapshot plus a bounded backfill of recent narrator transcript lines (not the Sim's entire lifetime history), so a visitor arriving mid-session gets context without the payload growing unbounded over the Sim's life.
- **Narrator (decided): OpenAI GPT-4.1 nano, run in-process.** A logically separate, mockable module inside the same always-on host process (see Agent architecture above for why — a true serverless function can't hold the live subscription this would otherwise need), called directly on notable events, rate-limited/batched so it's not called every tick. Stub with canned lines first, upgrade to live calls once the mechanic and pacing are validated. GPT-4.1 nano is the cheapest option on the market ($0.10/M input, $0.40/M output) — call volume here is low enough (event-triggered, not per-tick) that cost is negligible regardless of model, but nano was the explicit pick. If narration output ever reads as flat or generic under real testing, GPT-5.4 mini is the natural upgrade path without changing the architecture — the narrator module is isolated and swappable by design (see Engineering standards) even though it shares a process with the mover.
- **Rate limiting (decided):** Providence and Intervene inputs are throttled per-connection (e.g. one action per second per WebSocket connection) to prevent a single visitor from spamming the Sim's permanent record. Simple to implement, and sufficient at this scale — no per-IP tracking needed for now.
- **Uptime monitoring (decided):** a free external uptime checker (e.g. UptimeRobot or equivalent) pings the simulation host and alerts if it goes down, in addition to Railway's own restart policy. This matters more here than in a typical project — the whole premise is "it runs whether or not anyone's watching," so a silent, unnoticed crash would quietly betray the concept.
- **Secrets management (decided):** standard `.env` (gitignored) for local development, a committed `.env.example` documenting required variables without real values, and production secrets (OpenAI key, DB credentials) set directly in Railway's environment variable settings — never hardcoded, never committed. This matters more than usual since the repo is likely public as a portfolio piece.
- **Hosting (decided — see cost comparison below):** Static frontend (Vercel/Netlify free tier) for the landing page and 3D client; **Railway** for the always-on simulation host, as the best cheapest-but-solid option for a solo-developer, low-traffic workload — see rationale below.
- **Persistence (required, not optional):** Because the Sim's memory must never be wiped, its Q-values can't just live in browser memory or localStorage — a visitor clearing their cache would effectively "reset" it, which breaks the whole premise. The Sim's learned state needs to live in a small backend store (e.g. a hosted key-value store or Postgres row keyed to the Sim's id) that persists across sessions, browsers, and visitors. Every reward, every step, every drop-in gets written back. This also settles the shared-vs-private question below: it pushes naturally toward one canonical, persistent Sim rather than a private per-visitor instance, since a "private" Sim that no one else can affect is a much weaker version of the "one continuous life, shaped by everyone" idea. **Crash/restart recovery is part of this requirement, not a separate concern:** on every boot (deploy, crash, restart), the simulation host must rehydrate its full state from persistence before ticking — never reinitialize Q-values from scratch. This follows directly from the no-reset constraint but is worth testing explicitly (e.g. an integration test that kills and restarts the host process and asserts state survived).

### History & log retention (decided)

The no-erase principle means Q-values, the narrator transcript, and the event log are never deleted — over months or years that's real, unbounded storage growth if left unmanaged. Resolution: keep full-fidelity detail for a recent rolling window (e.g. the last few weeks), and compact older entries into summary aggregates (counts, totals, representative sample lines) rather than deleting them. Nothing is erased — the aggregate is still derived from and represents the real history — but storage stays bounded rather than growing linearly forever. This compaction job is itself something to build and test (e.g. a periodic job that rolls old raw entries into a summary once they age past the recent window), not just a policy on paper.

### First Construct (decided)

The first maze to build against: a simple **10x10 grid with a single goal**, walls and goal placement hand-designed for this first pass (exact layout is an implementation detail, not something that needs to be nailed down in this doc — any reasonable hand-drawn maze with a mix of dead ends and at least one solvable path works). Small enough to let Q-learning converge and be visibly demonstrable quickly, large enough to still read as a real space in the 3D scene rather than feeling sparse.

### Hosting cost comparison (for the simulation host)

Since the simulation host has to run continuously — unlike the rest of the stack, which is static or serverless and effectively free at this scale — this is the one piece of infrastructure that costs real money every month, so it's worth being deliberate about. Comparing the realistic options for a tiny, low-traffic, single-process Node service with a WebSocket connection:

- **Railway — recommended.** Usage-based billing on the Hobby tier (~$5/month base credit) typically runs a small always-on Node service around $2–5/month at this scale, only climbing if traffic actually grows. Best balance of low cost, easy deploys (git push), and no server maintenance — worth the small premium over a raw VPS for a portfolio project where your time is better spent on the actual RL/3D work than on server administration.
- **Render.** Predictable flat pricing (~$7/month for an always-on web service that doesn't sleep) — simpler billing than Railway's usage-based model, but a bit more expensive for a workload this small.
- **Fly.io.** Can be very cheap on paper (a single shared-cpu-1x VM is roughly $2/month), but real-world small apps tend to land around $8–25/month once storage volumes, egress, and machine restarts are factored in — and Fly no longer has a meaningful free tier. Better suited if multi-region latency becomes a concern later, not needed here.
- **Raw VPS (e.g. Hetzner CX22, ~€4.50/month ≈ $5/month).** The cheapest raw compute by a meaningful margin, and Hetzner's pricing is genuinely all-inclusive (traffic, IPv4/IPv6, DDoS protection, firewall). The tradeoff is you're managing the OS, process supervision (e.g. systemd or pm2), deploys, and security patching yourself — more setup and ongoing maintenance than a PaaS, which matters less for a hobbyist tinkering but more for a "spot-on engineering practices" portfolio piece where that time is better spent on tests/CI/architecture.

**Recommendation:** start on Railway. It's cheap enough at this project's scale (single Sim, modest traffic) that the cost difference vs. a raw VPS is a few dollars a month, and the deploy simplicity and lack of server-ops overhead is worth more than that difference, especially while the rest of the stack (RL core, 3D client, narrator) is still the main event. Revisit only if traffic or cost genuinely grows.

## Engineering standards (portfolio-grade)

Since this doubles as a portfolio piece, the codebase itself is part of the exhibit. Baseline expectations:

- **Architecture.** Clean separation between the RL engine (pure logic, no framework deps), the rendering layer (react-three-fiber components), the narrator module (isolated and mockable even though it runs in-process alongside the simulation host — see Tech stack), and the persistence layer (a thin data-access module, not scattered `fetch` calls). Each should be swappable/testable independently — this also reinforces the design principle that RL and narration are decoupled.
- **TypeScript everywhere**, strict mode on, no `any` used casually.
- **Automated tests.** Unit tests for the Q-learning core (deterministic, so this is the easiest and highest-value place to get real coverage), integration tests for the persistence layer and the WebSocket protocol (connect/reconnect snapshot + transcript backfill behavior, rate limiting), and at least a handful of end-to-end tests (e.g. Playwright) covering the landing page entry flow and camera-mode switching.
- **CI.** Lint, type-check, and test on every push (GitHub Actions is the natural default) — a portfolio project with a green CI badge and real tests says more than the visuals do.
- **Linting/formatting.** ESLint + Prettier, enforced in CI, not just locally.
- **Performance.** The 3D scene (clouds, particles, god-rays) needs a frame-rate budget — profile early, use instancing/LOD for particle effects, and make sure first-person mode doesn't tank on mid-range hardware.
- **Accessibility.** Even as an art piece, keep a baseline: keyboard-navigable controls, ARIA labels on interactive elements, and a "reduced motion" toggle for the particle/parallax effects for visitors sensitive to motion.
- **Documentation.** A real README (setup, architecture overview, how the RL/narrator/persistence pieces fit together), and consider an ADR (architecture decision record) for the bigger calls in this doc — e.g. why persistence is mandatory, why RL/LLM stay decoupled — so the reasoning is preserved alongside the code, not just in this design doc.

## Suggested build order

1. Project scaffold: React + TypeScript + react-three-fiber for the client, a small Node service for the simulation host, ESLint/Prettier/CI wired up from day one, `.env`/`.env.example` conventions established from the start — not bolted on later.
2. Q-learning core as a pure, framework-agnostic TypeScript module, with unit tests, built against the first Construct (10x10 grid, single goal) as a continuing task (γ=0.95, α=0.1, ε starting at 0.3 decaying to a 0.05 floor; rewards: -1/step, -5/wall bump, +50/goal). Prove it learns via console/debug output before touching any rendering or networking.
3. Persistence layer (backend store keyed to the single Sim's id), including crash/restart rehydration (test by killing and restarting the process) — build this now; see the no-erase/single-Sim constraints.
4. Simulation host: wrap the Q-learning core in an always-on process that ticks continuously (~1.5s/step), applies queued inputs with per-connection rate limiting, and persists after every step. Expose live state over WebSocket, including the connect/reconnect snapshot + bounded transcript backfill behavior. This is the piece that makes "it runs whether or not anyone is watching" literally true.
5. Basic 3D client: connect to the live state stream, render the Substrate and Sim in react-three-fiber, wire up third-person camera as the default view.
6. Add first-person and god-view camera modes plus FOV control.
7. Add reward/punish (Providence, discrete buttons) controls feeding into the same reward signal the maze gives automatically; add drop-anywhere (Intervene) and the no-completion-state goal behavior (see Artistic reference).
8. Add Q-value heatmap overlay in the god view.
9. Add the narrator module in-process (see Agent architecture) with canned/scripted lines in the Observer/Sim/Substrate voice, tied to events, to validate UX rhythm before paying for live calls.
10. Swap canned lines for real OpenAI GPT-4.1 nano calls using the theology-building narrator prompt above, with graceful degradation on API failure.
11. Apply full mystical/cosmic visual theming (clouds, god-rays, particles, instrument-style UI chrome), including the "visible wear" animation layer.
12. Build the landing page (welcome copy, Enter/Leave flow) — copy is final, see Landing page section.
13. Add maze editor + the next Construct in the sequence.
14. Set up external uptime monitoring/alerting for the simulation host.
15. Add a log-compaction job for history/transcript retention (recent window full-fidelity, older entries aggregated).
16. Fill out end-to-end test coverage (landing → enter → camera switching → Providence, reconnect behavior, rate limiting) and accessibility pass.

## Open questions to settle before/while building

- **Resolved:** one global, persistent Sim shared by all visitors, not private per-visitor instances — required by the no-erase principle above, and thematically it's the stronger version of the idea (one continuous life, everyone leaves a mark on the same record, no one can start over).
- **Resolved:** punishment's effect decays over time rather than being hard-capped. Concretely: punishment still writes to the Sim's history permanently (the record of it never disappears — see no-erase principle), but its influence on current behavior should fade the further it recedes into the past, similar to a recency-weighted or exponentially-decaying term in the reward signal, so a visitor's cruelty from months ago doesn't permanently dominate the Sim's present behavior, while newer visitors still see the scars in its transcript/history if they look. Exact decay function (linear vs. exponential, half-life) is still to be tuned once the RL core exists and we can observe it in practice.
- **Resolved:** the Sim moves through a *sequence* of Constructs over its one life — like real life, chapters that come one after another, permanent once passed, never parallel universes. This is the final call; build order step 13 (maze editor + additional environments) should implement this as "the next Construct," not a selector.
- **Resolved:** hosting is Railway for the simulation host (see Hosting cost comparison in Tech stack) — cheapest option that doesn't cost meaningful developer time in server maintenance, which matters more here than the few-dollar gap vs. a raw VPS.
- **Resolved:** "the Observer" is the final term for the visitor (see Vocabulary above).
- **Resolved:** "Leave" is just the browser back button — no custom exit flow.
- **Resolved:** persistence is standing up right after the Q-learning core (build order step 3), not deferred — see current build order above.
- **Resolved:** landing page welcome copy is final — see the Landing page section above.
- **Resolved:** tick rate is ~1 decision step every 1.5 seconds, decoupled from a 60fps client render rate and from narrator cadence — see "Tick rate & timing model" under Agent architecture above. Treat the 1.5s figure as a tunable config constant, expected to be adjusted once there's a real Sim to watch.
- **Resolved:** visible wear formula — see "Visible wear formula (decided — starting parameters)" under Artistic reference above. Starting constants are informed guesses, expected to be retuned once there's real Sim history to observe via a private debug readout.
- **Resolved (comprehensive pre-build audit, see below for the full list):** narrator wiring is in-process with the simulation host; Providence is discrete buttons, not a slider; the RL core is a continuing task with no terminal states (γ=0.95, α=0.1, ε 0.3→0.05); the first Construct is a 10x10 grid with a single goal; history/transcript retention keeps a recent full-fidelity window and compacts older entries rather than deleting or keeping everything raw forever; Providence/Intervene are rate-limited per-connection; the simulation host has external uptime monitoring in addition to Railway's restart policy; secrets use `.env`/`.env.example` locally and Railway env vars in production; and reconnecting clients receive a current state snapshot plus a bounded recent-transcript backfill, not the full lifetime history. Crash/restart recovery (rehydrate from persistence, never reinitialize) is now an explicit, testable requirement rather than an implicit consequence of the no-reset constraint.

No open questions remain as of this audit. Any new ambiguity discovered during implementation should be added here and resolved explicitly before being treated as decided.
