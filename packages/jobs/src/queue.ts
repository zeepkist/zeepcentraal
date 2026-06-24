import { jobsConfig } from '@zeepkist/core/config'
import { makeWorkerUtils, type WorkerUtils } from 'graphile-worker'
import { DEFAULT_JOB_PRIORITY, WORKSHOP_JOB_PRIORITY } from './priorities'
import { isCompatibleTaskIdentifier, isValidTaskPayload, taskDefinitions } from './taskDefinitions'

export { isValidTaskPayload } from './taskDefinitions'

let utils: WorkerUtils | null = null
let utilsPromise: Promise<WorkerUtils> | null = null

async function getUtils(): Promise<WorkerUtils> {
	if (!utils) {
		utilsPromise ??= makeWorkerUtils({ connectionString: jobsConfig.databaseUrl })
		utils = await utilsPromise
	}
	return utils
}

export function isCompatibleTask(task: string): boolean {
	return isCompatibleTaskIdentifier(task)
}

export async function enqueueCompatibleTask(task: string, options: Record<string, unknown>) {
	if (!isCompatibleTaskIdentifier(task) || !isValidTaskPayload(task, options)) {
		throw new Error(`Unsupported task: ${task}`)
	}

	const workerUtils = await getUtils()
	await workerUtils.addJob(task, options, {
		priority: task === 'scanWorkshopItem' ? WORKSHOP_JOB_PRIORITY : DEFAULT_JOB_PRIORITY,
		maxAttempts: taskDefinitions[task].maxAttempts ?? 3,
	})
}

export async function enqueueWorkshopScan(workshopId: bigint): Promise<void> {
	const workerUtils = await getUtils()
	await workerUtils.addJob(
		'scanWorkshopItem',
		{ workshopId: workshopId.toString() },
		{
			priority: WORKSHOP_JOB_PRIORITY,
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
