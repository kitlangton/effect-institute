/**
 * Dev-only authoring UI. Production code may only reach this module through a lazy import guarded by
 * `import.meta.env.DEV ? lazy(...) : null`, so the bundler drops it from production builds.
 *
 * @module
 */
export { AuthoringBar } from "./AuthoringBar"
export { AuthoringMenuItems } from "./AuthoringMenuItems"
