import { describe, expect, test } from 'bun:test'
import { stopServerWithEscalation } from './processLifecycle'

describe('stopServerWithEscalation', () => {
	test('uses graceful shutdown when it completes before deadline', async () => {
		const calls: Array<boolean | undefined> = []
		const server = {
			stop(force?: boolean) {
				calls.push(force)
				return Promise.resolve()
			},
		}

		expect(await stopServerWithEscalation(server, 100, 100)).toBe('graceful')
		expect(calls).toEqual([undefined])
	})

	test('forces active transports after graceful deadline', async () => {
		const calls: Array<boolean | undefined> = []
		const server = {
			stop(force?: boolean) {
				calls.push(force)
				return force ? Promise.resolve() : new Promise<void>(() => {})
			},
		}

		expect(await stopServerWithEscalation(server, 1, 100)).toBe('forced')
		expect(calls).toEqual([undefined, true])
	})

	test('reports cleanup that remains stuck after forced closure', async () => {
		const calls: Array<boolean | undefined> = []
		const server = {
			stop(force?: boolean) {
				calls.push(force)
				return new Promise<void>(() => {})
			},
		}

		expect(await stopServerWithEscalation(server, 1, 1)).toBe('timed-out')
		expect(calls).toEqual([undefined, true])
	})

	test('preserves shutdown failures', async () => {
		const server = {
			stop() {
				return Promise.reject(new Error('shutdown failed'))
			},
		}

		expect(stopServerWithEscalation(server, 100, 100)).rejects.toThrow('shutdown failed')
	})
})
