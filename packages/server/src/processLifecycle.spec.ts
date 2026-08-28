import { describe, expect, test } from 'bun:test'
import { EventEmitter } from 'node:events'
import { Elysia } from 'elysia'
import {
	type ClusterWorkerLike,
	completesWithin,
	onceAsync,
	stopClusterWorkers,
} from './processLifecycle'

class FakeWorker extends EventEmitter implements ClusterWorkerLike {
	dead = false
	signals: NodeJS.Signals[] = []

	kill(signal: NodeJS.Signals = 'SIGTERM') {
		this.signals.push(signal)
	}

	exit() {
		this.dead = true
		this.emit('exit')
	}

	isDead() {
		return this.dead
	}
}

describe('onceAsync', () => {
	test('runs shutdown once when multiple signals arrive', async () => {
		let calls = 0
		const shutdown = onceAsync(async () => {
			calls++
			await Promise.resolve()
		})

		await Promise.all([shutdown('SIGINT'), shutdown('SIGINT')])

		expect(calls).toBe(1)
	})
})

describe('completesWithin', () => {
	test('reports completion and timeout', async () => {
		expect(await completesWithin(Promise.resolve(), 100)).toBe(true)
		expect(await completesWithin(new Promise(() => {}), 1)).toBe(false)
	})

	test('preserves cleanup failures', async () => {
		expect(completesWithin(Promise.reject(new Error('cleanup failed')), 100)).rejects.toThrow(
			'cleanup failed',
		)
	})
})

describe('stopClusterWorkers', () => {
	test('waits for every worker to exit', async () => {
		const workers = [new FakeWorker(), new FakeWorker()]
		const stopping = stopClusterWorkers(workers, 'SIGINT', 100)

		workers[0]?.exit()
		workers[1]?.exit()

		expect(await stopping).toBe(true)
		expect(workers[0]?.signals).toEqual(['SIGINT'])
		expect(workers[1]?.signals).toEqual(['SIGINT'])
		expect(workers[0]?.listenerCount('exit')).toBe(0)
		expect(workers[1]?.listenerCount('exit')).toBe(0)
	})

	test('force kills workers after shutdown timeout', async () => {
		const worker = new FakeWorker()

		expect(await stopClusterWorkers([worker], 'SIGTERM', 1)).toBe(false)
		expect(worker.signals).toEqual(['SIGTERM', 'SIGKILL'])
		expect(worker.listenerCount('exit')).toBe(0)
	})
})

test('force-stopped Elysia listener releases its port', async () => {
	const app = new Elysia().get('/', () => 'OK').listen({ hostname: '127.0.0.1', port: 0 })
	const port = app.server?.port
	if (!port) throw new Error('Server lifecycle test listener did not bind')

	await app.stop(true)
	const rebound = Bun.serve({
		hostname: '127.0.0.1',
		port,
		fetch: () => new Response('OK'),
	})
	try {
		expect(rebound.port).toBe(port)
	} finally {
		await rebound.stop(true)
	}
})
