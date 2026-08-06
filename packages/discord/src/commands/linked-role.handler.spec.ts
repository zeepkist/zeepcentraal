import { expect, mock, test } from 'bun:test'
import { createChatInteraction, createMockContext } from '../../test/mocks'
import { handleLinkedRole } from './linked-role.handler'

test('linked-role requires guild context', async () => {
	const { context } = createMockContext()
	const { interaction } = createChatInteraction('linked-role')
	expect(handleLinkedRole(interaction, context)).rejects.toThrow(
		'Run this command inside a server.',
	)
})

test.each([{ role: { id: 'role-1' } }, { role: null }])(
	'linked-role stores $role',
	async ({ role }) => {
		const setLinkedRole = mock(async () => ({}))
		const { context } = createMockContext({ backend: { setLinkedRole } })
		const { interaction, state } = createChatInteraction('linked-role', {
			guildId: 'guild-1',
			roles: { role },
		})
		await handleLinkedRole(interaction, context)
		expect(setLinkedRole).toHaveBeenCalledWith('guild-1', role?.id ?? null)
		expect(JSON.stringify(state.reply)).toContain(role ? '<@&role-1>' : 'disabled')
	},
)
