import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const nuxtConfig = readFileSync(new URL('../../nuxt.config.ts', import.meta.url), 'utf8')

describe('Nuxt configuration', () => {
	it('does not inherit generic DEBUG as Nuxt hook timing', () => {
		expect(nuxtConfig).toContain('\tdebug: false,')
	})
})
