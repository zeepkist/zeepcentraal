import { describe, expect, test } from 'bun:test'
import { sanitizeSql } from './telemetry'

describe('database telemetry', () => {
	test('keeps placeholders and removes literals and comments', () => {
		expect(
			sanitizeSql(
				"select * from users where id = $1 and email = 'private@example.test' -- note",
			),
		).toBe('select * from users where id = $1 and email = ?')
	})

	test('removes dollar-quoted literals', () => {
		expect(sanitizeSql('select $$private$$, $value$also private$value$')).toBe('select ?, ?')
	})
})
