import { getPendingLevelRequests } from '@zeepkist/database/services/workshop'
import { WORKSHOP_JOB_PRIORITY } from '../priorities'
import type { TaskHandler } from './types'

const PAGE_SIZE = 1_000

export const recoverLevelRequests: TaskHandler<Record<string, never>> = async (
	_payload,
	helpers,
) => {
	let afterId = 0
	let queued = 0

	for (;;) {
		const requests = await getPendingLevelRequests({ afterId, limit: PAGE_SIZE })
		if (requests.length === 0) break

		await helpers.addJobs(
			requests.map(({ workshopId }) => ({
				identifier: 'scanWorkshopItem',
				payload: { workshopId: workshopId.toString() },
				priority: WORKSHOP_JOB_PRIORITY,
				maxAttempts: 5,
				jobKey: `scan-workshop-item:${workshopId}`,
			})),
		)
		queued += requests.length
		afterId = requests.at(-1)?.id ?? afterId
		if (requests.length < PAGE_SIZE) break
	}

	helpers.logger.info(`recoverLevelRequests queued ${queued} pending workshop scans.`)
}
