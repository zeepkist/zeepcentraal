import { expect, mock, test } from 'bun:test'

const updateLevelScoreBatch = mock(async () => ({ reported: 0, updated: 2, zeroed: 0 }))

mock.module('./levelScoreBatch', () => ({ updateLevelScoreBatch }))

const { updateLevelScoresBatch } = await import('./updateLevelScoresBatch')

test('bulk task persists scores without projecting contributions', async () => {
	const logger = { info: mock(() => {}), warn: mock(() => {}) }

	await updateLevelScoresBatch({ ids: [1, 2] }, { logger } as never)

	expect(updateLevelScoreBatch).toHaveBeenCalledWith({
		idLevels: [1, 2],
		logger,
		reportOnly: undefined,
		syncContributions: false,
	})
})
