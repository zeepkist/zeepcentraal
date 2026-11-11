import { createHead, renderSSRHead } from '@unhead/vue/server'
import { afterEach, expect, test, vi } from 'vitest'
import { buildDiscordEmbed } from '../../app/utils/discordPreview'

afterEach(() => vi.unstubAllGlobals())

async function fixture(path = '/wiki/level-editor', query = {}) {
	const head = createHead()
	const route = { value: { path, query, matched: [{}] } }
	const error = { value: null as unknown }
	vi.stubGlobal('defineNuxtPlugin', (plugin: unknown) => plugin)
	vi.stubGlobal('useSiteConfig', () => ({ url: 'https://zeepki.st' }))
	vi.stubGlobal('useError', () => error)
	vi.stubGlobal('injectHead', () => head)
	const { default: plugin } = await import('../../app/plugins/discord-preview')
	;(plugin as unknown as (app: unknown) => void)({ $router: { currentRoute: route } })
	return { head, route, error }
}

test('fallback uses resolved metadata and preserves existing OG image', async () => {
	const { head } = await fixture()
	head.push({
		title: 'Level editor',
		meta: [
			{ name: 'description', content: 'Editor guide' },
			{ property: 'og:image', content: 'https://zeepki.st/existing.png' },
		],
	})
	const { headTags } = await renderSSRHead(head)
	expect(headTags).toContain('id="discord:component-embed"')
	expect(headTags).toContain('Level editor')
	expect(headTags).toContain('Editor guide')
	expect(headTags.match(/property="og:image"/g)).toHaveLength(1)
	expect(headTags).toContain('existing.png')
})

test('feature preview replaces fallback and disappears with entry disposal', async () => {
	const { head } = await fixture('/totw/overall', {
		overallAfter: 'cursor',
		utm_source: 'discord',
	})
	const payload = buildDiscordEmbed(
		{ title: 'Actual standings', rows: [{ name: 'Player 51', rank: 51 }] },
		'https://zeepki.st/totw/overall?overallAfter=cursor',
	)
	const entry = head.push({
		script: [{ id: 'discord:component-embed', type: 'application/json', innerHTML: payload }],
	})
	const first = (await renderSSRHead(head)).headTags
	expect(first.match(/id="discord:component-embed"/g)).toHaveLength(1)
	expect(first).toContain('Player 51')
	entry.dispose()
	const second = (await renderSSRHead(head)).headTags
	expect(second).not.toContain('Player 51')
	expect(second).toContain('Overall standings')
	expect(second).not.toContain('utm_source')
})

test('excluded routes and error responses have no fallback', async () => {
	const { head, route, error } = await fixture()
	for (const path of ['/settings', '/admin/ghost-validation', '/records/me']) {
		route.value.path = path
		head.push({ title: path })
		expect((await renderSSRHead(head)).headTags).not.toContain('discord:component-embed')
	}
	route.value.path = '/level/missing'
	error.value = { statusCode: 404 }
	head.push({ title: 'Not found' })
	expect((await renderSSRHead(head)).headTags).not.toContain('discord:component-embed')
})
