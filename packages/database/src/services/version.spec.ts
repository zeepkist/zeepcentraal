import { expect, test } from 'bun:test'
import { isExactModVersionOutdated } from './versionSemver'

test.each([
	['1.2.2', '1.2.3', true],
	['1.2.3', '1.2.3', false],
	['1.2.4', '1.2.3', false],
	['1.2.3-beta.1', '1.2.3', true],
	['1.2.3+build.7', '1.2.3', false],
	['v1.2.3', '1.2.3', false],
	['invalid', '1.2.3', true],
	['1.2.3', 'invalid', true],
])('compares exact mod version %s against %s', (current, minimum, expected) => {
	expect(isExactModVersionOutdated(current, minimum)).toBe(expected)
})
