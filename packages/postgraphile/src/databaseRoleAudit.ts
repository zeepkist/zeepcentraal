import postgres from 'postgres'

export const GRAPHQL_DATABASE_ROLE = 'zeepcentraal_graphql'

export type GraphqlDatabaseRoleInspection = {
	roleName: string
	sessionRoleName: string
	canLogin: boolean
	superuser: boolean
	createDatabase: boolean
	createRole: boolean
	inherit: boolean
	replication: boolean
	bypassRls: boolean
	ownedPublicRelations: string[]
	memberOfRoles: string[]
}

type DatabaseRoleAuditRow = {
	role_name: string
	session_role_name: string
	can_login: boolean
	superuser: boolean
	create_database: boolean
	create_role: boolean
	inherit: boolean
	replication: boolean
	bypass_rls: boolean
	owned_public_relations: string[]
	member_of_roles: string[]
}

type InspectGraphqlDatabaseRole = (databaseUrl: string) => Promise<GraphqlDatabaseRoleInspection>

async function inspectGraphqlDatabaseRole(
	databaseUrl: string,
): Promise<GraphqlDatabaseRoleInspection> {
	const client = postgres(databaseUrl, {
		max: 1,
		idle_timeout: 5,
		connect_timeout: 10,
	})

	try {
		const rows = await client<DatabaseRoleAuditRow[]>`
			select
				role.rolname::text as role_name,
				session_user::text as session_role_name,
				role.rolcanlogin as can_login,
				role.rolsuper as superuser,
				role.rolcreatedb as create_database,
				role.rolcreaterole as create_role,
				role.rolinherit as inherit,
				role.rolreplication as replication,
				role.rolbypassrls as bypass_rls,
				coalesce(
					(
						select array_agg(
							format('%I.%I', namespace.nspname, relation.relname)
							order by namespace.nspname, relation.relname
						)
						from pg_catalog.pg_class relation
						inner join pg_catalog.pg_namespace namespace
							on namespace.oid = relation.relnamespace
						where relation.relowner = role.oid
							and namespace.nspname = 'public'
							and relation.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
					),
					array[]::text[]
				) as owned_public_relations,
				coalesce(
					(
						select array_agg(parent_role.rolname::text order by parent_role.rolname)
						from pg_catalog.pg_auth_members membership
						inner join pg_catalog.pg_roles parent_role
							on parent_role.oid = membership.roleid
						where membership.member = role.oid
					),
					array[]::text[]
				) as member_of_roles
			from pg_catalog.pg_roles role
			where role.rolname = current_user
		`
		const row = rows[0]
		if (!row) {
			throw new Error('connected database role was not found in pg_roles')
		}

		return {
			roleName: row.role_name,
			sessionRoleName: row.session_role_name,
			canLogin: row.can_login,
			superuser: row.superuser,
			createDatabase: row.create_database,
			createRole: row.create_role,
			inherit: row.inherit,
			replication: row.replication,
			bypassRls: row.bypass_rls,
			ownedPublicRelations: row.owned_public_relations,
			memberOfRoles: row.member_of_roles,
		}
	} finally {
		await client.end({ timeout: 5 })
	}
}

export function validateGraphqlDatabaseRole(inspection: GraphqlDatabaseRoleInspection): void {
	const violations: string[] = []

	if (inspection.roleName !== GRAPHQL_DATABASE_ROLE) {
		violations.push(`current_user must be ${GRAPHQL_DATABASE_ROLE}`)
	}
	if (inspection.sessionRoleName !== GRAPHQL_DATABASE_ROLE) {
		violations.push(`session_user must be ${GRAPHQL_DATABASE_ROLE}`)
	}
	if (!inspection.canLogin) {
		violations.push('role must have LOGIN')
	}
	if (inspection.superuser) {
		violations.push('role must have NOSUPERUSER')
	}
	if (inspection.createDatabase) {
		violations.push('role must have NOCREATEDB')
	}
	if (inspection.createRole) {
		violations.push('role must have NOCREATEROLE')
	}
	if (inspection.inherit) {
		violations.push('role must have NOINHERIT')
	}
	if (inspection.replication) {
		violations.push('role must have NOREPLICATION')
	}
	if (inspection.bypassRls) {
		violations.push('role must have NOBYPASSRLS')
	}
	if (inspection.ownedPublicRelations.length > 0) {
		violations.push(
			`role must not own public relations: ${inspection.ownedPublicRelations.join(', ')}`,
		)
	}
	if (inspection.memberOfRoles.length > 0) {
		violations.push(
			`role must not be a member of other roles: ${inspection.memberOfRoles.join(', ')}`,
		)
	}

	if (violations.length > 0) {
		throw new Error(`Unsafe GraphQL database role: ${violations.join('; ')}`)
	}
}

export async function assertRestrictedGraphqlDatabaseRole(
	databaseUrl: string,
	inspect: InspectGraphqlDatabaseRole = inspectGraphqlDatabaseRole,
): Promise<void> {
	let inspection: GraphqlDatabaseRoleInspection
	try {
		inspection = await inspect(databaseUrl)
	} catch {
		throw new Error(
			'GraphQL database role audit failed: database inspection could not complete',
		)
	}

	validateGraphqlDatabaseRole(inspection)
}
