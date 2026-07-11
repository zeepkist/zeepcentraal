import { describe, expect, test } from 'vitest'
import { resolveWebRuntimeDefaults } from '../../app/utils/runtime'

describe('web runtime defaults', () => {
	test('defaults to production GraphQL and backend URLs', () => {
		expect(resolveWebRuntimeDefaults({})).toEqual({
			backendUrl: 'https://backend.zeepki.st',
			graphqlHttpUrl: 'https://graphql.zeepki.st',
			graphqlWsUrl: 'wss://graphql.zeepki.st',
		})
	})

	test('allows local GraphQL and backend URL overrides', () => {
		expect(
			resolveWebRuntimeDefaults({
				NUXT_PUBLIC_BACKEND_URL: 'http://localhost:3000',
				NUXT_PUBLIC_GRAPHQL_HTTP_URL: 'http://localhost:5000',
				NUXT_PUBLIC_GRAPHQL_WS_URL: 'ws://localhost:5000',
			}),
		).toEqual({
			backendUrl: 'http://localhost:3000',
			graphqlHttpUrl: 'http://localhost:5000',
			graphqlWsUrl: 'ws://localhost:5000',
		})
	})
})
