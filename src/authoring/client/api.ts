/**
 * Browser client for the dev-only /__authoring endpoints (see src/authoring/server/devPlugin.ts).
 *
 * @module
 */

import type { AuthoringStatus, Take } from "../server/devPlugin"
import type { NarrationResult } from "../server/Narration"

export type { AuthoringStatus, NarrationResult, Take }

export type Outcome =
	| { readonly ok: true; readonly result: NarrationResult }
	| { readonly ok: false; readonly error: string }

const query = (chapter: string, section: string, extra: Record<string, string> = {}) =>
	new URLSearchParams({ chapter, section, ...extra }).toString()

// The dev server refuses POSTs without this header (see src/authoring/server/requestGuard.ts).
const AUTHORING_HEADERS = { "X-Authoring": "1" }

const post = async (route: string, chapter: string, section: string, init: RequestInit = {}, extra = {}) => {
	try {
		const response = await fetch(`/__authoring/${route}?${query(chapter, section, extra)}`, {
			method: "POST",
			...init,
			headers: { ...AUTHORING_HEADERS, ...init.headers },
		})
		return (await response.json()) as Outcome
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) } satisfies Outcome
	}
}

export const authoringApi = {
	status: async (): Promise<AuthoringStatus | null> => {
		try {
			return (await (await fetch("/__authoring/status")).json()) as AuthoringStatus
		} catch {
			return null
		}
	},
	takes: async (chapter: string, section: string): Promise<Take[]> => {
		try {
			const body = (await (await fetch(`/__authoring/takes?${query(chapter, section)}`)).json()) as { takes?: Take[] }
			return body.takes ?? []
		} catch {
			return []
		}
	},
	record: (chapter: string, section: string, audio: Blob) =>
		post("record", chapter, section, { body: audio, headers: { "Content-Type": audio.type || "audio/webm" } }),
	reprocessTake: (chapter: string, section: string, take: string) => post("takes/use", chapter, section, {}, { take }),
	align: (chapter: string, section: string) => post("align", chapter, section),
	generate: (chapter: string, section: string) => post("generate", chapter, section),
}
