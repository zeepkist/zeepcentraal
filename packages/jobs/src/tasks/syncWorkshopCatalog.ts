import { getWorkshopUpdateTimes } from '@zeepkist/database/services/workshop'
import { WORKSHOP_JOB_PRIORITY } from '../priorities'
import { batchProcess } from '../utils'
import { getWorkshopMetadata } from '../workshopScanner'
import type { TaskHandler } from './types'

interface SyncWorkshopCatalogPayload {
	all?: boolean
}

export const syncWorkshopCatalog: TaskHandler<SyncWorkshopCatalogPayload> = async (
	payload,
	helpers,
) => {
	const forceAll = payload.all === true
	const storedUpdates = await getWorkshopUpdateTimes()
	const metadata = getWorkshopMetadata()
	const seen = new Set<bigint>()
	const queue = new Set<bigint>()
	let cursor: string | undefined
	let pages = 0

	do {
		const page = await metadata.listItems(cursor)
		pages++
		for (const item of page.items) {
			seen.add(item.workshopId)
			const storedUpdate = storedUpdates.get(item.workshopId)
			if (
				forceAll ||
				!storedUpdate ||
				new Date(item.updatedAt).getTime() > new Date(storedUpdate).getTime()
			) {
				queue.add(item.workshopId)
			}
		}
		console.info(
			`syncWorkshopCatalog page ${pages} processed: ${page.items.length} items, ${seen.size} seen, ${queue.size} queued.`,
		)
		cursor = page.nextCursor
	} while (cursor)

	for (const workshopId of storedUpdates.keys()) {
		if (!seen.has(workshopId)) {
			queue.add(workshopId)
		}
	}

	const workshopIds = [...queue]
	for (const batch of batchProcess(workshopIds, 20)) {
		await helpers.addJob(
			'scanWorkshopBatch',
			{ workshopIds: batch.map(String) },
			{
				jobKey: `scan-workshop-batch:${batch[0]}:${batch.at(-1)}`,
				maxAttempts: 5,
				priority: WORKSHOP_JOB_PRIORITY,
			},
		)
	}
	helpers.logger.info(
		`syncWorkshopCatalog queued ${workshopIds.length} scans from ${seen.size} catalog items${forceAll ? ' (all=true)' : ''}.`,
	)
}
