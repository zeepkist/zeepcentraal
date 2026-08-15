import {
	DEFAULT_JOB_PRIORITY,
	LEVEL_SCORE_FINALIZER_PRIORITY,
	PRIORITY_JOB_PRIORITY,
} from '../priorities'
import { PLAYER_SCORE_QUEUE_NAME } from '../utils/playerScoreJobOptions'
import type { TaskHandler } from './types'
import type { LevelScoreFinalizationPayload } from './updateLevelScoresBarrier'

export const LEVEL_SCORE_MONITOR_QUEUE_NAME = 'level-score-run-monitor'
export const LEVEL_SCORE_MONITOR_MIN_DELAY_MS = 1_000
export const LEVEL_SCORE_MONITOR_RETRY_BUFFER_MS = 250

export const LEVEL_SCORE_RUN_JOBS_SQL = `
	SELECT
		job.id::text AS "id",
		job.attempts::integer AS "attempts",
		job.max_attempts::integer AS "maxAttempts",
		job.locked_at AS "lockedAt",
		job.run_at AS "runAt"
	FROM graphile_worker._private_jobs AS job
	INNER JOIN graphile_worker._private_tasks AS task
		ON task.id = job.task_id
	WHERE task.identifier = 'updateLevelScoresBatch'
		AND job.payload ->> 'runId' = $1
	ORDER BY job.id
`

export type LevelScoreRunJob = {
	attempts: number
	id: string
	lockedAt: Date | string | null
	maxAttempts: number
	runAt: Date | string
}

export type LevelScoreRunStatus = {
	failedJobIds: string[]
	nextRunAt: Date | null
	pendingCount: number
}

export type MonitorLevelScoreRunPayload = LevelScoreFinalizationPayload & {
	check: number
}

export function levelScoreMonitorJobKey(runId: string, check: number): string {
	return `monitor-level-score-run:${runId}:${check}`
}

export function summarizeLevelScoreRunJobs(jobs: LevelScoreRunJob[]): LevelScoreRunStatus {
	const failedJobIds: string[] = []
	let nextRunAt: Date | null = null
	let pendingCount = 0

	for (const job of jobs) {
		if (job.lockedAt === null && job.attempts >= job.maxAttempts) {
			failedJobIds.push(job.id)
			continue
		}

		pendingCount++
		const runAt = new Date(job.runAt)
		if (!Number.isNaN(runAt.getTime()) && (nextRunAt === null || runAt < nextRunAt)) {
			nextRunAt = runAt
		}
	}

	return { failedJobIds, nextRunAt, pendingCount }
}

export function getLevelScoreMonitorRunAt(nextRunAt: Date | null, now = Date.now()): Date {
	const minimum = now + LEVEL_SCORE_MONITOR_MIN_DELAY_MS
	const retry = nextRunAt ? nextRunAt.getTime() + LEVEL_SCORE_MONITOR_RETRY_BUFFER_MS : minimum
	return new Date(Math.max(minimum, retry))
}

export const monitorLevelScoreRun: TaskHandler<MonitorLevelScoreRunPayload> = async (
	payload,
	helpers,
) => {
	const result = await helpers.withPgClient((client) =>
		client.query<LevelScoreRunJob>(LEVEL_SCORE_RUN_JOBS_SQL, [payload.runId]),
	)
	const status = summarizeLevelScoreRunJobs(result.rows)

	if (status.failedJobIds.length > 0) {
		helpers.logger.error(
			`Level score run ${payload.runId} aborted: ${status.failedJobIds.length} batch jobs permanently failed; pending=${status.pendingCount}; failedJobIds=${status.failedJobIds.join(',')}.`,
			{
				failedJobIds: status.failedJobIds,
				pendingCount: status.pendingCount,
				runId: payload.runId,
			},
		)
		return
	}

	if (status.pendingCount > 0) {
		const nextCheck = payload.check + 1
		const runAt = getLevelScoreMonitorRunAt(status.nextRunAt)
		await helpers.addJob(
			'monitorLevelScoreRun',
			{ ...payload, check: nextCheck },
			{
				jobKey: levelScoreMonitorJobKey(payload.runId, nextCheck),
				priority: payload.all ? DEFAULT_JOB_PRIORITY : PRIORITY_JOB_PRIORITY,
				queueName: LEVEL_SCORE_MONITOR_QUEUE_NAME,
				runAt,
			},
		)
		helpers.logger.info(
			`Level score run ${payload.runId} waiting for ${status.pendingCount} batch jobs; failed=0; nextCheck=${runAt.toISOString()}.`,
			{
				nextCheck: runAt,
				pendingCount: status.pendingCount,
				runId: payload.runId,
			},
		)
		return
	}

	const { check: _, ...finalizationPayload } = payload
	await helpers.addJob('finalizeLevelScores', finalizationPayload, {
		jobKey: `finalize-level-scores:${payload.runId}`,
		jobKeyMode: 'unsafe_dedupe',
		priority: LEVEL_SCORE_FINALIZER_PRIORITY,
		queueName: PLAYER_SCORE_QUEUE_NAME,
	})
	helpers.logger.info(
		`Level score run ${payload.runId} completed all batches; pending=0 failed=0; queued contribution finalizer at priority ${LEVEL_SCORE_FINALIZER_PRIORITY}.`,
	)
}
