import { expect, mock, test } from 'bun:test'
import {
	DEAD_WORKER_POOL_LOCK_AGE_MS,
	LOCKED_WORKER_POOLS_SQL,
	type LockedWorkerPool,
	WorkerPoolRecovery,
} from './workerPoolRecovery'

const stalePool: LockedWorkerPool = {
	jobCount: 3,
	markerAlive: false,
	oldestLockedAt: '2026-08-15T16:00:00.000Z',
	poolId: 'pool-dead',
	queueCount: 1,
}

function createLogger() {
	return {
		error: mock(() => {}),
		info: mock(() => {}),
		warn: mock(() => {}),
	}
}

test('requires two stale missing-marker observations before force unlock', async () => {
	const forceUnlockWorkers = mock(async (_poolIds: string[]) => {})
	const getLockedPools = mock(async (_minimumAgeMs?: number) => [stalePool])
	const recovery = new WorkerPoolRecovery({
		forceUnlockWorkers,
		getLockedPools,
		logger: createLogger(),
		now: () => Date.parse('2026-08-15T16:05:00.000Z'),
	})

	await recovery.sweep()
	expect(forceUnlockWorkers).not.toHaveBeenCalled()
	await recovery.sweep()
	expect(forceUnlockWorkers).toHaveBeenCalledTimes(1)
	expect(forceUnlockWorkers).toHaveBeenCalledWith(['pool-dead'])
})

test('does not recover live or young worker pools', async () => {
	const forceUnlockWorkers = mock(async (_poolIds: string[]) => {})
	const livePool = { ...stalePool, markerAlive: true, poolId: 'pool-live' }
	const getLockedPools = mock(async (minimumAgeMs?: number) =>
		minimumAgeMs === DEAD_WORKER_POOL_LOCK_AGE_MS ? [livePool] : [livePool, stalePool],
	)
	const recovery = new WorkerPoolRecovery({
		forceUnlockWorkers,
		getLockedPools,
		logger: createLogger(),
	})

	await recovery.sweep()
	await recovery.sweep()
	expect(forceUnlockWorkers).not.toHaveBeenCalled()
})

test('known child death force unlocks immediately and retries failures', async () => {
	let attempts = 0
	const forceUnlockWorkers = mock(async () => {
		attempts++
		if (attempts === 1)
			throw Object.assign(new Error('database unavailable'), { code: '08006' })
	})
	const recovery = new WorkerPoolRecovery({
		forceUnlockWorkers,
		getLockedPools: mock(async () => []),
		logger: createLogger(),
	})

	await recovery.recoverKnownDeadPool('pool-crashed')
	expect(forceUnlockWorkers).toHaveBeenCalledTimes(2)
	await recovery.sweep()
	expect(forceUnlockWorkers).toHaveBeenCalledTimes(2)
	expect(forceUnlockWorkers).toHaveBeenLastCalledWith(['pool-crashed'])
})

test('recovery query checks advisory markers and never rewrites attempts', () => {
	expect(LOCKED_WORKER_POOLS_SQL).toContain("marker.locktype = 'advisory'")
	expect(LOCKED_WORKER_POOLS_SQL).toContain('marker.objsubid = 2')
	expect(LOCKED_WORKER_POOLS_SQL).toContain('graphile_worker._private_jobs')
	expect(LOCKED_WORKER_POOLS_SQL).toContain('graphile_worker._private_job_queues')
	expect(LOCKED_WORKER_POOLS_SQL).not.toContain('SET attempts')
})
