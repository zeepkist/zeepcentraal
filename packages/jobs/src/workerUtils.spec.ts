import { expect, test } from 'bun:test'
import { createQueueWorkerUtilsOptions } from './workerUtils'

test('limits enqueue-only worker utilities to configured pool maximum', () => {
	expect(
		createQueueWorkerUtilsOptions({
			databaseUrl: 'postgres://database/zeepkist',
			queuePoolMax: 2,
		}),
	).toEqual({
		connectionString: 'postgres://database/zeepkist',
		maxPoolSize: 2,
	})
})
