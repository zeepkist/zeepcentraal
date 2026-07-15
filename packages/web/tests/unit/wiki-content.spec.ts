import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const webRoot = fileURLToPath(new URL('../..', import.meta.url))
const wikiRoot = join(webRoot, 'content/wiki')

const readWiki = (name: string) => readFileSync(join(wikiRoot, name), 'utf8')

describe('Wiki documentation', () => {
	test('uses frontmatter headings and MDC alerts without duplicate H1 elements', () => {
		const documents = ['index.md', 'getting-started.md', 'setup-modkist.md'].map(readWiki)

		for (const document of documents) {
			expect(document).not.toMatch(/^# /m)
			expect(document).toContain('::content-alert')
		}

		expect(documents.join('\n')).toContain('type="notice"')
		expect(documents.join('\n')).toContain('type="important"')
		expect(documents.join('\n')).toContain('type="reminder"')
	})

	test('uses current Adventure route and practical setup guidance', () => {
		const gettingStarted = readWiki('getting-started.md')
		const setup = readWiki('setup-modkist.md')

		expect(gettingStarted).toContain('[Adventure Mode](/adventure/a)')
		expect(gettingStarted).not.toContain('[Adventure Mode](/adventure)')
		expect(setup).toContain('https://modkist.com/')
		expect(setup).toContain('https://mod.io/g/zeepkist/m/zeepkist-gtr')
	})

	test('shares request-free content shell across developer and wiki pages', () => {
		const contentPage = readFileSync(
			join(webRoot, 'app/components/content/ContentPage.vue'),
			'utf8',
		)
		const routes = [
			'app/pages/developer/graphql.vue',
			'app/pages/wiki/index.vue',
			'app/pages/wiki/[...slug].vue',
		].map((path) => readFileSync(join(webRoot, path), 'utf8'))

		expect(contentPage).toContain('<PageHeader')
		expect(contentPage).toContain('<ContentDocument')
		expect(contentPage).not.toMatch(/useFetch|\$fetch|useQuery/)
		for (const route of routes) {
			expect(route).toContain('<ContentPage')
			expect(route).toContain('show-table-of-contents')
		}
		expect(routes[2]).toContain("t('pages.wiki.notFound')")
	})
})
