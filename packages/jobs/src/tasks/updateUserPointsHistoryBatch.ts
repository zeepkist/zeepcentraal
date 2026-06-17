import { getUserPointsPaginated, insertUserPointsHistories } from '@zeepkist/database';
import type { TaskHandler } from './types';

type Payload = {
	offset?: number;
	limit?: number;
};

export const updateUserPointsHistoryBatch: TaskHandler<Payload> = async (payload, helpers) => {
	const offset = payload.offset ?? 0;
	const limit = payload.limit ?? 0;

	if (limit <= 0) {
		helpers.logger.warn('updateUserPointsHistoryBatch skipped: missing/invalid limit payload.');
		return;
	}

	try {
		const points = await getUserPointsPaginated(offset, limit);
		if (points.length === 0) {
			return;
		}

		await insertUserPointsHistories(points);
	} catch (error) {
		helpers.logger.error(`Failed to process user points batch at offset ${offset}.`, { error });
	}
};
