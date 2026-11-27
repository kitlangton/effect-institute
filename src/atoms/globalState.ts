import { Atom } from "effect/reactivity"

export const feedbackModalOpenAtom = Atom.make(false).pipe(Atom.keepAlive)
