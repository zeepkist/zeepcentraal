import { describe, expect, it } from 'vitest'
import type { SuperLeagueVoteCandidate } from '../../app/composables/useSuperLeagueVote'
import { voteCandidateLevel } from '../../app/utils/superLeagueVote'

const candidate: SuperLeagueVoteCandidate = {
	levelId: 42,
	workshopId: 3801858959,
	xxHash: 'D7837A7E0E17F8F681F9ED92861284FB',
	adventure: false,
	dateCreated: '2026-09-07T18:35:31Z',
	name: 'ZSL - Altitude',
	imageUrl: 'thumbnails/level.jpg',
	authorName: 'Builder',
	points: 5478,
	rating: 0.87,
	recordCount: 175,
	personalBestCount: 37,
	voteCount: 8,
	selfAuthored: false,
}

describe('Super League vote cards', () => {
	it('shows CDN thumbnails and level metrics from vote candidates', () => {
		const card = voteCandidateLevel(candidate)
		expect(card.imageUrl).toBe('https://cdn.zeepki.st/thumbnails/level.jpg')
		expect(card).toMatchObject({
			points: 5478,
			rating: 0.87,
			recordCount: 175,
			personalBestCount: 37,
			voteCount: 8,
		})
	})

	it('preserves unavailable points and rating when no score exists', () => {
		const card = voteCandidateLevel({
			...candidate,
			imageUrl: null,
			points: null,
			rating: null,
			recordCount: 0,
			personalBestCount: 0,
			voteCount: 0,
		})
		expect(card.imageUrl).toBeUndefined()
		expect(card.points).toBeNull()
		expect(card.rating).toBeNull()
		expect(card.recordCount).toBe(0)
		expect(card.personalBestCount).toBe(0)
	})
})
