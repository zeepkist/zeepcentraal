import { expect, test } from 'bun:test'
import { createButtonInteraction, createMockContext } from '../../../test/mocks'
import { buttonHandler } from './button'

test('button router rejects malformed and unknown IDs', async () => {
	const { context } = createMockContext()
	expect(await buttonHandler(createButtonInteraction('invalid').interaction, context)).toBe(false)
	expect(await buttonHandler(createButtonInteraction('other:id').interaction, context)).toBe(
		false,
	)
})

test('button router dispatches pagination and playlist IDs', async () => {
	const { context } = createMockContext()
	const page = createButtonInteraction('page:missing:next')
	const playlist = createButtonInteraction('playlist:missing')
	expect(await buttonHandler(page.interaction, context)).toBe(true)
	expect(await buttonHandler(playlist.interaction, context)).toBe(true)
})
