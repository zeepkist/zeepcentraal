import { expect, test } from 'bun:test'
import { safeError } from './helpers'

test('safeError hides query text and reports bounded nested transport metadata', () => {
	const cause = Object.assign(new Error('connection token=private-value failed'), {
		code: 'ECONNRESET',
		syscall: 'read',
	})
	const error = new Error('Failed query: select * from private_table\nparams: private-value', {
		cause,
	})
	const message = safeError(error)
	expect(message).toBe('Database query failed (code=ECONNRESET, syscall=read)')
	expect(message).not.toContain('private_table')
	expect(message).not.toContain('private-value')
})

test('safeError redacts credential-like values', () => {
	const message = safeError(
		new Error(
			'Bearer abc123 token=secret-value password=hunter2 postgresql://user:pass@database/db',
		),
	)
	expect(message).toBe(
		'Bearer [redacted] token=[redacted] password=[redacted] postgresql://[redacted]@database/db',
	)
})
