import { z } from 'zod'

const emptyPayload = z.looseObject({})
const batchPayload = z.union([
	z.looseObject({ ids: z.array(z.number().int().positive()).min(1) }),
	z.looseObject({
		offset: z.number().int().nonnegative(),
		limit: z.number().int().positive(),
	}),
])

export const taskDefinitions = {
	scanWorkshopBatch: {
		schema: z.looseObject({
			workshopIds: z
				.array(z.string().regex(/^[1-9]\d*$/))
				.min(1)
				.max(10),
		}),
		compatible: false,
		maxAttempts: 5,
	},
	scanWorkshopItem: {
		schema: z.looseObject({ workshopId: z.string().regex(/^[1-9]\d*$/) }),
		compatible: true,
		maxAttempts: 5,
	},
	syncPersonalBests: { schema: emptyPayload, compatible: true, maxAttempts: 3 },
	syncWorkshopCatalog: { schema: emptyPayload, compatible: true, maxAttempts: 3 },
	updateLevelPointsHistory: { schema: emptyPayload, compatible: true, maxAttempts: 3 },
	updateLevelPointsHistoryBatch: { schema: batchPayload, compatible: true, maxAttempts: 3 },
	updateLevelScore: {
		schema: z.looseObject({
			idLevel: z.number().int().positive(),
			idUser: z.number().int().positive().optional(),
		}),
		compatible: true,
		maxAttempts: 3,
	},
	updateLevelScores: {
		schema: z.looseObject({ all: z.boolean().optional() }),
		compatible: true,
		maxAttempts: 3,
	},
	updateLevelScoresBatch: {
		schema: z.looseObject({
			ids: z.array(z.number().int().positive()).min(1).max(50),
			personalBestCountPercentile: z.number().nonnegative(),
		}),
		compatible: false,
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

export function isTaskIdentifier(task: string): task is TaskIdentifier {
	return task in taskDefinitions
}

export function isCompatibleTaskIdentifier(task: string): task is TaskIdentifier {
	return isTaskIdentifier(task) && taskDefinitions[task].compatible
}

export function isValidTaskPayload(task: string, payload: unknown): boolean {
	return isTaskIdentifier(task) && taskDefinitions[task].schema.safeParse(payload).success
}
