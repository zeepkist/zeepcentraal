import {
	claimLevelRequest,
	getLevelByXxHash,
	releaseLevelRequest,
} from '@zeepkist/database/services'
import { enqueueWorkshopScan } from '@zeepkist/jobs/queue'
import { Elysia, t } from 'elysia'
import { withAuthGtr } from '../../plugins/withAuth'
import { withRateLimit } from '../../plugins/withRateLimit'
import { handleV1Error, V1_ERROR_CODES } from '../../v1Errors'

const MAX_WORKSHOP_ID = 9223372036854775807n
const XXH128_PATTERN = /^[0-9A-F]{32}$/

function isValidWorkshopId(workshopId: string) {
	return /^[1-9]\d*$/.test(workshopId) && BigInt(workshopId) <= MAX_WORKSHOP_ID
}

export const levelRoutes = new Elysia({ prefix: '/level' })
	.use(withAuthGtr)
	.use(withRateLimit('mutation'))
	.post(
		'/request',
		async ({ body, set }) => {
			const { WorkshopId, Hash } = body
			if (!isValidWorkshopId(WorkshopId) || !XXH128_PATTERN.test(Hash)) {
				set.status = 400
				return handleV1Error(V1_ERROR_CODES.GENERIC_INVALID_REQUEST)
			}

			const existing = await getLevelByXxHash(Hash)
			if (existing) {
				set.status = 200
				return
			}

			const workshopId = BigInt(WorkshopId)
			const claimed = await claimLevelRequest({ workshopId, hash: Hash })
			if (claimed) {
				try {
					await enqueueWorkshopScan(workshopId)
				} catch (error) {
					await releaseLevelRequest(workshopId)
					console.error(`Failed to enqueue workshop scan for ${workshopId}:`, error)
				}
			}

			set.status = 200
			return
		},
		{
			body: t.Object({
				WorkshopId: t.String(),
				Hash: t.String(),
			}),
		},
	)
