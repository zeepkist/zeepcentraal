import { releaseLevelRequest } from '@zeepkist/database/services/workshop'
import { getWorkshopScanner } from '../workshopScanner'
import type { TaskHandler } from './types'

type Payload = {
	workshopId: string
}

export const scanWorkshopItem: TaskHandler<Payload> = async (payload, helpers) => {
	const workshopId = BigInt(payload.workshopId)
	const result = await getWorkshopScanner().scanWorkshopItem(workshopId)

	await releaseLevelRequest(workshopId)
	await helpers.addJobs(
		result.changedLevelIds.map((idLevel) => ({
			identifier: 'updateLevelScore',
			payload: { idLevel },
			jobKey: `update-level-score:${idLevel}`,
		})),
	)
	helpers.logger.info(
		`scanWorkshopItem completed for workshopId=${workshopId} (${result.status}, levels=${result.changedLevelIds.length}).`,
	)
}
