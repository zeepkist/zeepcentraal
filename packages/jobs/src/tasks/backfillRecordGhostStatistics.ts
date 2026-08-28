import { parseGhostStatistics } from '@zeepkist/core/ghosts'
import { batchProcess } from '../utils/batchProcess'
import { buildGhostUrl } from '../utils/ghostStatisticsBackfill'
import type { TaskHandler } from './types'

const BATCH_SIZE = 500
const MAX_GHOST_DOWNLOAD_BYTES = 24 * 1024 * 1024

type Payload = {
	limit?: number
	ids?: number[]
	reparseGhostVersion?: 5
}

type BatchPayload = {
	ids: number[]
}

async function downloadGhost(ghostUrl: string): Promise<Uint8Array> {
	const response = await fetch(buildGhostUrl(ghostUrl))
	if (!response.ok) {
		throw new Error(`Ghost download failed: ${response.status}`)
	}
	const contentLength = Number(response.headers.get('content-length'))
	if (Number.isFinite(contentLength) && contentLength > MAX_GHOST_DOWNLOAD_BYTES) {
		throw new Error('Ghost download exceeds compressed size limit')
	}
	if (!response.body) throw new Error('Ghost download body is unavailable')
	const sink = new Bun.ArrayBufferSink()
	sink.start({ asUint8Array: true, highWaterMark: 1024 * 1024 })
	const reader = response.body.getReader()
	let byteLength = 0
	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			byteLength += value.byteLength
			if (byteLength > MAX_GHOST_DOWNLOAD_BYTES) {
				throw new Error('Ghost download exceeds compressed size limit')
			}
			sink.write(value)
		}
		return sink.end() as Uint8Array
	} catch (error) {
		await reader.cancel(error).catch(() => undefined)
		sink.end()
		throw error
	} finally {
		reader.releaseLock()
	}
}

export const backfillRecordGhostStatistics: TaskHandler<Payload> = async (payload, helpers) => {
	const { getRecordIdsWithGhostMedia, getRecordMediaForStatisticBackfill } = await import(
		'@zeepkist/database/services'
	)
	const limit = payload.limit ?? BATCH_SIZE
	const batchSize = Math.min(limit, BATCH_SIZE)
	let beforeId: number | undefined
	let enqueued = 0

	if (payload.ids && payload.ids.length > 0) {
		const idsWithGhostMedia: number[] = []
		for (const ids of batchProcess(payload.ids, BATCH_SIZE)) {
			idsWithGhostMedia.push(...(await getRecordIdsWithGhostMedia(ids)))
		}

		const jobs = Array.from(batchProcess(idsWithGhostMedia, BATCH_SIZE), (ids) => ({
			identifier: 'backfillRecordGhostStatisticsBatch',
			payload: { ids },
			jobKey: `backfill-record-ghost-statistics:${ids[0]}-${ids.at(-1)}`,
		}))
		if (jobs.length > 0) {
			await helpers.addJobs(jobs)
		}
		helpers.logger.info('Enqueued targeted record ghost statistics backfill.', {
			requested: payload.ids.length,
			count: idsWithGhostMedia.length,
			batches: jobs.length,
		})
		return
	}

	while (true) {
		const media = await getRecordMediaForStatisticBackfill({
			beforeId,
			limit: batchSize,
			...(payload.reparseGhostVersion === undefined
				? {}
				: { reparseGhostVersion: payload.reparseGhostVersion }),
		})
		if (media.length === 0) break
		const ids = media.map((item) => item.idRecord)
		await helpers.addJob(
			'backfillRecordGhostStatisticsBatch',
			{
				ids,
			},
			{
				jobKey: `backfill-record-ghost-statistics${payload.reparseGhostVersion === undefined ? '' : `:v${payload.reparseGhostVersion}`}:${ids[0]}-${ids.at(-1)}`,
			},
		)
		enqueued += media.length
		beforeId = media.at(-1)?.idRecord
		if (media.length < batchSize) break
	}

	helpers.logger.info('Enqueued record ghost statistics backfill batches.', {
		enqueued,
		batchSize,
		...(payload.reparseGhostVersion === undefined
			? {}
			: { reparseGhostVersion: payload.reparseGhostVersion }),
	})
}

export const backfillRecordGhostStatisticsBatch: TaskHandler<BatchPayload> = async (
	payload,
	helpers,
) => {
	const { getRecordMediaForStatisticBackfill, upsertRecordStatistic } = await import(
		'@zeepkist/database/services'
	)
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
			const statistics = await parseGhostStatistics(ghost)

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
