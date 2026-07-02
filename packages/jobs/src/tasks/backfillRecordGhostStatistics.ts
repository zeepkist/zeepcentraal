import { emptyGhostStatistics, parseGhostStatistics } from '@zeepkist/core/ghosts'
import {
	getRecordMediaForStatisticBackfill,
	upsertRecordStatistic,
} from '@zeepkist/database/services'
import { batchProcess } from '../utils/batchProcess'
import type { TaskHandler } from './types'

const BATCH_SIZE = 500
const CDN_BASE_URL = 'https://cdn.zeepki.st/'

type Payload = {
	limit?: number
	ids?: number[]
}

type BatchPayload = {
	ids: number[]
}

export function buildGhostUrl(ghostUrl: string): string {
	return new URL(ghostUrl, CDN_BASE_URL).toString()
}

async function downloadGhost(ghostUrl: string): Promise<Buffer> {
	const response = await fetch(buildGhostUrl(ghostUrl))
	if (!response.ok) {
		throw new Error(`Ghost download failed: ${response.status}`)
	}
	return Buffer.from(await response.arrayBuffer())
}

export const backfillRecordGhostStatistics: TaskHandler<Payload> = async (payload, helpers) => {
	const limit = payload.limit ?? BATCH_SIZE
	const batchSize = Math.min(limit, BATCH_SIZE)
	let afterId: number | undefined
	let enqueued = 0

	if (payload.ids && payload.ids.length > 0) {
		const jobs = Array.from(batchProcess(payload.ids, BATCH_SIZE), (ids) => ({
			identifier: 'backfillRecordGhostStatisticsBatch',
			payload: { ids },
			jobKey: `backfill-record-ghost-statistics:${ids[0]}-${ids.at(-1)}`,
		}))
		await helpers.addJobs(jobs)
		helpers.logger.info('Enqueued targeted record ghost statistics backfill.', {
			count: payload.ids.length,
			batches: jobs.length,
		})
		return
	}

	while (true) {
		const media = await getRecordMediaForStatisticBackfill({
			afterId,
			limit: batchSize,
		})
		if (media.length === 0) break
		const ids = media.map((item) => item.idRecord)
		await helpers.addJob(
			'backfillRecordGhostStatisticsBatch',
			{
				ids,
			},
			{
				jobKey: `backfill-record-ghost-statistics:${ids[0]}-${ids.at(-1)}`,
			},
		)
		enqueued += media.length
		afterId = media.at(-1)?.idRecord
		if (media.length < batchSize) break
	}

	helpers.logger.info('Enqueued record ghost statistics backfill batches.', {
		enqueued,
		batchSize,
	})
}

export const backfillRecordGhostStatisticsBatch: TaskHandler<BatchPayload> = async (
	payload,
	helpers,
) => {
	const media = await getRecordMediaForStatisticBackfill({
		limit: BATCH_SIZE,
		ids: payload.ids,
	})

	let updated = 0
	let failed = 0
	for (const item of media) {
		if (!item.ghostUrl) {
			continue
		}

		try {
			helpers.logger.info(`Backfilling ghost statistics for record ${item.idRecord}.`)

			const ghost = await downloadGhost(item.ghostUrl)
			const statistics = (await parseGhostStatistics(ghost)) ?? emptyGhostStatistics()

			await upsertRecordStatistic({
				idRecord: item.idRecord,
				...statistics,
			})

			updated++

			helpers.logger.info(
				`Backfilled ghost statistics for record ${item.idRecord}. Updated ${updated} records so far.`,
			)
		} catch (error) {
			failed++
			helpers.logger.warn(
				`Failed to backfill ghost statistics for record ${item.idRecord}.`,
				{
					error,
				},
			)
		}
	}

	helpers.logger.info('Backfilled record ghost statistics.', {
		count: media.length,
		updated,
		failed,
	})
}
