import { describe, expect, mock, test } from 'bun:test'

const setActiveSpanAttributes = mock()

mock.module('@zeepkist/telemetry', () => ({
	setActiveSpanAttributes,
}))

const { collectHeaderMetrics } = await import('./collectHeaderMetrics')

describe('collectHeaderMetrics', () => {
	test('collects expected GraphQL client headers', () => {
		const headers = new Headers({
			'X-Zeepkist-Version': '1.2.3',
			'X-Zeepkist-Major-Version': '1',
			'X-GTR-Version': '2.0.0',
			'X-Steam-ID': '76561198000000000',
		})

		collectHeaderMetrics(headers)

		expect(setActiveSpanAttributes).toHaveBeenCalledWith({
			'graphql.header.X-Zeepkist-Version': '1.2.3',
			'graphql.header.X-Zeepkist-Major-Version': '1',
			'graphql.header.X-GTR-Version': '2.0.0',
			'graphql.header.X-Steam-ID': '76561198000000000',
		})
	})
})
