# Animation DSL Reference

Algebraic data type for composable code animations.

Most section authors do **not** write `snapshots` directly. Instead, define:
- `code.animation` (the Animation tree)
- `code.base` (initial slot assignments)
- `code.flow` (word-triggered steps via `on(...)` — see `docs/animation-flow.md`)

## Primitives

### `text(content: string)`
Literal text content. Leaf node, cannot be further animated.
```ts
text("const x = 1")
```

### `empty`
Identity element. Renders nothing. Use for conditional visibility in slots.
```ts
slot("extra", { none: empty, shown: line("x", "...") })
```

### `line(id: string, content: AnimationInput)`
Line with explicit ID for animation tracking. Most common constructor.
```ts
// String content (most common)
line("sig", "function greet() {}")

// Inline content (array shorthand → concat)
line("call", concat(text("return "), slot("fn", { a: text("foo()") })))
```

### `stack(...parts: (Animation | string)[])`
Vertical composition. Parts render on different lines. Strings get auto-generated IDs.
```ts
stack(
  line("line1", "const x = 1"),
  line("line2", "const y = 2"),
  "auto-id line",  // Gets auto ID
)
```

### `concat(...parts: AnimationInput[])`
Horizontal composition. Parts render on same line. Strings auto-wrap in `text()`.
```ts
concat(text("return "), slot("val", { a: text("1"), b: text("2") }))
// Renders: "return 1" or "return 2"
```

### `slot(name: string, values: Record<string, AnimationInput>)`
Choice point. Snapshot selects which value via `{ slotName: "valueName" }`.
```ts
slot("body", {
  expanded: stack(line("a", "line a"), line("b", "line b")),
  collapsed: line("dots", "// ..."),
})
```

**First value is default:** The first key in values is used as the initial state. No need to specify `base` if first value is what you want.

```ts
// "slowDie" is default (first key)
slot("name", { slowDie: "slowDie", safeDie: "safeDie" })
```

**Reserved `"hidden"` state:** any slot can be set to `"hidden"` to render as `empty`, even if `"hidden"` is not defined in the slot values.

**Key semantics:**
- Slots are structural positions. The slot is always "present" in the animation tree.
- The slot VALUE controls what renders at that position.
- `empty` renders nothing but maintains the slot's position for future values.
- Same slot name can appear multiple times. All instances use the same value.

### `slot.optional(name: string, content: AnimationInput)`
The hide/show pattern: content starts as the reserved `"hidden"` value. Reveal with `{ name: "shown" }`.
```ts
line("sig", ["Effect<number", slot.optional("error", ", Error"), ">"])
// base state uses error="hidden" automatically

// Then in flow:
on("word").slots({ error: "shown" })
```

**Same slot, multiple positions (for paired delimiters):**
```ts
stack(
  line("ref", concat(
    "  slowDie",
    slot("pipe", { bare: empty, wrapped: ".pipe(" }),  // opening
  )),
  // ... content ...
  slot("pipe", { bare: empty, wrapped: line("close", "  )") }),  // closing
)
// When pipe="wrapped", both opening and closing appear together
```

### `section(name: string, content: AnimationInput)`
Namespace for line IDs. Prevents collision when composing. Line IDs become `sectionName/lineId`.
```ts
stack(
  section("foo", line("sig", "function foo() {}")),  // ID: "foo/sig"
  section("bar", line("sig", "function bar() {}")),  // ID: "bar/sig"
)
```

## Convenience Constructors

| Constructor | Purpose |
|-------------|---------|
| `slot.optional(name, content)` | Slot starting `"hidden"`, reveal with `"shown"` |
| `code(indent)` | Template tag for static multi-line code blocks |

### `code(indent: number)`

Template tag for static multi-line code blocks. Dedents the template and splits into lines with auto-generated IDs. Use when lines don't need to be individually animated (no focus/cursor targeting).

```ts
// With 2-space base indent
code(2)`
  Effect.gen(function* () {
    const n = yield* Random.nextIntBetween(1, 7)
    yield* Effect.sleep("1 second")
    return n
  })
`

// Equivalent to:
stack(
  "  Effect.gen(function* () {",
  "    const n = yield* Random.nextIntBetween(1, 7)",
  '    yield* Effect.sleep("1 second")',
  "    return n",
  "  })",
)
```

**When to use:** Static code blocks where you don't need to focus/highlight individual lines. Much cleaner than listing each line separately.

## Snapshots

Snapshots define animation state at each step.

A `Snapshot` is `{ slots, annotations }`:
- **slots**: which value each slot shows, `{ [slotName]: "valueKey" }`
- **annotations**: `Annotation[]` (see `src/lib/animated-code/annotations.ts`)

```ts
import { Focus, Cursor } from "@/lib/animated-code/annotations"

{
  slots: { body: "expanded", visibility: "shown" },
  annotations: [
    new Focus({ lines: ["sig", "return"] }),
    new Cursor({ text: "await" }),
  ],
}
```

## Compiling

`compileSlideshow({ animation, snapshots })` compiles to the `CodeSlideshow` the player reads (schema in `src/lib/animated-code/slideshow.ts`), highlighting each line as a whole with Shiki. `compile(def)` does the same synchronously with plain, unhighlighted tokens (tests). `evaluateLines(animation, slots)` gives the lines one snapshot shows, exactly as the compiled frame shows them.

## Imports

Content authoring (recommended):

```ts
import { section, on, stack, line, slot, text, concat, empty, code } from "@/lib/content"
```

Low-level (compiler/tests):

```ts
import { stack, line, slot, text, concat, empty, section, code } from "@/lib/animated-code/animation"
import { compile, compileSlideshow, evaluateLines } from "@/lib/animated-code/animation"
import type { Animation, Snapshot, AnimationDef } from "@/lib/animated-code/animation"
```

## Debugging

Use the CLI to preview animation steps:

```bash
bun narrate steps <section> --chapter <chapter>
```

Shows each step's code exactly as the player shows it, with slot values, where every annotation lands, and `(not found!)` for targets that match nothing.
