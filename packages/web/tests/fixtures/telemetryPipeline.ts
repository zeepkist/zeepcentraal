import {
	createTracedPostgresClient,
	startNodeTelemetryFromEnvironment,
	stopNodeTelemetry,
	withActiveSpan,
} from '@zeepkist/telemetry'
import { SQL } from 'bun'
import { tracedWebFetch } from '../../server/utils/tracedFetch'

startNodeTelemetryFromEnvironment('web', { autoInstrumentations: [] })
try {
	await withActiveSpan('pipeline.web', async () => {
		const databaseUrl = process.env.ZC_TEST_DATABASE_URL as string
		const client = createTracedPostgresClient(new SQL(databaseUrl, { max: 1 }), databaseUrl)
		try {
			const reserved = await client.reserve()
			try {
				const rows = await reserved.unsafe('SELECT $1::integer AS value', [17]).values()
				if (rows[0]?.[0] !== 17) throw new Error('Reserved query result changed')
			} finally {
				reserved.release()
			}
			await client.begin(async (transaction) => {
				await transaction.savepoint(async (nested) => {
					await nested`SELECT ${19}::integer`
				})
			})
			try {
				await client.unsafe("SELECT 'private-bun-sql-literal'::integer")
				throw new Error('Expected query failure')
			} catch (error) {
				if ((error as Error).message === 'Expected query failure') throw error
			}
		} finally {
			await client.close({ timeout: 1 })
		}
		const result = await tracedWebFetch<string>(process.argv[2] as string)
		if (result !== 'ok') throw new Error('Unexpected pipeline response')
	})
} finally {
	await stopNodeTelemetry()
}
