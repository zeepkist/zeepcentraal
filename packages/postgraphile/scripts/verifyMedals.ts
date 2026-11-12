import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { SQL } from 'bun'
import { buildSchema, lexicographicSortSchema, printSchema } from 'postgraphile/graphql'
import { createPostGraphileHandler } from '../src/postgraphileOptions'

const databaseUrl = process.env.ZC_TEST_DATABASE_URL
assert.ok(databaseUrl, 'ZC_TEST_DATABASE_URL required')
const target = new URL(databaseUrl)
assert.equal(target.hostname, '127.0.0.1')
assert.equal(target.pathname, '/competitive_medal_test')
const admin = new SQL(databaseUrl)
const role = `medal_graphql_test_${crypto.randomUUID().replaceAll('-', '')}`
const password = crypto.randomUUID().replaceAll('-', '')
await admin.unsafe(
	`CREATE ROLE ${role} LOGIN INHERIT PASSWORD '${password}' IN ROLE zeepcentraal_graphql`,
)
target.username = role
target.password = password
const handler = createPostGraphileHandler({
	...postgraphileConfig,
	databaseUrl: target.href,
	superuserDatabaseUrl: undefined,
	nodeEnv: 'production',
	liveQueries: { ...postgraphileConfig.liveQueries, enabled: true },
})
try {
	const schema = await handler.getSchema()
	for (const root of [schema.getQueryType(), schema.getSubscriptionType()]) {
		assert.ok(root?.getFields().medalCounts)
	}
	for (const typeName of [
		'Record',
		'RecordHistoryEntry',
		'PersonalBestGlobal',
		'ZslLevelResult',
	]) {
		const type = schema.getType(typeName)
		assert.ok(type && 'getFields' in type && type.getFields().medal, `${typeName}.medal`)
	}
	const userPoint = schema.getType('UserPoint')
	assert.ok(userPoint && 'getFields' in userPoint && userPoint.getFields().medalApex)
	assert.equal(schema.getType('LevelMedalThreshold'), undefined)
	const item = schema.getType('LevelItem')
	assert.ok(
		item &&
			'getFields' in item &&
			item.getFields().validationTimeExpert &&
			item.getFields().validationTimeApex,
	)
	if (process.argv.includes('--write-schema')) {
		await writeFile(
			new URL('../../graphql/schema.graphql', import.meta.url),
			`${printSchema(lexicographicSortSchema(schema))}\n`,
		)
	} else {
		const published = buildSchema(
			await readFile(new URL('../../graphql/schema.graphql', import.meta.url), 'utf8'),
		)
		assert.equal(
			printSchema(lexicographicSortSchema(schema)),
			printSchema(lexicographicSortSchema(published)),
			'Published schema must match restricted-role schema',
		)
	}
	console.log('Medal schema verified under restricted GraphQL role')
} finally {
	await handler.release()
	await admin.unsafe(`DROP ROLE ${role}`)
	await admin.close()
}
