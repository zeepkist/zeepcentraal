import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable, type Stream } from 'node:stream'
import { type HttpRequestHandler, PostGraphileResponse } from 'postgraphile'

type HeaderMap = Record<string, string>
type FetchBodyInit = ConstructorParameters<typeof Response>[0]
type FetchHeadersInit = ConstructorParameters<typeof Headers>[0]

function requestHeaders(request: Request): HeaderMap {
	const headers: HeaderMap = {}
	for (const [key, value] of request.headers.entries()) {
		headers[key.toLowerCase()] = value
	}
	return headers
}

function createNodeRequest(request: Request, body: unknown): IncomingMessage {
	const url = new URL(request.url)
	const nodeRequest = new EventEmitter() as IncomingMessage & {
		body?: unknown
		_body?: boolean
		originalUrl?: string
	}

	nodeRequest.method = request.method
	nodeRequest.url = `${url.pathname}${url.search}`
	nodeRequest.originalUrl = nodeRequest.url
	nodeRequest.headers = requestHeaders(request)
	nodeRequest.httpVersionMajor = 1
	nodeRequest.socket = {
		setTimeout() {
			return this
		},
		setNoDelay() {
			return this
		},
		setKeepAlive() {
			return this
		},
	} as unknown as IncomingMessage['socket']
	nodeRequest._body = true
	nodeRequest.body = body
	request.signal.addEventListener(
		'abort',
		() => {
			nodeRequest.emit('close')
		},
		{ once: true },
	)

	return nodeRequest
}

function createNodeResponse(): ServerResponse {
	const headers = new Map<string, number | string | string[]>()

	return {
		statusCode: 200,
		setHeader(name: string, value: number | string | string[]) {
			headers.set(name.toLowerCase(), value)
			return this
		},
		getHeader(name: string) {
			return headers.get(name.toLowerCase())
		},
		removeHeader(name: string) {
			headers.delete(name.toLowerCase())
		},
		end() {
			return this
		},
	} as ServerResponse
}

async function streamToResponseBody(stream: Stream): Promise<FetchBodyInit> {
	if (stream instanceof Readable) {
		return Readable.toWeb(stream) as ReadableStream
	}

	const chunks: Uint8Array[] = []
	for await (const chunk of stream as unknown as AsyncIterable<Buffer | string>) {
		chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
	}
	return Buffer.concat(chunks)
}

export class PostGraphileFetchResponse extends PostGraphileResponse {
	private readonly nodeRequest: IncomingMessage
	private readonly nodeResponse = createNodeResponse()
	private readonly headers = new Headers()
	private body: Stream | Buffer | string | undefined

	public constructor(request: Request, body: unknown) {
		super()
		this.nodeRequest = createNodeRequest(request, body)
	}

	public override getNodeServerRequest(): IncomingMessage {
		return this.nodeRequest
	}

	public override getNodeServerResponse(): ServerResponse {
		return this.nodeResponse
	}

	public override setHeaders(statusCode: number, headers: HeaderMap): void {
		this.statusCode = statusCode
		for (const [key, value] of Object.entries(headers)) {
			this.headers.set(key, value)
		}
	}

	public override setBody(body: Stream | Buffer | string | undefined): void {
		this.body = body
	}

	public async toResponse(extraHeaders?: FetchHeadersInit): Promise<Response> {
		const headers = new Headers(this.headers)
		if (extraHeaders) {
			for (const [key, value] of new Headers(extraHeaders).entries()) {
				headers.set(key, value)
			}
		}

		if (!this.body) {
			return new Response(null, {
				status: this.statusCode,
				headers,
			})
		}

		return new Response(
			typeof this.body === 'string' || Buffer.isBuffer(this.body)
				? this.body
				: await streamToResponseBody(this.body),
			{
				status: this.statusCode,
				headers,
			},
		)
	}
}

export async function handlePostGraphileRequest(
	handler: HttpRequestHandler,
	request: Request,
	body: unknown,
	extraHeaders?: FetchHeadersInit,
): Promise<Response> {
	return handlePostGraphileRouteRequest(handler.graphqlRouteHandler, request, body, extraHeaders)
}

export async function handlePostGraphileRouteRequest(
	routeHandler: (response: PostGraphileFetchResponse) => Promise<void>,
	request: Request,
	body: unknown,
	extraHeaders?: FetchHeadersInit,
): Promise<Response> {
	const response = new PostGraphileFetchResponse(request, body)
	await routeHandler(response)
	return response.toResponse(extraHeaders)
}
