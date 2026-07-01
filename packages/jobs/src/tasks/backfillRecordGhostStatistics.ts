import { parseGhostStatistics } from '@zeepkist/core/ghosts'
import {
	getRecordMediaForStatisticBackfill,
	upsertRecordStatistic,
} from '@zeepkist/database/services'
import type { TaskHandler } from './types'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500
const CDN_BASE_URL = 'https://cdn.zeepki.st/'

type Payload = {
	offset?: number
	limit?: number
	ids?: number[]
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
	const offset = payload.offset ?? 0
	const limit = Math.min(payload.limit ?? DEFAULT_LIMIT, MAX_LIMIT)
	const media = await getRecordMediaForStatisticBackfill({
		offset,
		limit,
		ids: payload.ids,
	})

	let updated = 0
	let failed = 0
	for (const item of media) {
		if (!item.ghostUrl) {
			continue
		}

		try {
			const ghost = await downloadGhost(item.ghostUrl)
			const statistics = parseGhostStatistics(ghost, { deriveLegacy: true })
			if (!statistics) {
				throw new Error('Ghost statistics unavailable')
			}
			await upsertRecordStatistic({
				idRecord: item.idRecord,
				...statistics,
			})
			updated++
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
		offset,
		limit,
		updated,
		failed,
	})
}
