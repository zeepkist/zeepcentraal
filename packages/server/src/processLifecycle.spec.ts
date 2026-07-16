import { describe, expect, test } from 'bun:test'
import { EventEmitter } from 'node:events'
import { type ClusterWorkerLike, onceAsync, stopClusterWorkers } from './processLifecycle'

class FakeWorker extends EventEmitter implements ClusterWorkerLike {
	dead = false
	signals: NodeJS.Signals[] = []
	process = {
		kill: (signal: NodeJS.Signals) => {
			this.signals.push(signal)
			return true
		},
	}

	isDead() {
		return this.dead
	}

	exit() {
		this.dead = true
		this.emit('exit')
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

describe('stopClusterWorkers', () => {
	test('waits for every worker to exit', async () => {
		const workers = [new FakeWorker(), new FakeWorker()]
		const stopping = stopClusterWorkers(workers, 'SIGINT', 100)

		workers[0]?.exit()
		workers[1]?.exit()

		expect(await stopping).toBe(true)
		expect(workers[0]?.signals).toEqual(['SIGINT'])
		expect(workers[1]?.signals).toEqual(['SIGINT'])
	})

	test('force kills workers after shutdown timeout', async () => {
		const worker = new FakeWorker()

		expect(await stopClusterWorkers([worker], 'SIGTERM', 1)).toBe(false)
		expect(worker.signals).toEqual(['SIGTERM', 'SIGKILL'])
	})
})
