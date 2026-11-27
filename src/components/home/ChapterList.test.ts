import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import {
	ChapterId,
	ChapterManifest,
	ChapterMetadata,
	GroupId,
	ManifestGroupEntry,
	ManifestSectionEntry,
	SectionId,
} from "@/lib/tooling/types"
import { computeChapterProgress, findSelectableChapterIndex } from "./ChapterList"

const chapterId = Schema.decodeSync(ChapterId)
const sectionId = Schema.decodeSync(SectionId)
const groupId = Schema.decodeSync(GroupId)

const chapters: ChapterMetadata[] = [
	new ChapterMetadata({ id: chapterId("intro"), title: "Intro", order: 1, sectionsCount: 2 }),
	new ChapterMetadata({ id: chapterId("coming"), title: "Coming", order: 2, comingSoon: true }),
	new ChapterMetadata({ id: chapterId("basics"), title: "Basics", order: 3, sectionsCount: 2 }),
]

describe("ChapterList helpers", () => {
	it("skips comingSoon chapters during keyboard navigation", () => {
		expect(findSelectableChapterIndex(chapters, -1, 1)).toBe(0)
		expect(findSelectableChapterIndex(chapters, -1, -1)).toBe(2)
		expect(findSelectableChapterIndex(chapters, 0, 1)).toBe(2)
		expect(findSelectableChapterIndex(chapters, 2, -1)).toBe(0)
		expect(findSelectableChapterIndex(chapters, 0, -1)).toBe(0)
		expect(findSelectableChapterIndex(chapters, 2, 1)).toBe(2)
	})

	it("computes per-chapter published progress and next continue target", () => {
		const manifests = new Map<string, ChapterManifest>([
			[
				"intro",
				new ChapterManifest({
					id: chapterId("intro"),
					title: "Intro",
					sections: [
						new ManifestSectionEntry({ id: sectionId("s1"), file: "s1.json" }),
						new ManifestSectionEntry({ id: sectionId("s2"), file: "s2.json" }),
					],
					groups: [
						new ManifestGroupEntry({
							id: groupId("g1"),
							title: "G1",
							sectionIds: [sectionId("s1"), sectionId("s2")],
						}),
					],
				}),
			],
			[
				"basics",
				new ChapterManifest({
					id: chapterId("basics"),
					title: "Basics",
					sections: [
						new ManifestSectionEntry({ id: sectionId("b1"), file: "b1.json" }),
						new ManifestSectionEntry({ id: sectionId("b2"), file: "b2.json" }),
					],
					groups: [
						new ManifestGroupEntry({
							id: groupId("g1"),
							title: "G1",
							sectionIds: [sectionId("b1"), sectionId("b2")],
						}),
					],
				}),
			],
		])

		const result = computeChapterProgress(chapters, { intro: ["s1", "s2"], basics: ["b1"] }, manifests)

		expect(result.progressMap.get("intro")).toEqual({ total: 2, completed: 2 })
		expect(result.progressMap.get("basics")).toEqual({ total: 2, completed: 1 })
		expect(result.continueTarget).toEqual({ chapterId: "basics", sectionId: "b2" })
	})
})
