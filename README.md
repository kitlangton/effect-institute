# Effect Institute

Voice-narrated, semi-interactive lessons for learning [Effect](https://effect.website). Code on the right changes in step with the narration on the left, word by word. Live at [www.effect.institute](https://www.effect.institute).

No accounts, no database, and no API keys are needed to run, study, test or build it. The site deploys as a Cloudflare Worker that serves static files. An ElevenLabs key is optional and only used by the local authoring tools, if you want automatic word timings or generated narration for your own lessons.

Built with Effect v4, `@effect/atom-react`, TanStack Start, Cloudflare Workers, PixiJS, Shiki and Tone.js.

## 1. Quickstart

Requires [Bun](https://bun.sh).

```bash
bun install
bun dev            # http://localhost:3210
```

On startup, Vite compiles the lesson DSL in `content/` into `.authoring/content/` and watches `content/**/*.ts`. Saving a lesson file rebuilds its chapter and updates the open page without a full reload. Progress and custom hotkeys are stored in the browser's `localStorage`.

The checks CI runs, none of which need a key:

```bash
bun run typecheck
bun run lint
bun run test
bun run build
```

To record or process narration you also need [ffmpeg](https://ffmpeg.org) on your `PATH` (macOS: `brew install ffmpeg`, Debian/Ubuntu: `apt install ffmpeg`).

## 2. Repository map

```text
content/                    Lesson DSL: one folder per chapter, index.ts lists its sections
  intro/, basics/
  changelog.ts              The /changelog page
assets/audio/<chapter>/     Narration audio, one <section>.webm per section
public/content/             Published build output, served by the Worker
  <chapter>/<section>.timings.json   Word timings for each section's audio
recordings/                 Raw takes from the recording bar (gitignored)
backups/                    Audio replaced by a new take (gitignored)
docs/animation-*.md         DSL reference: primitives, flow steps, patterns
src/
  authoring/                Dev-only authoring tools (never in the production build)
    core/                   Timing alignment and estimation (pure, unit tested)
    server/                 ElevenLabs client, ffmpeg pipeline, narration service, dev endpoints
    client/                 Recording bar and context menu actions, lazy-loaded in dev
  backend/services/         Course compiler (CourseService) used by the CLI and dev server
  components/chapters/      Chapter page: layouts, cursor, code panel, progress
  components/narrated/      Step-driven interactive demos and their registry
  lib/animated-code/        Code animation ADT, flow compiler, stability checks
  lib/content/              section/group/chapter DSL and compiler
  lib/neo-code-block/       Morphing, Shiki-highlighted code renderer
  lib/tooling/              The bun narrate CLI
  routes/                   TanStack Start routes
  worker.ts                 Cloudflare Worker entry (serves /content/* with byte ranges)
scripts/deploy/             Guarded Cloudflare deploy
scripts/check-dist/         Fails the build if authoring code reaches dist/
```

Which files you edit and which the tools write:

| Kind | Paths | Committed | Written by |
| --- | --- | --- | --- |
| Hand-written | `content/**/*.ts`, `src/**`, `docs/**` | yes | you |
| Narration audio | `assets/audio/<chapter>/<section>.webm` | yes | recording bar, `narrate record`, `narrate generate`, or you |
| Word timings | `public/content/<chapter>/<section>.timings.json` | yes | `narrate record`, `align`, `generate` |
| Published build | `public/content/**` (manifests, hashed `.json` and `.webm`) | yes | `bun narrate build --published` (part of `bun run build`) |
| Dev build | `.authoring/content/**` | no | `bun dev`, `bun narrate build` |
| Local scratch | `recordings/`, `backups/`, `.env` | no | the authoring tools, you |

## 3. Create your own lesson

### Step 1: Scaffold a section

```bash
bun narrate new my-chapter/my-section
```

This writes `content/my-chapter/my-section.ts` with a working example and, because the chapter is new, `content/my-chapter/index.ts` marked `draft: true`, then builds the chapter. Draft chapters show up in `bun dev` but are left out of the published site. Use `--title "..."` for the chapter title and `--group <id>` for the group the section goes in. If the chapter already exists, `new` writes only the section file and prints the import to add to that chapter's `index.ts`.

### Step 2: Write the code animation and the flow

A section is a transcript plus the code it narrates. The scaffold looks like this:

```ts
import { line, on, section, slot, stack } from "@/lib/content"

export const mySection = section("my-section", {
	transcript: `
		Every section starts with a transcript, written in Markdown.
		When the narration reaches the word **greet**, the code on the right changes.
		Steps fire on spoken words, so edit the transcript and the flow together.
	`,

	code: {
		animation: stack(
			line("import", 'import { Effect } from "effect"'),
			line("blank", ""),
			line("program", [
				"const program = Effect.succeed(",
				slot("message", { short: '"hi"', long: '"hello, world"' }),
				")",
			]),
			slot.optional("run", line("run", "Effect.runSync(program)")),
		),
		flow: [
			on("greet").slots({ message: "long" }).focus("program"),
			on("flow").slots({ run: "shown" }).at("runSync", (t) => t.cursor()),
		],
	},
})
```

- `stack(...)` stacks lines vertically. `line(id, content)` is one line with a stable ID; the renderer tracks lines by ID, so keep IDs stable across edits.
- `slot(name, { value: content, ... })` is a choice point inside a line. The first value is the default. `slot.optional(name, content)` starts hidden and appears when set to `"shown"`.
- `on("word")` starts a step when the narration reaches that word. `.slots({...})` changes slot values (they persist to later steps), `.focus(...lineIds)` dims the other lines, and `.at(pattern, (t) => t.cursor())` annotates matching code.
- Keep text that every slot value shares outside the slot, as `"const program = Effect.succeed("` is above. The renderer then morphs only the part that changes.

Sections can also drive an interactive component instead of, or next to, code: `component: { name, base, flow }`, where `flow` uses `on("word").state({...})`. Components live in `src/components/narrated/` and must be added to `componentRegistry.ts` and to the list in `src/lib/content/narrated-components.ts`. See `content/basics/index.ts` for examples.

The full reference is in [`docs/animation-dsl.md`](docs/animation-dsl.md), [`docs/animation-flow.md`](docs/animation-flow.md) and [`docs/animation-patterns.md`](docs/animation-patterns.md).

### Step 3: Verify from the CLI

```bash
bun narrate words -c my-chapter my-section    # transcript words with indices and #nth counts
bun narrate steps -c my-chapter my-section    # every step's code, what changed, and annotation targets
bun narrate build my-chapter                  # compile the chapter; fails on unknown words, slots or lines
```

`steps` prints each frame of the animation in trigger order, with `Δ` marking slot changes and a stability warning when a slot's values share text that should move outside the slot. If a word appears more than once, `words` shows which occurrence (`#2`, `#3`) a step should target; see `docs/animation-flow.md` for `nth` and `after`.

### Step 4: Add narration

Every published section needs an audio file and word timings. Pick one of three ways. All of them write `assets/audio/<chapter>/<section>.webm` and `public/content/<chapter>/<section>.timings.json`, then rebuild the chapter. If the rebuild fails, the previous audio and timings are restored.

**A. Record your own voice in the browser.** Needs ffmpeg. An ElevenLabs key is optional.

```bash
bun narrate record -c my-chapter my-section   # prints the URL and shortcuts below
bun dev
```

Open `http://localhost:3210/chapters/my-chapter?section=my-section`. The bottom bar of the code panel shows the recorder (development only).

| Key | Action |
| --- | --- |
| Ctrl+R | Start recording, or restart the take |
| Enter | Stop, process and save |
| Esc | Discard the take |
| Ctrl+D | Debug mode: list earlier takes for the section and reuse one |

The raw take is kept in `recordings/<chapter>/<section>/`. It is processed with ffmpeg and, if `ELEVENLABS_API_KEY` is set, aligned to the transcript. Without a key the timings are estimated from the take's length so you can hear it and watch the steps fire right away; the bar says so, and you can align later with `bun narrate align`. The browser asks for the microphone only when you press Ctrl+R.

**B. Generate narration with your own ElevenLabs key.**

```bash
cp .env.example .env    # then set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID
bun narrate generate -c my-chapter my-section
```

Or right-click the section in `bun dev` and choose "Generate audio (ElevenLabs)". Generation uses ElevenLabs text-to-speech with timestamps, so the timings come back with the audio. It replaces existing audio (the old file is copied to `backups/`) and costs ElevenLabs credits. `--voice <id>` and `--model <id>` override the settings; the default model is `eleven_v4`. `--all` generates every section in the chapter that has no audio yet.

**C. Bring your own audio.**

```bash
bun narrate record -c my-chapter my-section --file path/to/take.wav
```

This runs any file ffmpeg can read through the same processing as a browser take, and aligns it if a key is set. If you already have a finished Opus `.webm`, put it at `assets/audio/<chapter>/<section>.webm` and align it as is:

```bash
bun narrate align -c my-chapter my-section
```

`align` needs `ELEVENLABS_API_KEY`. Run it again whenever you edit a transcript without re-recording: changed words make the old timings stale, and until they are fixed the section's highlighting and steps no longer follow the audio.

**Audio processing.** Recorded and imported takes are converted to mono 48 kHz, high-passed at 80 Hz, trimmed of silence at both ends, gently compressed, normalized with two-pass EBU R128 `loudnorm` to -16 LUFS and -1 dBTP, lightly de-essed, and encoded as Opus at 64 kbps in WebM with cues at the front so byte-range seeking works, the same format and loudness as the committed lesson audio. Generated speech only gets the loudness normalization and encoding. To use your own clean-up chain, set `AUTHORING_AUDIO_CHAIN_CMD` in `.env` to a shell command that reads `$AUTHORING_AUDIO_IN` and writes `$AUTHORING_AUDIO_OUT` (both WAV); it runs on every take before compression and loudness normalization.

**Check everything:**

```bash
bun narrate doctor
```

`doctor` reports whether ffmpeg and each setting are available (presence only, never values) and lists sections with no audio, no timings, estimated timings, or timings made for an older transcript. It exits with an error only for problems in published sections that would break `bun run build` or the live site.

### Step 5: Publish and deploy your fork

1. Remove `draft: true` from the chapter (or from a group) once every section in it has audio.
2. Build. `bun run build` runs `bun narrate build --published` (writes `public/content/` and fails if a published section has no audio), then `vite build`, then the check that no authoring code reached `dist/`.

   ```bash
   bun narrate doctor
   bun run build
   ```

3. Commit the lesson source, its `assets/audio/` files and the regenerated `public/content/`.

To deploy a fork to your own Cloudflare account, change the names and routes that point at effect.institute:

- `wrangler.jsonc`: the top-level `name` (a workers.dev preview) and `env.production.name` and `routes` (your domain and zone, or no routes to stay on workers.dev).
- `scripts/deploy/targets.ts`: `PRODUCTION_WORKER`, `PRODUCTION_CONFIRMATION` and the worker names and route patterns in `TARGETS`, so the deploy guard accepts your config.
- `.github/workflows/deploy.yml`: the `CONFIRM_PRODUCTION_DEPLOY` value, to match your `PRODUCTION_CONFIRMATION`.

Check the build and config without uploading anything:

```bash
bun scripts/deploy/cf-deploy.ts production --dry-run
```

To deploy from GitHub Actions, add two repository secrets: `CLOUDFLARE_API_TOKEN` (an API token with permission to edit Workers) and `CLOUDFLARE_ACCOUNT_ID`. The Deploy workflow then runs on every push to `main`. To deploy from your machine, log in with Wrangler and run the same script without `--dry-run`, with `CONFIRM_PRODUCTION_DEPLOY` set to your confirmation string. The site needs no runtime secrets: ElevenLabs settings are only read by the local tools and are never deployed.

## 4. Guide for coding agents

Read [`docs/animation-dsl.md`](docs/animation-dsl.md), [`docs/animation-flow.md`](docs/animation-flow.md) and [`docs/animation-patterns.md`](docs/animation-patterns.md) before editing `content/**`.

Hard invariants:

1. Lessons are `content/**/*.ts`. Never hand-edit `public/content/**`, `.authoring/**` or `*.timings.json`; they are generated by `bun narrate build` and the narration commands.
2. Give every line that changes a stable `line("id", ...)`, and keep text shared by all of a slot's values outside the slot, so code morphs instead of crossfading.
3. Every `on("word")` must match a word in the transcript and every annotation pattern must match the code. Run `bun narrate steps -c <chapter> <section>` and fix every warning; the build rejects unknown words, slots and line IDs.
4. Editing a transcript invalidates its timings. Say so when you change narrated text: the author must re-record, or run `bun narrate align -c <chapter> <section>` with their key. `bun narrate doctor` lists stale sections.
5. Keep new chapters and groups `draft: true` until every section has audio; the published build fails on a published section without audio.
6. Authoring code lives in `src/authoring/` and must never reach production. `src/worker.ts`, routes and app components may only reach it through a dev-only lazy import written as a ternary on `import.meta.env.DEV`, both where it is defined and where it is rendered:

   ```tsx
   const AuthoringBar = import.meta.env.DEV ? lazy(() => import("@/authoring/client").then((m) => ({ default: m.AuthoringBar }))) : null
   // ...
   {import.meta.env.DEV && AuthoringBar ? <Suspense fallback={null}><AuthoringBar ... /></Suspense> : null}
   ```

   An `if (import.meta.env.PROD) return` without an `else` is not removed by the bundler. `bun run build` fails if `dist/` contains `__authoring`, `api.elevenlabs.io` or `ELEVENLABS`.
7. Nothing may need a key at startup, in tests, or in the build. Settings are read only when an ElevenLabs call runs. Tests use a mocked HTTP client and never call ElevenLabs.

Fast verification loop after editing a lesson:

```bash
bun narrate steps -c <chapter> <section>
bun narrate build <chapter>
bun run typecheck
bun run test
bun run lint
```

Before finishing, also run `bun narrate doctor` and `bun run build`. `bun run fix` applies the formatter (tabs, no semicolons).

## 5. CLI reference

Commands that work on a section take the chapter as `-c <chapter>` (default `intro`) and the section as the argument. `bun narrate <command> --help` lists every flag.

| Command | What it does | Needs |
| --- | --- | --- |
| `bun narrate new <chapter>/<section> [--title ...] [--group <id>]` | Scaffold a section, and a draft chapter if the chapter is new | nothing |
| `bun narrate words -c <chapter> <section>` | Transcript words with indices, `#nth` counts and timings | nothing |
| `bun narrate steps -c <chapter> <section>` | Every animation step: code, slot changes, annotation targets, stability warnings | nothing |
| `bun narrate read <chapter> [--include-code]` | A chapter's transcripts and IDs (and starting code) for review | nothing |
| `bun narrate stats -c <chapter> [--all]` | Word counts and durations per section | nothing |
| `bun narrate build [chapter] [--published]` | Compile lessons to `.authoring/content/`, or with `--published` the non-draft course to `public/content/` | nothing |
| `bun narrate record -c <chapter> <section>` | Print how to record in the browser | nothing |
| `bun narrate record -c <chapter> <section> --file <audio>` | Process an audio file as the section's narration; align it if a key is set, otherwise estimate timings | ffmpeg (key optional) |
| `bun narrate align -c <chapter> <section>`, `--all` | Align existing audio to the current transcript | `ELEVENLABS_API_KEY` |
| `bun narrate generate -c <chapter> <section> [--voice <id>] [--model <id>]`, `--all` | Generate narration and timings; `--all` covers sections without audio | `ELEVENLABS_API_KEY`, a voice, ffmpeg |
| `bun narrate doctor` | Check ffmpeg, settings, and every section's audio and timings | nothing |

`record`, `align` and `generate` accept `--json`, which prints the result as one JSON line; the dev server uses it.

Other scripts:

| Command | What it does |
| --- | --- |
| `bun dev` | Dev server on port 3210 with live lesson rebuilds and the recording tools |
| `bun run build` | Published content, Worker bundle, and the dist check |
| `bun run test` / `typecheck` / `lint` / `fix` | Vitest, TypeScript, Biome check, Biome format and fix |
| `bun scripts/deploy/cf-deploy.ts production --dry-run` | Build and check the production deploy without uploading |

## License

[MIT](./LICENSE)
