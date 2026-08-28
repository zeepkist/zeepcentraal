import { serverConfig } from '@zeepkist/core/config/server'
import type { Elysia } from 'elysia'
import { ERROR_CODES, handleProblem } from '../problems'

export const withAuthJob = (app: Elysia) =>
	app.beforeHandle(({ request }) => {
		const authorization = request.headers.get('authorization')
		const expected = `Bearer ${serverConfig.job.triggerToken}`

		if (!authorization || authorization !== expected) {
			return handleProblem(401, ERROR_CODES.AUTH_INVALID_TOKEN)
		}
	})
