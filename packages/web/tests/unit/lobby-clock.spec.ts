import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { useLobbyClock } from '../../app/composables/useLobbyClock'

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
})

describe('lobby display clock', () => {
	it('ticks once per minute only while visible and active, then disposes its timer', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-11-10T20:00:00Z'))
		const visible = shallowRef(true)
		const active = shallowRef(false)
		vi.stubGlobal('usePageVisibility', () => visible)
		const scope = effectScope()
		const now = scope.run(() => useLobbyClock(active))
		if (!now) throw new Error('Clock scope did not start')
		const initial = now.value
		expect(vi.getTimerCount()).toBe(0)
		active.value = true
		await nextTick()
		expect(vi.getTimerCount()).toBe(1)
		await vi.advanceTimersByTimeAsync(59_999)
		expect(now.value.getTime()).toBe(initial.getTime())
		await vi.advanceTimersByTimeAsync(1)
		expect(now.value.getTime() - initial.getTime()).toBe(60_000)
		visible.value = false
		await nextTick()
		expect(vi.getTimerCount()).toBe(0)
		await vi.advanceTimersByTimeAsync(120_000)
		expect(now.value.getTime() - initial.getTime()).toBe(60_000)
		visible.value = true
		await nextTick()
		expect(now.value.getTime() - initial.getTime()).toBe(180_000)
		expect(vi.getTimerCount()).toBe(1)
		active.value = false
		await nextTick()
		expect(vi.getTimerCount()).toBe(0)
		active.value = true
		await nextTick()
		scope.stop()
		expect(vi.getTimerCount()).toBe(0)
	})
})
