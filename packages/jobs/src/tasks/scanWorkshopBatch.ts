import { releaseLevelRequest } from '@zeepkist/database/services/workshop'
import { createWorkshopRetryJobs, formatWorkshopFailure } from '../utils/createWorkshopRetryJobs'
import { getWorkshopScanner } from '../workshopScanner'
import type { TaskHandler } from './types'

type Payload = {
	workshopIds: string[]
}

export const scanWorkshopBatch: TaskHandler<Payload> = async (payload, helpers) => {
	const workshopIds = payload.workshopIds.map(BigInt)
	const batch = await getWorkshopScanner().scanWorkshopItems(workshopIds, 10)

	const levelIds = new Set<number>()
	for (const result of batch.results) {
		await releaseLevelRequest(result.workshopId)
		for (const idLevel of result.changedLevelIds) {
			levelIds.add(idLevel)
		}
	}
	await helpers.addJobs(
		[...levelIds].map((idLevel) => ({
			identifier: 'updateLevelScore',
			payload: { idLevel },
			jobKey: `update-level-score:${idLevel}`,
		})),
	)

	if (batch.transientFailures.length > 0) {
		for (const failure of batch.transientFailures) {
			helpers.logger.warn(
				`scanWorkshopBatch isolated transient workshopId=${failure.workshopId}: ${formatWorkshopFailure(failure.error)}`,
			)
		}
		await helpers.addJobs(
			createWorkshopRetryJobs(batch.transientFailures.map((failure) => failure.workshopId)),
		)
	}
	helpers.logger.info(
		`scanWorkshopBatch completed ${batch.results.length} items, queued ${levelIds.size} scores and ${batch.transientFailures.length} isolated retries.`,
	)
}
