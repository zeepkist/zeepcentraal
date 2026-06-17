import { getTotalUserPoints } from '@zeepkist/database';
import type { TaskHandler } from './types';

const BATCH_SIZE = 200;

type Payload = Record<string, never>;

export const updateUserPointsHistory: TaskHandler<Payload> = async (_payload, helpers) => {
	const totalPoints = await getTotalUserPoints();
	if (totalPoints <= 0) {
		helpers.logger.info('No user points found for history sync.');
		return;
	}

	const totalBatches = Math.ceil(totalPoints / BATCH_SIZE);
	for (let index = 0; index < totalBatches; index++) {
		const offset = index * BATCH_SIZE;
		await helpers.addJob('updateUserPointsHistoryBatch', { offset, limit: BATCH_SIZE });
	}

	helpers.logger.info(`Queued ${totalBatches} updateUserPointsHistoryBatch jobs.`);
};
