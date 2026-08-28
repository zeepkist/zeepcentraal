import { Manifest } from 'elysia'
import { buildSchema } from 'postgraphile/graphql'
import type { ReadinessService } from './readiness'
import { buildPostGraphileServer } from './server'

const captureReadiness: ReadinessService = {
	async check() {
		return { ok: true }
	},
	async dispose() {},
}

const captureHandler = {
	createServ() {
		return {
			async handleGraphQLRequest() {
				return Response.json({ data: { ok: true } })
			},
			async handleGraphiQLStaticRequest() {
				return null
			},
		}
	},
	getSchema() {
		return buildSchema(`
			type Query {
				ok: Boolean
			}

			type Subscription {
				ok: Boolean
			}
		`)
	},
}

export const app = Manifest.isCapturing()
	? buildPostGraphileServer(captureHandler as never, captureReadiness)
	: buildPostGraphileServer()
