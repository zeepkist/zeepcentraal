import { expect, mock, test } from 'bun:test'
import { expectComponentsV2 } from '../../../test/components'
import { createChatInteraction, createMockContext } from '../../../test/mocks'
import { modkistGtrHandler } from './modkist-gtr'

test('Modkist/GTR renderer uses missing-version fallbacks', async () => {
	const modVersions = mock(async () => ({ versions: { nodes: [] }, records: { nodes: [] } }))
	const { context } = createMockContext({ graphql: { modVersions } })
	const { interaction, state } = createChatInteraction('gtr')
	await modkistGtrHandler(interaction, context)
	expectComponentsV2(state.edit)
	expect(JSON.stringify(state.edit)).toContain('No submitted record')
	expect(JSON.stringify(state.edit)).toContain('Unknown / Unknown')
})
