import { Buffer } from 'node:buffer'
import {
	convertHandlerResultToResult,
	GrafservBase,
	type GrafservBody,
	type GrafservConfig,
	getBodyFromFrameworkBody,
	normalizeRequest,
	processHeaders,
	type Result,
} from 'postgraphile/grafserv'

function headersToRecord(headers: Headers) {
	const record: Record<string, string> = {}
	for (const [key, value] of headers.entries()) {
		record[key] = value
	}
	return processHeaders(record)
}

function queryParams(url: URL) {
	const params: Record<string, string | string[]> = {}
	for (const [key, value] of url.searchParams.entries()) {
		const existing = params[key]
		if (Array.isArray(existing)) {
			existing.push(value)
		} else if (existing !== undefined) {
			params[key] = [existing, value]
		} else {
			params[key] = value
		}
	}
	return params
}

async function bodyFromRequest(request: Request, body: unknown): Promise<GrafservBody> {
	if (body !== undefined) {
		return getBodyFromFrameworkBody(body)
	}

	const contentType = request.headers.get('content-type') ?? ''
	if (contentType.includes('application/json')) {
		return { type: 'json', json: (await request.clone().json()) as never }
	}

	if (contentType.includes('application/graphql') || contentType.startsWith('text/')) {
		return { type: 'text', text: await request.clone().text() }
	}

	return { type: 'buffer', buffer: Buffer.from(await request.clone().arrayBuffer()) }
}

function bufferStreamToReadableStream(bufferIterator: AsyncGenerator<Buffer>) {
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			const result = await bufferIterator.next()
			if (result.done) {
				controller.close()
				return
			}
			controller.enqueue(result.value)
		},
		async cancel() {
			await bufferIterator.return?.(undefined)
		},
	})
}

function responseFromResult(result: Result | null): Response | null {
	if (!result) {
		return null
	}

	switch (result.type) {
		case 'error':
			return new Response(result.error.message, {
				status: result.statusCode,
				headers: result.headers,
			})
		case 'buffer':
			return new Response(result.buffer, {
				status: result.statusCode,
				headers: result.headers,
			})
		case 'json':
			return Response.json(result.json, {
				status: result.statusCode,
				headers: result.headers,
			})
		case 'noContent':
			return new Response(null, {
				status: result.statusCode,
				headers: result.headers,
			})
		case 'bufferStream':
			return new Response(bufferStreamToReadableStream(result.bufferIterator), {
				status: result.statusCode,
				headers: result.headers,
			})
	}
}

export class ElysiaGrafserv extends GrafservBase {
	private createDigest(request: Request, body?: unknown) {
		const url = new URL(request.url)

		return normalizeRequest({
			httpVersionMajor: 1,
			httpVersionMinor: 1,
			isSecure: url.protocol === 'https:',
			method: request.method,
			path: url.pathname,
			headers: headersToRecord(request.headers),
			getQueryParams() {
				return queryParams(url)
			},
			getBody() {
				return bodyFromRequest(request, body)
			},
			requestContext: {},
		})
	}

	public async handleGraphQLRequest(request: Request, body?: unknown) {
		const result = await convertHandlerResultToResult(
			await this.graphqlHandler(this.createDigest(request, body), this.graphiqlHandler),
		)
		return responseFromResult(result)
	}

	public async handleGraphiQLStaticRequest(request: Request) {
		const result = await convertHandlerResultToResult(
			await this.graphiqlStaticHandler(this.createDigest(request)),
		)
		return responseFromResult(result)
	}

	public async handleEventStreamRequest(request: Request) {
		const result = await convertHandlerResultToResult({
			type: 'event-stream',
			request: this.createDigest(request),
			dynamicOptions: this.dynamicOptions,
			payload: this.makeStream(),
			statusCode: 200,
		})
		return responseFromResult(result)
	}
}

export function elysiaGrafserv(config: GrafservConfig) {
	return new ElysiaGrafserv(config)
}
