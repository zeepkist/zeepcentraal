import { expect, test } from 'bun:test'
import { linkedUser } from '../../test/mocks'
import { aliases } from './aliases'

test('aliases includes linked identities and handles missing users', () => {
	expect(aliases(null)).toEqual([])
	expect(aliases(linkedUser)).toEqual(['7', '76561198000000007', 'discord-1', 'Player Seven'])
})
