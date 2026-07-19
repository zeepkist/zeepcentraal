import { describe, expect, test } from 'bun:test'
import {
	assertRestrictedGraphqlDatabaseRole,
	type GraphqlDatabaseRoleInspection,
	validateGraphqlDatabaseRole,
} from './databaseRoleAudit'

const safeInspection: GraphqlDatabaseRoleInspection = {
	roleName: 'zeepcentraal_graphql',
	sessionRoleName: 'zeepcentraal_graphql',
	canLogin: true,
	superuser: false,
	createDatabase: false,
	createRole: false,
	inherit: false,
	replication: false,
	bypassRls: false,
	ownedPublicRelations: [],
	memberOfRoles: [],
}

describe('validateGraphqlDatabaseRole', () => {
	test('accepts the dedicated restricted login role', () => {
		expect(() => validateGraphqlDatabaseRole(safeInspection)).not.toThrow()
	})

	test.each([
		['roleName', 'postgres', 'current_user must be zeepcentraal_graphql'],
		['sessionRoleName', 'postgres', 'session_user must be zeepcentraal_graphql'],
		['canLogin', false, 'role must have LOGIN'],
		['superuser', true, 'role must have NOSUPERUSER'],
		['createDatabase', true, 'role must have NOCREATEDB'],
		['createRole', true, 'role must have NOCREATEROLE'],
		['inherit', true, 'role must have NOINHERIT'],
		['replication', true, 'role must have NOREPLICATION'],
		['bypassRls', true, 'role must have NOBYPASSRLS'],
	] as const)('rejects unsafe %s', (field, value, expectedMessage) => {
		expect(() =>
			validateGraphqlDatabaseRole({
				...safeInspection,
				[field]: value,
			}),
		).toThrow(expectedMessage)
	})

	test('rejects public relation ownership and role memberships', () => {
		expect(() =>
			validateGraphqlDatabaseRole({
				...safeInspection,
				ownedPublicRelations: ['public.level'],
				memberOfRoles: ['postgres'],
			}),
		).toThrow(
			'role must not own public relations: public.level; role must not be a member of other roles: postgres',
		)
	})
})

test('production role audit inspects provided connection without exposing it in errors', async () => {
	const databaseUrl = 'postgres://zeepcentraal_graphql:do-not-print@database:5432/zeepkist'
	let receivedUrl: string | undefined

	await assertRestrictedGraphqlDatabaseRole(databaseUrl, async (url) => {
		receivedUrl = url
		return safeInspection
	})

	expect(receivedUrl).toBe(databaseUrl)

	const result = assertRestrictedGraphqlDatabaseRole(databaseUrl, async () => {
		throw new Error(databaseUrl)
	})
	await expect(result).rejects.toThrow('database inspection could not complete')
	await expect(result).rejects.not.toThrow('do-not-print')
	await result.catch((error) => {
		expect(error.cause).toBeUndefined()
		expect(error.stack).not.toContain('do-not-print')
	})
})
