import { Schema } from "effect"
import { ChapterPaths } from "@/lib/chapter-paths"
import {
	ChapterManifest,
	type ChapterMetadata,
	CourseManifest,
	type ManifestSectionEntry,
	SectionData,
} from "@/lib/tooling/types"

const decodeCourseManifest = Schema.decodeUnknownSync(CourseManifest)
const decodeChapterManifest = Schema.decodeUnknownSync(ChapterManifest)
const decodeSectionData = Schema.decodeUnknownSync(SectionData)

export interface ContentDeliveryOptions {
	readonly origin?: string
	readonly cache?: RequestCache
	readonly fetch?: typeof globalThis.fetch
}

function resolveContentUrl(path: string, origin: string | undefined) {
	if (!origin) return path
	return new URL(path, origin).toString()
}

async function fetchJson<A>(
	path: string,
	decode: (input: unknown) => A,
	options: ContentDeliveryOptions = {},
): Promise<A> {
	const requestUrl = resolveContentUrl(path, options.origin)
	const fetchImpl = options.fetch ?? globalThis.fetch
	const response = await fetchImpl(requestUrl, options.cache === undefined ? undefined : { cache: options.cache })
	if (!response.ok) {
		throw new Error(`Failed to fetch ${requestUrl}: ${response.status}`)
	}
	try {
		return decode(await response.json())
	} catch (cause) {
		throw new Error(`Failed to decode ${requestUrl}: ${cause}`)
	}
}

export function fetchCourseManifest(options?: ContentDeliveryOptions) {
	return fetchJson(ChapterPaths.courseManifestUrl(), decodeCourseManifest, options)
}

export function fetchChapterManifest(chapterId: string, options?: ContentDeliveryOptions) {
	return fetchJson(ChapterPaths.chapterManifestUrl(chapterId), decodeChapterManifest, options)
}

function fetchSectionData(chapterId: string, entry: ManifestSectionEntry, options?: ContentDeliveryOptions) {
	return fetchJson(ChapterPaths.sectionJsonFileUrl(chapterId, entry.file), decodeSectionData, options)
}

export function fetchChapterSections(chapterId: string, manifest: ChapterManifest, options?: ContentDeliveryOptions) {
	return Promise.all(manifest.sections.map((entry) => fetchSectionData(chapterId, entry, options)))
}

export async function fetchChapterManifestMap(chapters: readonly ChapterMetadata[], options?: ContentDeliveryOptions) {
	const manifestByChapter = new Map<string, ChapterManifest>()
	await Promise.all(
		chapters.map(async (chapter) => {
			try {
				manifestByChapter.set(chapter.id, await fetchChapterManifest(chapter.id, options))
			} catch (error) {
				// A single missing chapter manifest should not block index progress for the rest.
				console.warn(`[content] Failed to load chapter manifest "${chapter.id}":`, error)
			}
		}),
	)
	return manifestByChapter
}
