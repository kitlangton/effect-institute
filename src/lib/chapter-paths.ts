/**
 * Centralized URL generation for chapter assets.
 */

const CONTENT_URL_BASE = "/content"

export const ChapterPaths = {
	/** URL to audio file for a section (takes hashed filename from section JSON) */
	audioUrl: (chapter: string, audioFile: string) => `${CONTENT_URL_BASE}/${chapter}/${audioFile}`,

	/** URL to chapter manifest (section order) */
	chapterManifestUrl: (chapter: string) => `${CONTENT_URL_BASE}/${chapter}/manifest.json`,

	/** URL to section JSON data by hashed filename (e.g., "welcome.a1b2c3d4.json") */
	sectionJsonFileUrl: (chapter: string, filename: string) => `${CONTENT_URL_BASE}/${chapter}/${filename}`,

	/** URL to course manifest (chapter list) */
	courseManifestUrl: () => `${CONTENT_URL_BASE}/manifest.json`,
} as const
