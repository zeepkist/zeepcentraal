import { enqueueCompatibleTask, isCompatibleTask, isValidTaskPayload } from '@zeepkist/jobs/queue'
import { Elysia, t } from 'elysia'
import { JOB_BEARER_SECURITY, OPENAPI_TAG } from '../../openapi'
import { withAuthJob } from '../../plugins/withAuthJob'
import { withRateLimit } from '../../plugins/withRateLimit'
import { ERROR_CODES, handleProblem } from '../../problems'

export const jobRoutes = new Elysia({ prefix: '/job' })
	.use(withRateLimit('job'))
	.use(withAuthJob)
	.post(
		'/trigger',
		{
			body: t.Object({
				Task: t.String({ description: 'Allowlisted Graphile Worker task identifier.' }),
				Options: t.Record(t.String(), t.Unknown(), {
					description: 'Task-specific payload validated before enqueueing.',
				}),
			}),
			detail: {
				operationId: 'triggerJob',
				summary: 'Trigger a background job',
				description:
					'Enqueues an allowlisted background task. Intended only for trusted ZeepCentraal services.',
				security: JOB_BEARER_SECURITY,
				tags: [OPENAPI_TAG.job],
			},
		},
		async ({ body, set }) => {
			if (!isCompatibleTask(body.Task) || !isValidTaskPayload(body.Task, body.Options)) {
				return handleProblem(400, ERROR_CODES.GENERIC_INVALID_REQUEST)
			}

			await enqueueCompatibleTask(body.Task, body.Options)
			set.status = 200
			return
		},
	)
