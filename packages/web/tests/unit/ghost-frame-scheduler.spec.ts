import { describe, expect, it, vi } from 'vitest'
import { GhostFrameScheduler } from '../../app/utils/ghostFrameScheduler'

describe('ghost frame scheduler', () => {
	it('coalesces invalidations into one pending animation frame', () => {
		let callback: FrameRequestCallback | null = null
		const request = vi.fn((next: FrameRequestCallback) => {
			callback = next
			return 7
		})
		const render = vi.fn()
		const scheduler = new GhostFrameScheduler(request, vi.fn(), render)

		scheduler.request()
		scheduler.request()
		expect(request).toHaveBeenCalledTimes(1)
		expect(scheduler.pending).toBe(true)

		if (!callback) throw new Error('Expected scheduled callback')
		callback(123)
		expect(render).toHaveBeenCalledWith(123)
		expect(scheduler.pending).toBe(false)
	})

	it('cancels pending work and can schedule again', () => {
		const cancel = vi.fn()
		const request = vi.fn(() => 11)
		const scheduler = new GhostFrameScheduler(request, cancel, vi.fn())

		scheduler.request()
		scheduler.cancel()
		scheduler.request()

		expect(cancel).toHaveBeenCalledWith(11)
		expect(request).toHaveBeenCalledTimes(2)
	})
})
