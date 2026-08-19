import { describe, expect, test } from 'vitest'
import { resolveAuthReturnPath } from '../../app/utils/auth-return-path'

const origin = 'https://zeepki.st'

describe('OAuth return path', () => {
	test.each([
		['/', '/'],
		['/levels?sort=popular&page=2', '/levels?sort=popular&page=2'],
		['/level/example?tab=records#record-42', '/level/example?tab=records#record-42'],
	])('preserves internal path %s', (value, expected) => {
		expect(resolveAuthReturnPath(value, origin)).toBe(expected)
	})

	test.each([
		null,
		'',
		'levels?page=2',
		'https://example.com/levels',
		'//example.com/levels',
		'/\\example.com/levels',
		'/levels?query=%zz',
		'/levels\u0000?page=2',
	])('rejects external or malformed value %s', (value) => {
		expect(resolveAuthReturnPath(value, origin)).toBeNull()
	})

	test.each(['/auth/callback', '/auth/callback?next=/levels', '/?auth=callback'])(
		'rejects callback target %s',
		(value) => {
			expect(resolveAuthReturnPath(value, origin)).toBeNull()
		},
	)
})
