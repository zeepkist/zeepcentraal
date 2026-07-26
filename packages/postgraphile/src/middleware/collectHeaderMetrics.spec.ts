import { beforeEach, describe, expect, mock, test } from 'bun:test'

const setActiveSpanAttributes = mock()

mock.module('@zeepkist/telemetry', () => ({
	setActiveSpanAttributes,
}))

const { collectHeaderMetrics } = await import('./collectHeaderMetrics')

describe('collectHeaderMetrics', () => {
	beforeEach(() => {
		setActiveSpanAttributes.mockClear()
	})

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

	test.each(['my-application-name', 'my-application-name@1.0.0'])(
		'collects valid X-Client identity %s',
		(clientIdentity) => {
			collectHeaderMetrics(new Headers({ 'X-Client': clientIdentity }))

			expect(setActiveSpanAttributes).toHaveBeenCalledWith({
				'graphql.header.X-Client': clientIdentity,
			})
		},
	)

	test.each([
		'My-Application',
		'my application',
		'my-application@',
		'my-application/name',
		'a'.repeat(97),
	])('ignores invalid X-Client identity %s', (clientIdentity) => {
		collectHeaderMetrics(new Headers({ 'X-Client': clientIdentity }))

		expect(setActiveSpanAttributes).toHaveBeenCalledWith({})
	})
})
