import { describe, expect, it } from 'bun:test'
import { normalizeEncryptedAppTicket } from './steamSession'

describe('normalizeEncryptedAppTicket', () => {
	it('accepts the steam-user runtime response wrapper', () => {
		const ticket = Buffer.from([1, 2, 3])

		expect(normalizeEncryptedAppTicket({ encryptedAppTicket: ticket })).toBe(ticket)
	})

	it('keeps compatibility with the stale DefinitelyTyped return type', () => {
		const ticket = Buffer.from([1, 2, 3])

		expect(normalizeEncryptedAppTicket(ticket)).toBe(ticket)
	})

	it('rejects missing and empty tickets', () => {
		expect(() => normalizeEncryptedAppTicket({})).toThrow(
			'Steam returned an invalid encrypted app ticket',
		)
		expect(() => normalizeEncryptedAppTicket({ encryptedAppTicket: Buffer.alloc(0) })).toThrow(
			'Steam returned an invalid encrypted app ticket',
		)
	})
})
