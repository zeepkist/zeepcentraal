import { and, eq, sql } from 'drizzle-orm';
import { db } from '../index';
import { personalBestGlobal, record, recordMedia, worldRecordGlobal } from '../schema';
import { GHOST_FOLDER } from '../config';
import { uploadFile } from '../s3';
import { generateUid } from '../utils/generateUid';

export async function insertRecord(input: typeof record.$inferInsert) {
	const [created] = await db.insert(record).values(input).returning();
	return created;
}

export async function insertRecordMedia({
	idRecord,
	ghostData,
}: {
	idRecord: number;
	ghostData: string;
}) {
	const uid = generateUid();
	const ghostUrl = `${GHOST_FOLDER}/${uid}.bin`;
	void uploadFile(ghostUrl, Buffer.from(ghostData, 'base64'));
	const [created] = await db
		.insert(recordMedia)
		.values({
			idRecord,
			ghostUrl,
			dateCreated: new Date().toISOString(),
			dateUpdated: new Date().toISOString(),
		})
		.returning();
	return created;
}

export async function upsertPersonalBest({
	idUser,
	idLevel,
	idRecord,
	time,
}: {
	idUser: number;
	idLevel: number;
	idRecord: number;
	time: number;
}) {
	const existing = await db
		.select({ id: personalBestGlobal.id, idRecord: personalBestGlobal.idRecord, time: record.time })
		.from(personalBestGlobal)
		.leftJoin(record, eq(personalBestGlobal.idRecord, record.id))
		.where(and(eq(personalBestGlobal.idUser, idUser), eq(personalBestGlobal.idLevel, idLevel)))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!existing || (typeof existing.time === 'number' && existing.time > time)) {
		const now = new Date().toISOString();
		const [updated] = await db
			.update(personalBestGlobal)
			.set({ idRecord, dateUpdated: now })
			.where(and(eq(personalBestGlobal.idUser, idUser), eq(personalBestGlobal.idLevel, idLevel)))
			.returning();

		if (updated) {
			return updated;
		}

		const [inserted] = await db
			.insert(personalBestGlobal)
			.values({ idUser, idLevel, idRecord, dateCreated: now, dateUpdated: now })
			.returning();

		return inserted;
	}

	return null;
}

export async function upsertWorldRecord({
	idUser,
	idLevel,
	idRecord,
	time,
}: {
	idUser: number;
	idLevel: number;
	idRecord: number;
	time: number;
}) {
	const existing = await db
		.select({ id: worldRecordGlobal.id, time: record.time })
		.from(worldRecordGlobal)
		.leftJoin(record, eq(worldRecordGlobal.idRecord, record.id))
		.where(eq(worldRecordGlobal.idLevel, idLevel))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (!existing || (typeof existing.time === 'number' && existing.time > time)) {
		const now = new Date().toISOString();
		const [updated] = await db
			.update(worldRecordGlobal)
			.set({ idUser, idRecord, dateUpdated: now })
			.where(eq(worldRecordGlobal.idLevel, idLevel))
			.returning();

		if (updated) {
			return updated;
		}

		const [inserted] = await db
			.insert(worldRecordGlobal)
			.values({ idUser, idLevel, idRecord, dateCreated: now, dateUpdated: now })
			.returning();

		return inserted;
	}

	return null;
}

export async function getPersonalBestsWithRecord({
	idLevel,
	limit = 10,
}: {
	idLevel: number;
	limit?: number;
}) {
	const personalBests = await db
		.select({
			id: record.idLevel,
			time: record.time,
			totalCount: sql<number>`COUNT(*) OVER ()`,
		})
		.from(record)
		.innerJoin(personalBestGlobal, eq(personalBestGlobal.idRecord, record.id))
		.where(eq(record.idLevel, idLevel))
		.orderBy(record.time)
		.limit(limit);

	return personalBests;
}
