import { onScopeDispose, type Ref, watch } from 'vue'
import type { SessionUser } from '~/types/app'
import type { WebSession } from './useSessionRequest'

type SessionState = {
	user: SessionUser | null
	pending: boolean
	resolved: boolean
	revision: number
	loggingOut: boolean
	setUser: (user: SessionUser | null) => void
	refreshSession: (operation: () => Promise<void>) => Promise<void>
}

/** One refresh operation per app; never share session state between SSR requests. */
export function useSessionRecovery(
	session: SessionState,
	refreshAt: Ref<number | null>,
	load: () => Promise<WebSession>,
) {
	let disposed = false
	let timer: ReturnType<typeof setTimeout> | undefined

	function refresh(rotate = false): Promise<void> {
		if (disposed || session.loggingOut) return Promise.resolve()
		const revision = session.revision
		return session.refreshSession(async () => {
			if (disposed || revision !== session.revision) return
			session.pending = true
			try {
				if (rotate) {
					await $fetch('/api/auth/refresh', {
						method: 'POST',
						credentials: 'include',
						retry: 0,
					})
				}
				if (disposed || revision !== session.revision) return
				const result = await load()
				if (disposed || revision !== session.revision) return
				session.setUser(result.user)
				refreshAt.value = result.refreshAt
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
		if (timer) clearTimeout(timer)
	})
	return { refresh, listen }
}
