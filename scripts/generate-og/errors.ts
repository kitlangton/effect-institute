import { Schema } from "effect"

/** A step of OG image generation failed (browser launch, dev server, navigation, screenshot). */
export class OgError extends Schema.TaggedError<OgError>()("OgError", {
	message: Schema.String,
	cause: Schema.optional(Schema.Defect()),
}) {}

export const ogError = (message: string) => (cause: unknown) => new OgError({ message, cause })
