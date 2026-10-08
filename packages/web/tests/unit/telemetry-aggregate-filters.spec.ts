import { readFileSync } from 'node:fs'
import {
	Zc_DashboardStatisticsDocument,
	Zc_LevelStatisticsDocument,
	Zc_UserStatisticsDocument,
} from '@zeepkist/graphql/generated'
import { Kind, parse, valueFromASTUntyped } from 'graphql'
import { describe, expect, it } from 'vitest'

const cases = [
	{
		file: 'dashboard',
		document: Zc_DashboardStatisticsDocument,
		aliases: ['v6DayStatistics', 'v6MonthStatistics'],
	},
	{ file: 'levelStatistics', document: Zc_LevelStatisticsDocument, aliases: ['v6Statistics'] },
	{
		file: 'userStatistics',
		document: Zc_UserStatisticsDocument,
		aliases: ['v6Statistics', 'v6DayStatistics', 'v6MonthStatistics', 'v6YearStatistics'],
	},
]

describe('extended telemetry aggregate filters', () => {
	it.each(cases)(
		'$file includes V6+ and keeps record scope in source and generated documents',
		({ file, document, aliases }) => {
			const source = parse(
				readFileSync(
					new URL(
						`../../../graphql/documents/web/queries/${file}.graphql`,
						import.meta.url,
					),
					'utf8',
				),
			)
			for (const candidate of [source, document]) {
				const connections = candidate.definitions.flatMap((definition) =>
					definition.kind === Kind.OPERATION_DEFINITION
						? definition.selectionSet.selections.filter(
								(selection) =>
									selection.kind === Kind.FIELD &&
									selection.alias?.value.startsWith('v6'),
							)
						: [],
				)
				expect(
					connections.map(
						(connection) => connection.kind === Kind.FIELD && connection.alias?.value,
					),
				).toEqual(aliases)
				for (const connection of connections) {
					if (connection.kind !== Kind.FIELD) continue
					const argument = connection.arguments?.find(
						(argument) => argument.name.value === 'filter',
					)
					expect(argument).toBeDefined()
					if (!argument) continue
					const filter = valueFromASTUntyped(argument.value, {
						userId: 123,
						levelId: 456,
						daySince: 'day',
						monthSince: 'month',
						yearSince: 'year',
					})
					expect(filter.ghostVersion).toEqual({ greaterThanOrEqualTo: 6 })
					expect(filter.record.modVersion).toBeUndefined()
					const record: Record<string, unknown> = {}
					if (file === 'levelStatistics') record.levelId = { equalTo: 456 }
					if (file === 'userStatistics') record.userId = { equalTo: 123 }
					const period = connection.alias?.value
						.match(/(Day|Month|Year)/)?.[1]
						?.toLowerCase()
					if (period) record.dateCreated = { greaterThanOrEqualTo: period }
					expect(filter.record).toEqual(record)
				}
			}
		},
	)
})
