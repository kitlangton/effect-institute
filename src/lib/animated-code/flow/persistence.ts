/**
 * Persistence utilities for annotation state across steps.
 *
 * Handles transient vs persistent annotations:
 * - Transient: disappear after one step
 * - Persistent (persist: true): stick until explicitly cleared
 *
 * @module
 */

/** Check if value has a truthy persist property */
function defaultHasPersist<T>(v: T): boolean {
	return typeof v === "object" && v !== null && "persist" in v && !!(v as Record<string, unknown>).persist
}

/**
 * Tracks a single-value persistent annotation.
 * Handles clear flags and persist:true semantics.
 */
export class Persistent<T> {
	value: T | null = null
	private hasPersist: (v: T) => boolean

	constructor(hasPersist: (v: T) => boolean = defaultHasPersist) {
		this.hasPersist = hasPersist
	}

	/** Process current annotation and return effective value */
	update(current: T | undefined, clear: boolean | undefined): T | null {
		if (clear) this.value = null
		if (current !== undefined) {
			this.value = this.hasPersist(current) ? current : null
		}
		return current ?? this.value
	}
}

/**
 * Tracks an array persistent annotation.
 * Filters for items with persist:true.
 */
export class PersistentArray<T extends { persist?: boolean }> {
	value: T[] | null = null

	/**
	 * Optional key function for deduplication.
	 * When provided, items with matching keys will be replaced rather than accumulated.
	 */
	private keyFn: ((item: T) => string) | undefined

	constructor(keyFn?: (item: T) => string) {
		this.keyFn = keyFn
	}

	/** Process current annotations and return effective value */
	update(current: T[] | undefined, clear: boolean | undefined): T[] | null {
		if (clear) this.value = null

		if (current && current.length > 0) {
			// Save old persistent items BEFORE updating
			const oldPersistent = this.value

			// Update stored value with persistent items from current
			const persisting = current.filter((x) => x.persist)
			this.value = persisting.length > 0 ? persisting : null

			// Merge old persistent items with current
			if (oldPersistent && oldPersistent.length > 0) {
				// Filter out old items that are being replaced by current items
				const keyFn = this.keyFn
				const currentKeys = keyFn ? new Set(current.map(keyFn)) : null
				const keptOld = currentKeys ? oldPersistent.filter((old) => !currentKeys.has(keyFn!(old))) : oldPersistent

				// Also update stored value to include kept old items
				if (keptOld.length > 0) {
					this.value = this.value ? [...keptOld, ...this.value] : keptOld
				}

				// Return merged: old persistent + current
				return [...keptOld, ...current]
			}
			return current
		}

		return this.value
	}
}
