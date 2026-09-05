/** Destructive integration fixture. Only accepts an explicitly named pgmq_test database. */
import assert from 'node:assert/strict'
import { SQL } from 'bun'
import { wrapWorkerUtils } from '../src/jobTelemetry'
import { PgmqQueue } from '../src/pgmq'

const url = process.argv[2]
if (
	!url ||
	new URL(url).pathname !== '/pgmq_test' ||
	!['localhost', '127.0.0.1'].includes(new URL(url).hostname)
) {
	throw new Error(
		'Pass a localhost Postgres URL ending in /pgmq_test; fixture clears that database queue schema',
	)
}
function required<T>(value: T | undefined): T {
	assert.notEqual(value, undefined)
	return value as T
}
const sql = new SQL(url)
const fast = new PgmqQueue(sql, 'fast')
const bulk = new PgmqQueue(sql, 'bulk')
let passed = 0
async function check(name: string, test: () => Promise<void>) {
	await sql`TRUNCATE zc_jobs.job,pgmq.q_zeepcentraal_fast,pgmq.q_zeepcentraal_bulk,pgmq.a_zeepcentraal_fast,pgmq.a_zeepcentraal_bulk`
	await test()
	passed++
	console.info(`PASS ${name}`)
}
try {
	await sql.unsafe('DROP SCHEMA IF EXISTS zc_jobs CASCADE')
	// Existing pgmq queues are safe to reuse across fixture runs.
	const migration = await Bun.file(
		new URL('../../database/drizzle/0083_pgmq_queue.sql', import.meta.url),
	).text()
	for (const statement of migration.split('--> statement-breakpoint')) await sql.unsafe(statement)
	await fast.initialize()
	assert.equal(typeof (await wrapWorkerUtils(fast).metrics()).depth, 'number')
	await check('concurrent pending requests coalesce without losing FIFO position', async () => {
		const jobs = await Promise.all(
			Array.from({ length: 20 }, (_, i) =>
				fast.addJob(
					'updateLevelScore',
					{ idLevel: 7, idUser: i + 1 },
					{ jobKey: 'level:7' },
				),
			),
		)
		assert.equal(new Set(jobs.map((job) => job.id)).size, 1)
		const latest = await fast.addJob(
			'updateLevelScore',
			{ idLevel: 7, idUser: 99 },
			{ jobKey: 'level:7' },
		)
		assert.equal(latest.id, required(jobs[0]).id)
		const [job] = await fast.claim(4)
		assert.deepEqual(required(job).payload, { idLevel: 7, idUser: 99 })
		assert.equal(await fast.finish(required(job)), true)
		assert.equal((await fast.claim(4)).length, 0)
	})
	await check('running request creates exactly one latest follow-up', async () => {
		await fast.addJob('updateLevelScore', { idLevel: 7 }, { jobKey: 'level:7' })
		const [first] = await fast.claim(1)
		const following = await Promise.all(
			Array.from({ length: 10 }, (_, i) =>
				fast.addJob(
					'updateLevelScore',
					{ idLevel: 7, idUser: i + 1 },
					{ jobKey: 'level:7' },
				),
			),
		)
		assert.equal(new Set(following.map((job) => job.id)).size, 1)
		assert.notEqual(required(following[0]).id, required(first).id)
		assert.equal((await fast.claim(4)).length, 0)
		await fast.finish(required(first))
		await sql`UPDATE pgmq.q_zeepcentraal_fast SET vt=now()`
		const next = await fast.claim(4)
		assert.equal(next.length, 1)
	})
	await check('bulk backlog and shared keys do not consume fast capacity', async () => {
		await bulk.addJobs(
			Array.from({ length: 100 }, (_, i) => ({
				identifier: 'updateLevelScore',
				payload: { idLevel: i + 1 },
				jobKey: `level:${i}`,
			})),
		)
		const running = await bulk.claim(14)
		assert.equal(running.length, 14)
		await fast.addJob('updateLevelScore', { idLevel: 1 }, { jobKey: 'level:0' })
		assert.equal((await fast.claim(4)).length, 1)
	})
	await check('claim exclusion and crash recovery fence stale acknowledgements', async () => {
		await fast.addJob('updatePlayerScore', { idUser: 1 })
		const claims = await Promise.all([fast.claim(1), fast.claim(1)])
		assert.equal(claims.flat().length, 1)
		const stale = required(claims.flat()[0])
		assert.equal(await fast.heartbeat(stale), true)
		await sql`UPDATE zc_jobs.job SET lease_until=now()-interval '1 second'`
		await sql`UPDATE pgmq.q_zeepcentraal_fast SET vt=now()-interval '1 second'`
		const [recovered] = await fast.claim(1)
		assert.equal(required(recovered).attempts, 2)
		assert.notEqual(required(recovered).generation, stale.generation)
		assert.equal(await fast.finish(stale), false)
		assert.equal(await fast.heartbeat(stale), false)
		assert.equal(await fast.finish(required(recovered)), true)
	})
	await check('retry delay, unrelated progress and exhausted archive', async () => {
		await fast.addJob('updatePlayerScore', { idUser: 1 }, { maxAttempts: 2 })
		const [first] = await fast.claim(1)
		await fast.finish(required(first), 'handler_failed')
		assert.equal((await fast.claim(1)).length, 0)
		await fast.addJob('updatePlayerScore', { idUser: 2 })
		assert.deepEqual((await fast.claim(1))[0]?.payload, { idUser: 2 })
		await sql`UPDATE pgmq.q_zeepcentraal_fast SET vt=now() WHERE msg_id=${required(first).id}::bigint`
		const [retry] = await fast.claim(1)
		assert.equal(required(retry).attempts, 2)
		await fast.finish(required(retry), 'handler_failed')
		const [archived] = await sql`SELECT message FROM pgmq.a_zeepcentraal_fast`
		assert.equal(archived.message.failure, 'attempts_exhausted')
		assert.deepEqual(archived.message.payload, { idUser: 1 })
	})
	await check('oldest eligible FIFO with concurrent completion', async () => {
		const jobs = await fast.addJobs(
			[1, 2, 3].map((idUser) => ({ identifier: 'updatePlayerScore', payload: { idUser } })),
		)
		const claims = await fast.claim(2)
		assert.deepEqual(
			claims.map((job) => job.id),
			jobs.slice(0, 2).map((job) => job.id),
		)
		await fast.finish(required(claims[1]))
		assert.equal(required((await fast.claim(1))[0]).id, required(jobs[2]).id)
	})
	await check('bulk conflict group excludes peers but permits independent tasks', async () => {
		await bulk.addJob('updatePlayerScores', {})
		const [first] = await bulk.claim(1)
		await bulk.addJob('updateLevelScores', { all: true })
		await bulk.addJob('updateUserPointsHistory', {})
		const jobs = await bulk.claim(14)
		assert.equal(jobs.length, 1)
		assert.equal(required(jobs[0]).task, 'updateUserPointsHistory')
		await bulk.finish(required(first))
	})
	await check('invalid messages archive without handler execution', async () => {
		await sql`SELECT zc_jobs.enqueue('fast','unknown','{}'::jsonb)`
		const [job] = await fast.claim(1)
		await fast.finish(required(job), 'invalid_job')
		const [row] = await sql`SELECT message->>'failure' AS reason FROM pgmq.a_zeepcentraal_fast`
		assert.equal(row.reason, 'invalid_job')
	})
	await check('busy groups do not hide independent jobs behind a deep backlog', async () => {
		await bulk.addJob('updatePlayerScores', {})
		await bulk.claim(1)
		await bulk.addJobs(
			Array.from({ length: 1000 }, (_, i) => ({
				identifier: 'updatePlayerScore',
				payload: { idUser: i + 1 },
			})),
		)
		await bulk.addJob('updateUserPointsHistory', {})
		assert.equal(required((await bulk.claim(1))[0]).task, 'updateUserPointsHistory')
	})
	await check(
		'future jobs remain delayed and message IDs preserve bigint precision',
		async () => {
			await sql`SELECT setval('pgmq.q_zeepcentraal_fast_msg_id_seq',9007199254740993,false)`
			const later = await fast.addJob(
				'updatePlayerScore',
				{ idUser: 1 },
				{ runAt: new Date(Date.now() + 60_000) },
			)
			assert.equal(later.id, '9007199254740993')
			assert.equal((await fast.claim(1)).length, 0)
			const now = await fast.addJob('updatePlayerScore', { idUser: 2 })
			assert.equal(required((await fast.claim(1))[0]).id, now.id)
		},
	)

	console.info(`${passed} pgmq integration scenarios passed`)
} finally {
	await sql.close()
}
