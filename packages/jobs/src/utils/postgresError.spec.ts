import { describe, expect, test } from 'bun:test'
import { getPostgresErrorMetadata } from './postgresError'

describe('getPostgresErrorMetadata', () => {
	test('exposes nested PostgreSQL failure fields', () => {
		const cause = Object.assign(new Error('duplicate key'), {
			code: '23505',
			constraint: 'user_point_contribution_pkey',
			detail: 'Key already exists.',
			routine: '_bt_check_unique',
		})
		const error = Object.assign(new Error('Failed query'), { cause })

		expect(getPostgresErrorMetadata(error)).toEqual({
			code: '23505',
			constraint: 'user_point_contribution_pkey',
			detail: 'Key already exists.',
			routine: '_bt_check_unique',
			message: 'duplicate key',
		})
	})
})
