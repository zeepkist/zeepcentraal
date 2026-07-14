import { describe, expect, it } from 'vitest'
import { resolveInitialColourMode } from '../../app/utils/colourMode'

describe('resolveInitialColourMode', () => {
	it.each([
		['dark', 'dark'],
		['light', 'light'],
		['system', 'dark'],
		[undefined, 'dark'],
		[null, 'dark'],
		['invalid', 'dark'],
	])('resolves %j to %s', (preference, expected) => {
		expect(resolveInitialColourMode(preference)).toBe(expected)
	})
})
