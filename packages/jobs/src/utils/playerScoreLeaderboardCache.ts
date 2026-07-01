import KeyvPostgres from '@keyv/postgres'
import { jobsConfig } from '@zeepkist/core/config/jobs'
import {
	getLevelsPersonalBestsWithLevelPointsAndPosition,
	type PersonalBestWithLevelPointsAndPosition,
} from '@zeepkist/database/services/personalBest'
import type { Helpers } from 'graphile-worker'
import Keyv from 'keyv'

// 1 day in milliseconds
export const PLAYER_SCORE_LEADERBOARD_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export type PlayerScoreLeaderboardRows = PersonalBestWithLevelPointsAndPosition[]

interface PlayerScoreLeaderboardCacheEntry<T> {
	key: string
	value: T
	ttl?: number
}

interface CachedPlayerScoreLeaderboardRow {
	idUser: number
	idLevel: number
	idRecord: number
	levelPoints: number
	position: string
}

export interface PlayerScoreLeaderboardCache {
	get<T>(key: string): Promise<T | undefined>
	getMany<T>(keys: string[]): Promise<Array<T | undefined>>
	set<T>(key: string, value: T, ttl?: number): Promise<boolean>
	setMany<T>(entries: Array<PlayerScoreLeaderboardCacheEntry<T>>): Promise<boolean[]>
	hasMany(keys: string[]): Promise<boolean[]>
	deleteMany(keys: string[]): Promise<boolean[]>
}

let playerScoreLeaderboardCache: PlayerScoreLeaderboardCache | undefined

export function buildPlayerScoreLeaderboardCacheKey(levelId: number): string {
	return `level-${levelId}-leaderboard`
}

export function getPlayerScoreLeaderboardCache(): PlayerScoreLeaderboardCache {
	playerScoreLeaderboardCache ??= new Keyv({
		emitErrors: false,
		namespace: 'update-player-scores',
		store: new KeyvPostgres({
			uri: jobsConfig.databaseUrl,
			schema: 'keyv',
			table: 'cache',
			max: 2,
			iterationLimit: 1000,
			useUnloggedTable: true,
			clearExpiredInterval: 5 * 60 * 1000, // 5 minutes
		}),
		throwOnErrors: true,
		ttl: PLAYER_SCORE_LEADERBOARD_CACHE_TTL_MS,
	})

	return playerScoreLeaderboardCache
}

export function setPlayerScoreLeaderboardCache(cache: PlayerScoreLeaderboardCache | undefined) {
	playerScoreLeaderboardCache = cache
}

function serializeLeaderboardRows(
	rows: PlayerScoreLeaderboardRows,
): CachedPlayerScoreLeaderboardRow[] {
	return rows.map((row) => ({
		...row,
		position: row.position.toString(),
	}))
}

function deserializeLeaderboardRows(
	rows: CachedPlayerScoreLeaderboardRow[],
): PlayerScoreLeaderboardRows {
	return rows.map((row) => ({
		...row,
		position: BigInt(row.position),
	}))
}

export async function getCachedLevelLeaderboards({
	cache = getPlayerScoreLeaderboardCache(),
	idLevels,
	logger,
	loadLeaderboards = getLevelsPersonalBestsWithLevelPointsAndPosition,
}: {
	cache?: PlayerScoreLeaderboardCache
	idLevels: number[]
	logger: Helpers['logger']
	loadLeaderboards?: (
		idLevels: number[],
	) => Promise<Map<number, PersonalBestWithLevelPointsAndPosition[]>>
}): Promise<Map<number, PlayerScoreLeaderboardRows>> {
	const leaderboards = new Map<number, PlayerScoreLeaderboardRows>()
	if (idLevels.length === 0) {
		return leaderboards
	}

	const missingLevelIds: number[] = []
	const cacheKeys = idLevels.map(buildPlayerScoreLeaderboardCacheKey)

	try {
		const cachedLeaderboards = await cache.getMany<CachedPlayerScoreLeaderboardRow[]>(cacheKeys)
		for (let index = 0; index < idLevels.length; index++) {
			const idLevel = idLevels[index]
			if (idLevel === undefined) {
				continue
			}
			const cached = cachedLeaderboards[index]
			if (cached === undefined) {
				missingLevelIds.push(idLevel)
				continue
			}
			leaderboards.set(idLevel, deserializeLeaderboardRows(cached))
		}
	} catch (error) {
		logger.warn('Player score leaderboard cache getMany failed.', {
			error,
		})
		missingLevelIds.push(...idLevels)
	}

	if (missingLevelIds.length === 0) {
		return leaderboards
	}

	const loadedLeaderboards = await loadLeaderboards(missingLevelIds)
	const cacheEntries: Array<PlayerScoreLeaderboardCacheEntry<CachedPlayerScoreLeaderboardRow[]>> =
		[]
	for (const idLevel of missingLevelIds) {
		const rows = loadedLeaderboards.get(idLevel) ?? []
		leaderboards.set(idLevel, rows)
		cacheEntries.push({
			key: buildPlayerScoreLeaderboardCacheKey(idLevel),
			value: serializeLeaderboardRows(rows),
			ttl: PLAYER_SCORE_LEADERBOARD_CACHE_TTL_MS,
		})
	}

	try {
		await cache.setMany(cacheEntries)
	} catch (error) {
		logger.warn('Player score leaderboard cache setMany failed.', {
			error,
		})
	}

	return leaderboards
}

export async function refreshCachedLevelLeaderboards({
	cache = getPlayerScoreLeaderboardCache(),
	idLevels,
	logger,
	loadLeaderboards = getLevelsPersonalBestsWithLevelPointsAndPosition,
}: {
	cache?: PlayerScoreLeaderboardCache
	idLevels: number[]
	logger: Helpers['logger']
	loadLeaderboards?: (
		idLevels: number[],
	) => Promise<Map<number, PersonalBestWithLevelPointsAndPosition[]>>
}): Promise<void> {
	const uniqueLevelIds = [...new Set(idLevels)]
	if (uniqueLevelIds.length === 0) {
		return
	}

	const loadedLeaderboards = await loadLeaderboards(uniqueLevelIds)
	const cacheEntries = uniqueLevelIds.map((idLevel) => ({
		key: buildPlayerScoreLeaderboardCacheKey(idLevel),
		value: serializeLeaderboardRows(loadedLeaderboards.get(idLevel) ?? []),
		ttl: PLAYER_SCORE_LEADERBOARD_CACHE_TTL_MS,
	}))

	try {
		await cache.setMany(cacheEntries)
	} catch (error) {
		logger.warn('Player score leaderboard cache refresh setMany failed.', {
			error,
		})
	}
}
