import { z } from 'zod'

// Recovered CLI contracts; production task registry remains in crates/jobs/src/lib.rs.
const emptyPayload = z.looseObject({})
const syncWorkshopCatalogPayload = z
	.looseObject({
		all: z.boolean().optional(),
		fixZeepSDKExponentHashes: z.boolean().optional(),
		repairZslAuthors: z.literal(true).optional(),
	})
	.refine(
		(payload) =>
			!payload.repairZslAuthors ||
			(payload.all !== true && payload.fixZeepSDKExponentHashes !== true),
		{ message: 'ZSL author repair cannot be combined with full-catalog options' },
	)
const batchPayload = z.union([
	z.looseObject({ ids: z.array(z.number().int().positive()).min(1) }),
	z.looseObject({
		offset: z.number().int().nonnegative(),
		limit: z.number().int().positive(),
	}),
])
export const taskDefinitions = {
	prepareZslPracticePlaylist: {
		schema: z.strictObject({
			roundId: z.number().int().positive().max(2147483647),
			playlist: z
				.url()
				.max(4096)
				.refine((value) => {
					const url = new URL(value)
					return (
						['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
					)
				}),
		}),
		compatible: true,
		maxAttempts: 5,
	},
	backfillLevelSimhash: {
		schema: z.strictObject({}),
		compatible: true,
		maxAttempts: 3,
	},
	backfillRecordGhostStatistics: {
		schema: z
			.looseObject({
				ids: z.array(z.number().int().positive()).min(1).optional(),
				limit: z.number().int().positive().max(500).optional(),
				reparseGhostVersion: z.literal(5).optional(),
			})
			.refine((payload) => !(payload.ids && payload.reparseGhostVersion !== undefined), {
				message: 'Targeted IDs cannot be combined with ghost-version reparsing',
			}),
		compatible: true,
		maxAttempts: 1,
	},
	backfillRecordGhostStatisticsBatch: {
		schema: z.looseObject({
			ids: z.array(z.number().int().positive()).min(1).max(500),
		}),
		compatible: true,
		maxAttempts: 1,
	},
	prunePointsHistory: { schema: emptyPayload, compatible: true, maxAttempts: 3 },
	recoverLevelRequests: { schema: emptyPayload, compatible: false, maxAttempts: 3 },
	prepareTrackTournamentLobbyAsset: {
		schema: z.looseObject({ idTournament: z.number().int().positive() }),
		compatible: true,
		maxAttempts: 5,
	},
	scanWorkshopBatch: {
		schema: z.looseObject({
			workshopIds: z
				.array(z.string().regex(/^[1-9]\d*$/))
				.min(1)
				.max(10),
			fixZeepSDKExponentHashes: z.boolean().optional(),
		}),
		compatible: true,
		maxAttempts: 5,
	},
	scanWorkshopItem: {
		schema: z.looseObject({ workshopId: z.string().regex(/^[1-9]\d*$/) }),
		compatible: true,
		maxAttempts: 5,
	},
	rotateTrackTournament: {
		schema: z.looseObject({ type: z.union([z.literal(0), z.literal(1)]) }),
		compatible: false,
		maxAttempts: 3,
	},
	syncPersonalBests: { schema: emptyPayload, compatible: true, maxAttempts: 3 },
	syncWorkshopCatalog: { schema: syncWorkshopCatalogPayload, compatible: true, maxAttempts: 3 },
	updateLevelPointsHistory: { schema: emptyPayload, compatible: true, maxAttempts: 3 },
	updateLevelPointsHistoryBatch: { schema: batchPayload, compatible: true, maxAttempts: 3 },
	updateLevelScore: {
		schema: z.looseObject({
			idLevel: z.number().int().positive(),
			idUser: z.number().int().positive().optional(),
			reportOnly: z.boolean().optional(),
		}),
		compatible: true,
		maxAttempts: 3,
	},
	updateLevelScores: {
		schema: z.looseObject({
			all: z.boolean().optional(),
			reportOnly: z.boolean().optional(),
		}),
		compatible: true,
		maxAttempts: 3,
	},
	updatePlayerScore: {
		schema: z.looseObject({ idUser: z.number().int().positive() }),
		compatible: true,
		maxAttempts: 3,
	},
	updatePlayerScores: { schema: emptyPayload, compatible: true, maxAttempts: 3 },
	updateUserPointsHistory: { schema: emptyPayload, compatible: true, maxAttempts: 3 },
	updateUserPointsHistoryBatch: { schema: batchPayload, compatible: true, maxAttempts: 3 },
} as const

export type TaskIdentifier = keyof typeof taskDefinitions

export type CompatibleTaskIdentifier = {
	[Identifier in TaskIdentifier]: (typeof taskDefinitions)[Identifier]['compatible'] extends true
		? Identifier
		: never
}[TaskIdentifier]

export const compatibleTaskIdentifiers = Object.freeze(
	(Object.keys(taskDefinitions) as TaskIdentifier[]).filter(
		(task): task is CompatibleTaskIdentifier => taskDefinitions[task].compatible,
	),
)

export function isTaskIdentifier(task: string): task is TaskIdentifier {
	return task in taskDefinitions
}

export function isCompatibleTaskIdentifier(task: string): task is CompatibleTaskIdentifier {
	return isTaskIdentifier(task) && taskDefinitions[task].compatible
}

export function isValidTaskPayload(task: string, payload: unknown): boolean {
	return isTaskIdentifier(task) && taskDefinitions[task].schema.safeParse(payload).success
}
