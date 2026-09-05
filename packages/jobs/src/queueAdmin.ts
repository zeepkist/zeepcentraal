import { queueClient } from './pgmq'
import type { JobLane } from './queueTypes'
import { isTaskIdentifier, isValidTaskPayload, taskDefinitions } from './taskDefinitions'

/** Run only with producers/workers stopped for transfer and rollback. Never prints payloads. */
export async function runQueueAdmin(args: string[]) {
	const [command, laneArg, id] = args
	const sql = queueClient()
	try {
		if (command === 'status') {
			for (const lane of ['fast', 'bulk'] as const) {
				const [metrics] = await sql`SELECT * FROM pgmq.metrics(${`zeepcentraal_${lane}`})`
				console.info({ lane, ...metrics })
			}
		} else if (command === 'archive' || command === 'replay') {
			if (laneArg !== 'fast' && laneArg !== 'bulk')
				throw new Error('Specify fast or bulk lane')
			const lane: JobLane = laneArg
			const table = `pgmq.a_zeepcentraal_${lane}`
			if (command === 'archive') {
				console.info(
					await sql.unsafe(
						`SELECT msg_id::text,archived_at,message->>'task' AS task,message->>'failure' AS failure FROM ${table} ORDER BY msg_id DESC LIMIT 100`,
					),
				)
			} else {
				if (!id || !/^\d+$/.test(id)) throw new Error('Specify archived message ID')
				await sql.begin(async (tx) => {
					await tx`SELECT zc_jobs.lock_lane(${lane})`
					const [row] = await tx.unsafe(
						`SELECT message FROM ${table} WHERE msg_id=$1::bigint FOR UPDATE`,
						[id],
					)
					const message = row?.message as
						| { task: string; payload: unknown; jobKey?: string; lockGroup?: string }
						| undefined
					if (
						!message ||
						!isTaskIdentifier(message.task) ||
						!isValidTaskPayload(message.task, message.payload)
					)
						throw new Error('Archive is missing or invalid; repair payload offline')
					await tx`SELECT zc_jobs.enqueue(${lane},${message.task},${JSON.stringify(message.payload)}::text::jsonb,${message.jobKey ?? null},${message.lockGroup ?? null},${taskDefinitions[message.task].maxAttempts})`
					await tx.unsafe(`DELETE FROM ${table} WHERE msg_id=$1::bigint`, [id])
				})
				console.info('Archived job replayed.', { lane, id })
			}
		} else if (command === 'transfer' || command === 'rollback') {
			if (!args.includes('--offline'))
				throw new Error('Stop updater, producers and workers; then pass --offline')
			await sql.begin(async (tx) => {
				await tx`SELECT zc_jobs.lock_lane('bulk')`
				await tx`SELECT zc_jobs.lock_lane('fast')`
				if (command === 'transfer') {
					// Lock legacy tables against old producers and preserve exhausted rows in place.
					await tx`LOCK TABLE graphile_worker._private_jobs IN ACCESS EXCLUSIVE MODE`
					const jobs =
						await tx`SELECT j.id::text,t.identifier,j.payload,j.key,j.max_attempts-j.attempts AS remaining,j.run_at,q.queue_name
      FROM graphile_worker._private_jobs j JOIN graphile_worker._private_tasks t ON t.id=j.task_id
      LEFT JOIN graphile_worker._private_job_queues q ON q.id=j.job_queue_id
      WHERE j.attempts<j.max_attempts AND NOT EXISTS(SELECT 1 FROM zc_jobs.transfer x WHERE x.source_id=j.id)
      ORDER BY j.id`
					for (const job of jobs) {
						if (
							!isTaskIdentifier(job.identifier) ||
							!isValidTaskPayload(job.identifier, job.payload)
						)
							throw new Error(
								`Unsupported legacy job ID ${job.id}; transfer rolled back`,
							)
						const group = ['updateLevelScores', 'updatePlayerScores'].includes(
							job.identifier,
						)
							? 'global-scores'
							: job.queue_name
						// Source-specific keys avoid merging distinct legacy jobs or losing retry budgets.
						const [sent] =
							await tx`SELECT zc_jobs.enqueue('bulk',${job.identifier},${JSON.stringify(job.payload)}::text::jsonb,${`legacy:${job.id}`},${group ?? null},${job.remaining},${job.run_at})::text AS id`
						await tx`INSERT INTO zc_jobs.transfer(source_id,message_id) VALUES(${job.id}::bigint,${sent.id}::bigint)`
						await tx`DELETE FROM graphile_worker._private_jobs WHERE id=${job.id}::bigint`
					}
					console.info('Transferred legacy jobs.', { count: jobs.length })
				} else {
					for (const lane of ['bulk', 'fast'] as const) {
						const jobs = await tx.unsafe(
							`SELECT j.*,j.id::text AS id,q.vt FROM zc_jobs.job j JOIN pgmq.q_zeepcentraal_${lane} q ON q.msg_id=j.id WHERE j.lane=$1 ORDER BY j.id`,
							[lane],
						)
						for (const job of jobs) {
							// Expired attempts without budget remain archived rather than resurrected.
							const remaining = job.max_attempts - job.attempts
							if (remaining <= 0)
								throw new Error(
									'Exhausted in-flight job remains; start pgmq recovery before rollback',
								)
							await tx`SELECT graphile_worker.add_job(identifier=>${job.task},payload=>${JSON.stringify(job.payload)}::text::json,
        queue_name=>${job.task === 'updatePlayerScore' || job.task === 'updatePlayerScores' || job.task === 'updateLevelScores' ? 'player-score-writes' : job.lock_group},
        run_at=>${job.vt},max_attempts=>${remaining}::smallint,job_key=>${`pgmq:${lane}:${job.id}`})`
							await tx`SELECT pgmq.delete(${`zeepcentraal_${lane}`},${job.id}::bigint)`
							await tx`DELETE FROM zc_jobs.job WHERE lane=${lane} AND id=${job.id}::bigint`
						}
						console.info('Rolled back queue.', { lane, count: jobs.length })
					}
				}
			})
		} else
			throw new Error(
				'Usage: queue status | archive <lane> | replay <lane> <id> | transfer --offline | rollback --offline',
			)
	} finally {
		await sql.close()
	}
}
