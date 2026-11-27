# Animation Patterns & Best Practices

Common patterns derived from real sections.

## Core Principles

### 1. Cursor Follows Narration
When you say a word, cursor should be on that word:
```typescript
// "we'll create safeDie" → cursor on safeDie
on("create").slots({ name: "safeDie", body: "wrapped" }).cursor("safeDie")

// "wraps slowDie" → cursor on slowDie
on("wraps").cursor("slowDie")
```

### 2. Time Structural Changes
Show containers BEFORE their content. Give animations time to complete:
```typescript
// "we use catchAll" - pipe appears first, then catchAll line
on("use").slots({ pipeShow: "shown" }),  // .pipe( and ) appear
on("catchAll").slots({ catchAllShow: "shown" }).cursor("catchAll"),  // catchAll appears inside
```

### 3. Don't Over-Focus
Only focus on what's relevant to the narration:
```typescript
// Bad: focusing on slowDie when talking about safeDie
on("create").slots({ name: "safeDie" }).focus("slowDieRef")  // ❌

// Good: cursor on safeDie, no focus needed
on("create").slots({ name: "safeDie" }).cursor("safeDie")  // ✅
```

### 4. Progressive Wrapping
Show content bare first, then wrapped. Use inline slots within a stable line:
```typescript
// Line always exists, wrapping is conditional
line("slowDieRef", [
  "  slowDie",
  slot.optional("pipeShow", ".pipe("), // bare → wrapped
]),

// Closing paren only when wrapped
slot.optional("pipeShow", line("pipeClose", "  )")),
```

### 5. Preview Before Committing
Use the CLI to verify animation steps and transcript word indices:
```bash
bun narrate steps catching-errors --chapter intro
bun narrate words catching-errors --chapter intro
```

## Inline Slots for Granular Changes

Use inline slots within `concat()` to animate parts of a line without losing line identity.

### Indentation Changes
```typescript
line("random", concat(
  slot("indent", { normal: text("  "), indented: text("    ") }),
  text("const n = yield* Random.nextIntBetween(1, 7)"),
))
```

### Type Parameter Changes
Animate just the changing part, not the whole type:
```typescript
line("sig", concat(
  text("const slowDie: Effect<number"),
  slot.optional("errorType", text(", VeryBadRoll")),
  text("> ="),
))
```

### Inline Content Changes
```typescript
line("comment", concat(
  text("// "),
  slot("commentText", {
    intro: text("Effect version"),
    error: text("> VeryBadRoll is not assignable to never"),
    fixed: text("It compiles!"),
  }),
))
```

## Two-Part Line Reveals

Show a line progressively: first the structure, then the content.

```typescript
slot.optional(
  "throwLine",
  line("throw", concat(
    text("  if (n === 4)"),
    slot("throwAction", {
      hidden: text(" ???"),      // Placeholder
      shown: text(" throw new VeryBadRoll()"),
    }),
  )),
)
```

Flow reveals in two steps:
```typescript
flow: [
  on("check").slots({ throwLine: "shown" }).cursor("???"),
  on("throw").slots({ throwAction: "shown" }).cursor("VeryBadRoll"),
]
```

## Layout Restructuring

Split inline code to multiple lines by toggling slots.

```typescript
animation: stack(
  line("sig", concat(
    text("const slowDie: Effect<number> ="),
    slot("genInline", {
      inline: text(" Effect.gen(function* () {"),
      hidden: empty,
    }),
  )),
  slot.optional("genLine", line("gen", "  Effect.gen(function* () {")),
  // Body lines with indent slots
  line("random", concat(
    slot("indent", { normal: text("  "), indented: text("    ") }),
    text("const n = yield* Random.nextIntBetween(1, 7)"),
  )),
  // ...
)

flow: [
  // Split and re-indent
  on("lethal").slots({
    genInline: "hidden",
    genLine: "shown",
    indent: "indented",
    closeIndent: "indented",
  }),
]
```

## Persistent Annotations

Most annotations are transient by default. Use `persist: true` where supported, then clear when you're done:

```typescript
flow: [
  on("error")
    .slots({ commentText: "error" })
    .squiggle("Effect<number>", { color: "red", persist: true })
    .focus("comment", "sig", { persist: true }),

  on("propagates")
    .cursor("Effect.fail"),

  // Fix: squiggle gone, error type shown
  on("reckon")
    .slots({ commentText: "fixed", errorType: "shown" })
    .squiggle.clear()
    .focus.clear()
    .cursor("VeryBadRoll"),
]
```

## Always-Visible Lines with State Changes

Keep a line visible, change its content via slot:

```typescript
line("comment", concat(
  text("// "),
  slot("commentText", {
    intro: text("Effect version"),
    error: text("> VeryBadRoll is not assignable to never"),
    fixed: text("It compiles!"),
  }),
))

base: {
  commentText: "intro",  // Starts with "// Effect version"
}
```

## Focus Flow

Guide attention through the code:

```typescript
flow: [
  // Intro: spotlight the function name
  on("slowDie").focus({ text: "slowDie" }).cursor("slowDie"),

  // Focus specific lines as narrative progresses
  on("rolls").focus("random").cursor("Math.random"),
  on("second").focus("sleep").cursor("sleep"),

  // Let it breathe: clear focus
  on("decree"),

  // Focus new content as it appears
  on("check").slots({ throwLine: "shown" }).focus("throw"),
]
```

## Celebration Effects

Mark success moments:

```typescript
on("type-check")
  .sound("success")
  .burst("Promise<number>", "✅")
```

Multiple emojis:
```typescript
on("success").burst("Result", ["🎉", "✨", "🎊"], { count: 5 })
```

## Naming Conventions

### Line IDs
Use semantic names that describe content:
- `"sig"` - function signature
- `"random"` - random number generation
- `"throw"` - error throwing line
- `"return"` - return statement
- `"close"` - closing brace

### Slot Names
Describe what changes:
- `"throwLine"` - the throw statement visibility
- `"throwAction"` - what happens in the throw
- `"errorType"` - error type parameter
- `"indent"` - indentation level
- `"commentText"` - comment content

### Slot Values
- `"hidden"` / `"shown"` - visibility toggles
- `"normal"` / `"indented"` - layout states
- `"base"` / `"expanded"` - content states
- `"intro"` / `"error"` / `"fixed"` - progression states

## Anti-Patterns

### Replacing Whole Lines for Partial Changes
Bad: Swapping entire line animations loses line identity and causes jarring transitions.

Good: Use inline slots within `concat()` to change only the dynamic part.

### Guessing Transcript Words
Bad: Using words that don't exist in the transcript.

Good: Use exact words from transcript. Build validates and shows errors with suggestions.

### Forgetting Focus Persistence
Bad: Expecting focus to persist when it's transient.

Good: Pass `{ persist: true }` to `.focus(...)` / `.focus.range(...)` / `.focus.except(...)`, then `.focus.clear()` when done.

### Over-Annotating
Bad: Adding glow, squiggle, cursor, burst all at once.

Good: Use sparingly. One or two annotations per step max. Reserve bursts for key moments.

## Imports Summary

```typescript
import { section, on, stack, line, slot, text, concat, empty } from "@/lib/content"
```
