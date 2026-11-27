import { describe, expect, it } from "vitest"
import { line, slot } from "@/lib/animated-code/animation"
import { compileChapter, compileSection, compileSectionsWithGroups, validateChapterDefinition } from "./compile"
import { chapter, group, section } from "./dsl"

const publicSection = section("public-section", { transcript: "Published." })
const draftSection = section("draft-section", { transcript: "Draft." })
const fixture = chapter("fixture", "Fixture", [
	group("public", "Public", [publicSection]),
	group("draft", "Draft", [draftSection], { draft: true }),
])

describe("publication compilation", () => {
	it("omits draft groups and sections from published artifacts", () => {
		const manifest = compileChapter(fixture)
		const sections = compileSectionsWithGroups(fixture)

		expect(manifest.sections.map((entry) => entry.id)).toEqual(["public-section"])
		expect(manifest.draftGroups).toBeUndefined()
		expect(sections.map((entry) => entry.id)).toEqual(["public-section"])
	})

	it("retains drafts in explicit authoring artifacts", () => {
		const manifest = compileChapter(fixture, undefined, { includeDrafts: true })
		const sections = compileSectionsWithGroups(fixture, { includeDrafts: true })

		expect(manifest.sections.map((entry) => entry.id)).toEqual(["public-section", "draft-section"])
		expect(manifest.draftGroups).toEqual(["draft"])
		expect(sections.map((entry) => entry.id)).toEqual(["public-section", "draft-section"])
		expect(sections[1].groupDraft).toBe(true)
	})

	it("rejects duplicate section IDs before artifact paths collide", () => {
		const invalid = chapter("fixture", "Fixture", [
			group("one", "One", [section("same", { transcript: "One." })]),
			group("two", "Two", [section("same", { transcript: "Two." })]),
		])

		expect(() => validateChapterDefinition(invalid)).toThrow("Duplicate section ID: same")
	})

	it("rejects authored IDs that can escape generated paths", () => {
		const invalid = chapter("fixture", "Fixture", [section("../escape", { transcript: "No." })])

		expect(() => validateChapterDefinition(invalid)).toThrow("Invalid section ID: ../escape")
	})

	it("extracts animated initial code using optional slot hidden defaults", () => {
		const animated = section("animated", {
			transcript: "A type.",
			code: {
				animation: line("sig", ["Effect<number", slot.optional("error", ", Error"), ">"]),
				flow: [],
			},
		})

		expect(compileSection(animated).code).toBe("Effect<number>")
	})
})
