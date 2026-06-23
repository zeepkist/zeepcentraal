import { getWorkshopUpdateTimes } from '@zeepkist/database/services/workshop'
import { batchProcess } from '../utils'
import { getWorkshopMetadata } from '../workshopScanner'
import type { TaskHandler } from './types'

export const syncWorkshopCatalog: TaskHandler = async (_payload, helpers) => {
	const storedUpdates = await getWorkshopUpdateTimes()
	const metadata = getWorkshopMetadata()
	const seen = new Set<bigint>()
	const queue = new Set<bigint>()
	let cursor: string | undefined

	do {
		const page = await metadata.listItems(cursor)
		for (const item of page.items) {
			seen.add(item.workshopId)
			const storedUpdate = storedUpdates.get(item.workshopId)
			if (
				!storedUpdate ||
				new Date(item.updatedAt).getTime() > new Date(storedUpdate).getTime()
			) {
				queue.add(item.workshopId)
			}
		}
		cursor = page.nextCursor
	} while (cursor)

	for (const workshopId of storedUpdates.keys()) {
		if (!seen.has(workshopId)) {
			queue.add(workshopId)
		}
	}

	const workshopIds = [...queue]
	for (const batch of batchProcess(workshopIds, 10)) {
		await helpers.addJob(
			'scanWorkshopBatch',
			{ workshopIds: batch.map(String) },
			{
				jobKey: `scan-workshop-batch:${batch[0]}:${batch.at(-1)}`,
				maxAttempts: 5,
			},
		)
	}
	helpers.logger.info(
		`syncWorkshopCatalog queued ${workshopIds.length} scans from ${seen.size} catalog items.`,
	)
}
