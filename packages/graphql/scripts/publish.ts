import { execSync } from 'node:child_process'

const ACCESS_TOKEN = process.env.GRAPHQL_HIVE_ACCESS_TOKEN

execSync(
	`bunx --bun hive schema:publish --target "zeepcentraal/graphql/production" schema.graphql --registry.accessToken ${ACCESS_TOKEN}`,
	{ stdio: 'inherit' },
)
