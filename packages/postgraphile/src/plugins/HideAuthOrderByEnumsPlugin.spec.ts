import { describe, expect, test } from 'bun:test'
import { HideAuthOrderByEnumsPlugin } from './HideAuthOrderByEnumsPlugin'

function runPlugin(values: Record<string, unknown>, isPgRowSortEnum: boolean) {
	const callback = HideAuthOrderByEnumsPlugin.schema?.hooks?.GraphQLEnumType_values as unknown as
		| ((
				value: Record<string, unknown>,
				build: never,
				context: never,
		  ) => Record<string, unknown>)
		| undefined

	if (!callback) {
		throw new Error('Plugin did not register hook')
	}

	return callback(values, {} as never, { scope: { isPgRowSortEnum } } as never)
}

describe('HideAuthOrderByEnumsPlugin', () => {
	test('removes auth order values from row sort enums', () => {
		const values = {
			AUTH_ID_ASC: {},
			AUTHS_ID_DESC: {},
			USER_ID_ASC: {},
		}

		expect(runPlugin(values, true)).toEqual({
			USER_ID_ASC: {},
		})
	})

	test('leaves non-row-sort enums unchanged', () => {
		const values = {
			AUTH_ID_ASC: {},
			AUTHS_ID_DESC: {},
			USER_ID_ASC: {},
		}

		expect(runPlugin(values, false)).toEqual(values)
	})
})
