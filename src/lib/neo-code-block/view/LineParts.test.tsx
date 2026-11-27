import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { LineParts } from "./LineParts"

describe("LineParts", () => {
	it("renders compiled bright ranges as glowing text", () => {
		const html = renderToStaticMarkup(
			<LineParts
				line={{
					lineId: "sig",
					text: "const result = value",
					entering: false,
					dimmed: false,
					brightBoundaries: [{ start: 15, end: 20 }],
					parts: [
						{
							partId: "p0",
							tokens: [{ text: "const result = value", type: "identifier" }],
							motionKey: "p0",
							crossfade: false,
							animateEntry: false,
							isVisible: true,
						},
					],
				}}
				lineIndex={0}
				brightRanges={[{ lineIndex: 0, start: 15, end: 20 }]}
				renderMode="static"
			/>,
		)

		expect(html).toContain("text-shadow:0 0 6px currentColor")
		expect(html).toContain("value")
	})
})
