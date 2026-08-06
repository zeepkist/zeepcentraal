import { expect, test } from 'bun:test'
import { createButtonInteraction, createMockContext } from '../../../test/mocks'
import { createPages, handlePaginationButton } from './pagination.handler'

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
	expect(full.components[0]?.components[0]?.data.disabled).toBe(true)
})

test('pagination reports expired and wrong-owner sessions', async () => {
	const { context } = createMockContext()
	const expired = createButtonInteraction('page:missing:next')
	await handlePaginationButton(expired.interaction, context, 'missing', 'next')
	expect(JSON.stringify(expired.state.reply)).toContain('Pagination expired')

	createPages(context, 'owner', 'Title', ['row'])
	const wrong = createButtonInteraction('page:session-1:next', 'other')
	await handlePaginationButton(wrong.interaction, context, 'session-1', 'next')
	expect(JSON.stringify(wrong.state.reply)).toContain('Only command owner')
})

test('pagination moves and clamps both directions', async () => {
	const { context } = createMockContext()
	createPages(context, 'discord-1', 'Title', ['one', 'two'], 1)
	const next = createButtonInteraction('page:session-1:next')
	await handlePaginationButton(next.interaction, context, 'session-1', 'next')
	expect(JSON.stringify(next.state.update)).toContain('Page 2/2')
	await handlePaginationButton(next.interaction, context, 'session-1', 'next')
	expect(JSON.stringify(next.state.update)).toContain('Page 2/2')
	const previous = createButtonInteraction('page:session-1:previous')
	await handlePaginationButton(previous.interaction, context, 'session-1', 'previous')
	await handlePaginationButton(previous.interaction, context, 'session-1', 'previous')
	expect(JSON.stringify(previous.state.update)).toContain('Page 1/2')
})

test('pagination rejects a corrupted page session', async () => {
	const { context } = createMockContext()
	createPages(context, 'discord-1', 'Title', ['row'])
	const session = context.runtime.sessions.page('session-1')
	if (!session) throw new Error('test session missing')
	session.pages = []
	const button = createButtonInteraction('page:session-1:next')
	expect(
		handlePaginationButton(button.interaction, context, 'session-1', 'next'),
	).rejects.toThrow('Page no longer exists')
})
