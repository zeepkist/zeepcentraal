// Historical schema fixture only. Production mirror uses record_history_fact.
import { sql } from 'drizzle-orm'
import {
	boolean,
	check,
	foreignKey,
	index,
	integer,
	pgPolicy,
	primaryKey,
	real,
	text,
	timestamp,
} from 'drizzle-orm/pg-core'
import { record, zcPrivate, zeepCentraalGraphqlRole } from './schema'

export const recordHistoryIndex = zcPrivate.table(
	'record_history_index',
	{
		recordEligible: boolean('record_eligible').notNull().default(true),
		historyView: text('history_view').notNull(),
		id: integer().notNull(),
		time: real().notNull(),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' }).notNull(),
		levelId: integer('level_id').notNull(),
		userId: integer('user_id').notNull(),
		levelPosition: integer('level_position'),
		contributionRank: integer('contribution_rank'),
		levelPoints: integer('level_points'),
		levelDecayedPoints: real('level_decayed_points'),
		playerDecayedPoints: real('player_decayed_points'),
		isPersonalBest: boolean('is_personal_best').notNull().default(false),
		isWorldRecord: boolean('is_world_record').notNull().default(false),
		hasContribution: boolean('has_contribution').notNull().default(false),
	},
	(table) => [
		foreignKey({
			columns: [table.id, table.recordEligible],
			foreignColumns: [record.id, record.recordEligible],
			name: 'record_history_index_eligibility_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),
		primaryKey({ columns: [table.historyView, table.id] }),
		foreignKey({
			columns: [table.id],
			foreignColumns: [record.id],
			name: 'record_history_index_record_fkey',
		}).onDelete('cascade'),
		check(
			'CK_record_history_index_view',
			sql`${table.historyView} IN ('recent', 'personal-bests', 'world-records')`,
		),
		index('IX_record_history_index_record').using('btree', table.id.asc().nullsLast()),
		index('IX_record_history_index_latest').using(
			'btree',
			table.historyView.asc().nullsLast(),
			table.dateCreated.desc().nullsFirst(),
			table.id.desc().nullsFirst(),
		),
		index('IX_record_history_index_user_latest').using(
			'btree',
			table.historyView.asc().nullsLast(),
			table.userId.asc().nullsLast(),
			table.dateCreated.desc().nullsFirst(),
			table.id.desc().nullsFirst(),
		),
		index('IX_record_history_index_level_latest')
			.using(
				'btree',
				table.historyView.asc().nullsLast(),
				table.levelId.asc().nullsLast(),
				table.id.desc().nullsFirst(),
			)
			.where(sql`${table.historyView} IN ('personal-bests', 'world-records')`),
		index('IX_record_history_index_level_user_latest')
			.using(
				'btree',
				table.historyView.asc().nullsLast(),
				table.levelId.asc().nullsLast(),
				table.userId.asc().nullsLast(),
				table.id.desc().nullsFirst(),
			)
			.where(sql`${table.historyView} = 'personal-bests'`),
		index('IX_record_history_index_player_value').using(
			'btree',
			table.historyView.asc().nullsLast(),
			table.hasContribution.asc().nullsLast(),
			table.playerDecayedPoints.desc().nullsFirst(),
			table.dateCreated.desc().nullsFirst(),
			table.id.desc().nullsFirst(),
		),
		index('IX_record_history_index_user_player_value').using(
			'btree',
			table.historyView.asc().nullsLast(),
			table.userId.asc().nullsLast(),
			table.hasContribution.asc().nullsLast(),
			table.playerDecayedPoints.desc().nullsFirst(),
			table.dateCreated.desc().nullsFirst(),
			table.id.desc().nullsFirst(),
		),
		index('IX_record_history_index_level_value').using(
			'btree',
			table.historyView.asc().nullsLast(),
			table.hasContribution.asc().nullsLast(),
			table.levelPoints.desc().nullsFirst(),
			table.dateCreated.desc().nullsFirst(),
			table.id.desc().nullsFirst(),
		),
		index('IX_record_history_index_user_level_value').using(
			'btree',
			table.historyView.asc().nullsLast(),
			table.userId.asc().nullsLast(),
			table.hasContribution.asc().nullsLast(),
			table.levelPoints.desc().nullsFirst(),
			table.dateCreated.desc().nullsFirst(),
			table.id.desc().nullsFirst(),
		),
		index('IX_record_history_player_value_contributing')
			.using(
				'btree',
				table.historyView.asc().nullsLast(),
				table.playerDecayedPoints.desc().nullsFirst(),
				table.dateCreated.desc().nullsFirst(),
				table.id.desc().nullsFirst(),
			)
			.where(sql`${table.hasContribution}`),
		index('IX_record_history_user_player_value_contributing')
			.using(
				'btree',
				table.historyView.asc().nullsLast(),
				table.userId.asc().nullsLast(),
				table.playerDecayedPoints.desc().nullsFirst(),
				table.dateCreated.desc().nullsFirst(),
				table.id.desc().nullsFirst(),
			)
			.where(sql`${table.hasContribution}`),
		index('IX_record_history_level_value_contributing')
			.using(
				'btree',
				table.historyView.asc().nullsLast(),
				table.levelPoints.desc().nullsFirst(),
				table.dateCreated.desc().nullsFirst(),
				table.id.desc().nullsFirst(),
			)
			.where(sql`${table.hasContribution}`),
		index('IX_record_history_user_level_value_contributing')
			.using(
				'btree',
				table.historyView.asc().nullsLast(),
				table.userId.asc().nullsLast(),
				table.levelPoints.desc().nullsFirst(),
				table.dateCreated.desc().nullsFirst(),
				table.id.desc().nullsFirst(),
			)
			.where(sql`${table.hasContribution}`),
		index('IX_record_history_index_level_projection')
			.using('btree', table.levelId.asc().nullsLast())
			.where(
				sql`${table.hasContribution} = false AND (${table.isPersonalBest} OR ${table.isWorldRecord})`,
			),
		pgPolicy('record_eligibility', {
			for: 'select',
			to: zeepCentraalGraphqlRole,
			using: sql`${table.recordEligible}`,
		}),
	],
)
