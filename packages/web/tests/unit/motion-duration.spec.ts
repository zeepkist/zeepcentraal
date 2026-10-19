import { usePreferredReducedMotion } from '@vueuse/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, onMounted, shallowRef } from 'vue'
import { useMotionDuration } from '../../app/composables/useMotionDuration'

vi.mock('@vueuse/core', () => ({ usePreferredReducedMotion: vi.fn() }))
vi.mock('vue', async (importOriginal) => ({
	...(await importOriginal<typeof import('vue')>()),
	onMounted: vi.fn(),
}))

describe('motion duration', () => {
	beforeEach(() => vi.clearAllMocks())

	it.each([150, 450, 500, 650])(
		'keeps %ims motion still until mount and follows live preference',
		(duration) => {
			const preference = shallowRef<'reduce' | 'no-preference'>('no-preference')
			vi.mocked(usePreferredReducedMotion).mockReturnValue(computed(() => preference.value))
			const actual = useMotionDuration(duration)
			expect(actual.value).toBe(0)
			vi.mocked(onMounted).mock.calls[0]?.[0]?.()
			expect(actual.value).toBe(duration)
			preference.value = 'reduce'
			expect(actual.value).toBe(0)
			preference.value = 'no-preference'
			expect(actual.value).toBe(duration)
		},
	)

	it('never enables movement when mounted with reduced motion', () => {
		const preference = shallowRef<'reduce' | 'no-preference'>('reduce')
		vi.mocked(usePreferredReducedMotion).mockReturnValue(computed(() => preference.value))
		const actual = useMotionDuration(500)
		expect(actual.value).toBe(0)
		vi.mocked(onMounted).mock.calls[0]?.[0]?.()
		expect(actual.value).toBe(0)
	})
})
