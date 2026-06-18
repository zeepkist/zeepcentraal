import { setAttributes } from '@elysiajs/opentelemetry'
import {
	getOrInsertLevel,
	getUser,
	scheduleRecordMediaUpload,
	submitRecord,
} from '@zeepkist/database/services'
import { enqueueCompatibleTask } from '@zeepkist/jobs/queue'
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
			const { Level, Time, Splits, Speeds, GhostData, GameVersion, ModVersion } = body

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

			const level = await getOrInsertLevel(Level)
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

			set.status = 200
			return
		},
		{
			body: t.Object({
				Level: t.String(),
				Time: t.Number(),
				Splits: t.Array(t.Number()),
				Speeds: t.Array(t.Number()),
				GhostData: t.String(),
				GameVersion: t.String(),
				ModVersion: t.String(),
			}),
		},
	)
