import { Elysia, t } from 'elysia'
import { config } from '../../config'
import { OPENAPI_TAG, PROBLEM_DETAILS_SCHEMA } from '../../openapi'
import { resolveClientIp, withRateLimit } from '../../plugins/withRateLimit'
import { handleProblem } from '../../problems'
import { verifyTurnstileToken } from './turnstileVerification'

export const turnstileRoutes = new Elysia({ prefix: '/turnstile' })
	.use(withRateLimit('mutation'))
	.post(
		'/verify',
		{
			body: t.Object(
				{
					token: t.String({ minLength: 1, maxLength: 2048 }),
				},
				{ additionalProperties: t.Never() },
			),
			detail: {
				operationId: 'verifyTurnstile',
				summary: 'Verify Turnstile challenge',
				description:
					'Validates a record-replay Turnstile token before protected browser downloads begin.',
				tags: [OPENAPI_TAG.turnstile],
				responses: {
					200: {
						description: 'Challenge validated.',
						content: {
							'application/json': {
								schema: {
									type: 'object',
									required: ['success'],
									properties: { success: { type: 'boolean' } },
								},
							},
						},
					},
					403: {
						description: 'Challenge rejected.',
						content: { 'application/problem+json': { schema: PROBLEM_DETAILS_SCHEMA } },
					},
					503: {
						description: 'Challenge validation unavailable.',
						content: { 'application/problem+json': { schema: PROBLEM_DETAILS_SCHEMA } },
					},
				},
			},
		},
		async ({ body, request, server }) => {
			const result = await verifyTurnstileToken({
				token: body.token,
				secretKey: config.turnstile.secretKey,
				remoteIp: resolveClientIp(request, server),
				allowedHostnames: config.turnstile.allowedHostnames,
			})

			if (!result.verified) {
				return result.reason === 'unavailable'
					? handleProblem(503, 'Turnstile verification unavailable')
					: handleProblem(403, 'Turnstile verification failed')
			}

			return { success: true as const }
		},
	)
