import { config } from '@zeepkist/core'
import { makeWorkerUtils, type WorkerUtils } from 'graphile-worker'
import { isCompatibleTaskIdentifier, isValidTaskPayload, taskDefinitions } from './taskDefinitions'

export { isValidTaskPayload } from './taskDefinitions'

let utils: WorkerUtils | null = null
let utilsPromise: Promise<WorkerUtils> | null = null

async function getUtils(): Promise<WorkerUtils> {
	if (!utils) {
		utilsPromise ??= makeWorkerUtils({ connectionString: config.databaseUrl })
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
		priority: 5,
		maxAttempts: taskDefinitions[task].maxAttempts,
	})
}

export async function closeQueue(): Promise<void> {
	await utils?.release()
	utils = null
	utilsPromise = null
}
