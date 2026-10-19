import { describe, expect, it } from 'vitest'
import { cssTimeToMilliseconds } from '../../app/utils/motion'

describe('CSS motion time', () => {
	it.each([
		['125ms', 125],
		['.125s', 125],
		[' 0.125s ', 125],
		['160ms', 160],
		['.16s', 160],
		['0s', 0],
		['0', 0],
	] as const)('reads %s as %ims for WAAPI', (value, expected) => {
		expect(cssTimeToMilliseconds(value)).toBe(expected)
	})
})
