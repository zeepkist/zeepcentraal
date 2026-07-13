import { describe, expect, it } from 'vitest'
import { buildLevelAvailabilityFilter } from '../../app/utils/levelExplorer'

describe('level availability filters', () => {
	it('does not require workshop items for Adventure levels', () => {
		expect(buildLevelAvailabilityFilter('yes')).toEqual({
			adventure: { equalTo: true },
		})
	})

	it('requires an accessible workshop item for community levels', () => {
		expect(buildLevelAvailabilityFilter('no')).toEqual({
			adventure: { equalTo: false },
			levelItems: { some: { deleted: { equalTo: false } } },
		})
	})

	it('combines official and accessible community levels by default', () => {
		expect(buildLevelAvailabilityFilter('all')).toEqual({
			or: [
				{ adventure: { equalTo: true } },
				{
					adventure: { equalTo: false },
					levelItems: { some: { deleted: { equalTo: false } } },
				},
			],
		})
	})
})
