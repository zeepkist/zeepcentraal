import { expect, test } from 'bun:test'
import { createButtonInteraction, createMockContext } from '../../../test/mocks'
import { handleButton } from './button.handler'

test('button router rejects malformed and unknown IDs', async () => {
	const { context } = createMockContext()
	expect(await handleButton(createButtonInteraction('invalid').interaction, context)).toBe(false)
	expect(await handleButton(createButtonInteraction('other:id').interaction, context)).toBe(false)
})

test('button router dispatches pagination and playlist IDs', async () => {
	const { context } = createMockContext()
	const page = createButtonInteraction('page:missing:next')
	const playlist = createButtonInteraction('playlist:missing')
	expect(await handleButton(page.interaction, context)).toBe(true)
	expect(await handleButton(playlist.interaction, context)).toBe(true)
})
