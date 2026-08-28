import { and, eq, gt, isNotNull } from 'drizzle-orm'
import { db } from '../client'
import { auth, user } from '../schema'

function hashRefreshToken(refreshToken: string): string {
	return new Bun.CryptoHasher('sha256').update(refreshToken).digest('hex')
}

export type WebSessionInput = {
	steamId: string
	accessToken: string
	refreshToken: string
}

export type WebRefreshSessionInput = Pick<WebSessionInput, 'steamId' | 'refreshToken'>

function parseSteamId(value: string) {
	try {
		return BigInt(value)
	} catch {
		return null
	}
}

export async function getWebSession(input: WebSessionInput) {
	const steamId = parseSteamId(input.steamId)
	if (steamId === null) return null

	const now = BigInt(Math.floor(Date.now() / 1000))
	const [session] = await db
		.select({
			id: user.id,
			steamId: user.steamId,
			steamName: user.steamName,
			discordId: user.discordId,
			accessTokenExpiry: auth.accessTokenExpiry,
		})
		.from(auth)
		.innerJoin(user, eq(auth.idUser, user.id))
		.where(
			and(
				eq(auth.accessToken, input.accessToken),
				eq(auth.refreshTokenHash, hashRefreshToken(input.refreshToken)),
				isNotNull(auth.accessTokenExpiry),
				gt(auth.accessTokenExpiry, now),
				gt(auth.refreshTokenExpiry, now),
				eq(user.steamId, steamId),
				eq(user.banned, false),
			),
		)
		.limit(1)

	if (!session?.steamId || !session.accessTokenExpiry) return null
	return {
		...session,
		steamId: session.steamId,
		accessTokenExpiry: session.accessTokenExpiry,
	}
}

export async function getRefreshableWebSession(input: WebRefreshSessionInput) {
	const steamId = parseSteamId(input.steamId)
	if (steamId === null) return false

	const [session] = await db
		.select({ id: auth.id })
		.from(auth)
		.innerJoin(user, eq(auth.idUser, user.id))
		.where(
			and(
				eq(auth.refreshTokenHash, hashRefreshToken(input.refreshToken)),
				gt(auth.refreshTokenExpiry, BigInt(Math.floor(Date.now() / 1000))),
				eq(user.steamId, steamId),
				eq(user.banned, false),
			),
		)
		.limit(1)

	return Boolean(session)
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
