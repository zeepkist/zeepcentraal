import { enqueueCompatibleTask, isCompatibleTask, isValidTaskPayload } from '@zeepkist/jobs/queue'
import { Elysia, t } from 'elysia'
import { withAuthJob } from '../../plugins/withAuthJob'
import { withRateLimit } from '../../plugins/withRateLimit'

export const jobRoutes = new Elysia({ prefix: '/job' })
	.use(withRateLimit('job'))
	.use(withAuthJob)
	.post(
		'/trigger',
		async ({ body, set }) => {
			if (!isCompatibleTask(body.Task) || !isValidTaskPayload(body.Task, body.Options)) {
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
