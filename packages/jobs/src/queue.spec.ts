import { beforeEach, expect, mock, test } from 'bun:test'

const addJob = mock(async (..._args: unknown[]) => {})
const release = mock(async () => {})
const createQueueWorkerUtils = mock(async () => ({ addJob, release }))
const createQueueWorkerUtilsOptions = (config: { databaseUrl: string; queuePoolMax: number }) => ({
	connectionString: config.databaseUrl,
	maxPoolSize: config.queuePoolMax,
})

mock.module('./workerUtils', () => ({ createQueueWorkerUtils, createQueueWorkerUtilsOptions }))

const { closeQueue, enqueueCompatibleTask } = await import('./queue')

beforeEach(async () => {
	await closeQueue()
	addJob.mockClear()
	release.mockClear()
	createQueueWorkerUtils.mockClear()
})

test('queue boundary deduplicates persistent level scoring by level', async () => {
	await enqueueCompatibleTask('updateLevelScore', { idLevel: 7, idUser: 42 })
	await enqueueCompatibleTask('updateLevelScore', { idLevel: 7, idUser: 99 })

	expect(addJob).toHaveBeenCalledTimes(2)
	for (const call of addJob.mock.calls) {
		expect(call[2]).toMatchObject({
			jobKey: 'update-level-score:7',
			maxAttempts: 3,
			priority: 5,
			queueName: 'level-score-writes:3',
		})
		expect(call[2]).not.toHaveProperty('jobKeyMode')
	}
})

test('enqueue boundary keeps report-only level scoring separate', async () => {
	await enqueueCompatibleTask('updateLevelScore', { idLevel: 7, reportOnly: true })
	expect(addJob.mock.calls[0]?.[2]).toMatchObject({ jobKey: 'update-level-score-report:7' })
	expect(addJob.mock.calls[0]?.[2]).not.toHaveProperty('queueName')
})

test('queue boundary serializes bulk score writers under distinct keys', async () => {
	await enqueueCompatibleTask('updateLevelScores', { all: true })
	await enqueueCompatibleTask('updateLevelScores', { all: false })

	expect(addJob.mock.calls[0]?.[2]).toMatchObject({
		jobKey: 'update-level-scores:full',
		queueName: 'player-score-writes',
	})
	expect(addJob.mock.calls[1]?.[2]).toMatchObject({
		jobKey: 'update-level-scores:incremental',
		queueName: 'player-score-writes',
	})
})

test('queue boundary exposes tournament lobby asset preparation with retry policy', async () => {
	await enqueueCompatibleTask('prepareTrackTournamentLobbyAsset', { idTournament: 42 })

	expect(addJob).toHaveBeenCalledWith(
		'prepareTrackTournamentLobbyAsset',
		{ idTournament: 42 },
		{ maxAttempts: 5, priority: 5 },
	)
})

test('queue boundary keeps manual points-history pruning low priority and serialized', async () => {
	await enqueueCompatibleTask('prunePointsHistory', {})

	expect(addJob).toHaveBeenCalledWith(
		'prunePointsHistory',
		{},
		{
			maxAttempts: 3,
			priority: 100,
			queueName: 'points-history-pruning',
		},
	)
})
