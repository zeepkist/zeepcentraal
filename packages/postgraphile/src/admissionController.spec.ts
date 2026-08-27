import { describe, expect, test } from 'bun:test'
import { AdmissionClosedError, createAdmissionController } from './admissionController'

describe('createAdmissionController', () => {
	test('bounds active and queued work and drains FIFO', async () => {
		const first = Promise.withResolvers<number>()
		const stats: Array<{ active: number; queued: number }> = []
		const admission = createAdmissionController(1, 1, (value) => stats.push(value))
		const firstResult = admission.admit(() => first.promise)
		const secondResult = admission.admit(async () => 2)

		expect(admission.admit(async () => 3)).toBeUndefined()
		expect(admission.stats()).toEqual({ active: 1, queued: 1 })
		first.resolve(1)
		expect(await firstResult).toBe(1)
		expect(await secondResult).toBe(2)
		expect(admission.stats()).toEqual({ active: 0, queued: 0 })
		expect(stats).toContainEqual({ active: 1, queued: 1 })
	})

	test('rejects queued work and waits for active work during disposal', async () => {
		const active = Promise.withResolvers<void>()
		const admission = createAdmissionController(1, 1)
		const activeResult = admission.admit(() => active.promise)
		const queuedResult = admission.admit(async () => undefined)
		const disposing = admission.dispose()
		let disposed = false
		void disposing.then(() => {
			disposed = true
		})

		await expect(queuedResult).rejects.toBeInstanceOf(AdmissionClosedError)
		expect(disposed).toBe(false)
		expect(admission.admit(async () => undefined)).toBeUndefined()
		active.resolve()
		await activeResult
		await disposing
		expect(disposed).toBe(true)
	})
})
