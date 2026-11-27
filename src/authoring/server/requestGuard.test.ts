import { describe, expect, it } from "vitest"
import { type GuardRequest, rejectCrossSite } from "./requestGuard"

const req = (method: string, headers: GuardRequest["headers"] = {}): GuardRequest => ({
	method,
	headers: { host: "localhost:3210", ...headers },
})

describe("rejectCrossSite", () => {
	it("allows the dev client's own requests", () => {
		expect(rejectCrossSite(req("GET", { "sec-fetch-site": "same-origin" }))).toBeNull()
		expect(
			rejectCrossSite(
				req("POST", { "x-authoring": "1", "sec-fetch-site": "same-origin", origin: "http://localhost:3210" }),
			),
		).toBeNull()
	})

	it("allows curl and other non-browser clients that send the header", () => {
		expect(rejectCrossSite(req("GET"))).toBeNull()
		expect(rejectCrossSite(req("POST", { "x-authoring": "1" }))).toBeNull()
	})

	it("refuses non-GET requests without the header", () => {
		expect(rejectCrossSite(req("POST"))).toMatch(/x-authoring: 1/)
		expect(rejectCrossSite(req("POST", { "x-authoring": "yes" }))).toMatch(/x-authoring: 1/)
		expect(rejectCrossSite(req("PUT", { "sec-fetch-site": "same-origin" }))).toMatch(/x-authoring: 1/)
	})

	it("refuses cross-site fetch metadata, even on GET and with the header", () => {
		expect(rejectCrossSite(req("GET", { "sec-fetch-site": "cross-site" }))).toMatch(/Sec-Fetch-Site: cross-site/)
		expect(rejectCrossSite(req("POST", { "x-authoring": "1", "sec-fetch-site": "same-site" }))).toMatch(/same-site/)
		expect(rejectCrossSite(req("GET", { "sec-fetch-site": "none" }))).toBeNull()
	})

	it("refuses an Origin that does not match Host", () => {
		expect(rejectCrossSite(req("GET", { origin: "https://evil.example" }))).toMatch(/Origin: https:\/\/evil.example/)
		expect(rejectCrossSite(req("POST", { "x-authoring": "1", origin: "http://localhost:9999" }))).toMatch(/Origin/)
		expect(rejectCrossSite(req("POST", { "x-authoring": "1", origin: "null" }))).toMatch(/Origin: null/)
		expect(rejectCrossSite({ method: "GET", headers: { origin: "http://localhost:3210" } })).toMatch(/Origin/)
	})

	it("reads the first value of repeated headers", () => {
		expect(rejectCrossSite(req("POST", { "x-authoring": ["1", "2"] }))).toBeNull()
	})
})
