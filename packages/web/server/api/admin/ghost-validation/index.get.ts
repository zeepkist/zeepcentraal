import { fetchAuthenticatedBackend } from '../../../utils/backend'
import { assertSameOrigin } from '../../../utils/request'

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	setHeader(event, 'cache-control', 'private, no-store')
	const query = getQuery(event)
	return fetchAuthenticatedBackend(event, '/admin/ghost-validation', {
		method: 'GET',
		query: Object.fromEntries(
			Object.entries(query).filter(
				([key, value]) =>
					[
						'after',
						'record',
						'status',
						'idLevel',
						'workshopId',
						'from',
						'to',
						'history',
					].includes(key) && typeof value === 'string',
			),
		) as Record<string, string>,
	})
})
