# Effect Institute

Strange, semi-interactive, voice-narrated lessons for learning [Effect](https://effect.website). Live at [www.effect.institute](https://www.effect.institute).

Free and open source: no accounts, no database, no API keys. Built with **Effect v4**, **`@effect/atom-react`**, **TanStack Start**, **Cloudflare Workers**, **PixiJS**, **Shiki**, and **Tone.js**.

## Quickstart

```bash
bun install
bun dev            # http://localhost:3210
```

On startup, Vite compiles the TypeScript lesson DSL under `content/` into `.authoring/content/` and watches `content/**/*.ts` for live HMR updates. Lesson progress and custom hotkeys are saved locally in `localStorage`.

## Architecture

```text
content/                       # Lesson DSL (intro, basics, changelog)
assets/audio/                  # Source narration audio (.webm)
public/content/                # Built course artifacts (manifests, hashed JSON/audio, word timings)
src/
  atoms/                       # Effect-backed reactive state (@effect/atom-react)
  backend/services/            # Effect v4 content compiler (CourseService, AppConfig)
  components/
    chapters/                  # Chapter shell, layouts, cursor, code panel, progress UI
    narrated/                  # Step-driven interactive lesson demos & PixiJS effect row engine
  lib/
    animated-code/             # Algebraic code-animation ADT, flow compiler & stability analyzer
    content/                   # Course/chapter/section DSL & compiler
    hierarchy/                 # Effect fiber tree state derivation & layout
    neo-code-block/            # Smoothly morphing Shiki-highlighted code renderer
    tooling/                   # `bun narrate` CLI (build, steps, words, read, stats)
  routes/                      # TanStack Start file-based routes
  sounds/                      # Tone.js procedural UI & lesson synth system
  worker.ts                    # Cloudflare Worker entry point (range-capable /content/* serving)
```

### Highlights

- **Effect v4 & `@effect/atom-react`:** Typed `Context.Service` layers (`AudioPlayer`, `ProgressService`, `WakeLockService`, `CourseService`), unified shared `MemoMap` runtime, and `KeyValueStore` persistence.
- **Algebraic Code Animation DSL (`src/lib/animated-code`):** Composable `stack`, `line`, `slot`, and `on("word")` primitives that preserve token identity across frames so code smoothly morphs in sync with spoken narration.
- **Custom PixiJS Fiber Visualizer (`src/components/narrated/pixi-effect-row`):** Real-time visual execution of Effect combinators, failures, and structured concurrency.

## Content Authoring

Every lesson is authored as TypeScript under `content/` and compiled to JSON:

```ts
import { chapter, line, on, section, slot, stack } from "@/lib/content"

export const mySection = section("my-section", {
	transcript: `
		TypeScript types disappear at runtime.
		So when data arrives from an API, you have no type guarantees.
	`,
	code: {
		animation: stack(
			line("fetch", 'const data = await fetch("/api/user")'),
			line("user", ["const user", slot.optional("type", ": any"), " = await data.json()"]),
		),
		base: { type: "hidden" },
		flow: [on("runtime").slots({ type: "shown" }).cursor("any")],
	},
})

export default chapter("intro", "Intro", [mySection])
```

See `docs/animation-dsl.md`, `docs/animation-flow.md`, and `docs/animation-patterns.md` for the full DSL reference.

## CLI & Scripts

```bash
bun dev                                     # Dev server (http://localhost:3210)
bun run typecheck                           # TypeScript check
bun run lint                                # Biome check
bun run test                                # Vitest + @effect/vitest suite
bun run build                               # Build published content + Worker bundle

bun narrate build                           # Build all chapters to .authoring/content
bun narrate build --published               # Build published chapters to public/content
bun narrate steps -c intro catch-tag        # Preview animation frames & slot stability
bun narrate words -c intro catch-tag        # List transcript words with indices
bun narrate stats -c basics                 # Word counts and durations
```

## License

[MIT](./LICENSE)
