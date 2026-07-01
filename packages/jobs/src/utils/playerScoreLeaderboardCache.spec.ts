import { describe, expect, test } from 'bun:test'
import { type Helpers, Logger } from 'graphile-worker'
import {
	buildPlayerScoreLeaderboardCacheKey,
	getCachedLevelLeaderboards,
	PLAYER_SCORE_LEADERBOARD_CACHE_TTL_MS,
	type PlayerScoreLeaderboardCache,
	type PlayerScoreLeaderboardRows,
	refreshCachedLevelLeaderboards,
} from './playerScoreLeaderboardCache'

class FakeCache implements PlayerScoreLeaderboardCache {
	entries = new Map<string, unknown>()
	getCalls = 0
	getManyCalls = 0
	setCalls = 0
	setManyCalls = 0
	failGet = false
	failGetMany = false
	failSet = false
	failSetMany = false
	lastSetManyEntries: Array<{ key: string; value: unknown; ttl?: number }> = []

	async get<T>(key: string): Promise<T | undefined> {
		this.getCalls++
		if (this.failGet) {
			throw new Error('get failed')
		}
		return this.entries.get(key) as T | undefined
	}

	async getMany<T>(keys: string[]): Promise<Array<T | undefined>> {
		this.getManyCalls++
		if (this.failGetMany) {
			throw new Error('getMany failed')
		}
		return keys.map((key) => this.entries.get(key) as T | undefined)
	}

	async set<T>(key: string, value: T, _ttl?: number): Promise<boolean> {
		this.setCalls++
		if (this.failSet) {
			throw new Error('set failed')
		}
		this.entries.set(key, value)
		return true
	}

	async setMany<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<boolean[]> {
		this.setManyCalls++
		this.lastSetManyEntries = entries
		if (this.failSetMany) {
			throw new Error('setMany failed')
		}
		for (const entry of entries) {
			this.entries.set(entry.key, entry.value)
		}
		return entries.map(() => true)
	}

	async hasMany(keys: string[]): Promise<boolean[]> {
		return keys.map((key) => this.entries.has(key))
	}

	async deleteMany(keys: string[]): Promise<boolean[]> {
		return keys.map((key) => {
			const existed = this.entries.has(key)
			this.entries.delete(key)
			return existed
		})
	}
}

type WarningLog = {
	message: string
	meta?: Parameters<Helpers['logger']['warn']>[1]
}

function createLogger(): {
	logger: Helpers['logger']
	warnings: WarningLog[]
} {
	const warnings: WarningLog[] = []
	const logger: Helpers['logger'] = new Logger(() => (level, message, meta) => {
		if (level === 'warning') {
			warnings.push({ message, meta })
		}
	})
	return { logger, warnings }
}

const leaderboardRows: PlayerScoreLeaderboardRows = [
	{
		idUser: 1,
		idLevel: 10,
		idRecord: 100,
		levelPoints: 1000,
		position: 1n,
	},
	{
		idUser: 2,
		idLevel: 10,
		idRecord: 200,
		levelPoints: 1000,
		position: 2n,
	},
]

describe('player score leaderboard cache', () => {
	test('builds fixed level leaderboard cache key', () => {
		expect(buildPlayerScoreLeaderboardCacheKey(123)).toBe('level-123-leaderboard')
	})

	test('returns empty leaderboards without cache calls for empty level list', async () => {
		const cache = new FakeCache()
		const logger = createLogger()

		const result = await getCachedLevelLeaderboards({
			cache,
			idLevels: [],
			logger: logger.logger,
			loadLeaderboards: async () => {
				throw new Error('should not load')
			},
		})

		expect(result.size).toBe(0)
		expect(cache.getManyCalls).toBe(0)
		expect(cache.setManyCalls).toBe(0)
	})

	test('loads and stores missing leaderboard rows with five minute TTL', async () => {
		const cache = new FakeCache()
		const logger = createLogger()
		let loadCalls = 0

		const result = await getCachedLevelLeaderboards({
			cache,
			idLevels: [10],
			logger: logger.logger,
			loadLeaderboards: async () => {
				loadCalls++
				return new Map([[10, leaderboardRows]])
			},
		})

		expect(loadCalls).toBe(1)
		expect(cache.getManyCalls).toBe(1)
		expect(cache.getCalls).toBe(0)
		expect(cache.setManyCalls).toBe(1)
		expect(cache.setCalls).toBe(0)
		expect(cache.lastSetManyEntries).toHaveLength(1)
		expect(cache.lastSetManyEntries[0]?.ttl).toBe(PLAYER_SCORE_LEADERBOARD_CACHE_TTL_MS)
		expect(result.get(10)).toEqual(leaderboardRows)
		expect(cache.entries.get('level-10-leaderboard')).toEqual([
			{
				idUser: 1,
				idLevel: 10,
				idRecord: 100,
				levelPoints: 1000,
				position: '1',
			},
			{
				idUser: 2,
				idLevel: 10,
				idRecord: 200,
				levelPoints: 1000,
				position: '2',
			},
		])
	})

	test('uses cached leaderboard rows on hit', async () => {
		const cache = new FakeCache()
		const logger = createLogger()
		cache.entries.set('level-10-leaderboard', [
			{
				idUser: 1,
				idLevel: 10,
				idRecord: 100,
				levelPoints: 1000,
				position: '1',
			},
		])

		const result = await getCachedLevelLeaderboards({
			cache,
			idLevels: [10],
			logger: logger.logger,
			loadLeaderboards: async () => {
				throw new Error('should not load')
			},
		})

		expect(cache.getManyCalls).toBe(1)
		expect(cache.getCalls).toBe(0)
		expect(cache.setManyCalls).toBe(0)
		expect(cache.setCalls).toBe(0)
		expect(result.get(10)).toEqual([
			{
				idUser: 1,
				idLevel: 10,
				idRecord: 100,
				levelPoints: 1000,
				position: 1n,
			},
		])
	})

	test('keeps cached hits and loads misses in input order', async () => {
		const cache = new FakeCache()
		const logger = createLogger()
		cache.entries.set('level-10-leaderboard', [
			{
				idUser: 1,
				idLevel: 10,
				idRecord: 100,
				levelPoints: 1000,
				position: '1',
			},
		])
		const loadedRows: PlayerScoreLeaderboardRows = [
			{
				idUser: 3,
				idLevel: 20,
				idRecord: 300,
				levelPoints: 900,
				position: 3n,
			},
		]

		const result = await getCachedLevelLeaderboards({
			cache,
			idLevels: [10, 20],
			logger: logger.logger,
			loadLeaderboards: async (idLevels) => {
				expect(idLevels).toEqual([20])
				return new Map([[20, loadedRows]])
			},
		})

		expect(cache.getManyCalls).toBe(1)
		expect(cache.setManyCalls).toBe(1)
		expect(cache.lastSetManyEntries.map((entry) => entry.key)).toEqual(['level-20-leaderboard'])
		expect(result.get(10)).toEqual([
			{
				idUser: 1,
				idLevel: 10,
				idRecord: 100,
				levelPoints: 1000,
				position: 1n,
			},
		])
		expect(result.get(20)).toEqual(loadedRows)
	})

	test('falls back to loader when cache getMany fails', async () => {
		const cache = new FakeCache()
		const logger = createLogger()
		cache.failGetMany = true
		let loadCalls = 0

		const result = await getCachedLevelLeaderboards({
			cache,
			idLevels: [10],
			logger: logger.logger,
			loadLeaderboards: async () => {
				loadCalls++
				return new Map([[10, leaderboardRows]])
			},
		})

		expect(loadCalls).toBe(1)
		expect(result.get(10)).toEqual(leaderboardRows)
		expect(logger.warnings).toHaveLength(1)
		expect(logger.warnings[0]?.message).toBe('Player score leaderboard cache getMany failed.')
	})

	test('returns loaded rows when cache setMany fails', async () => {
		const cache = new FakeCache()
		const logger = createLogger()
		cache.failSetMany = true

		const result = await getCachedLevelLeaderboards({
			cache,
			idLevels: [10],
			logger: logger.logger,
			loadLeaderboards: async () => new Map([[10, leaderboardRows]]),
		})

		expect(cache.getManyCalls).toBe(1)
		expect(cache.setManyCalls).toBe(1)
		expect(result.get(10)).toEqual(leaderboardRows)
		expect(logger.warnings).toHaveLength(1)
		expect(logger.warnings[0]?.message).toBe('Player score leaderboard cache setMany failed.')
	})

	test('refreshes cached leaderboards with setMany without reading cache', async () => {
		const cache = new FakeCache()
		const logger = createLogger()
		cache.entries.set('level-10-leaderboard', [{ stale: true }])

		await refreshCachedLevelLeaderboards({
			cache,
			idLevels: [10, 20],
			logger: logger.logger,
			loadLeaderboards: async (idLevels) => {
				expect(idLevels).toEqual([10, 20])
				return new Map([[10, leaderboardRows]])
			},
		})

		expect(cache.getCalls).toBe(0)
		expect(cache.getManyCalls).toBe(0)
		expect(cache.setCalls).toBe(0)
		expect(cache.setManyCalls).toBe(1)
		expect(cache.lastSetManyEntries.map((entry) => entry.key)).toEqual([
			'level-10-leaderboard',
			'level-20-leaderboard',
		])
		expect(cache.lastSetManyEntries.map((entry) => entry.ttl)).toEqual([
			PLAYER_SCORE_LEADERBOARD_CACHE_TTL_MS,
			PLAYER_SCORE_LEADERBOARD_CACHE_TTL_MS,
		])
		expect(cache.entries.get('level-10-leaderboard')).toEqual([
			{
				idUser: 1,
				idLevel: 10,
				idRecord: 100,
				levelPoints: 1000,
				position: '1',
			},
			{
				idUser: 2,
				idLevel: 10,
				idRecord: 200,
				levelPoints: 1000,
				position: '2',
			},
		])
		expect(cache.entries.get('level-20-leaderboard')).toEqual([])
	})

	test('logs warning when leaderboard cache refresh setMany fails', async () => {
		const cache = new FakeCache()
		const logger = createLogger()
		cache.failSetMany = true

		await refreshCachedLevelLeaderboards({
			cache,
			idLevels: [10],
			logger: logger.logger,
			loadLeaderboards: async () => new Map([[10, leaderboardRows]]),
		})

		expect(cache.getCalls).toBe(0)
		expect(cache.getManyCalls).toBe(0)
		expect(cache.setManyCalls).toBe(1)
		expect(logger.warnings).toHaveLength(1)
		expect(logger.warnings[0]?.message).toBe(
			'Player score leaderboard cache refresh setMany failed.',
		)
	})
})
