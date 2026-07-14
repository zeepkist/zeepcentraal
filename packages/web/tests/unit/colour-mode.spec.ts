import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveInitialColourMode } from '../../app/utils/colourMode'

const themeCss = readFileSync(new URL('../../app/assets/css/tailwind.css', import.meta.url), 'utf8')

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

	it('keeps semantic tokens above layered Nuxt UI defaults', () => {
		const tokenRules = themeCss.indexOf(':root,\n.dark {')
		const baseLayer = themeCss.indexOf('@layer base {')

		expect(tokenRules).toBeGreaterThan(-1)
		expect(baseLayer).toBeGreaterThan(tokenRules)
	})
})
