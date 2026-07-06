import { describe, expect, test } from 'bun:test'
import { LiveQueryCompatPlugin } from './LiveQueryCompatPlugin'

type FieldsHook = (
	fields: Record<string, unknown>,
	build: unknown,
	context: { scope: { isRootQuery?: boolean; isRootSubscription?: boolean } },
) => Record<string, unknown>

describe('LiveQueryCompatPlugin', () => {
	test('mirrors root query fields onto root subscription and removes listen', () => {
		const hook = LiveQueryCompatPlugin.schema?.hooks?.GraphQLObjectType_fields as
			| FieldsHook
			| undefined
		expect(hook).toBeFunction()

		const build = {}
		const queryFields = {
			records: { type: 'RecordsConnection' },
		}
		hook?.(queryFields, build, { scope: { isRootQuery: true } })

		const subscriptionFields = hook?.({ listen: { type: 'ListenPayload' } }, build, {
			scope: { isRootSubscription: true },
		})
		expect(subscriptionFields).toBeDefined()

		expect(subscriptionFields?.records).toEqual({ type: 'RecordsConnection' })
		expect(subscriptionFields?.listen).toBeUndefined()
	})
})
