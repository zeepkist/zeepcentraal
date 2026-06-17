import { getAllLevelIds, getAllLevelIdsWithRecordsSince } from '@zeepkist/database';
import { batchProcess } from '../utils';
import type { TaskHandler } from './types';

type Payload = {
	all?: boolean;
};

export const updateLevelScores: TaskHandler<Payload> = async (payload, helpers) => {
	const { all = false } = payload;
	const levelIds = all
		? await getAllLevelIds()
		: await getAllLevelIdsWithRecordsSince(new Date(Date.now() - 20 * 60 * 1000));

	helpers.logger.info(`updateLevelScores starting with ${levelIds.length} levels (all=${all}).`);

	for (const batchIds of batchProcess(levelIds)) {
		await Promise.all(batchIds.map((idLevel) => helpers.addJob('updateLevelScore', { idLevel })));
	}

	helpers.logger.info(`Queued ${levelIds.length} updateLevelScore jobs.`);
};
