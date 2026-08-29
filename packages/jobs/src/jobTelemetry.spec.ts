import { expect, mock, test } from 'bun:test'
import type { JobHelpers, WorkerUtils } from 'graphile-worker'
import { wrapTask, wrapWorkerUtils } from './jobTelemetry'

const tracePayloadKey = '__zeepcentraalTelemetry'

function helpers(attempts: number) {
	return {
		addJob: mock(async () => ({ id: 'child' })),
		addJobs: mock(async () => []),
		getQueueName: mock(async () => 'test-queue'),
		job: { attempts, id: 'job-1', max_attempts: 3 },
	} as unknown as JobHelpers
}

test('producer injects private carrier without mutating input payload', async () => {
	const addJob = mock(async (_identifier: string, payload: unknown) => ({
		id: 'job-1',
		payload,
	}))
	const utils = wrapWorkerUtils({ addJob } as unknown as WorkerUtils)
	const payload = { idLevel: 42 }

	await utils.addJob('scanWorkshopItem', payload)

	expect(payload).not.toHaveProperty(tracePayloadKey)
	expect(addJob.mock.calls[0]?.[1]).toEqual({ idLevel: 42, [tracePayloadKey]: {} })
})

test('consumer strips carrier for every retry attempt', async () => {
	const received: unknown[] = []
	const task = wrapTask('scanWorkshopItem', async (payload) => {
		received.push(payload)
	})
	const payload = {
		idLevel: 42,
		[tracePayloadKey]: {
			traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
		},
	}

	await task(payload, helpers(1))
	await task(payload, helpers(2))

	expect(received).toEqual([{ idLevel: 42 }, { idLevel: 42 }])
	expect(payload).toHaveProperty(tracePayloadKey)
})
