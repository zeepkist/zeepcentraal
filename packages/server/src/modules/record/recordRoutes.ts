import { setAttributes } from '@elysiajs/opentelemetry'
import {
	claimLevelRequest,
	getOrInsertLevelWithAdventure,
	getUser,
	hasLevelMetadata,
	releaseLevelRequest,
	scheduleRecordMediaUpload,
	submitRecord,
} from '@zeepkist/database/services'
import { enqueueCompatibleTask, enqueueWorkshopScan } from '@zeepkist/jobs/queue'
import { Elysia, t } from 'elysia'
import { withAuthGtr } from '../../plugins/withAuth'
import { withModVersionGuard } from '../../plugins/withModVersionGuard'
import { withRateLimit } from '../../plugins/withRateLimit'

export const recordRoutes = new Elysia({ prefix: '/record' })
	.use(withAuthGtr)
	.use(withRateLimit('record'))
	.use(withModVersionGuard)
	.post(
		'/submit',
		async ({ auth, body, set, request }) => {
			const { Level, WorkshopId, Time, Splits, Speeds, GhostData, GameVersion, ModVersion } =
				body
			const validWorkshopId =
				WorkshopId === undefined ||
				(/^[1-9]\d*$/.test(WorkshopId) && BigInt(WorkshopId) <= 9223372036854775807n)

			const validBase64 =
				GhostData.length % 4 === 0 &&
				/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(GhostData)
			const validNumbers =
				Number.isFinite(Time) &&
				Time > 0 &&
				Splits.every(Number.isFinite) &&
				Speeds.every(Number.isFinite)

			setAttributes({
				'record.request_bytes': Number(request.headers.get('content-length') ?? 0),
				'record.ghost_base64_bytes': GhostData.length,
				'record.ghost_decoded_bytes': validBase64
					? Buffer.byteLength(GhostData, 'base64')
					: 0,
				'record.split_count': Splits.length,
				'record.speed_count': Speeds.length,
			})

			if (
				!Level ||
				!Time ||
				!Splits ||
				!Speeds ||
				!GhostData ||
				!GameVersion ||
				!validWorkshopId ||
				!validBase64 ||
				!validNumbers
			) {
				set.status = 400
				return {
					error: {
						code: 19,
						message: 'Missing required parameters',
					},
				}
			}

			const user = await getUser(auth.steamId)
			if (!user || user.banned) {
				set.status = 401
				return {
					error: {
						code: 16,
						message: 'User not found',
					},
				}
			}

			const workshopId = WorkshopId === undefined ? undefined : BigInt(WorkshopId)
			const level = await getOrInsertLevelWithAdventure(Level, workshopId === undefined)
			if (!level) {
				set.status = 400
				return {
					error: {
						code: 18,
						message: 'Level not found',
					},
				}
			}

			const submitted = await submitRecord({
				idUser: user.id,
				idLevel: level.id,
				time: Time,
				splits: Splits,
				speeds: Speeds,
				modVersion: ModVersion,
				gameVersion: GameVersion,
				dateCreated: new Date().toISOString(),
				dateUpdated: new Date().toISOString(),
			})

			if (!submitted) {
				set.status = 400
				return {
					error: {
						code: 20,
						message: 'Failed to submit record',
					},
				}
			}

			scheduleRecordMediaUpload(submitted.record.id, GhostData)

			if (submitted.personalBestChanged) {
				await enqueueCompatibleTask('updateLevelScore', {
					idLevel: level.id,
					idUser: user.id,
				})
			}

			if (workshopId !== undefined && !(await hasLevelMetadata(level.id))) {
				const claimed = await claimLevelRequest({
					workshopId,
					hash: Level,
				})
				if (claimed) {
					try {
						await enqueueWorkshopScan(workshopId)
					} catch (error) {
						await releaseLevelRequest(workshopId)
						console.error(`Failed to enqueue workshop scan for ${workshopId}:`, error)
					}
				}
			}

			set.status = 200
			return
		},
		{
			body: t.Object({
				Level: t.String(),
				WorkshopId: t.Optional(t.String()),
				Time: t.Number(),
				Splits: t.Array(t.Number()),
				Speeds: t.Array(t.Number()),
				GhostData: t.String(),
				GameVersion: t.String(),
				ModVersion: t.String(),
			}),
		},
	)
