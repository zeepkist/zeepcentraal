import { MAX_GHOST_COMPRESSED_BYTES, parseGhostStatistics } from '@zeepkist/core/ghosts'
import {
	claimMissingLevelMetadataRequest,
	getLevelByXxHash,
	getOrInsertLevelWithCanonicalHash,
	getUser,
	submitRecord,
	uploadRecordMedia,
} from '@zeepkist/database/services'
import { enqueueCompatibleTask, enqueueWorkshopScan } from '@zeepkist/jobs/queue'
import { setActiveSpanAttributes, startActiveSpan } from '@zeepkist/telemetry'
import { Elysia, t } from 'elysia'
import { GTR_BEARER_SECURITY, OPENAPI_TAG } from '../../openapi'
import { withAuthGtr } from '../../plugins/withAuth'
import { withModVersionGuard } from '../../plugins/withModVersionGuard'
import { withRateLimit } from '../../plugins/withRateLimit'
import { RecordWorkCapacityError, recordWork } from './recordWork'

async function traceSubmitPhase<T>(name: string, task: () => Promise<T>): Promise<T> {
	return startActiveSpan(name, async (span) => {
		try {
			return await task()
		} catch (error) {
			span.recordException(error)
			span.setErrorStatus(error instanceof Error ? error.message : String(error))
			throw error
		} finally {
			span.end()
		}
	})
}

function ghostFrameBucket(frameCount: number | null): string {
	if (frameCount === null) return 'unknown'
	if (frameCount < 1_000) return '0-999'
	if (frameCount < 4_000) return '1000-3999'
	if (frameCount < 8_000) return '4000-7999'
	return '8000+'
}

function scheduleRecordFollowups({
	idLevel,
	idUser,
	personalBestChanged,
	workshopId,
	workshopScanClaimed,
}: {
	idLevel: number
	idUser: number
	personalBestChanged: boolean
	workshopId?: bigint
	workshopScanClaimed: boolean
}): void {
	if (personalBestChanged) {
		void traceSubmitPhase('record.submit.enqueue_level_score', () =>
			enqueueCompatibleTask('updateLevelScore', { idLevel, idUser }),
		).catch((error) => {
			console.error(`Failed to enqueue level score update for level ${idLevel}:`, error)
		})
	}

	if (workshopScanClaimed && workshopId !== undefined) {
		void traceSubmitPhase('record.submit.enqueue_workshop_scan', () =>
			enqueueWorkshopScan(workshopId),
		).catch((error) => {
			console.error(`Failed to enqueue workshop scan for ${workshopId}:`, error)
		})
	}
}

export const recordRoutes = new Elysia({ prefix: '/record' })
	.use(withAuthGtr)
	.use(withRateLimit('record'))
	.use(withModVersionGuard)
	.post(
		'/submit',
		async ({ auth, body, set, request }) => {
			return traceSubmitPhase('record.submit.total', async () => {
				const {
					Level,
					Hash,
					WorkshopId,
					Time,
					Splits,
					Speeds,
					GhostData,
					GameVersion,
					ModVersion,
				} = body
				const validHash = typeof Hash === 'string' && /^[0-9A-F]{32}$/.test(Hash)
				const validWorkshopId =
					WorkshopId === undefined ||
					(/^[1-9]\d*$/.test(WorkshopId) && BigInt(WorkshopId) <= 9223372036854775807n)

				const validBase64 =
					GhostData.length % 4 === 0 &&
					/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
						GhostData,
					)
				const validNumbers =
					Number.isFinite(Time) &&
					Time > 0 &&
					Splits.every(Number.isFinite) &&
					Speeds.every(Number.isFinite)
				const decodedGhostBytes = validBase64
					? Math.floor((GhostData.length * 3) / 4) -
						(GhostData.endsWith('==') ? 2 : GhostData.endsWith('=') ? 1 : 0)
					: 0

				setActiveSpanAttributes({
					'record.request_bytes': Number(request.headers.get('content-length') ?? 0),
					'record.ghost_base64_bytes': GhostData.length,
					'record.ghost_decoded_bytes': decodedGhostBytes,
					'record.split_count': Splits.length,
					'record.speed_count': Speeds.length,
				})

				if (
					!Level ||
					!validHash ||
					!Time ||
					!Splits ||
					!Speeds ||
					!GhostData ||
					!GameVersion ||
					!validWorkshopId ||
					!validBase64 ||
					decodedGhostBytes > MAX_GHOST_COMPRESSED_BYTES ||
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

				const ghostBytes = Uint8Array.fromBase64(GhostData)
				let uploadReservation: ReturnType<typeof recordWork.reserveUpload>
				try {
					uploadReservation = recordWork.reserveUpload(ghostBytes.byteLength)
				} catch (error) {
					if (!(error instanceof RecordWorkCapacityError)) throw error
					set.status = 503
					set.headers['retry-after'] = '1'
					return
				}

				try {
					const preliminaryResults = await Promise.allSettled([
						traceSubmitPhase('record.submit.ghost_statistics', () =>
							recordWork.runParser(() => parseGhostStatistics(ghostBytes)),
						),
						traceSubmitPhase('record.submit.user_lookup', () => getUser(auth.steamId)),
						traceSubmitPhase('record.submit.level_lookup', () =>
							getLevelByXxHash(Hash),
						),
					] as const)
					const [ghostResult, userResult, existingLevelResult] = preliminaryResults
					if (ghostResult.status === 'rejected') {
						if (ghostResult.reason instanceof RecordWorkCapacityError) {
							set.status = 503
							set.headers['retry-after'] = '1'
							return
						}
						set.status = 400
						return {
							error: {
								code: 19,
								message: 'Missing required parameters',
							},
						}
					}
					if (userResult.status === 'rejected') throw userResult.reason
					if (existingLevelResult.status === 'rejected') throw existingLevelResult.reason
					const ghostStatistics = ghostResult.value

					const user = userResult.value
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
					const isAdventure = workshopId === undefined
					const existingLevel = existingLevelResult.value
					const level =
						existingLevel && (!isAdventure || existingLevel.adventure)
							? existingLevel
							: await traceSubmitPhase('record.submit.level_resolve', () =>
									getOrInsertLevelWithCanonicalHash({
										hash: Level,
										xxHash: Hash,
										adventure: isAdventure,
									}),
								)
					if (!level) {
						set.status = 400
						return {
							error: {
								code: 18,
								message: 'Level not found',
							},
						}
					}

					const submitted = await submitRecord(
						{
							idUser: user.id,
							idLevel: level.id,
							time: Time,
							splits: Splits,
							speeds: Speeds,
							modVersion: ModVersion,
							gameVersion: GameVersion,
							dateCreated: new Date().toISOString(),
							dateUpdated: new Date().toISOString(),
						},
						ghostStatistics,
					)

					if (!submitted) {
						set.status = 400
						return {
							error: {
								code: 20,
								message: 'Failed to submit record',
							},
						}
					}

					uploadReservation.schedule(() =>
						uploadRecordMedia(submitted.record.id, ghostBytes),
					)
					const workshopScanClaimed =
						workshopId === undefined
							? false
							: await traceSubmitPhase('record.submit.workshop_claim', () =>
									claimMissingLevelMetadataRequest({
										idLevel: level.id,
										workshopId,
										hash: Level,
									}),
								)

					setActiveSpanAttributes({
						'record.ghost_version': ghostStatistics.ghostVersion ?? 0,
						'record.ghost_frame_bucket': ghostFrameBucket(ghostStatistics.frameCount),
						'record.personal_best_changed': submitted.personalBestChanged,
						'record.tournament_result_changed': submitted.tournamentResultChanged,
						'record.adventure': isAdventure,
						'record.workshop_scan_claimed': workshopScanClaimed,
					})
					scheduleRecordFollowups({
						idLevel: level.id,
						idUser: user.id,
						personalBestChanged: submitted.personalBestChanged,
						workshopId,
						workshopScanClaimed,
					})

					set.status = 200
					return
				} finally {
					uploadReservation[Symbol.dispose]()
				}
			})
		},
		{
			body: t.Object({
				Level: t.String({ description: 'Canonical legacy level hash.' }),
				Hash: t.Optional(
					t.String({ description: 'Uppercase 32-character XXH128 level hash.' }),
				),
				WorkshopId: t.Optional(
					t.String({
						description:
							'Positive Steam Workshop file ID. Omit for Adventure Mode levels.',
					}),
				),
				Time: t.Number({ description: 'Completed record time in seconds.' }),
				Splits: t.Array(t.Number(), {
					description: 'Cumulative checkpoint split times in seconds.',
				}),
				Speeds: t.Array(t.Number(), {
					description: 'Recorded checkpoint speeds corresponding to `Splits`.',
				}),
				GhostData: t.String({ description: 'Base64-encoded GTR ghost replay.' }),
				GameVersion: t.String({ description: 'Zeepkist game version.' }),
				ModVersion: t.String({ description: 'Installed GTR semantic version.' }),
			}),
			detail: {
				operationId: 'submitRecord',
				summary: 'Submit a GTR record',
				description:
					'Validates and stores a completed run, checkpoint data, telemetry statistics, and ghost replay.',
				security: GTR_BEARER_SECURITY,
				tags: [OPENAPI_TAG.record],
			},
		},
	)
