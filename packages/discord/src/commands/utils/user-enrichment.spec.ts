import { expect, test } from 'bun:test'
import { linkedUser } from '../../../test/mocks'
import { enrichUser } from './user-enrichment'

test('user enrichment handles empty, invalid, and matched users', () => {
	const users = new Map([[7, linkedUser]])
	expect(enrichUser(null, users)).toBeNull()
	expect(enrichUser(undefined, users)).toBeUndefined()
	expect(enrichUser({ steamName: 'No ID' }, users)).toEqual({ steamName: 'No ID' })
	expect(enrichUser({ id: 7, steamName: 'Old' }, users)).toEqual(linkedUser)
	expect(enrichUser({ id: 8, steamName: 'Unmatched' }, users)).toEqual({
		id: 8,
		steamName: 'Unmatched',
	})
})
