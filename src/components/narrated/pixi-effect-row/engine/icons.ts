import { type Graphics, GraphicsPath, parseSVGPath } from "pixi.js"

export type NodeIconKind = "sparkle" | "error" | "warning" | "check" | "none"

const ICON_CENTER = 128
export const ICON_VIEWBOX = 256
const ICON_STAR_PATH =
	"M240,128a15.79,15.79,0,0,1-10.5,15l-63.44,23.07L143,229.5a16,16,0,0,1-30,0L89.94,166.06,26.5,143a16,16,0,0,1,0-30L89.94,89.94,113,26.5a16,16,0,0,1,30,0l23.07,63.44L229.5,113A15.79,15.79,0,0,1,240,128Z"
const ICON_ERROR_PATH =
	"M128,16C70.65,16,24,60.86,24,116c0,34.1,18.27,66,48,84.28V216a16,16,0,0,0,16,16h8a4,4,0,0,0,4-4V200.27a8.17,8.17,0,0,1,7.47-8.25,8,8,0,0,1,8.53,8v28a4,4,0,0,0,4,4h16a4,4,0,0,0,4-4V200.27a8.17,8.17,0,0,1,7.47-8.25,8,8,0,0,1,8.53,8v28a4,4,0,0,0,4,4h8a16,16,0,0,0,16-16V200.28C213.73,182,232,150.1,232,116,232,60.86,185.35,16,128,16ZM92,152a20,20,0,1,1,20-20A20,20,0,0,1,92,152Zm72,0a20,20,0,1,1,20-20A20,20,0,0,1,164,152Z"
const ICON_WARNING_PATH =
	"M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z"

const STAR_PATH = createSvgPath(ICON_STAR_PATH)
const ERROR_PATH = createSvgPath(ICON_ERROR_PATH)
const WARNING_PATH = createSvgPath(ICON_WARNING_PATH)

function createSvgPath(pathData: string) {
	const path = new GraphicsPath()
	parseSVGPath(pathData, path)
	path.checkForHoles = true
	return path
}

function drawSvgIcon(target: Graphics, path: GraphicsPath, color: number) {
	target.clear()
	target.setFillStyle({ color })
	target.path(path).fill()
	target.pivot.set(ICON_CENTER, ICON_CENTER)
}

function drawCheckIcon(target: Graphics, color: number) {
	target.clear()
	target.setStrokeStyle({ width: 24, color, cap: "round", join: "round" })
	target.moveTo(40, 144).lineTo(96, 200).lineTo(224, 72).stroke()
	target.pivot.set(ICON_CENTER, ICON_CENTER)
}

export function drawIconKind(target: Graphics, kind: NodeIconKind, color: number) {
	switch (kind) {
		case "sparkle":
			drawSvgIcon(target, STAR_PATH, color)
			break
		case "error":
			drawSvgIcon(target, ERROR_PATH, color)
			break
		case "warning":
			drawSvgIcon(target, WARNING_PATH, color)
			break
		case "check":
			drawCheckIcon(target, color)
			break
		default:
			target.clear()
	}
}
