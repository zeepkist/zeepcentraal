import { expect, test } from 'bun:test'
import { permanentDmFailure } from './permanent-dm-failure'

test('permanent DM failure recognizes Discord permission and unknown-user codes', () => {
	for (const code of [50007, 50013, 10013]) expect(permanentDmFailure({ code })).toBe(true)
	expect(permanentDmFailure({ code: 500 })).toBe(false)
	expect(permanentDmFailure(null)).toBe(false)
})
