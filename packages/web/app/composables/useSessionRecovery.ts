import { onScopeDispose, type Ref, watch } from 'vue'
import type { SessionUser } from '~/types/app'
import { notifyWebAuthChange, webAuthChannel, withWebAuthLock } from '~/utils/authCoordination'
import type { WebSession } from './useSessionRequest'

type SessionState = {
	user: SessionUser | null
	pending: boolean
	resolved: boolean
	revision: number
	loggingOut: boolean
	setUser: (user: SessionUser | null) => void
	refreshSession: (operation: () => Promise<void>) => Promise<void>
	invalidate: () => void
	waitForSessionRefresh: () => Promise<void>
}

/** One refresh operation per app; never share session state between SSR requests. */
export function useSessionRecovery(
	session: SessionState,
	refreshAt: Ref<number | null>,
	load: () => Promise<WebSession>,
) {
	let disposed = false
	let timer: ReturnType<typeof setTimeout> | undefined
	let channel: BroadcastChannel | undefined

	function refresh(rotate = false, notify = true): Promise<void> {
		if (disposed || session.loggingOut) return Promise.resolve()
		const revision = session.revision
		return session.refreshSession(async () => {
			if (disposed || revision !== session.revision) return
			session.pending = true
			try {
				const result = await withWebAuthLock(async () => {
					if (disposed || session.loggingOut || revision !== session.revision) return null
					// Another tab may have rotated while this tab waited for the lock.
					let current = await load()
					if (disposed || session.loggingOut || revision !== session.revision) return null
					if (
						rotate &&
						current.user &&
						current.refreshAt !== null &&
						current.refreshAt <= Date.now()
					) {
						await $fetch('/api/auth/refresh', {
							method: 'POST',
							credentials: 'include',
							retry: 0,
						})
						if (disposed || revision !== session.revision) return null
						current = await load()
					}
					return current
				})
				if (!result) return
				if (disposed || revision !== session.revision) return
				session.setUser(result.user)
				refreshAt.value = result.refreshAt
				if (notify && result.user) notifyWebAuthChange('updated')
			} catch {
				if (disposed || revision !== session.revision) return
				session.setUser(null)
				refreshAt.value = null
			} finally {
				if (!disposed && revision === session.revision) {
					session.pending = false
					session.resolved = true
				}
			}
		})
	}

	function recover() {
		if (document.visibilityState === 'hidden') return
		if (!session.resolved || refreshAt.value === null || refreshAt.value <= Date.now()) {
			void refresh(refreshAt.value !== null && refreshAt.value <= Date.now())
		}
	}

	function listen() {
		if (typeof BroadcastChannel !== 'undefined') {
			channel = new BroadcastChannel(webAuthChannel)
			channel.onmessage = (event: MessageEvent<unknown>) => {
				if (event.data === 'logout') {
					session.invalidate()
					refreshAt.value = null
				} else if (event.data === 'updated') {
					const revision = session.revision
					void session.waitForSessionRefresh().then(() => {
						if (!disposed && revision === session.revision) void refresh(false, false)
					})
				}
			}
		}
		watch(
			[refreshAt, () => session.user?.id],
			([next]) => {
				if (timer) clearTimeout(timer)
				if (next === null || !session.user) return
				timer = setTimeout(() => void refresh(true), Math.max(0, next - Date.now()))
			},
			{ immediate: true },
		)
		for (const event of ['focus', 'pageshow', 'online']) window.addEventListener(event, recover)
		document.addEventListener('visibilitychange', recover)
		onScopeDispose(() => {
			for (const event of ['focus', 'pageshow', 'online']) {
				window.removeEventListener(event, recover)
			}
			document.removeEventListener('visibilitychange', recover)
		})
	}
	onScopeDispose(() => {
		disposed = true
		channel?.close()
		if (timer) clearTimeout(timer)
	})
	function synchronize() {
		if (session.user) notifyWebAuthChange('updated')
		else if (/(?:^|;\s*)zeepcentral_steam_id=[^;]+/.test(document.cookie)) {
			// A concurrent SSR navigation may lose rotation before the winner sets cookies.
			void refresh(false, false)
		}
	}
	return { refresh, listen, synchronize }
}
