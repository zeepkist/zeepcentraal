import { expect, test } from 'bun:test'
import { isLevelScoreEligible } from './levelScoreEligibility'

test('adventure levels remain scoreable regardless of workshop state', () => {
	expect(isLevelScoreEligible({ adventure: true, itemCount: 2, accessibleItemCount: 0 })).toBe(
		true,
	)
})

test('levels without workshop items remain scoreable', () => {
	expect(isLevelScoreEligible({ adventure: false, itemCount: 0, accessibleItemCount: 0 })).toBe(
		true,
	)
})

test('levels with any accessible workshop item remain scoreable', () => {
	expect(isLevelScoreEligible({ adventure: false, itemCount: 2, accessibleItemCount: 1 })).toBe(
		true,
	)
})

test('levels with only deleted workshop items are not scoreable', () => {
	expect(isLevelScoreEligible({ adventure: false, itemCount: 2, accessibleItemCount: 0 })).toBe(
		false,
	)
})
