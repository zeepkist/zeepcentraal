import { createError } from 'nuxt/server'

export async function readBoundedJson(
	request: Request,
	limit: number,
): Promise<Record<string, unknown>> {
	const stream = request.body?.getReader()
	if (!stream) throw createError({ status: 400, statusText: 'Missing JSON body' })
	const decoder = new TextDecoder('utf-8', { fatal: true })
	let size = 0
	let text = ''
	try {
		for (;;) {
			const chunk = await stream.read()
			if (chunk.done) break
			size += chunk.value.byteLength
			if (size > limit) {
				await stream.cancel()
				throw createError({ status: 413, statusText: 'Request body too large' })
			}
			text += decoder.decode(chunk.value, { stream: true })
		}
		const body: unknown = JSON.parse(text + decoder.decode())
		if (body === null || typeof body !== 'object' || Array.isArray(body)) {
			throw new TypeError('Expected a JSON object')
		}
		return body as Record<string, unknown>
	} catch (error) {
		if (error instanceof SyntaxError || error instanceof TypeError) {
			throw createError({ status: 400, statusText: 'Invalid JSON body' })
		}
		throw error
	} finally {
		stream.releaseLock()
	}
}
