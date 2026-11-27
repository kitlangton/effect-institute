import { Atom } from "effect/reactivity"

export interface Notification {
	id: number
	message: string
}

let notificationId = 0

/** Current notification to display (null = none) */
export const notificationAtom = Atom.make<Notification | null>(null)

/** Create a new notification (use with useAtomSet) */
export const notify = (message: string) => {
	return (_prev: Notification | null): Notification => ({
		id: ++notificationId,
		message,
	})
}

/** Clear notification (use with useAtomSet) */
export const clearNotification = () => null

/** Default duration for notifications */
export const NOTIFICATION_DURATION = 2000
