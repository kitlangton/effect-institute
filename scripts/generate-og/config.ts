import path from "node:path"

export const VIEWPORT = { width: 1200, height: 630 }
export const DEVICE_SCALE = 2
export const OUTPUT_DIR = path.join(process.cwd(), "public", "og")
export const TEMPLATE_ROUTE = "/og/home"

export const getBaseUrl = (): string | null => process.env.OG_BASE_URL?.trim().replace(/\/$/, "") ?? null
