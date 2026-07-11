import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { mainNav } from '../../app/utils/navigation'

const en = JSON.parse(
	readFileSync(new URL('../../i18n/locales/en.json', import.meta.url), 'utf8'),
) as {
	nav: Record<string, string>
	navDescriptions: Record<string, string>
}

function resolveKey(source: Record<string, unknown>, key: string): unknown {
	return key.split('.').reduce<unknown>((current, segment) => {
		if (current && typeof current === 'object' && segment in current) {
			return (current as Record<string, unknown>)[segment]
		}

		return undefined
	}, source)
}

describe('navigation model', () => {
	test('uses route keys that resolve through i18n', () => {
		for (const item of mainNav) {
			expect(item.to.startsWith('/')).toBe(true)
			expect(resolveKey(en, item.labelKey)).toBeTypeOf('string')
			expect(resolveKey(en, item.descriptionKey ?? item.labelKey)).toBeTypeOf('string')
		}
	})
})
