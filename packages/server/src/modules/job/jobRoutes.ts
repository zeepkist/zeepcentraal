import { config as coreConfig } from '@zeepkist/core'
import { enqueueCompatibleTask, isCompatibleTask } from '@zeepkist/jobs/queue'
import { Elysia, t } from 'elysia'
import { handleV1Error, V1_ERROR_CODES } from '../../v1Errors'

export const jobRoutes = new Elysia({ prefix: '/job' }).post(
	'/trigger',
	async ({ body, request, set }) => {
		if (request.headers.get('authorization') !== `Bearer ${coreConfig.job.triggerToken}`) {
			set.status = 401
			return {
				error: handleV1Error(V1_ERROR_CODES.AUTH_INVALID_TOKEN).error,
			}
		}

		if (!isCompatibleTask(body.Task)) {
			set.status = 400
			return {
				error: {
					code: 22,
					message: 'Invalid request',
				},
			}
		}

		await enqueueCompatibleTask(body.Task, body.Options)
		set.status = 200
		return
	},
	{
		body: t.Object({
			Task: t.String(),
			Options: t.Record(t.String(), t.Unknown()),
		}),
	},
)
