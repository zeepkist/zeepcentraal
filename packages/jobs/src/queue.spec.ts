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
		})
		expect(call[2]).not.toHaveProperty('jobKeyMode')
	}
})

test('enqueue boundary keeps report-only level scoring separate', async () => {
	await enqueueCompatibleTask('updateLevelScore', { idLevel: 7, reportOnly: true })
	expect(addJob.mock.calls[0]?.[2]).toMatchObject({ jobKey: 'update-level-score-report:7' })
})
