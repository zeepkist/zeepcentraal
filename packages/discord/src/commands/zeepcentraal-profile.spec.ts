import { expect, mock, test } from 'bun:test'
import { expectComponentsV2 } from '../../test/components'
import {
	createContextInteraction,
	createMockContext,
	linkedUser,
	unlinkedState,
} from '../../test/mocks'
import { zeepCentraalProfileHandler } from './zeepcentraal-profile'

test('profile context command resolves target and renders profile', async () => {
	const userByFilter = mock(async () => ({ ...linkedUser, userPoints: { rank: 1, points: 2 } }))
	const { context } = createMockContext({ graphql: { userByFilter } })
	const { interaction, state } = createContextInteraction()
	await zeepCentraalProfileHandler(interaction, context)
	expectComponentsV2(state.edit)
	expect(JSON.stringify(state.edit)).toContain('Player Seven')
})

test('profile context command requires linked target', async () => {
	const { context } = createMockContext({
		backend: { user: mock(async () => unlinkedState) },
	})
	const { interaction } = createContextInteraction()
	expect(zeepCentraalProfileHandler(interaction, context)).rejects.toThrow('Link account first')
})
