import { expect, mock, test } from 'bun:test'
import { createMockContext } from '../../../test/mocks'
import { findLevel } from './level-lookup'

test('level lookup supports ID, hash, successful text search, and missing text search', async () => {
	const levelById = mock(async () => ({ id: 1 }))
	const query = mock(async (...args: unknown[]) => {
		const variables = args[1] as { search?: string; xxHash?: string }
		if (variables.search === 'found') return { levels: { nodes: [{ xxHash: 'result' }] } }
		if (variables.search === 'missing') return { levels: { nodes: [] } }
		return { levelByXxHash: { xxHash: variables.xxHash } }
	})
	const { context } = createMockContext({ graphql: { levelById, query } })
	expect(await findLevel('1', context)).toEqual({ id: 1 })
	expect(await findLevel('abcdef0123456789', context)).toEqual({ xxHash: 'abcdef0123456789' })
	expect(await findLevel('found', context)).toEqual({ xxHash: 'result' })
	expect(await findLevel('missing', context)).toBeNull()
})

test('level lookup returns null GraphQL detail', async () => {
	const query = mock(async () => ({ levelByXxHash: null }))
	const { context } = createMockContext({ graphql: { query } })
	expect(await findLevel('abcdef0123456789', context)).toBeNull()
})
