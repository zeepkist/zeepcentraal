import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const layout = readFileSync(new URL('../../app/layouts/default.vue', import.meta.url), 'utf8')

describe('application shell layout', () => {
	test('lets short content share the viewport with header and footer', () => {
		expect(layout).toContain('class="flex min-h-dvh min-w-0 flex-1 flex-col"')
		expect(layout).toContain('<UMain')
		expect(layout).toContain(':ui="{ base: \'min-h-0\' }"')
		expect(layout).toContain('class="app-page-content min-w-0 flex-1 px-4 py-5"')
	})
})
