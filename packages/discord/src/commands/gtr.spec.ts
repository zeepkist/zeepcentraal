import { expect, mock, test } from 'bun:test'
import { createChatInteraction, createMockContext } from '../../test/mocks'
import { gtrHandler } from './gtr'

test('gtr includes linked player versions', async () => {
	const modVersions = mock(async () => ({
		records: { nodes: [{ modVersion: '1.2.3', dateCreated: '2026-08-06' }] },
		versions: { nodes: [{ latest: '1.3.0', minimum: '1.1.0' }] },
	}))
	const { context } = createMockContext({ graphql: { modVersions } })
	const { interaction, state } = createChatInteraction('gtr')
	await gtrHandler(interaction, context)
	expect(JSON.stringify(state.edit)).toContain('1.2.3')
	expect(JSON.stringify(state.edit)).toContain('1.3.0 / 1.1.0')
})
