/** Requires the disposable sql_test schema bootstrapped by verifyBunSql.ts. */
import assert from 'node:assert/strict'
import { SQL } from 'bun'

const url = process.argv[2]
if (
	!url ||
	new URL(url).pathname !== '/sql_test' ||
	!['localhost', '127.0.0.1'].includes(new URL(url).hostname)
)
	throw new Error('Use disposable localhost sql_test database')
process.env.DATABASE_URL = url
process.env.NODE_ENV = 'test'
const native = new SQL(url)
const { closeDatabase } = await import('../client')
const { persistUserPointScore } = await import('../services/userPointContribution')
const { resetInactiveUserScores } = await import('../services/userPoints')
const { submitRecord } = await import('../services/record')
const userId = 900001
const levelId = 900001
try {
	await native`DELETE FROM "user" WHERE id IN (900001,900002)`
	await native`DELETE FROM level WHERE id=900001`
	await native`INSERT INTO "user"(id) OVERRIDING SYSTEM VALUE VALUES(900001),(900002)`
	await native`INSERT INTO level(id,hash,xx_hash) OVERRIDING SYSTEM VALUE VALUES(900001,'pgmq-score-fixture','pgmq-score-fixture')`
	const [record] =
		await native`INSERT INTO record(id_user,id_level,time,game_version,mod_version,date_created)
  VALUES(${userId},${levelId},60,'test','test',now()-interval '1 year') RETURNING id`
	await native`INSERT INTO user_points(id_user,points,total_points) VALUES(${userId},100,100)`
	await native`INSERT INTO user_point_contribution(id_user,id_level,id_record,contribution_rank,level_position,level_points,level_decayed_points,player_decayed_points)
  VALUES(${userId},${levelId},${record.id},1,1,100,100,100)`
	const snapshot = {
		idUser: userId,
		points: 100,
		totalPoints: 100,
		contributions: [
			{
				idLevel: levelId,
				idRecord: record.id,
				contributionRank: 1,
				levelPosition: 1,
				levelPoints: 100,
				levelDecayedPoints: 100,
				playerDecayedPoints: 100,
			},
		],
	}
	const acquired = Promise.withResolvers<void>()
	const release = Promise.withResolvers<void>()
	const projection = native.begin(async (tx) => {
		await tx`SELECT pg_advisory_xact_lock(-1861284952,${userId})`
		acquired.resolve()
		await release.promise
		await tx`UPDATE user_point_contribution SET level_points=200,level_decayed_points=200 WHERE id_user=${userId}`
	})
	await acquired.promise
	let finished = false
	const stale = persistUserPointScore(snapshot).then((value) => {
		finished = true
		return value
	})
	try {
		assert.equal(
			await persistUserPointScore({
				idUser: 900002,
				points: 0,
				totalPoints: 0,
				contributions: [],
			}),
			true,
		)
		assert.equal(finished, false, 'unrelated user progresses while same-user persistence waits')
	} finally {
		release.resolve()
	}
	await projection
	assert.equal(await stale, false, 'changed contribution snapshot must reject stale aggregate')
	const [points] = await native`SELECT points FROM user_points WHERE id_user=${userId}`
	assert.equal(points.points, 100)
	console.info('PASS shared user lock rejects stale snapshot and permits unrelated fast work')
	const gate = Promise.withResolvers<void>()
	const locked = Promise.withResolvers<void>()
	const submission = native.begin(async (tx) => {
		await tx`SELECT pg_advisory_xact_lock(-1861284952,${userId})`
		locked.resolve()
		await gate.promise
		await tx`INSERT INTO record(id_user,id_level,time,game_version,mod_version) VALUES(${userId},${levelId},59,'test','test')`
	})
	await locked.promise
	const reset = resetInactiveUserScores([userId])
	gate.resolve()
	await submission
	await reset
	const [after] = await native`SELECT points FROM user_points WHERE id_user=${userId}`
	assert.equal(after.points, 100, 'inactive reset must recheck a concurrently submitted record')
	console.info('PASS inactive reset rechecks activity under shared transaction lock')
	await Promise.all([
		submitRecord({
			idUser: userId,
			idLevel: levelId,
			time: 58,
			gameVersion: 'test',
			modVersion: 'test',
		}),
		resetInactiveUserScores([userId]),
	])
	console.info('PASS real record submission and inactive reset complete without lock inversion')
} finally {
	await closeDatabase()
	await native`DELETE FROM "user" WHERE id IN (900001,900002)`
	await native`DELETE FROM level WHERE id=900001`
	await native.close()
}
