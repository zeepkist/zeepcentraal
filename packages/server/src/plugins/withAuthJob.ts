import { config as coreConfig } from '@zeepkist/core'
import type { Elysia } from 'elysia'
import { handleV1Error, V1_ERROR_CODES } from '../v1Errors'

export const withAuthJob = (app: Elysia) =>
	app.onBeforeHandle(({ request }) => {
		const authorization = request.headers.get('authorization')
		const expected = `Bearer ${coreConfig.job.triggerToken}`

		if (!authorization || authorization !== expected) {
			return new Response(JSON.stringify(handleV1Error(V1_ERROR_CODES.AUTH_INVALID_TOKEN)), {
				status: 401,
				headers: { 'content-type': 'application/json' },
			})
		}
	})
