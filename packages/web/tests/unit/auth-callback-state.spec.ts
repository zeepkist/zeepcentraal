import { describe, expect, test } from 'vitest'
import { shouldShowAuthVerificationFailure } from '../../app/utils/auth-callback-state'

describe('OAuth callback state', () => {
	test('waits for session resolution before reporting failure', () => {
		expect(shouldShowAuthVerificationFailure(true, true, false)).toBe(false)
	})

	test('never reports failure after a verified session arrives', () => {
		expect(shouldShowAuthVerificationFailure(true, false, true)).toBe(false)
	})

	test('reports failure only after callback session resolution finishes without a user', () => {
		expect(shouldShowAuthVerificationFailure(true, false, false)).toBe(true)
		expect(shouldShowAuthVerificationFailure(false, false, false)).toBe(false)
	})
})
