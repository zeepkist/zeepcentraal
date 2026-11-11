import { describe, expect, test } from 'vitest'
import {
	buildDiscordEmbed,
	discordPageUrl,
	discordStandingRow,
	discordText,
	discordUrl,
	isDiscordPreviewPage,
} from '../../app/utils/discordPreview'

const pageUrl = 'https://zeepki.st/totw/2026-w45?standingsAfter=cursor'

describe('Discord component previews', () => {
	test('uses one container, native thumbnail, three placements and link-only buttons', () => {
		const text = buildDiscordEmbed(
			{
				title: 'Weekly event',
				image: '/thumbnail.png',
				rows: Array.from({ length: 4 }, (_, index) => ({
					name: `Player ${index}`,
					rank: index < 2 ? 1 : index + 1,
					value: '0:42.000',
					url: `/user/${index}`,
				})),
				links: [{ label: 'Overall standings', url: '/totw/overall' }],
			},
			pageUrl,
		)!
		const payload = JSON.parse(text)
		expect(Object.keys(payload)).toEqual(['component'])
		expect(payload.component.type).toBe(17)
		expect(payload.component.components[0].accessory.media.url).toBe(
			'https://zeepki.st/thumbnail.png',
		)
		expect(text).toContain('#1 [Player 0]')
		expect(text).toContain('#1 [Player 1]')
		expect(text).not.toContain('Player 3')
		const buttons = payload.component.components.at(-1).components
		expect(buttons).toHaveLength(2)
		for (const button of buttons) {
			expect(button.style).toBe(5)
			expect(Object.keys(button).sort()).toEqual(['label', 'style', 'type', 'url'])
		}
	})

	test('fits escaped UTF-8 bytes without corrupting Unicode or JSON', () => {
		const text = buildDiscordEmbed(
			{
				title: '😀</script>&'.repeat(100),
				description: '競争'.repeat(1000),
				rows: Array.from({ length: 3 }, (_, index) => ({
					name: '🧑‍🚀[*@everyone</script>'.repeat(100),
					rank: index + 1,
					value: '42.000 seconds',
					url: `/user/${'1'.repeat(500)}`,
				})),
				links: Array.from({ length: 10 }, (_, index) => ({
					label: 'Link',
					url: `/levels?q=${'a'.repeat(400)}${index}`,
				})),
			},
			pageUrl,
		)!
		expect(text).toBeDefined()
		expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(3000)
		expect(text).not.toContain('</script>')
		expect(text).not.toContain('@everyone')
		expect(JSON.parse(text).component.type).toBe(17)
	})

	test('keeps placements and primary link when URLs consume byte budget', () => {
		const url = `https://zeepki.st/levels?q=${'x'.repeat(1800)}`
		const text = buildDiscordEmbed(
			{
				title: 'Levels',
				rows: [
					{ name: 'First', rank: 1, url },
					{ name: 'Second', rank: 2, url },
					{ name: 'Third', rank: 3, url },
				],
			},
			url,
		)!
		expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(3000)
		expect(text).toContain('Third')
		expect(JSON.parse(text).component.components.at(-1).components[0].url).toBe(url)
	})

	test('drops invalid media and buttons, escapes Markdown and disables mentions', () => {
		const text = buildDiscordEmbed(
			{
				title: 'Title',
				image: 'javascript:alert(1)',
				rows: [{ name: '[name](https://evil.invalid) @everyone' }],
				links: [{ label: 'Unsafe', url: 'data:text/html,evil' }],
			},
			pageUrl,
		)!
		expect(text).not.toContain('javascript:')
		expect(text).not.toContain('data:text')
		expect(discordText('[name] @everyone')).toBe('\\[name\\] @\u200beveryone')
		expect(discordUrl('https://name:password@example.com', pageUrl)).toBeUndefined()
		expect(discordUrl(`https://example.com/${'x'.repeat(2048)}`, pageUrl)).toBeUndefined()
	})

	test('distinguishes empty results from failed or unavailable results', () => {
		expect(buildDiscordEmbed({ title: 'Empty', rows: [] }, pageUrl)).toContain('No results.')
		expect(buildDiscordEmbed({ title: 'Unavailable' }, pageUrl)).not.toContain('No results.')
	})

	test('keeps public filters and all cursor directions; drops private and tracking state', () => {
		const url = new URL(
			discordPageUrl(
				'/levels',
				{
					q: 'foo & bar',
					sort: 'POINTS_DESC',
					before: 'b',
					last: '1',
					pbsAfter: 'p',
					standingsBefore: 's',
					historyLast: '1',
					roundId: '5',
					essential: '1',
					minPeak: '10',
					tags: ['one', 'two'],
					pb: 'yes',
					wr: 'no',
					auth: 'callback',
					token: 'secret',
					utm_source: 'discord',
				},
				'https://zeepki.st',
			),
		)
		expect(url.searchParams.get('q')).toBe('foo & bar')
		for (const key of [
			'sort',
			'before',
			'last',
			'pbsAfter',
			'standingsBefore',
			'historyLast',
			'roundId',
			'essential',
			'minPeak',
		])
			expect(url.searchParams.has(key)).toBe(true)
		expect(url.searchParams.getAll('tags')).toEqual(['one', 'two'])
		for (const key of ['pb', 'wr', 'auth', 'token', 'utm_source'])
			expect(url.searchParams.has(key)).toBe(false)
	})

	test('formats public standing fields without renumbering shared ranks', () => {
		expect(
			discordStandingRow({
				rank: 51,
				totalPoints: 500,
				user: { steamId: '123', steamName: 'Player' },
			}),
		).toEqual({ name: 'Player', url: '/user/123', rank: 51, value: '500 points' })
		expect(
			discordStandingRow({
				rank: 1,
				completedLevels: 3,
				totalLevels: 5,
				totalTimeMs: '42000',
			}).value,
		).toContain('3/5 levels')
	})

	test('excludes private pages with path boundaries', () => {
		for (const path of [
			'/settings',
			'/settings/discord',
			'/admin/ghost-validation',
			'/records/me',
			'/records/me/',
		])
			expect(isDiscordPreviewPage(path), path).toBe(false)
		for (const path of ['/', '/records', '/record/1', '/users', '/super-league/vote'])
			expect(isDiscordPreviewPage(path), path).toBe(true)
	})
})
