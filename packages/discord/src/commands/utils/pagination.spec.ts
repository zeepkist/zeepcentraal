import { expect, test } from 'bun:test'
import { createButtonInteraction, createMockContext } from '../../../test/mocks'
import { createPages, paginationHandler } from './pagination'

test('pagination creates empty and multi-page responses', () => {
	const { context } = createMockContext()
	const empty = createPages(context, 'owner', 'Empty', [])
	expect(empty.embeds[0]?.description).toBe('No results.')
	const full = createPages(
		context,
		'owner',
		'Full',
		Array.from({ length: 11 }, (_, index) => `Row ${index}`),
		10,
	)
	expect(full.embeds[0]?.footer?.text).toContain('1/2')
	expect(JSON.stringify(full.components[0])).toContain('"disabled":true')
})

test('pagination preserves rich embeds, auxiliary buttons, and description context', async () => {
	const { context } = createMockContext()
	const response = createPages(context, 'discord-1', 'Leaderboard', ['First', 'Second'], 1, {
		components: [
			{
				type: 1,
				components: [
					{
						type: 2,
						style: 5,
						label: 'Open',
						url: 'https://frontend.example.test/leaderboard',
					},
				],
			},
		],
		descriptionPrefix: 'By Author\n\n**Leaderboard**',
		embed: {
			color: 123,
			footer: { text: 'Custom footer' },
			fields: [{ name: 'Entries', value: '2' }],
			thumbnail: { url: 'https://images.example.test/level.png' },
			url: 'https://frontend.example.test/level/hash',
		},
	})
	expect(response.embeds[0]).toMatchObject({
		color: 123,
		description: 'By Author\n\n**Leaderboard**\n\nFirst',
		footer: { text: 'Custom footer • Page 1/2' },
		fields: [{ name: 'Entries', value: '2' }],
		thumbnail: { url: 'https://images.example.test/level.png' },
		url: 'https://frontend.example.test/level/hash',
	})
	expect(response.components).toHaveLength(2)

	const next = createButtonInteraction('page:session-1:next')
	await paginationHandler(next.interaction, context, 'session-1', 'next')
	expect(next.state.update).toMatchObject({
		embeds: [
			{
				description: 'By Author\n\n**Leaderboard**\n\nSecond',
				thumbnail: { url: 'https://images.example.test/level.png' },
				url: 'https://frontend.example.test/level/hash',
			},
		],
	})
	expect((next.state.update as { components: unknown[] }).components).toHaveLength(2)
})

test('pagination supports custom empty descriptions', () => {
	const { context } = createMockContext()
	const empty = createPages(context, 'owner', 'Empty', [], 10, {
		descriptionPrefix: 'Leaderboard',
		emptyDescription: 'No personal bests yet.',
	})
	expect(empty.embeds[0]?.description).toBe('Leaderboard\n\nNo personal bests yet.')
})

test('pagination reports expired and wrong-owner sessions', async () => {
	const { context } = createMockContext()
	const expired = createButtonInteraction('page:missing:next')
	await paginationHandler(expired.interaction, context, 'missing', 'next')
	expect(JSON.stringify(expired.state.reply)).toContain('Pagination expired')

	createPages(context, 'owner', 'Title', ['row'])
	const wrong = createButtonInteraction('page:session-1:next', 'other')
	await paginationHandler(wrong.interaction, context, 'session-1', 'next')
	expect(JSON.stringify(wrong.state.reply)).toContain('Only command owner')
})

test('pagination moves and clamps both directions', async () => {
	const { context } = createMockContext()
	createPages(context, 'discord-1', 'Title', ['one', 'two'], 1)
	const next = createButtonInteraction('page:session-1:next')
	await paginationHandler(next.interaction, context, 'session-1', 'next')
	expect(JSON.stringify(next.state.update)).toContain('Page 2/2')
	await paginationHandler(next.interaction, context, 'session-1', 'next')
	expect(JSON.stringify(next.state.update)).toContain('Page 2/2')
	const previous = createButtonInteraction('page:session-1:previous')
	await paginationHandler(previous.interaction, context, 'session-1', 'previous')
	await paginationHandler(previous.interaction, context, 'session-1', 'previous')
	expect(JSON.stringify(previous.state.update)).toContain('Page 1/2')
})

test('pagination rejects a corrupted page session', async () => {
	const { context } = createMockContext()
	createPages(context, 'discord-1', 'Title', ['row'])
	const session = context.runtime.sessions.page('session-1')
	if (!session) throw new Error('test session missing')
	session.pages = []
	const button = createButtonInteraction('page:session-1:next')
	expect(paginationHandler(button.interaction, context, 'session-1', 'next')).rejects.toThrow(
		'Page no longer exists',
	)
})
