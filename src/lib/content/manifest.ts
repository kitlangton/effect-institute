import type { ChapterManifest } from "@/lib/tooling/types"

/** Get the published section count from groups, which exclude draft groups. */
export function getPublishedSectionCount(manifest: ChapterManifest): number {
	if (manifest.groups && manifest.groups.length > 0) {
		return manifest.groups.reduce((sum, group) => sum + group.sectionIds.length, 0)
	}
	return manifest.sections.length
}

/** Get published section IDs in chapter order, excluding draft groups. */
export function getPublishedSectionIds(manifest: ChapterManifest): readonly string[] {
	if (manifest.groups && manifest.groups.length > 0) {
		return manifest.groups.flatMap((group) => group.sectionIds)
	}
	return manifest.sections.map((section) => section.id)
}
