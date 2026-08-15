import type { WorkerUtils } from 'graphile-worker'
import { getPostgresErrorMetadata } from './postgresError'

export const DEAD_WORKER_POOL_LOCK_AGE_MS = 60_000
export const WORKER_POOL_RECOVERY_INTERVAL_MS = 30_000

export interface LockedWorkerPool {
	jobCount: number
	markerAlive: boolean
	oldestLockedAt: Date | string
	poolId: string
	queueCount: number
}

export const LOCKED_WORKER_POOLS_SQL = `
	WITH lock_owners AS (
		SELECT locked_by, locked_at, 1::integer AS job_count, 0::integer AS queue_count
		FROM graphile_worker._private_jobs
		WHERE locked_by IS NOT NULL
			AND locked_at IS NOT NULL
		UNION ALL
		SELECT locked_by, locked_at, 0::integer AS job_count, 1::integer AS queue_count
		FROM graphile_worker._private_job_queues
		WHERE locked_by IS NOT NULL
			AND locked_at IS NOT NULL
	), summarized AS (
		SELECT
			locked_by,
			MIN(locked_at) AS oldest_locked_at,
			SUM(job_count)::integer AS job_count,
			SUM(queue_count)::integer AS queue_count
		FROM lock_owners
		GROUP BY locked_by
	)
	SELECT
		summarized.locked_by AS "poolId",
		summarized.oldest_locked_at AS "oldestLockedAt",
		summarized.job_count AS "jobCount",
		summarized.queue_count AS "queueCount",
		EXISTS (
			SELECT 1
			FROM pg_locks AS marker
			WHERE marker.locktype = 'advisory'
				AND marker.granted = true
				AND marker.classid = $1::integer::oid
				AND marker.objid = hashtext(summarized.locked_by)::oid
				AND marker.objsubid = 2
		) AS "markerAlive"
	FROM summarized
	WHERE summarized.oldest_locked_at <=
		NOW() - ($2::double precision * INTERVAL '1 millisecond')
	ORDER BY summarized.locked_by
`

interface RecoveryLogger {
	error(message: string, metadata?: Record<string, unknown>): void
	info(message: string, metadata?: Record<string, unknown>): void
	warn(message: string, metadata?: Record<string, unknown>): void
}

interface WorkerPoolRecoveryOptions {
	forceUnlockWorkers: WorkerUtils['forceUnlockWorkers']
	getLockedPools: (minimumLockAgeMs?: number) => Promise<LockedWorkerPool[]>
	logger?: RecoveryLogger
	now?: () => number
}

export class WorkerPoolRecovery {
	private readonly confirmedDeadPools = new Set<string>()
	private readonly firstMissingMarkerObservation = new Set<string>()
	private sweepPromise: Promise<void> | null = null

	private readonly forceUnlockWorkers: WorkerUtils['forceUnlockWorkers']
	private readonly getLockedPools: WorkerPoolRecoveryOptions['getLockedPools']
	private readonly logger: RecoveryLogger
	private readonly now: () => number

	constructor({
		forceUnlockWorkers,
		getLockedPools,
		logger = console,
		now = Date.now,
	}: WorkerPoolRecoveryOptions) {
		this.forceUnlockWorkers = forceUnlockWorkers
		this.getLockedPools = getLockedPools
		this.logger = logger
		this.now = now
	}

	async recoverKnownDeadPool(poolId: string): Promise<void> {
		this.confirmedDeadPools.add(poolId)
		await this.sweep()
		if (this.confirmedDeadPools.has(poolId)) await this.sweep()
	}

	sweep(): Promise<void> {
		this.sweepPromise ??= this.performSweep().finally(() => {
			this.sweepPromise = null
		})
		return this.sweepPromise
	}

	private async performSweep(): Promise<void> {
		const allLockedPools = await this.getLockedPools(0)
		const summaryByPool = new Map(allLockedPools.map((pool) => [pool.poolId, pool]))

		for (const poolId of [...this.confirmedDeadPools]) {
			const recovered = await this.recoverPool(
				poolId,
				'cluster-exit',
				summaryByPool.get(poolId),
			)
			if (recovered) this.confirmedDeadPools.delete(poolId)
		}

		const stalePools = await this.getLockedPools(DEAD_WORKER_POOL_LOCK_AGE_MS)
		const missingNow = new Set<string>()
		for (const pool of stalePools) {
			if (pool.markerAlive || this.confirmedDeadPools.has(pool.poolId)) {
				this.firstMissingMarkerObservation.delete(pool.poolId)
				continue
			}

			missingNow.add(pool.poolId)
			if (!this.firstMissingMarkerObservation.has(pool.poolId)) {
				this.firstMissingMarkerObservation.add(pool.poolId)
				this.logger.warn('Graphile worker pool liveness marker missing.', {
					jobCount: pool.jobCount,
					lockAgeMs: this.lockAgeMs(pool.oldestLockedAt),
					poolId: pool.poolId,
					queueCount: pool.queueCount,
				})
				continue
			}

			const recovered = await this.recoverPool(pool.poolId, 'missing-marker', pool)
			if (recovered) {
				this.firstMissingMarkerObservation.delete(pool.poolId)
				missingNow.delete(pool.poolId)
			}
		}

		for (const poolId of this.firstMissingMarkerObservation) {
			if (!missingNow.has(poolId)) this.firstMissingMarkerObservation.delete(poolId)
		}
	}

	private async recoverPool(
		poolId: string,
		reason: 'cluster-exit' | 'missing-marker',
		summary?: LockedWorkerPool,
	): Promise<boolean> {
		try {
			await this.forceUnlockWorkers([poolId])
			this.logger.warn('Recovered dead Graphile worker pool locks.', {
				jobCount: summary?.jobCount ?? 0,
				lockAgeMs: summary ? this.lockAgeMs(summary.oldestLockedAt) : 0,
				poolId,
				queueCount: summary?.queueCount ?? 0,
				reason,
			})
			return true
		} catch (error) {
			this.logger.error('Dead Graphile worker pool lock recovery failed.', {
				poolId,
				postgres: getPostgresErrorMetadata(error),
				reason,
			})
			return false
		}
	}

	private lockAgeMs(lockedAt: Date | string): number {
		const timestamp = lockedAt instanceof Date ? lockedAt.getTime() : Date.parse(lockedAt)
		return Math.max(0, this.now() - timestamp)
	}
}
