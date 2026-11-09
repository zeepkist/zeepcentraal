/** Additional timestamp groups, public lobby fields and occupancy ordering. */
export const LobbyAggregatesPlugin: GraphileConfig.Plugin = {
	name: 'LobbyAggregatesPlugin',
	version: '1.0.0',
	after: [
		'PgAggregatesSpecsPlugin',
		'PgAggregatesAddConnectionGroupedAggregatesPlugin',
		'PgOrderAllAttributesPlugin',
	],
	schema: {
		hooks: {
			GraphQLEnumType_values(values, build, context) {
				if (
					!context.scope.isPgRowSortEnum ||
					!context.scope.pgCodec?.attributes?.available_capacity ||
					!values.OCCUPANCY_DESC
				)
					return values
				const value = values.OCCUPANCY_DESC
				return {
					...values,
					OCCUPANCY_DESC: {
						...value,
						extensions: {
							...value.extensions,
							grafast: {
								...value.extensions?.grafast,
								apply: build.EXPORTABLE(
									() =>
										(queryBuilder: {
											orderBy(spec: {
												attribute: string
												direction: 'DESC'
												nulls: 'LAST'
											}): void
										}) => {
											queryBuilder.orderBy({
												attribute: 'occupancy',
												direction: 'DESC',
												nulls: 'LAST',
											})
										},
									[],
								),
							},
						},
					},
				}
			},
			GraphQLObjectType_fields(fields, _build, context) {
				if (context.scope.isRootQuery || context.scope.isRootSubscription) {
					const { lobbyByMasterId: _hidden, ...visible } = fields
					return visible
				}
				if (context.Self.name.includes('Lobb')) {
					const { masterId: _hidden, ...visible } = fields
					return visible
				}
				return fields
			},
			build(build) {
				const { sql, EXPORTABLE } = build
				const specs = build.pgAggregateGroupBySpecs
				const base = specs?.[0]
				if (!base || !specs || !sql)
					throw new Error('pg-aggregates timestamp grouping unavailable')
				for (const [id, interval] of [
					['five-minutes', '5 minutes'],
					['six-hours', '6 hours'],
					['utc-hour', 'hour'],
					['utc-day', 'day'],
					['month', 'month'],
				] as const) {
					specs.push({
						...base,
						id: `truncated-to-${id}`,
						shouldApplyToEntity: ({ codec, attributeName }) =>
							!!codec?.attributes?.players_in_rooms &&
							attributeName === 'date_created',
						sqlWrap: EXPORTABLE(
							(sql, interval) => (fragment) =>
								['month', 'hour', 'day'].includes(interval)
									? sql`date_trunc(${sql.literal(interval)}, ${fragment}, 'UTC')`
									: sql`date_bin(${sql.literal(interval)}::interval, ${fragment}, '2000-01-01Z'::timestamptz)`,
							[sql, interval],
						),
					})
				}
				return build
			},
		},
	},
}
