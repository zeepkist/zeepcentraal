import { createHash } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { db } from '../client'
import { auth } from '../schema'

function hashRefreshToken(refreshToken: string): string {
	return createHash('sha256').update(refreshToken).digest('hex')
}

export async function insertAuth(input: typeof auth.$inferInsert) {
	const [row] = await db
		.insert(auth)
		.values({
			...input,
			refreshToken: null,
			refreshTokenHash: input.refreshToken
				? hashRefreshToken(input.refreshToken)
				: input.refreshTokenHash,
		})
		.returning()
	return row
}

export async function rotateAuth(
	idUser: number,
	currentRefreshToken: string,
	next: typeof auth.$inferInsert,
) {
	return db.transaction(async (tx) => {
		const [consumed] = await tx
			.delete(auth)
			.where(
				and(
					eq(auth.idUser, idUser),
					eq(auth.refreshTokenHash, hashRefreshToken(currentRefreshToken)),
					gt(auth.refreshTokenExpiry, BigInt(Math.floor(Date.now() / 1000))),
				),
			)
			.returning({ id: auth.id })

		if (!consumed) {
			return null
		}

		const [created] = await tx
			.insert(auth)
			.values({
				...next,
				refreshToken: null,
				refreshTokenHash: next.refreshToken
					? hashRefreshToken(next.refreshToken)
					: next.refreshTokenHash,
			})
			.returning()
		return created ?? null
	})
}
