import { describe, expect, mock, test } from 'bun:test'
import { verifyTurnstileToken } from './turnstileVerification'

const input = {
	token: 'challenge-token',
	secretKey: 'server-secret',
	remoteIp: '203.0.113.10',
	allowedHostnames: ['zeepki.st'],
} as const

describe('verifyTurnstileToken', () => {
	test('accepts matching successful validation and sends server-only fields', async () => {
		const fetch = mock(async (_url: string | URL | Request, init?: RequestInit) => {
			expect(init?.method).toBe('POST')
			expect(init?.headers).toEqual({ 'content-type': 'application/json' })
			expect(JSON.parse(String(init?.body))).toEqual({
				secret: 'server-secret',
				response: 'challenge-token',
				remoteip: '203.0.113.10',
			})
			return Response.json({
				success: true,
				action: 'record-replay',
				hostname: 'zeepki.st',
			})
		})

		expect(await verifyTurnstileToken(input, { fetch })).toEqual({ verified: true })
	})

	test.each([
		[{ success: false, 'error-codes': ['invalid-input-response'] }, 'failed token'],
		[{ success: true, action: 'login', hostname: 'zeepki.st' }, 'wrong action'],
		[
			{ success: true, action: 'record-replay', hostname: 'attacker.example' },
			'wrong hostname',
		],
	] as const)('rejects %s', async (response) => {
		const fetch = mock(async () => Response.json(response))

		expect(await verifyTurnstileToken(input, { fetch })).toEqual({
			verified: false,
			reason: 'rejected',
		})
	})

	test('fails closed when Siteverify is unavailable', async () => {
		const fetch = mock(async () => new Response(null, { status: 503 }))

		expect(await verifyTurnstileToken(input, { fetch })).toEqual({
			verified: false,
			reason: 'unavailable',
		})
	})
})
