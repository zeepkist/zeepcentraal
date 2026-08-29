import {
	getMeter,
	injectTraceCarrier,
	SpanKind,
	type TraceCarrier,
	withActiveSpan,
	withExtractedTraceCarrier,
} from '@zeepkist/telemetry'
import type {
	AddJobsJobSpec,
	Helpers,
	Job,
	JobHelpers,
	TaskSpec,
	WorkerUtils,
} from 'graphile-worker'

const TRACE_PAYLOAD_KEY = '__zeepcentraalTelemetry'
const meter = getMeter('zeepcentraal-jobs')
const producerDuration = meter.createHistogram('messaging.publish.duration', { unit: 's' })
const consumerDuration = meter.createHistogram('messaging.process.duration', { unit: 's' })
const outcomes = meter.createCounter('messaging.operations')

type PayloadObject = Record<string, unknown>

function payloadWithCarrier(payload: unknown, carrier = injectTraceCarrier()): unknown {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload
	return { ...(payload as PayloadObject), [TRACE_PAYLOAD_KEY]: carrier }
}

function payloadWithoutCarrier(payload: unknown) {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		return { carrier: undefined, payload }
	}
	const { [TRACE_PAYLOAD_KEY]: rawCarrier, ...cleanPayload } = payload as PayloadObject
	const carrier =
		rawCarrier && typeof rawCarrier === 'object'
			? (Object.fromEntries(
					Object.entries(rawCarrier).filter((entry): entry is [string, string] =>
						entry.every((value) => typeof value === 'string'),
					),
				) as TraceCarrier)
			: undefined
	return { carrier, payload: cleanPayload }
}

async function tracedAddJob(
	addJob: WorkerUtils['addJob'] | Helpers['addJob'],
	identifier: string,
	payload: unknown,
	spec?: TaskSpec,
) {
	const started = performance.now()
	try {
		const job = await withActiveSpan(
			`${identifier} publish`,
			{
				kind: SpanKind.PRODUCER,
				attributes: {
					'messaging.system': 'graphile-worker',
					'messaging.operation.type': 'send',
					'messaging.destination.name': spec?.queueName ?? identifier,
				},
			},
			async (span) => {
				const created = await addJob(identifier, payloadWithCarrier(payload), spec)
				span.addEvent('messaging.job.created', { 'messaging.message.id': created.id })
				return created
			},
		)
		outcomes.add(1, { 'messaging.operation.type': 'send', outcome: 'success' })
		return job
	} catch (error) {
		outcomes.add(1, { 'messaging.operation.type': 'send', outcome: 'error' })
		throw error
	} finally {
		producerDuration.record((performance.now() - started) / 1_000, {
			'messaging.destination.name': identifier,
		})
	}
}

async function tracedAddJobs(addJobs: Helpers['addJobs'], specs: readonly AddJobsJobSpec[]) {
	const carrier = injectTraceCarrier()
	const started = performance.now()
	try {
		const jobs = await withActiveSpan(
			'graphile-worker publish batch',
			{
				kind: SpanKind.PRODUCER,
				attributes: { 'messaging.batch.message_count': specs.length },
			},
			async (span) => {
				const created = await addJobs(
					specs.map((spec) => ({
						...spec,
						payload: payloadWithCarrier(spec.payload, carrier),
					})),
				)
				span.addEvent('messaging.jobs.created', {
					'messaging.batch.message_count': created.length,
				})
				return created
			},
		)
		outcomes.add(1, { 'messaging.operation.type': 'send_batch', outcome: 'success' })
		return jobs
	} catch (error) {
		outcomes.add(1, { 'messaging.operation.type': 'send_batch', outcome: 'error' })
		throw error
	} finally {
		producerDuration.record((performance.now() - started) / 1_000, {
			'messaging.destination.name': 'batch',
		})
	}
}

export function wrapWorkerUtils<T extends WorkerUtils>(utils: T): T {
	return new Proxy(utils, {
		get(target, property, receiver) {
			if (property === 'addJob') {
				return (identifier: string, payload: unknown, spec?: TaskSpec) =>
					tracedAddJob(target.addJob.bind(target), identifier, payload, spec)
			}
			if (property === 'addJobs') {
				return (specs: readonly AddJobsJobSpec[]) =>
					tracedAddJobs(target.addJobs.bind(target), specs)
			}
			const value = Reflect.get(target, property, receiver)
			return typeof value === 'function' ? value.bind(target) : value
		},
	})
}

function wrapHelpers(helpers: JobHelpers): JobHelpers {
	return {
		...helpers,
		addJob: ((identifier: string, payload: unknown, spec?: TaskSpec) =>
			tracedAddJob(
				helpers.addJob.bind(helpers),
				identifier,
				payload,
				spec,
			)) as Helpers['addJob'],
		addJobs: ((specs: readonly AddJobsJobSpec[]) =>
			tracedAddJobs(helpers.addJobs.bind(helpers), specs)) as Helpers['addJobs'],
	}
}

export function wrapTask(
	identifier: string,
	task: (payload: unknown, helpers: JobHelpers) => Promise<void>,
) {
	return async (rawPayload: unknown, helpers: JobHelpers) => {
		const { carrier, payload } = payloadWithoutCarrier(rawPayload)
		return withExtractedTraceCarrier(carrier, async () => {
			const queue = (await helpers.getQueueName()) ?? identifier
			const started = performance.now()
			try {
				const result = await withActiveSpan(
					`${identifier} process`,
					{
						kind: SpanKind.CONSUMER,
						attributes: {
							'messaging.system': 'graphile-worker',
							'messaging.operation.type': 'process',
							'messaging.destination.name': queue,
							'messaging.message.id': helpers.job.id,
							'messaging.message.retry.count': helpers.job.attempts,
							'messaging.message.retry.max': helpers.job.max_attempts,
						},
					},
					(span) => {
						span.addEvent('messaging.job.attempt', {
							'messaging.message.retry.count': helpers.job.attempts,
						})
						return task(payload, wrapHelpers(helpers))
					},
				)
				outcomes.add(1, { 'messaging.operation.type': 'process', outcome: 'success' })
				return result
			} catch (error) {
				outcomes.add(1, { 'messaging.operation.type': 'process', outcome: 'error' })
				throw error
			} finally {
				consumerDuration.record((performance.now() - started) / 1_000, {
					'messaging.destination.name': identifier,
				})
			}
		})
	}
}

export type TracedTask = (payload: unknown, helpers: JobHelpers) => Promise<void>
export type TracedJob = Job
