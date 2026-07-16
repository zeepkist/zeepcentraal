import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const webRoot = fileURLToPath(new URL('../..', import.meta.url))
const wikiRoot = join(webRoot, 'content/wiki')
const readWiki = (name: string) => readFileSync(join(wikiRoot, name), 'utf8')
const wikiDocuments = [
	'index.md',
	'getting-started.md',
	'setup-modkist.md',
	'level-editor/index.md',
	'level-editor/useful-mods.md',
	'level-editor/building-tips.md',
	'level-editor/surface-friction.md',
	'level-editor/zeepkist-gravity.md',
	'level-editor/useful-numbers.md',
	'level-editor/light-tricks.md',
	'level-editor/pre-v18-logic-blocks.md',
]

describe('Wiki documentation', () => {
	test('uses frontmatter headings, focused routes, and MDC presentation', () => {
		const documents = wikiDocuments.map(readWiki)
		for (const document of documents) expect(document).not.toMatch(/^# /m)

		expect(readWiki('index.md')).toContain('::content-resource-grid')
		expect(readWiki('level-editor/index.md')).toContain('::content-resource-grid')
		expect(documents.join('\n')).toContain('type="notice"')
		expect(documents.join('\n')).toContain('type="important"')
		expect(documents.join('\n')).toContain('type="reminder"')
		expect(existsSync(join(webRoot, 'app/pages/wiki/guides.vue'))).toBe(false)
	})

	test('provides validated source edit links for every wiki document', () => {
		const editLink = readFileSync(
			join(webRoot, 'app/components/content/ContentEditLink.vue'),
			'utf8',
		)
		const contentPage = readFileSync(
			join(webRoot, 'app/components/content/ContentPage.vue'),
			'utf8',
		)
		const contentConfig = readFileSync(join(webRoot, 'content.config.ts'), 'utf8')

		for (const documentPath of wikiDocuments) {
			const expectedPath = `wiki/${documentPath}`
			expect(readWiki(documentPath)).toContain(`editPath: ${expectedPath}`)
		}
		expect(editLink).toContain(
			'https://github.com/zeepkist/zeepcentraal/blob/develop/packages/web/content/',
		)
		expect(editLink).toContain('SAFE_CONTENT_PATH')
		expect(editLink).toContain('new URL(props.path, CONTENT_SOURCE_BASE_URL)')
		expect(editLink).not.toMatch(/useFetch|\$fetch|useQuery/)
		expect(contentPage).toContain('<ContentEditLink :path="document.editPath"')
		expect(contentConfig).toContain('editPath: z.string()')
	})

	test('embeds the exact Zeepkist introduction through a request-free privacy component', () => {
		const gettingStarted = readWiki('getting-started.md')
		const embed = readFileSync(
			join(webRoot, 'app/components/content/ContentYoutubeEmbed.vue'),
			'utf8',
		)

		expect(gettingStarted).toContain('video-id="rk9rMywR1yc"')
		expect(gettingStarted.indexOf('content-youtube-embed')).toBeLessThan(
			gettingStarted.indexOf('## Install Zeepkist'),
		)
		expect(embed).toContain('https://www.youtube-nocookie.com/embed/')
		expect(embed).toContain('loading="lazy"')
		expect(embed).toContain('referrerpolicy="strict-origin-when-cross-origin"')
		expect(embed).toContain('allowfullscreen')
		expect(embed).toContain('aspect-video')
		expect(embed).not.toMatch(/useFetch|\$fetch|useQuery/)
	})

	test('preserves supplied friction, gravity, editor, and logic values verbatim', () => {
		const friction = readWiki('level-editor/surface-friction.md')
		const gravity = readWiki('level-editor/zeepkist-gravity.md')
		const building = readWiki('level-editor/building-tips.md')
		const numbers = readWiki('level-editor/useful-numbers.md')
		const lights = readWiki('level-editor/light-tricks.md')
		const logic = readWiki('level-editor/pre-v18-logic-blocks.md')

		for (const value of [
			'70,00%',
			'26,00%',
			'15,00%',
			'10,00%',
			'5,00%',
			'35,50%',
			'45,50%',
			'11,00%',
			'0,00%',
			'100,00%',
		])
			expect(friction).toContain(value)

		for (const value of [
			'5.585161',
			'5.232066',
			'4.662559',
			'3.472288',
			'0.533629',
			'-0.360498',
			'-0.764848',
			'-8.532932',
			'-150.45992',
			'-100',
		])
			expect(gravity).toContain(value)

		expect(building).toContain('10-20s')
		expect(building).toContain('fan height at 0.001 and range at 2000')
		for (const value of [
			'x0 y0 z0',
			'x0 y500 z0',
			'16m wide, 16m long, and 1.6m high',
			'26.565°',
			'14.036°',
			'10°, 15°, 30°, and 45°',
			'9.462°',
			'7.125°',
		])
			expect(numbers).toContain(value)
		expect(lights).toContain('folder 803, block 2265')
		expect(lights).toContain('X1000/Y1/Z1000')
		expect(logic).toContain('0.5s')
		expect(logic).toContain('| 1 | 1 | 1 | 0 | 1 | 0 | 0 | 1 |')
	})

	test('renders supplied tree images with Nuxt Image', () => {
		const building = readWiki('level-editor/building-tips.md')
		const gallery = readFileSync(
			join(webRoot, 'app/components/content/ContentWikiImageGallery.vue'),
			'utf8',
		)
		expect(building).toContain('::content-wiki-image-gallery')
		for (const name of ['tree-trick-1.jpg', 'tree-trick-2.jpg', 'tree-trick-3.jpg']) {
			expect(existsSync(join(webRoot, 'app/assets/wiki', name))).toBe(true)
			expect(gallery).toContain(name)
		}
		expect(gallery).toContain('<NuxtImg')
		expect(gallery).toContain(':alt="image.caption"')
	})

	test('loads release metadata in route while keeping presentation request-free', () => {
		const route = readFileSync(join(webRoot, 'app/pages/wiki/[...slug].vue'), 'utf8')
		const downloads = readFileSync(
			join(webRoot, 'app/components/content/ContentModkistDownloads.vue'),
			'utf8',
		)
		const panel = readFileSync(
			join(webRoot, 'app/components/content/ContentModkistReleasePanel.vue'),
			'utf8',
		)
		const setup = readWiki('setup-modkist.md')

		expect(route).toContain("path.value === '/wiki/setup-modkist'")
		expect(route).toContain("useFetch<ModkistReleases>('/api/modkist/releases'")
		expect(setup).toContain('::content-modkist-downloads')
		expect(setup).toContain('cargo install zeeper')
		expect(setup).toContain('https://crates.io/crates/zeeper')
		expect(panel).toContain('/api/downloads/modkist/$' + '{channel}/$' + '{format}')
		expect(panel).toContain("['msi', 'appimage', 'deb', 'dmg']")
		for (const source of [downloads, panel])
			expect(source).not.toMatch(/useFetch|\$fetch|useQuery/)
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
