import { config } from '@zeepkist/core';
import { makeWorkerUtils, type WorkerUtils } from 'graphile-worker';

const compatibleTasks = new Set([
	'syncPersonalBests',
	'updateLevelPointsHistory',
	'updateLevelPointsHistoryBatch',
	'updateLevelScore',
	'updateLevelScores',
	'updatePlayerScore',
	'updatePlayerScores',
	'updateUserPointsHistory',
	'updateUserPointsHistoryBatch',
]);

let utils: WorkerUtils | null = null;

async function getUtils(): Promise<WorkerUtils> {
	if (!utils) {
		utils = await makeWorkerUtils({ connectionString: config.databaseUrl });
	}
	return utils;
}

export function isCompatibleTask(task: string): boolean {
	return compatibleTasks.has(task);
}

export async function enqueueCompatibleTask(task: string, options: Record<string, unknown>) {
	if (!isCompatibleTask(task)) {
		throw new Error(`Unsupported task: ${task}`);
	}

	const workerUtils = await getUtils();
	await workerUtils.addJob(task, options, { priority: 5, maxAttempts: 1 });
}
