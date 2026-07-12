import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const component = readFileSync(
	new URL('../../app/components/dashboard/SteamNewsFeed.vue', import.meta.url),
	'utf8',
)

describe('Steam announcement cards', () => {
	it('makes every announcement a safe external card link', () => {
		expect(component).toContain('<a')
		expect(component).toContain('v-for="item in items"')
		expect(component).toContain(':href="item.url"')
		expect(component).toContain('target="_blank"')
		expect(component).toContain('rel="noopener"')
		expect(component).not.toContain('<article')
	})

	it('matches Super League hover and focus interactions', () => {
		expect(component).toContain('hover:border-primary/50')
		expect(component).toContain('motion-safe:hover:-translate-y-1')
		expect(component).toContain('hover:shadow-primary/10')
		expect(component).toContain('focus-visible:ring-2')
		expect(component).toContain('focus-visible:ring-primary')
		expect(component).toContain('motion-safe:group-hover:translate-x-1')
		expect(component).toContain('motion-safe:group-hover:-translate-y-1')
	})

	it('renders data-fed content and no request logic', () => {
		expect(component).toContain('{{ item.title }}')
		expect(component).toContain('{{ item.contents }}')
		expect(component).toContain('v-if="item.author"')
		expect(component).toContain('{{ item.author }}')
		expect(component).toContain('<NuxtTime :datetime="item.date" relative />')
		expect(component).toContain('name="brand-steam"')
		expect(component).toContain('name="external-link"')
		expect(component).not.toContain('useFetch')
		expect(component).not.toContain('$fetch')
	})
})
