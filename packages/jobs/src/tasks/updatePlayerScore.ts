import {
	getUserPersonalBestsWithLevelPointsAndPosition,
	upsertUserPoints,
} from '@zeepkist/database';
import { calculatePlayerPoints } from '../utils';
import type { TaskHandler } from './types';

type Payload = {
	idUser?: number;
};

export const updatePlayerScore: TaskHandler<Payload> = async (payload, helpers) => {
	if (!payload.idUser) {
		helpers.logger.warn('updatePlayerScore skipped: missing idUser payload.');
		return;
	}

	try {
		const personalBests = await getUserPersonalBestsWithLevelPointsAndPosition({
			idUser: payload.idUser,
		});

		if (personalBests.length === 0) {
			helpers.logger.info(
				`updatePlayerScore skipped for idUser=${payload.idUser}; no personal bests found.`,
			);
			return;
		}

		const { points, totalPoints } = calculatePlayerPoints(personalBests);
		await upsertUserPoints({
			idUser: payload.idUser,
			points,
			totalPoints,
		});
	} catch (error) {
		helpers.logger.error(`Error updating player score for idUser=${payload.idUser}`, { error });
	}
};
