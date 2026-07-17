import { describe, expect, mock, test } from 'bun:test'
import {
	buildJobTriggerUrl,
	JobTriggerHttpError,
	PRODUCTION_BACKEND_URL,
	resolveBackendUrl,
	sendJobTriggerRequest,
} from './http'

const request = {
	Task: 'updatePlayerScore',
	Options: { idUser: 42 },
}

describe('resolveBackendUrl', () => {
	test('uses configured local backend URL', () => {
		expect(resolveBackendUrl('local', { BACKEND_URL: ' http://localhost:5000/ ' })).toBe(
			'http://localhost:5000/',
		)
	})

	test('requires BACKEND_URL for local requests', () => {
		expect(() => resolveBackendUrl('local', {})).toThrow('BACKEND_URL is not defined')
	})

	test('uses fixed production backend regardless of local configuration', () => {
		expect(resolveBackendUrl('production', { BACKEND_URL: 'http://localhost:5000' })).toBe(
			PRODUCTION_BACKEND_URL,
		)
	})
})

describe('buildJobTriggerUrl', () => {
	test('normalizes trailing slashes and appends job route', () => {
		expect(buildJobTriggerUrl('http://localhost:5000///')).toBe(
			'http://localhost:5000/job/trigger',
		)
	})

	test('does not duplicate an existing job route', () => {
		expect(buildJobTriggerUrl('https://backend.example/job/trigger/')).toBe(
			'https://backend.example/job/trigger',
		)
	})

	test('preserves a backend path and removes query and fragment values', () => {
		expect(buildJobTriggerUrl('https://backend.example/api/?ignored=true#fragment')).toBe(
			'https://backend.example/api/job/trigger',
		)
	})

	test('rejects invalid and non-HTTP backend URLs', () => {
		expect(() => buildJobTriggerUrl('not a URL')).toThrow(
			'BACKEND_URL must be a valid HTTP URL',
		)
		expect(() => buildJobTriggerUrl('file:///tmp/backend')).toThrow(
			'BACKEND_URL must use HTTP or HTTPS',
		)
	})
})

describe('sendJobTriggerRequest', () => {
	test('posts bearer-authenticated payload and accepts empty success response', async () => {
		const fetchImpl = mock(async () => new Response(null, { status: 200 }))

		expect(
			await sendJobTriggerRequest({
				url: 'http://localhost:5000/job/trigger',
				token: 'test-token',
				request,
				fetchImpl,
			}),
		).toEqual({ status: 200 })
		expect(fetchImpl).toHaveBeenCalledTimes(1)
		expect(fetchImpl).toHaveBeenCalledWith('http://localhost:5000/job/trigger', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer test-token',
			},
			body: JSON.stringify(request),
		})
	})

	test('exposes structured API error status, code, and message', async () => {
		const fetchImpl = mock(
			async () =>
				new Response(JSON.stringify({ error: { code: 22, message: 'Invalid request' } }), {
					status: 400,
				}),
		)

		const error = await captureError(
			sendJobTriggerRequest({
				url: 'http://localhost:5000/job/trigger',
				token: 'test-token',
				request,
				fetchImpl,
			}),
		)

		expect(error).toBeInstanceOf(JobTriggerHttpError)
		expect(error).toMatchObject({
			status: 400,
			code: 22,
			message: 'Job trigger request failed (400, code 22): Invalid request.',
		})
	})

	test('exposes plain-text errors and Retry-After', async () => {
		const fetchImpl = mock(
			async () =>
				new Response('Too many requests', {
					status: 429,
					headers: { 'Retry-After': '30' },
				}),
		)

		const error = await captureError(
			sendJobTriggerRequest({
				url: 'http://localhost:5000/job/trigger',
				token: 'test-token',
				request,
				fetchImpl,
			}),
		)

		expect(error).toMatchObject({
			status: 429,
			retryAfter: '30',
			message: 'Job trigger request failed (429): Too many requests. Retry after: 30.',
		})
	})

	test('redacts token echoed by an error response', async () => {
		const fetchImpl = mock(async () => new Response('Rejected secret-token', { status: 401 }))

		const error = await captureError(
			sendJobTriggerRequest({
				url: 'http://localhost:5000/job/trigger',
				token: 'secret-token',
				request,
				fetchImpl,
			}),
		)

		expect(error.message).toContain('[REDACTED]')
		expect(error.message).not.toContain('secret-token')
	})

	test('does not expose fetch failure details or token', async () => {
		const fetchImpl = mock(async () => {
			throw new Error('Authorization failed for secret-token')
		})

		const error = await captureError(
			sendJobTriggerRequest({
				url: 'http://localhost:5000/job/trigger',
				token: 'secret-token',
				request,
				fetchImpl,
			}),
		)

		expect(error.message).toBe('Job trigger request failed before receiving a response')
		expect(error.message).not.toContain('secret-token')
	})

	test('rejects empty trigger token before sending', async () => {
		const fetchImpl = mock(async () => new Response(null, { status: 200 }))

		expect(
			sendJobTriggerRequest({
				url: 'http://localhost:5000/job/trigger',
				token: ' ',
				request,
				fetchImpl,
			}),
		).rejects.toThrow('TRIGGER_JOB_TOKEN is not defined')
		expect(fetchImpl).not.toHaveBeenCalled()
	})
})

async function captureError(promise: Promise<unknown>): Promise<Error & Record<string, unknown>> {
	try {
		await promise
		throw new Error('Expected promise to reject')
	} catch (error) {
		if (!(error instanceof Error)) {
			throw error
		}

		return error as Error & Record<string, unknown>
	}
}
