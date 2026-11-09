import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useAccountActions } from '../../app/composables/useAccountActions'
import { useSessionRecovery } from '../../app/composables/useSessionRecovery'
import { useSessionStore } from '../../app/stores/session'

const user = { id: 1, steamId: '76561198000000000', steamName: 'Auth fixture' }
const scopes: ReturnType<typeof effectScope>[] = []

function setup() {
	vi.useFakeTimers()
	vi.setSystemTime(2_000_000_000_000)
	vi.stubGlobal('ref', ref)
	setActivePinia(createPinia())
	const session = useSessionStore()
	session.setUser(user)
	session.resolved = true
	const refreshAt = ref<number | null>(Date.now() + 60_000)
	const load = vi.fn().mockImplementation(async () => ({
		user,
		isAdmin: false,
		refreshAt: Date.now() + 600_000,
	}))
	const fetcher = vi.fn().mockResolvedValue({ refreshAt: Date.now() + 600_000 })
	const windowTarget = new EventTarget()
	const documentTarget = Object.assign(new EventTarget(), { visibilityState: 'visible' })
	vi.stubGlobal('window', windowTarget)
	vi.stubGlobal('document', documentTarget)
	vi.stubGlobal('$fetch', fetcher)
	const scope = effectScope()
	scopes.push(scope)
	const recovery = scope.run(() => {
		const recovery = useSessionRecovery(session, refreshAt, load)
		recovery.listen()
		return recovery
	})
	if (!recovery) throw new Error('Session recovery scope inactive')
	return { session, refreshAt, load, fetcher, windowTarget, documentTarget, recovery, scope }
}

afterEach(() => {
	for (const scope of scopes.splice(0)) scope.stop()
	vi.useRealTimers()
	vi.unstubAllGlobals()
})

describe('session recovery', () => {
	it('refreshes before expiry and installs the next timer', async () => {
		const flow = setup()
		await vi.advanceTimersByTimeAsync(60_000)
		expect(flow.fetcher).toHaveBeenCalledOnce()
		expect(flow.load).toHaveBeenCalledOnce()
		expect(flow.session.user).toEqual(user)
		expect(flow.session.pending).toBe(false)
		await vi.advanceTimersByTimeAsync(600_000)
		expect(flow.fetcher).toHaveBeenCalledTimes(2)
	})

	it.each(['focus', 'pageshow', 'online', 'visibilitychange'])(
		'recovers overdue session on %s without waiting for suspended timer',
		async (event) => {
			const flow = setup()
			vi.setSystemTime(Date.now() + 120_000)
			const target = event === 'visibilitychange' ? flow.documentTarget : flow.windowTarget
			target.dispatchEvent(new Event(event))
			await flow.session.waitForSessionRefresh()
			expect(flow.fetcher).toHaveBeenCalledOnce()
			expect(flow.load).toHaveBeenCalledOnce()
			expect(flow.refreshAt.value).toBeGreaterThan(Date.now())
		},
	)

	it('coalesces timer, focus, and manual refresh', async () => {
		const flow = setup()
		let finish!: () => void
		flow.fetcher.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve
				}),
		)
		await vi.advanceTimersByTimeAsync(60_000)
		flow.windowTarget.dispatchEvent(new Event('focus'))
		flow.windowTarget.dispatchEvent(new Event('pageshow'))
		const manual = flow.recovery.refresh()
		expect(flow.fetcher).toHaveBeenCalledOnce()
		finish()
		await manual
		expect(flow.load).toHaveBeenCalledOnce()
	})

	it('does not refresh fresh sessions or hidden tabs on focus', async () => {
		const flow = setup()
		flow.windowTarget.dispatchEvent(new Event('focus'))
		vi.setSystemTime(Date.now() + 120_000)
		flow.documentTarget.visibilityState = 'hidden'
		flow.windowTarget.dispatchEvent(new Event('focus'))
		await Promise.resolve()
		expect(flow.fetcher).not.toHaveBeenCalled()
	})

	it('shows signed out on refresh failure, then recovers with saved cookies', async () => {
		const flow = setup()
		flow.fetcher.mockRejectedValueOnce(new Error('Network unavailable'))
		await vi.advanceTimersByTimeAsync(60_000)
		expect(flow.session.user).toBeNull()
		expect(flow.refreshAt.value).toBeNull()
		flow.windowTarget.dispatchEvent(new Event('online'))
		await flow.session.waitForSessionRefresh()
		expect(flow.session.user).toEqual(user)
		expect(flow.fetcher).toHaveBeenCalledOnce()
		expect(flow.load).toHaveBeenCalledOnce()
	})

	it('clears user on failed verification and manual refresh still works', async () => {
		const flow = setup()
		flow.load.mockResolvedValueOnce({ user: null, isAdmin: false, refreshAt: null })
		await flow.recovery.refresh()
		expect(flow.session.user).toBeNull()
		await flow.recovery.refresh()
		expect(flow.session.user).toEqual(user)
	})

	it('waits for delayed refresh before logout clears cookies and rejects delayed user', async () => {
		const flow = setup()
		let finish!: (value: unknown) => void
		flow.load.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve
				}),
		)
		const refreshing = flow.recovery.refresh()
		await Promise.resolve()
		vi.stubGlobal('useRuntimeConfig', () => ({ public: {} }))
		vi.stubGlobal('useRoute', () => ({ fullPath: '/' }))
		vi.stubGlobal('useSessionStore', () => flow.session)
		vi.stubGlobal('useState', () => flow.refreshAt)
		vi.stubGlobal('useAuthReturnPath', () => ({ save: vi.fn() }))
		vi.stubGlobal('navigateTo', vi.fn())
		const logout = useAccountActions().logout()
		flow.windowTarget.dispatchEvent(new Event('focus'))
		expect(flow.session.user).toBeNull()
		expect(flow.fetcher).not.toHaveBeenCalled()
		finish({ user, isAdmin: false, refreshAt: Date.now() + 600_000 })
		await Promise.all([refreshing, logout])
		expect(flow.session.user).toBeNull()
		expect(flow.refreshAt.value).toBeNull()
		expect(flow.fetcher).toHaveBeenCalledWith('/api/auth/logout', expect.anything())
	})

	it('removes listeners and timers on disposal and ignores delayed results', async () => {
		const flow = setup()
		let finish!: (value: unknown) => void
		flow.load.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve
				}),
		)
		const refreshing = flow.recovery.refresh()
		await Promise.resolve()
		flow.scope.stop()
		finish({ user: null, isAdmin: false, refreshAt: null })
		await refreshing
		flow.windowTarget.dispatchEvent(new Event('online'))
		await vi.advanceTimersByTimeAsync(600_000)
		expect(flow.session.user).toEqual(user)
		expect(flow.load).toHaveBeenCalledOnce()
		expect(flow.fetcher).not.toHaveBeenCalled()
		await nextTick()
	})
})
