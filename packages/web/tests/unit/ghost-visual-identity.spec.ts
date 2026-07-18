import { describe, expect, it } from 'vitest'
import type { GhostRecordSource } from '../../app/types/ghost'
import {
	buildGhostVisualIdentities,
	normalizeGhostColor,
	sanitizeGhostUsername,
} from '../../app/utils/ghostVisualIdentity'

const labels = {
	unknownPlayer: 'Unknown player',
	worldRecord: (name: string) => `${name} (WR)`,
	personalBest: (name: string) => `${name} (PB)`,
	ordinal: (name: string, ordinal: string) => `${name} (${ordinal})`,
}

function record(overrides: Partial<GhostRecordSource> = {}): GhostRecordSource {
	return {
		recordId: 1,
		levelId: 1,
		userId: 1,
		userSteamId: '76561198000000001',
		userName: 'Player',
		time: 10,
		dateCreated: '2026-07-18T00:00:00Z',
		ghostUrl: 'https://cdn.zeepki.st/ghosts/1',
		mediaRevision: '2026-07-18T00:00:00Z',
		isWorldRecord: false,
		isPersonalBest: false,
		...overrides,
	}
}

describe('ghost visual identity', () => {
	it('uses WR precedence for label and primary colour', () => {
		const [identity] = buildGhostVisualIdentities(
			[
				{
					record: record({ isWorldRecord: true, isPersonalBest: true }),
					ghost: {
						metadata: {
							steamId: '76561198000000001',
							taggedUsername: null,
							color: '#ff0000ff',
							cosmetics: null,
						},
					},
				},
			],
			labels,
			'en',
			'#facc15',
			['#38bdf8'],
		)
		expect(identity).toMatchObject({
			label: 'Player (WR)',
			bodyColor: '#facc15',
			colorSource: 'world-record',
		})
	})

	it('labels PB and slower displayed runs in deterministic time order', () => {
		const identities = buildGhostVisualIdentities(
			[
				{ record: record({ recordId: 3, time: 12 }) },
				{ record: record({ recordId: 1, time: 10, isPersonalBest: true }) },
				{ record: record({ recordId: 2, time: 11 }) },
			],
			labels,
			'en',
			'#facc15',
			['#38bdf8'],
		)
		expect(identities.map(({ label }) => label)).toEqual([
			'Player (3rd)',
			'Player (PB)',
			'Player (2nd)',
		])
	})

	it('only trusts tagged username when Steam IDs match', () => {
		const identities = buildGhostVisualIdentities(
			[
				{
					record: record({ userName: null }),
					ghost: {
						metadata: {
							steamId: 'different',
							taggedUsername: '<color=red>Injected</color>',
							color: null,
							cosmetics: null,
						},
					},
				},
			],
			labels,
			'en',
			'#facc15',
			['#38bdf8'],
		)
		expect(identities[0]?.playerName).toBe('Unknown player')
	})

	it('normalizes colours and strips rich text from fallback names', () => {
		expect(normalizeGhostColor('#12AB34FF')).toBe('#12ab34')
		expect(normalizeGhostColor('#12AB34')).toBeNull()
		expect(sanitizeGhostUsername('<color=#fff>Player</color>')).toBe('Player')
	})
})
