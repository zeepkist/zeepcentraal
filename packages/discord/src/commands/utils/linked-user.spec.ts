import { expect, test } from 'bun:test'
import { linkedState, linkedUser, unlinkedState } from '../../../test/mocks'
import { linkedUserOrThrow } from './linked-user'

test('linked-user returns linked account', () => {
	expect(linkedUserOrThrow(linkedState)).toEqual(linkedUser)
})

test('linked-user rejects unlinked account', () => {
	expect(() => linkedUserOrThrow(unlinkedState)).toThrow('Link account first')
})
