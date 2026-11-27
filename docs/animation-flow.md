# Flow Builder Reference

Word-triggered steps for:
- animated code (`code: { animation, base, flow }`)
- step-driven components (`component: { name, base, flow }`)

Each step fires when a transcript word is spoken.

## Entry Point

```ts
on(
  word: string,
  opts?: { after?: string; nth?: number; offset?: number },
): StepBuilder
```

## Step Builder Methods

### Word Matching

Word refs are normalized (case-insensitive, common punctuation stripped). Refs can also be prefixes of transcript words (for refs with 3+ characters), e.g. `on("Promise")` can match a transcript word like `Promise<Order>`.

| Method | Description |
|--------|-------------|
| `.as(name)` | Custom step name (default: `word`) |
| `.after(word)` | Only trigger after `word` appears |
| `.nth(n)` | Trigger on the Nth match (1-based) |
| `.offset(seconds)` | Trigger `seconds` after the word timing |

### State Changes

| Method | Description |
|--------|-------------|
| `.slots({ slotName: "value" })` | Change slot values (animated code). Persists forward. |
| `.state({ key: value })` | Update component state (component flows). Persists forward. |

### Focus (Line-Level)

| Method | Description |
|--------|-------------|
| `.focus(...ids)` | Focus specific line IDs. Others dim. |
| `.focus.range(from, to)` | Focus lines between two IDs (inclusive) |
| `.focus.except(...ids)` | Focus all lines except these |
| `.focus.all()` | Clear focus (all lines visible) |
| `.focus.clear()` | Clear persisted line and token focus |
| `.focus(...ids, { persist: true })` | Focus lines with persistence across steps |
| `.focus.range(from, to, { persist: true })` | Range focus with persistence |

### Focus (Token-Level)

| Method | Description |
|--------|-------------|
| `.focus({ text, line?, dim?, glow?, persist? })` | Spotlight every match of `text` (only on `line` when given); everything else dims to `dim` (default 0.4). Several token focuses in one step share the first one's `dim` and `glow`. |

### Visual Effects

Pattern matching defaults to **smart boundary** matching:
- Word-like patterns (e.g. `"Promise"`) match on word boundaries.
- Punctuation patterns (e.g. `": any"`, `".pipe"`) work without extra options.

Use `{ substring: true }` only when you explicitly want to match *inside* identifiers.

| Method | Description |
|--------|-------------|
| `.cursor(text, opts?)` | Show cursor. Opts: `{ nth?, type?, after?, substring?, persist? }` |
| `.cursor.clear()` | Clear persisted cursor |
| `.bright(text, opts?)` | Text glow. Opts: `{ nth?, color?, after?, substring?, persist? }` |
| `.bright.clear()` | Clear persisted bright |
| `.glow(text, opts?)` | Background glow (transient). Opts: `{ color?, nth?, after?, substring? }` |
| `.squiggle(text, opts?)` | Wavy underline. Opts: `{ color?, nth?, after?, substring?, persist? }` |
| `.squiggle.clear()` | Clear persisted squiggles |
| `.mark(text, opts?)` | Highlighter box. Opts: `{ color?, nth?, after?, substring?, persist? }` |
| `.mark.clear()` | Clear persisted marks |
| `.burst(text, emoji, opts?)` | Emoji particles. Opts: `{ count?, nth?, after?, substring?, persist? }` |
| `.burst.clear()` | Clear persisted burst |
| `.status(text, status, opts?)` | Status indicator. Opts: `{ nth?, after?, substring?, persist? }` |
| `.status.clear()` | Clear persisted status |
| `.say(text)` | Speech bubble on the cursor |

### Grouping Multiple Effects

Apply multiple annotations to the same target without repeating the pattern:

```ts
on("TooHigh").at("TooHigh", (t) => t.bright().cursor().glow({ color: "blue" }))
on("second").at("Err", (t) => t.mark().status("error"), { nth: 2 })
```

The builder has `cursor`, `bright`, `glow`, `squiggle`, `mark`, `burst` and `status`, each the step method of the same name on the shared target. The third argument sets `{ nth?, after?, substring? }` for all of them.

### Audio

| Method | Description |
|--------|-------------|
| `.sound(name)` | Play a sound effect (`AnimationSoundName`) |

Current sound names:
`tick`, `pop`, `whoosh`, `sad`, `celebrate`, `chime`, `success`, `error`, `alarm`, `doom`, `spooky`, `press`, `fail`, `succeed`, `ping1`, `ping2`, `ping3`, `derp`, `skip`.

## Key Behaviors

### Timing: Containers Before Content

Show structural changes a step **before** their content:

```ts
on("use").slots({ pipeShow: "shown" })          // .pipe( and ) animate in
on("catchAll").slots({ catchAllShow: "shown" }) // catchAll appears inside
on("function").slots({ arrow: "shown" })        // () => ??? appears
```

### Slot / State Persistence

Both `.slots()` and `.state()` changes persist forward:

```ts
flow: [
  on("first").slots({ body: "shown" }),
  on("second"), // body still "shown"
]
```

### Persisting Annotations

Many annotations support `persist: true` to carry forward until cleared or overridden:

```ts
flow: [
  on("first").cursor("foo", { persist: true }),
  on("second"),            // cursor still at "foo"
  on("third").cursor.clear(),
]
```

### Implicit Start Step

An initial `start` step/snapshot is automatically added at step 0.

### Build Validation

The course build resolves every annotation against the code its step shows, the same way the player does, and fails on any target that matches nothing (a persisting annotation is reported at the first step it misses), any line ID a line focus names that doesn't exist, and any trigger word missing from the transcript.

## Imports (Content Authoring)

```ts
import { on } from "@/lib/content"
```
