import { sql } from 'drizzle-orm';
import { db } from '../index';
import { zslSeasonResult } from '../schema';

interface ZslSeasonResultInput {
	idSeason: number;
	idUser: number;
	position: number;
	points: number;
}

export async function upsertZslSeasonResults(rows: ZslSeasonResultInput[]) {
	if (rows.length === 0) {
		return;
	}

	await db.transaction(async (tx) => {
		await tx
			.insert(zslSeasonResult)
			.values(rows)
			.onConflictDoUpdate({
				target: [zslSeasonResult.idSeason, zslSeasonResult.idUser],
				set: {
					points: sql`EXCLUDED.points`,
					position: sql`EXCLUDED.position`,
				},
			});
	});
}
