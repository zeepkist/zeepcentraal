import { eq, gte } from 'drizzle-orm';
import { db } from '../index';
import { level, record } from '../schema';

export async function getLevel(hash: string) {
	return db.query.level.findFirst({
		where: eq(level.hash, hash),
	});
}

export async function getOrInsertLevel(hash: string) {
	const existing = await getLevel(hash);
	if (existing) {
		return existing;
	}

	const [created] = await db.insert(level).values({ hash }).returning();
	return created;
}

export async function getAllLevelIds(): Promise<number[]> {
	const levels = await db.select({ id: level.id }).from(level);
	return levels.map((entry) => entry.id);
}

export async function getAllLevelIdsWithRecordsSince(recordsSince: Date): Promise<number[]> {
	const levels = await db
		.select({ id: level.id })
		.from(level)
		.innerJoin(record, eq(level.id, record.idLevel))
		.where(gte(record.dateCreated, recordsSince.toISOString()));

	return levels.map((entry) => entry.id);
}
