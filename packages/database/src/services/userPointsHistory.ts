import { db } from '../index';
import { userPoints, userPointsHistory } from '../schema';

type UserPoints = Pick<
	typeof userPoints.$inferInsert,
	'idUser' | 'points' | 'totalPoints' | 'rank' | 'worldRecords'
>;

type UserPointsHistory = typeof userPointsHistory.$inferInsert;

export async function insertUserPointsHistories(entries: UserPoints[]) {
	if (entries.length === 0) {
		return;
	}

	const now = new Date().toISOString();

	const histories: UserPointsHistory[] = entries.map((entry) => ({
		idUser: entry.idUser,
		points: entry.points ?? 0,
		totalPoints: entry.totalPoints,
		rank: entry.rank,
		worldRecords: entry.worldRecords,
		dateCreated: now,
	}));

	await db.transaction(async (tx) => {
		await tx.insert(userPointsHistory).values(histories);
	});
}
