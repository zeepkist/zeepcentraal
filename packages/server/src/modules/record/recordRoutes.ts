import { Elysia, t } from 'elysia';
import { getOrInsertLevel, getUser, insertRecord, insertRecordMedia, upsertPersonalBest, upsertWorldRecord } from '@zeepkist/database/services';
import { verifyAccessToken } from '@zeepkist/core';
import { enqueueCompatibleTask } from '@zeepkist/jobs/queue';
import { withAuthGtr } from '../../plugins/withAuth';
import { withModVersionGuard } from '../../plugins/withModVersionGuard';

export const recordRoutes = new Elysia({ prefix: '/record' })
	.use(withAuthGtr)
	.use(withModVersionGuard)
	.post('/submit', async ({ headers, body, set }) => {
		const bearerToken = headers.authorization?.split(' ')[1];
		if (!bearerToken) {
			set.status = 400;
			return {
				error: {
					code: 14,
					message: 'Not authenticated',
				},
			};
		}

		let auth;
		try {
			auth = verifyAccessToken(bearerToken);
		} catch {
			set.status = 401;
			return {
				error: {
					code: 15,
					message: 'Invalid or expired token',
				},
			};
		}

		const { Level, Time, Splits, Speeds, GhostData, GameVersion, ModVersion } = body;

		if (!Level || !Time || !Splits || !Speeds || !GhostData || !GameVersion) {
			set.status = 400;
			return {
				error: {
					code: 19,
					message: 'Missing required parameters',
				},
			};
		}

		const user = await getUser(auth.steamId);
		if (!user) {
			set.status = 401;
			return {
				error: {
					code: 16,
					message: 'User not found',
				},
			};
		}

		const level = await getOrInsertLevel(Level);
		if (!level) {
			set.status = 400;
			return {
				error: {
					code: 18,
					message: 'Level not found',
				},
			};
		}

		const submittedRecord = await insertRecord({
			idUser: user.id,
			idLevel: level.id,
			time: Time,
			splits: Splits,
			speeds: Speeds,
			modVersion: ModVersion,
			gameVersion: GameVersion,
			dateCreated: new Date().toISOString(),
			dateUpdated: new Date().toISOString(),
		});

		if (!submittedRecord) {
			set.status = 400;
			return {
				error: {
					code: 20,
					message: 'Failed to submit record',
				},
			};
		}

		const [personalBest] = await Promise.all([
			upsertPersonalBest({ idUser: user.id, idLevel: level.id, idRecord: submittedRecord.id, time: Time }),
			upsertWorldRecord({ idUser: user.id, idLevel: level.id, idRecord: submittedRecord.id, time: Time }),
			insertRecordMedia({ idRecord: submittedRecord.id, ghostData: GhostData }),
		]);

		if (personalBest) {
			await enqueueCompatibleTask('updateLevelScore', { idLevel: level.id, idUser: user.id });
		}

		set.status = 200;
		return;
	}, {
		body: t.Object({
			Level: t.String(),
			Time: t.Number(),
			Splits: t.Array(t.Number()),
			Speeds: t.Array(t.Number()),
			GhostData: t.String(),
			GameVersion: t.String(),
			ModVersion: t.String(),
		}),
	});
