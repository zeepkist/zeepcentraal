import { and, eq } from 'drizzle-orm';
import { db } from '../index';
import { auth } from '../schema';

export async function getAuthByRefreshToken(refreshToken: string, provider: string) {
	return db.query.auth.findFirst({
		where: and(eq(auth.refreshToken, refreshToken), eq(auth.provider, provider)),
	});
}

export async function insertAuth(input: typeof auth.$inferInsert) {
	const [row] = await db.insert(auth).values(input).returning();
	return row;
}

export async function getAuthByUserAndRefreshToken(idUser: number, token: string) {
	return db.query.auth.findFirst({
		where: and(eq(auth.idUser, idUser), eq(auth.refreshToken, token)),
	});
}

export async function deleteAuthById(id: number) {
	await db.delete(auth).where(eq(auth.id, id));
}

export async function deleteAuthByRefreshToken(refreshToken: string) {
	await db.delete(auth).where(eq(auth.refreshToken, refreshToken));
}
