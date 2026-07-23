import { getWorkshopSyncState } from '@zeepkist/database/services/workshop'
import { ZSL_WORKSHOP_AUTHOR_ID } from '@zeepkist/workshop'
import { WORKSHOP_JOB_PRIORITY } from '../priorities'
import { batchProcess } from '../utils'
import { getWorkshopMetadata } from '../workshopScanner'
import type { TaskHandler } from './types'

interface SyncWorkshopCatalogPayload {
	all?: boolean
	fixZeepSDKExponentHashes?: boolean
	repairZslAuthors?: true
}

export const syncWorkshopCatalog: TaskHandler<SyncWorkshopCatalogPayload> = async (
	payload,
	helpers,
) => {
	const forceAll = payload.all === true
	const repairZslAuthors = payload.repairZslAuthors === true
	const fixZeepSDKExponentHashes = forceAll && payload.fixZeepSDKExponentHashes === true
	const metadata = getWorkshopMetadata()
	const seen = new Set<bigint>()
	const queue = new Set<bigint>()
	let pages = 0

	if (repairZslAuthors) {
		let pageNumber: number | undefined = 1
		do {
			const page = await metadata.listUserItemIds(ZSL_WORKSHOP_AUTHOR_ID, pageNumber)
			pages++
			for (const workshopId of page.workshopIds) {
				seen.add(workshopId)
				queue.add(workshopId)
			}
			console.info(
				`syncWorkshopCatalog ZSL page ${pages} processed: ${page.workshopIds.length} items, ${seen.size} seen, ${queue.size} queued.`,
			)
			pageNumber = page.nextPage
		} while (pageNumber)
	} else {
		const storedWorkshopState = await getWorkshopSyncState()
		let cursor: string | undefined
		do {
			const page = await metadata.listItems(cursor)
			pages++
			for (const item of page.items) {
				seen.add(item.workshopId)
				const storedState = storedWorkshopState.get(item.workshopId)
				if (
					forceAll ||
					!storedState ||
					storedState.activeItemCount === 0 ||
					new Date(item.updatedAt).getTime() > new Date(storedState.updatedAt).getTime()
				) {
					queue.add(item.workshopId)
				}
			}
			console.info(
				`syncWorkshopCatalog page ${pages} processed: ${page.items.length} items, ${seen.size} seen, ${queue.size} queued.`,
			)
			cursor = page.nextCursor
		} while (cursor)

		for (const [workshopId, storedState] of storedWorkshopState) {
			if (!seen.has(workshopId) && storedState.activeItemCount > 0) {
				queue.add(workshopId)
			}
		}
	}

	const workshopIds = [...queue]
	for (const batch of batchProcess(workshopIds, 20)) {
		await helpers.addJob(
			'scanWorkshopBatch',
			{
				workshopIds: batch.map(String),
				...(fixZeepSDKExponentHashes ? { fixZeepSDKExponentHashes: true } : {}),
			},
			{
				jobKey: `scan-workshop-batch:${batch[0]}:${batch.at(-1)}`,
				maxAttempts: 5,
				priority: WORKSHOP_JOB_PRIORITY,
			},
		)
	}
	helpers.logger.info(
		`syncWorkshopCatalog queued ${workshopIds.length} scans from ${seen.size} catalog items${forceAll ? ' (all=true)' : ''}${fixZeepSDKExponentHashes ? ' (fixZeepSDKExponentHashes=true)' : ''}${repairZslAuthors ? ' (repairZslAuthors=true)' : ''}.`,
	)
}
