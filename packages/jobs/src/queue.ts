import type { JobLane, WorkerUtils } from './queueTypes'
import { isCompatibleTaskIdentifier, isValidTaskPayload, taskDefinitions } from './taskDefinitions'
import { levelScoreJobOptions } from './utils/levelScoreJobOptions'
import { playerScoreJobOptions } from './utils/playerScoreJobOptions'
import { POINTS_HISTORY_PRUNE_QUEUE_NAME } from './utils/pointsHistoryPruningOptions'
import { createQueueWorkerUtils } from './workerUtils'

export { isValidTaskPayload } from './taskDefinitions'

let utils: WorkerUtils | null = null
let utilsPromise: Promise<WorkerUtils> | null = null

async function getUtils(): Promise<WorkerUtils> {
	if (!utils) {
		utilsPromise ??= createQueueWorkerUtils().catch((error) => {
			utilsPromise = null
			throw error
		})
		utils = await utilsPromise
	}
	return utils
}

export async function initializeQueue(): Promise<void> {
	await getUtils()
}

export function isCompatibleTask(task: string): boolean {
	return isCompatibleTaskIdentifier(task)
}

export async function enqueueCompatibleTask(
	task: string,
	options: Record<string, unknown>,
	context: { lane: JobLane } = { lane: 'bulk' },
) {
	if (!isCompatibleTaskIdentifier(task) || !isValidTaskPayload(task, options)) {
		throw new Error(`Unsupported task: ${task}`)
	}

	const workerUtils = await getUtils()
	await workerUtils.addJob(task, options, {
		lane: context.lane,

		maxAttempts: taskDefinitions[task].maxAttempts ?? 3,
		...(task === 'prunePointsHistory'
			? {
					queueName: POINTS_HISTORY_PRUNE_QUEUE_NAME,
				}
			: {}),
		...playerScoreJobOptions(task, options),
		...levelScoreJobOptions(task, options),
	})
}

export async function enqueueWorkshopScan(workshopId: bigint): Promise<void> {
	const workerUtils = await getUtils()
	await workerUtils.addJob(
		'scanWorkshopItem',
		{ workshopId: workshopId.toString() },
		{
			maxAttempts: taskDefinitions.scanWorkshopItem.maxAttempts,
			jobKey: `scan-workshop-item:${workshopId}`,
		},
	)
}

export async function closeQueue(): Promise<void> {
	await utils?.release()
	utils = null
	utilsPromise = null
}
