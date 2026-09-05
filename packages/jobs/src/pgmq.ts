import { jobsConfig } from '@zeepkist/core/config/jobs'
import { createSqlClient } from '@zeepkist/core/sql'
import type { SQL } from 'bun'
import type { AddJobsJobSpec, Job, JobLane, TaskSpec, WorkerUtils } from './queueTypes'
import { isTaskIdentifier, isValidTaskPayload, taskDefinitions } from './taskDefinitions'
import { JOB_VISIBILITY_SECONDS } from './workerOptions'

export interface ClaimedJob {
	attempts: number
	generation: string
	id: string
	lane: JobLane
	max_attempts: number
	payload: unknown
	task: string
}
export function queueClient() {
	return createSqlClient(jobsConfig.databaseUrl, {
		max: jobsConfig.queuePoolMax,
		idleTimeout: 30,
		connectionTimeout: 5,
		connection: { application_name: 'zeepcentraal-pgmq', statement_timeout: 10000 },
	})
}
export function lockGroup(task: string, lane: JobLane, spec: TaskSpec) {
	if (lane === 'fast') return null
	if (
		task === 'updateLevelScores' ||
		task === 'updatePlayerScores' ||
		task === 'updatePlayerScore'
	)
		return 'global-scores'
	return spec.queueName ?? null
}
export class PgmqQueue implements WorkerUtils {
	constructor(
		private readonly sql: SQL,
		readonly lane: JobLane = 'bulk',
	) {}
	async initialize() {
		const [row] = await this.sql`SELECT extversion FROM pg_extension WHERE extname='pgmq'`
		if (row?.extversion !== '1.12.0') throw new Error('pgmq 1.12.0 migration required')
		await this
			.sql`SELECT 'zc_jobs.job'::regclass, 'zc_jobs.claim(text,integer,integer)'::regprocedure`
	}
	async addJob(identifier: string, payload: unknown = {}, spec: TaskSpec = {}): Promise<Job> {
		const [job] = await this.addJobs([{ ...spec, identifier, payload }])
		if (!job) throw new Error('Queue did not return a job')
		return job
	}
	async addJobs(specs: readonly AddJobsJobSpec[]): Promise<Job[]> {
		const rows = specs.map((spec) => {
			if (
				!isTaskIdentifier(spec.identifier) ||
				!isValidTaskPayload(spec.identifier, spec.payload ?? {})
			) {
				throw new Error(`Invalid queued task: ${spec.identifier}`)
			}
			const lane = spec.lane ?? this.lane
			const max = spec.maxAttempts ?? taskDefinitions[spec.identifier].maxAttempts
			if (!Number.isInteger(max) || max < 1) throw new Error('Invalid job attempt limit')
			return {
				lane,
				task: spec.identifier,
				payload: spec.payload ?? {},
				key: spec.jobKey ?? null,
				group: lockGroup(spec.identifier, lane, spec),
				max,
				run_at: spec.runAt?.toISOString() ?? null,
			}
		})
		if (!rows.length) return []
		// One round trip per batch. Stable lane ordering prevents mixed-lane deadlocks.
		return this.sql.begin(async (tx) => {
			for (const lane of [...new Set(rows.map((row) => row.lane))].sort()) {
				await tx`SELECT zc_jobs.lock_lane(${lane})`
			}
			const result =
				await tx`SELECT zc_jobs.enqueue(r.lane,r.task,r.payload,r.key,r."group",r.max,COALESCE(r.run_at,clock_timestamp()))::text AS id,
    r.task AS task_identifier, 0 AS attempts, r.max AS max_attempts
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::text::jsonb)
     AS r(lane text,task text,payload jsonb,key text,"group" text,max integer,run_at timestamptz)`
			return result.map((row: Job) => ({ ...row, id: String(row.id) }))
		})
	}
	async claim(count: number): Promise<ClaimedJob[]> {
		const rows = await this
			.sql`SELECT lane,id::text,task,payload,attempts,max_attempts,generation::text FROM zc_jobs.claim(${this.lane},${count},${JOB_VISIBILITY_SECONDS})`
		return rows.map((row: ClaimedJob) => ({
			...row,
			id: String(row.id),
			generation: String(row.generation),
		}))
	}
	async heartbeat(job: ClaimedJob): Promise<boolean> {
		const [row] = await this
			.sql`SELECT zc_jobs.heartbeat(${job.lane},${job.id}::bigint,${job.generation}::bigint,${JOB_VISIBILITY_SECONDS}) AS ok`
		return row?.ok === true
	}
	async finish(job: ClaimedJob, failure: string | null = null): Promise<boolean> {
		const [row] = await this
			.sql`SELECT zc_jobs.finish(${job.lane},${job.id}::bigint,${job.generation}::bigint,${failure}) AS ok`
		return row?.ok === true
	}
	async metrics() {
		const [queue] = await this.sql`SELECT * FROM pgmq.metrics(${`zeepcentraal_${this.lane}`})`
		const [archive] = await this.sql.unsafe(
			`SELECT count(*)::integer AS count FROM pgmq.a_zeepcentraal_${this.lane}`,
		)
		return {
			depth: Number(queue?.queue_length ?? 0),
			oldestAge: Number(queue?.oldest_msg_age_sec ?? 0),
			archived: Number(archive?.count ?? 0),
		}
	}

	async release() {
		await this.sql.close({ timeout: 5 })
	}
}
