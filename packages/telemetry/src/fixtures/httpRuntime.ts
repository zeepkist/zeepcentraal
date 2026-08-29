import { createRequire } from 'node:module'

const { createServer, request } = createRequire(import.meta.url)(
	'node:http',
) as typeof import('node:http')

export async function exerciseNodeHttp() {
	const server = createServer((_request, response) => {
		response.end('ok')
	})
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
	const address = server.address()
	if (!address || typeof address === 'string') throw new Error('HTTP fixture address unavailable')

	try {
		await new Promise<void>((resolve, reject) => {
			const outgoing = request(
				{ host: '127.0.0.1', port: address.port, path: '/otel-test' },
				(response) => {
					response.resume()
					response.once('end', resolve)
				},
			)
			outgoing.once('error', reject)
			outgoing.end()
		})
	} finally {
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve())),
		)
	}
}
