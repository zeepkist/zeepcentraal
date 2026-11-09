export const webAuthChannel = 'zeepcentral-web-auth'
export type WebAuthChange = 'updated' | 'logout'

/** Cookies are shared by tabs. Serialize their refresh and logout operations too. */
export function withWebAuthLock<T>(operation: () => Promise<T>): Promise<T> {
	if (import.meta.server || typeof navigator === 'undefined' || !navigator.locks) {
		return operation()
	}
	return navigator.locks.request(webAuthChannel, operation)
}

/** Send an invalidation hint only. Never broadcast credentials or user data. */
export function notifyWebAuthChange(change: WebAuthChange) {
	if (import.meta.server || typeof BroadcastChannel === 'undefined') return
	const channel = new BroadcastChannel(webAuthChannel)
	channel.postMessage(change)
	channel.close()
}
