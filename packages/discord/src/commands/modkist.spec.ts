import { expect, mock, test } from 'bun:test'
import { createChatInteraction, createMockContext, unlinkedState } from '../../test/mocks'
import { modkistHandler } from './modkist'

test('modkist shows setup guide without account data when unlinked', async () => {
	const { context } = createMockContext({ backend: { user: mock(async () => unlinkedState) } })
	const { interaction, state } = createChatInteraction('modkist')
	await modkistHandler(interaction, context)
	expect(JSON.stringify(state.edit)).toContain('setup-modkist')
	expect(JSON.stringify(state.edit)).not.toContain('Your latest submitted GTR')
})
