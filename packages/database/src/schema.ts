import { sql } from 'drizzle-orm'
import {
	bigint,
	boolean,
	check,
	doublePrecision,
	foreignKey,
	index,
	integer,
	jsonb,
	pgPolicy,
	pgRole,
	pgSchema,
	pgTable,
	pgView,
	primaryKey,
	real,
	smallint,
	text,
	timestamp,
	unique,
	uniqueIndex,
	varchar,
} from 'drizzle-orm/pg-core'
import { DEFAULT_VOTE_RATING } from './config'

export const zcPrivate = pgSchema('zc_private')

export const zeepCentraalGraphqlRole = pgRole('zeepcentraal_graphql', {
	createDb: false,
	createRole: false,
	inherit: false,
})

export const level = pgTable(
	'level',
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity({
			name: 'level_id_seq',
			startWith: 1,
			increment: 1,
			minValue: 1,
			maxValue: 2147483647,
			cache: 1,
		}),
		hash: text().notNull(),
		xxHash: text('xx_hash').notNull(),
		adventure: boolean().notNull().default(false),
		hasRecords: boolean('has_records').notNull().default(false),
		recordCount: bigint('record_count', { mode: 'number' }).notNull().default(0),
		publiclyVisible: boolean('publicly_visible').notNull().default(false),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		index('IX_level_hash').using('btree', table.hash.asc().nullsLast()),
		unique('UQ_level_xx_hash').on(table.xxHash),
		index('IX_level_date_created_id').using(
			'btree',
			table.dateCreated.desc().nullsLast(),
			table.id.desc().nullsLast(),
		),
		index('IX_level_adventure_date_created_id')
			.using('btree', table.dateCreated.asc().nullsLast(), table.id.asc().nullsLast())
			.where(sql`${table.adventure} = true`),
		index('IX_level_hash_search').using('gin', table.hash.op('gin_trgm_ops')),
		index('IX_level_xx_hash_search').using('gin', table.xxHash.op('gin_trgm_ops')),
		index('IX_level_publicly_visible_id')
			.using('btree', table.id.asc().nullsLast())
			.where(sql`${table.publiclyVisible} = true`),
	],
)

export const levelItem = pgTable(
	'level_item',
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity({
			name: 'level_item_id_seq',
			startWith: 1,
			increment: 1,
			minValue: 1,
			maxValue: 2147483647,
			cache: 1,
		}),
		idLevel: integer('id_level').notNull(),
		workshopId: bigint('workshop_id', { mode: 'bigint' }).notNull(),
		authorId: bigint('author_id', { mode: 'bigint' }).notNull(),
		name: text().notNull(),
		imageUrl: text('image_url').notNull(),
		fileAuthor: text('file_author').notNull(),
		fileUid: text('file_uid').notNull(),
		validationTimeAuthor: real('validation_time_author').notNull(),
		validationTimeGold: real('validation_time_gold').notNull(),
		validationTimeSilver: real('validation_time_silver').notNull(),
		validationTimeBronze: real('validation_time_bronze').notNull(),
		deleted: boolean().notNull(),
		publiclyVisible: boolean('publicly_visible').notNull().default(false),
		rtmSampleKey: doublePrecision('rtm_sample_key').notNull().default(sql`random()`),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(), // workshop level created at
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(), // workshop level updated at
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		foreignKey({
			columns: [table.idLevel],
			foreignColumns: [level.id],
			name: 'level_item_id_level_fkey',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.workshopId],
			foreignColumns: [workshopItem.workshopId],
			name: 'level_item_workshop_item_fkey',
		}),
		foreignKey({
			columns: [table.authorId],
			foreignColumns: [user.steamId],
			name: 'level_item_author_fkey',
		}),
		index('IX_level_item_level').using('btree', table.idLevel.asc().nullsLast()),
		index('IX_level_item_workshop_deleted').using(
			'btree',
			table.workshopId.asc().nullsLast(),
			table.deleted.asc().nullsLast(),
		),
		index('IX_level_item_workshop_file_uid').using(
			'btree',
			table.workshopId.asc().nullsLast(),
			table.fileUid.asc().nullsLast(),
		),
		index('IX_level_item_workshop_level').using(
			'btree',
			table.workshopId.asc().nullsLast(),
			table.idLevel.asc().nullsLast(),
		),
		index('IX_level_item_author').using('btree', table.authorId.asc().nullsLast()),
		index('IX_level_item_level_updated_active')
			.using(
				'btree',
				table.idLevel.asc().nullsLast(),
				table.updatedAt.desc().nullsLast(),
				table.id.desc().nullsLast(),
			)
			.where(sql`${table.deleted} = false`),
		index('IX_level_item_author_created_active')
			.using(
				'btree',
				table.authorId.asc().nullsLast(),
				table.createdAt.desc().nullsLast(),
				table.id.desc().nullsLast(),
				table.idLevel.asc().nullsLast(),
			)
			.where(sql`${table.deleted} = false`),
		index('IX_level_item_name_search').using('gin', table.name.op('gin_trgm_ops')),
		index('IX_level_item_public_level_updated')
			.using(
				'btree',
				table.idLevel.asc().nullsLast(),
				table.updatedAt.desc().nullsLast(),
				table.id.desc().nullsLast(),
			)
			.where(sql`${table.publiclyVisible} = true`),
		index('IX_level_item_public_level_updated_active')
			.using(
				'btree',
				table.idLevel.asc().nullsLast(),
				table.updatedAt.desc().nullsLast(),
				table.id.desc().nullsLast(),
			)
			.where(sql`${table.publiclyVisible} = true AND ${table.deleted} = false`),
		index('IX_level_item_public_workshop')
			.using('btree', table.workshopId.asc().nullsLast(), table.id.asc().nullsLast())
			.where(sql`${table.publiclyVisible} = true`),
		index('IX_level_item_public_rtm_sample')
			.using('btree', table.rtmSampleKey.asc().nullsLast(), table.id.asc().nullsLast())
			.where(sql`${table.publiclyVisible} = true AND ${table.deleted} = false`),
		pgPolicy('graphql_select_visible_level_item', {
			for: 'select',
			to: zeepCentraalGraphqlRole,
			using: sql`${table.publiclyVisible} = true`,
		}),
	],
).enableRLS()

export const workshopItem = pgTable(
	'workshop_item',
	{
		workshopId: bigint('workshop_id', { mode: 'bigint' }).primaryKey(),
		authorId: bigint('author_id', { mode: 'bigint' }).notNull(),
		name: text().notNull(),
		imageUrl: text('image_url').notNull(),
		visibility: smallint().notNull().default(0),
		publiclyVisible: boolean('publicly_visible').notNull().default(false),
		fileSize: integer('file_size').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(), // workshop item created at
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(), // workshop item updated at
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date().toISOString()),
	},
	(table) => [
		foreignKey({
			columns: [table.authorId],
			foreignColumns: [user.steamId],
			name: 'workshop_item_author_fkey',
		}),
		index('IX_workshop_item_author').using('btree', table.authorId.asc().nullsLast()),
		index('IX_workshop_item_public')
			.using('btree', table.workshopId.asc().nullsLast())
			.where(sql`${table.publiclyVisible} = true`),
		pgPolicy('graphql_select_visible_workshop_item', {
			for: 'select',
			to: zeepCentraalGraphqlRole,
			using: sql`${table.publiclyVisible} = true`,
		}),
	],
).enableRLS()

export const levelMetadata = pgTable(
	'level_metadata',
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity({
			name: 'level_metadata_id_seq',
			startWith: 1,
			increment: 1,
			minValue: 1,
			maxValue: 2147483647,
			cache: 1,
		}),
		idLevel: integer('id_level').notNull(),
		amountCheckpoints: integer('amount_checkpoints').notNull(),
		amountFinishes: integer('amount_finishes').notNull(),
		amountBlocks: integer('amount_blocks').notNull(),
		typeGround: integer('type_ground').notNull(),
		typeSkybox: integer('type_skybox').notNull(),
		format: integer().notNull().default(0),
		blocks: jsonb().notNull(),
		publiclyVisible: boolean('publicly_visible').notNull().default(false),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		foreignKey({
			columns: [table.idLevel],
			foreignColumns: [level.id],
			name: 'level_metadata_id_level_fkey',
		}).onDelete('cascade'),
		index('IX_level_metadata_level').using('btree', table.idLevel.asc().nullsLast()),
		index('IX_level_metadata_public_level')
			.using('btree', table.idLevel.asc().nullsLast())
			.where(sql`${table.publiclyVisible} = true`),
		pgPolicy('graphql_select_visible_level_metadata', {
			for: 'select',
			to: zeepCentraalGraphqlRole,
			using: sql`${table.publiclyVisible} = true`,
		}),
	],
).enableRLS()

const levelPointDiagnosticColumns = () => ({
	competitiveMerit: real('competitive_merit'),
	complexityConfidence: real('complexity_confidence'),
	complexityScore: real('complexity_score'),
	fieldStrength: real('field_strength'),
	qualityScore: real('quality_score'),
	skillAlignment: real('skill_alignment'),
	skillConfidence: real('skill_confidence'),
	skillSampleSize: integer('skill_sample_size'),
	skillScore: real('skill_score'),
	skillSeparation: real('skill_separation'),
	worldRecordExcluded: boolean('world_record_excluded'),
})

export const levelPoints = pgTable(
	'level_points',
	{
		idLevel: integer('id_level').primaryKey(),
		points: integer().notNull(),
		rating: real().notNull().default(DEFAULT_VOTE_RATING),
		lengthModifier: real('modifier_length').notNull().default(1.0),
		competitivenessModifier: real('modifier_competitiveness').notNull().default(1.0),
		evidenceModifier: real('modifier_evidence').notNull().default(1.0),
		qualityModifier: real('modifier_quality').notNull().default(1.0),
		ratingModifier: real('modifier_rating').notNull().default(1.0),
		...levelPointDiagnosticColumns(),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		foreignKey({
			columns: [table.idLevel],
			foreignColumns: [level.id],
			name: 'level_points_level_fkey',
		}).onDelete('cascade'),
		index('IX_level_points_points_level').using(
			'btree',
			table.points.desc().nullsLast(),
			table.idLevel.asc().nullsLast(),
		),
		index('IX_level_points_rating_level').using(
			'btree',
			table.rating.desc().nullsLast(),
			table.idLevel.asc().nullsLast(),
		),
	],
)

export const levelPointsHistory = pgTable(
	'level_points_history',
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity({
			name: 'level_points_history_id_seq',
			startWith: 1,
			increment: 1,
			minValue: 1,
			maxValue: 2147483647,
			cache: 1,
		}),
		idLevel: integer('id_level').notNull(),
		points: integer().notNull(),
		rating: real().notNull().default(DEFAULT_VOTE_RATING),
		lengthModifier: real('modifier_length').notNull().default(1.0),
		competitivenessModifier: real('modifier_competitiveness').notNull().default(1.0),
		evidenceModifier: real('modifier_evidence').notNull().default(1.0),
		qualityModifier: real('modifier_quality').notNull().default(1.0),
		ratingModifier: real('modifier_rating').notNull().default(1.0),
		...levelPointDiagnosticColumns(),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		foreignKey({
			columns: [table.idLevel],
			foreignColumns: [level.id],
			name: 'level_points_history_level_fkey',
		}).onDelete('cascade'),
		uniqueIndex('UQ_level_points_history_level').using(
			'btree',
			table.idLevel.asc().nullsLast(),
			table.dateCreated.desc().nullsLast(),
		),
	],
)

export const levelRequest = pgTable(
	'level_request',
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity({
			name: 'requests_id_seq',
			startWith: 1,
			increment: 1,
			minValue: 1,
			maxValue: 2147483647,
			cache: 1,
		}),
		workshopId: bigint('workshop_id', { mode: 'bigint' }).notNull(),
		uid: text(),
		hash: text(),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		unique('UQ_level_request_workshop_id').on(table.workshopId),
		index('IX_level_request_hash').using('btree', table.hash.asc().nullsLast()),
	],
)

export const personalBestGlobal = pgTable(
	'personal_best_global',
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity({
			name: 'personal_bests_id_seq',
			startWith: 1,
			increment: 1,
			minValue: 1,
			maxValue: 2147483647,
			cache: 1,
		}),
		idRecord: integer('id_record').notNull(),
		idUser: integer('id_user').notNull(),
		idLevel: integer('id_level').notNull(),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		foreignKey({
			columns: [table.idLevel],
			foreignColumns: [level.id],
			name: 'personal_best_global_level_fkey',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.idRecord],
			foreignColumns: [record.id],
			name: 'personal_bests_global_record_fkey',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.idUser],
			foreignColumns: [user.id],
			name: 'personal_bests_global_user_fkey',
		}).onDelete('cascade'),
		unique('UQ_personal_bests_user_level').on(table.idUser, table.idLevel),
		index('IX_personal_bests_level_user').using(
			'btree',
			table.idLevel.asc().nullsLast(),
			table.idUser.asc().nullsLast(),
		),
		index('IX_personal_bests_record').using('btree', table.idRecord.asc().nullsLast()),
		index('IX_personal_bests_date_created').using('btree', table.dateCreated.asc().nullsLast()),
	],
)

export const userPoints = pgTable(
	'user_points',
	{
		idUser: integer('id_user').primaryKey(),
		points: integer().default(0).notNull(),
		totalPoints: integer('total_points').default(0).notNull(),
		rank: integer().default(-1).notNull(),
		worldRecords: integer('world_records').default(0).notNull(),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		foreignKey({
			columns: [table.idUser],
			foreignColumns: [user.id],
			name: 'user_points_user_fkey',
		}).onDelete('cascade'),
		index('IX_user_points_rank_ranked')
			.using('btree', table.rank.asc().nullsLast(), table.idUser.asc().nullsLast())
			.where(sql`${table.rank} <> -1`),
		index('IX_user_points_points').using(
			'btree',
			table.points.desc().nullsLast(),
			table.idUser.asc().nullsLast(),
		),
		index('IX_user_points_total_points').using(
			'btree',
			table.totalPoints.desc().nullsLast(),
			table.idUser.asc().nullsLast(),
		),
		index('IX_user_points_world_records').using(
			'btree',
			table.worldRecords.desc().nullsLast(),
			table.idUser.asc().nullsLast(),
		),
	],
)

export const userPointContribution = pgTable(
	'user_point_contribution',
	{
		idUser: integer('id_user').notNull(),
		idLevel: integer('id_level').notNull(),
		idRecord: integer('id_record').notNull(),
		contributionRank: integer('contribution_rank').notNull(),
		levelPosition: integer('level_position').notNull(),
		levelPoints: integer('level_points').notNull(),
		levelDecayedPoints: real('level_decayed_points').notNull(),
		playerDecayedPoints: real('player_decayed_points').notNull(),
		dateCalculated: timestamp('date_calculated', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		foreignKey({
			columns: [table.idUser],
			foreignColumns: [user.id],
			name: 'user_point_contribution_user_fkey',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.idLevel],
			foreignColumns: [level.id],
			name: 'user_point_contribution_level_fkey',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.idRecord],
			foreignColumns: [record.id],
			name: 'user_point_contribution_record_fkey',
		}).onDelete('cascade'),
		primaryKey({ columns: [table.idUser, table.idLevel] }),
		index('IX_user_point_contribution_user_contribution_rank').using(
			'btree',
			table.idUser.asc().nullsLast(),
			table.contributionRank.asc().nullsLast(),
		),
		index('IX_user_point_contribution_level').using('btree', table.idLevel.asc().nullsLast()),
		index('IX_user_point_contribution_record').using('btree', table.idRecord.asc().nullsLast()),
		index('IX_user_point_contribution_user_value_level').using(
			'btree',
			table.idUser.asc().nullsLast(),
			table.playerDecayedPoints.desc().nullsLast(),
			table.idLevel.asc().nullsLast(),
		),
		index('IX_user_point_contribution_player_value_record').using(
			'btree',
			table.playerDecayedPoints.desc().nullsLast(),
			table.idRecord.desc().nullsLast(),
		),
		index('IX_user_point_contribution_level_value_record').using(
			'btree',
			table.levelPoints.desc().nullsLast(),
			table.idRecord.desc().nullsLast(),
		),
		index('IX_user_point_contribution_user_level_value_record').using(
			'btree',
			table.idUser.asc().nullsLast(),
			table.levelPoints.desc().nullsLast(),
			table.idRecord.desc().nullsLast(),
		),
		index('IX_user_point_contribution_user_wr_value_level')
			.using(
				'btree',
				table.idUser.asc().nullsLast(),
				table.playerDecayedPoints.desc().nullsLast(),
				table.idLevel.asc().nullsLast(),
			)
			.where(sql`${table.levelPosition} = 1`),
	],
)

export const userPointsHistory = pgTable(
	'user_points_history',
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity({
			name: 'user_points_history_id_seq',
			startWith: 1,
			increment: 1,
			minValue: 1,
			maxValue: 2147483647,
			cache: 1,
		}),
		idUser: integer('id_user').notNull(),
		points: integer().notNull(),
		totalPoints: integer('total_points').default(0).notNull(),
		rank: integer().default(-1).notNull(),
		worldRecords: integer('world_records').default(0).notNull(),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		foreignKey({
			columns: [table.idUser],
			foreignColumns: [user.id],
			name: 'user_points_history_user_fkey',
		}).onDelete('cascade'),
		uniqueIndex('UQ_user_points_history_user').using(
			'btree',
			table.idUser.asc().nullsLast(),
			table.dateCreated.desc().nullsLast(),
		),
	],
)

export const auth = pgTable(
	'auth',
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity({
			name: 'auth_id_seq',
			startWith: 1,
			increment: 1,
			minValue: 1,
			maxValue: 2147483647,
			cache: 1,
		}),
		idUser: integer('id_user'),
		accessToken: text('access_token'),
		accessTokenExpiry: bigint('access_token_expiry', { mode: 'bigint' }),
		refreshToken: text('refresh_token'),
		refreshTokenHash: text('refresh_token_hash'),
		refreshTokenExpiry: bigint('refresh_token_expiry', { mode: 'bigint' }),
		type: integer(),
		provider: varchar().notNull().default('invalid'),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		foreignKey({
			columns: [table.idUser],
			foreignColumns: [user.id],
			name: 'auth_user_foreign',
		}).onDelete('cascade'),
		index('IX_auth_user').using('btree', table.idUser.asc().nullsLast()),
		uniqueIndex('UQ_auth_refresh_token_hash')
			.on(table.refreshTokenHash)
			.where(sql`${table.refreshTokenHash} IS NOT NULL`),
	],
)

export const record = pgTable(
	'record',
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity({
			name: 'records_id_seq',
			startWith: 1,
			increment: 1,
			minValue: 1,
			maxValue: 2147483647,
			cache: 1,
		}),
		idUser: integer('id_user').notNull(),
		time: real().notNull(),
		gameVersion: varchar('game_version', { length: 255 }).notNull(),
		idLevel: integer('id_level').notNull(),
		modVersion: varchar('mod_version', { length: 255 }).notNull(),
		splits: real().array(),
		speeds: real().array(),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		foreignKey({
			columns: [table.idLevel],
			foreignColumns: [level.id],
			name: 'record_level_fkey',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.idUser],
			foreignColumns: [user.id],
			name: 'records_user_foreign',
		}).onDelete('cascade'),
		index('IX_records_level_time_id').using(
			'btree',
			table.idLevel.asc().nullsLast(),
			table.time.asc().nullsLast(),
			table.id.asc().nullsLast(),
		),
		index('IX_records_level_date_created_id').using(
			'btree',
			table.idLevel.asc().nullsLast(),
			table.dateCreated.desc().nullsLast(),
			table.id.desc().nullsLast(),
			table.modVersion.asc().nullsLast(),
		),
		index('IX_records_user_date_created_id').using(
			'btree',
			table.idUser.asc().nullsLast(),
			table.dateCreated.desc().nullsLast(),
			table.id.desc().nullsLast(),
			table.modVersion.asc().nullsLast(),
		),
		index('IX_records_date_created_id').using(
			'btree',
			table.dateCreated.desc().nullsLast(),
			table.id.desc().nullsLast(),
			table.idLevel.asc().nullsLast(),
			table.modVersion.asc().nullsLast(),
		),
		index('IX_records_hot_levels_date_level').using(
			'btree',
			table.dateCreated.desc().nullsLast(),
			table.idLevel.asc().nullsLast(),
		),
	],
)

/** Weekly/monthly featured-track competitions. Type 0 = weekly, 1 = monthly. */
export const trackTournament = pgTable(
	'track_tournament',
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity({
			name: 'track_tournament_id_seq',
			startWith: 1,
			increment: 1,
			minValue: 1,
			maxValue: 2147483647,
			cache: 1,
		}),
		type: integer().notNull(),
		slug: text().notNull(),
		idLevel: integer('id_level').notNull(),
		startAt: timestamp('start_at', { withTimezone: true, mode: 'string' }).notNull(),
		endAt: timestamp('end_at', { withTimezone: true, mode: 'string' }).notNull(),
		finalizedAt: timestamp('finalized_at', { withTimezone: true, mode: 'string' }),
		pointsVersion: integer('points_version').notNull().default(1),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		foreignKey({
			columns: [table.idLevel],
			foreignColumns: [level.id],
			name: 'track_tournament_level_fkey',
		}),
		check('CK_track_tournament_type', sql`${table.type} IN (0, 1)`),
		check('CK_track_tournament_period', sql`${table.endAt} > ${table.startAt}`),
		check('CK_track_tournament_points_version', sql`${table.pointsVersion} = 1`),
		unique('UQ_track_tournament_type_level').on(table.type, table.idLevel),
		unique('UQ_track_tournament_type_start').on(table.type, table.startAt),
		unique('UQ_track_tournament_type_slug').on(table.type, table.slug),
		index('IX_track_tournament_type_id').using(
			'btree',
			table.type.asc().nullsLast(),
			table.id.desc().nullsFirst(),
		),
		index('IX_track_tournament_level_period').using(
			'btree',
			table.idLevel.asc().nullsLast(),
			table.startAt.asc().nullsLast(),
			table.endAt.asc().nullsLast(),
		),
		pgPolicy('graphql_select_visible_track_tournament', {
			for: 'select',
			to: zeepCentraalGraphqlRole,
			using: sql`EXISTS (
				SELECT 1 FROM public.level AS graphql_visible_level
				WHERE graphql_visible_level.id = ${table.idLevel}
					AND graphql_visible_level.publicly_visible = true
			)`,
		}),
	],
).enableRLS()

/** Best submitted record for one user during one featured-track competition. */
export const trackTournamentResult = pgTable(
	'track_tournament_result',
	{
		idTournament: integer('id_tournament').notNull(),
		idUser: integer('id_user').notNull(),
		idRecord: integer('id_record').notNull(),
		time: real().notNull(),
		rank: integer().notNull(),
		points: integer().notNull(),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		primaryKey({ columns: [table.idTournament, table.idUser] }),
		foreignKey({
			columns: [table.idTournament],
			foreignColumns: [trackTournament.id],
			name: 'track_tournament_result_tournament_fkey',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.idUser],
			foreignColumns: [user.id],
			name: 'track_tournament_result_user_fkey',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.idRecord],
			foreignColumns: [record.id],
			name: 'track_tournament_result_record_fkey',
		}),
		check('CK_track_tournament_result_rank', sql`${table.rank} > 0`),
		check(
			'CK_track_tournament_result_points',
			sql`${table.points} >= 2 AND MOD(${table.points}, 2) = 0`,
		),
		index('IX_track_tournament_result_tournament_rank').using(
			'btree',
			table.idTournament.asc().nullsLast(),
			table.rank.asc().nullsLast(),
			table.time.asc().nullsLast(),
			table.idRecord.asc().nullsLast(),
		),
		index('IX_track_tournament_result_record').using('btree', table.idRecord.asc().nullsLast()),
		pgPolicy('graphql_select_visible_track_tournament_result', {
			for: 'select',
			to: zeepCentraalGraphqlRole,
			using: sql`
				EXISTS (
					SELECT 1
					FROM public.track_tournament AS visible_tournament
					INNER JOIN public.level AS graphql_visible_level
						ON graphql_visible_level.id = visible_tournament.id_level
						AND graphql_visible_level.publicly_visible = true
					WHERE visible_tournament.id = ${table.idTournament}
				)
				AND EXISTS (
					SELECT 1
					FROM public.record AS graphql_visible_record
					INNER JOIN public.level AS graphql_record_level
						ON graphql_record_level.id = graphql_visible_record.id_level
						AND graphql_record_level.publicly_visible = true
					WHERE graphql_visible_record.id = ${table.idRecord}
				)
			`,
		}),
	],
).enableRLS()

export const recordMedia = pgTable(
	'record_media',
	{
		idRecord: integer('id_record').primaryKey(),
		ghostUrl: text('ghost_url'),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		foreignKey({
			columns: [table.idRecord],
			foreignColumns: [record.id],
			name: 'media_record_fkey',
		}).onDelete('cascade'),
	],
)

export const recordStatistic = pgTable(
	'record_statistic',
	{
		idRecord: integer('id_record').primaryKey(),
		ghostVersion: integer('ghost_version'),
		hasInputData: boolean('has_input_data'),
		hasAirData: boolean('has_air_data'),
		hasWheelData: boolean('has_wheel_data'),
		hasSlipData: boolean('has_slip_data'),
		hasStateData: boolean('has_state_data'),
		hasSurfaceData: boolean('has_surface_data'),
		hasVelocityData: boolean('has_velocity_data'),
		hasRagdollData: boolean('has_ragdoll_data'),
		timeAnyDriverInput: real('time_any_driver_input'),
		driverInputTransitionCount: integer('driver_input_transition_count'),
		frameCount: integer('frame_count'),
		time: real(),
		distance: real(),
		distanceInAir: real('distance_in_air'),
		distanceOnGround: real('distance_on_ground'),
		distanceOn1Wheel: real('distance_on_1_wheel'),
		distanceOn2Wheels: real('distance_on_2_wheels'),
		distanceOn3Wheels: real('distance_on_3_wheels'),
		distanceOn4Wheels: real('distance_on_4_wheels'),
		timeInAir: real('time_in_air'),
		timeOnGround: real('time_on_ground'),
		timeOn1Wheel: real('time_on_1_wheel'),
		timeOn2Wheels: real('time_on_2_wheels'),
		timeOn3Wheels: real('time_on_3_wheels'),
		timeOn4Wheels: real('time_on_4_wheels'),
		averageSpeed: real('average_speed'),
		maxSpeed: real('max_speed'),
		armsUpCount: integer('arms_up_count'),
		armsUpTime: real('arms_up_time'),
		brakeCount: integer('brake_count'),
		brakeTime: real('brake_time'),
		turnLeftCount: integer('turn_left_count'),
		turnLeftTime: real('turn_left_time'),
		turnRightCount: integer('turn_right_count'),
		turnRightTime: real('turn_right_time'),
		hornCount: integer('horn_count'),
		hornTime: real('horn_time'),
		distanceSlipping: real('distance_slipping'),
		distanceParaglider: real('distance_paraglider'),
		distanceOffroadWheels: real('distance_offroad_wheels'),
		distanceSoapWheels: real('distance_soap_wheels'),
		distanceOnMonorail: real('distance_on_monorail'),
		distanceParked: real('distance_parked'),
		distanceRagdoll: real('distance_ragdoll'),
		timeSlipping: real('time_slipping'),
		timeParaglider: real('time_paraglider'),
		timeOffroadWheels: real('time_offroad_wheels'),
		timeSoapWheels: real('time_soap_wheels'),
		timeOnMonorail: real('time_on_monorail'),
		timeParked: real('time_parked'),
		timeRagdoll: real('time_ragdoll'),
		distanceOnTarmac: real('distance_on_tarmac'),
		distanceOnGrass: real('distance_on_grass'),
		distanceOnSand: real('distance_on_sand'),
		distanceOnIce1: real('distance_on_ice1'),
		distanceOnIce2: real('distance_on_ice2'),
		distanceOnIce3: real('distance_on_ice3'),
		distanceOnSoap: real('distance_on_soap'),
		distanceOnWood: real('distance_on_wood'),
		distanceOnMud: real('distance_on_mud'),
		timeOnTarmac: real('time_on_tarmac'),
		timeOnGrass: real('time_on_grass'),
		timeOnSand: real('time_on_sand'),
		timeOnIce1: real('time_on_ice1'),
		timeOnIce2: real('time_on_ice2'),
		timeOnIce3: real('time_on_ice3'),
		timeOnSoap: real('time_on_soap'),
		timeOnWood: real('time_on_wood'),
		timeOnMud: real('time_on_mud'),
		averageVelocity: real('average_velocity'),
		maxVelocity: real('max_velocity'),
		averageAngularVelocity: real('average_angular_velocity'),
		maxAngularVelocity: real('max_angular_velocity'),
		averageGforce: real('average_gforce'),
		maxGforce: real('max_gforce'),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		foreignKey({
			columns: [table.idRecord],
			foreignColumns: [record.id],
			name: 'record_statistic_record_fkey',
		}).onDelete('cascade'),
	],
)

export const user = pgTable(
	'user',
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity({
			name: 'users_id_seq',
			startWith: 1,
			increment: 1,
			minValue: 1,
			maxValue: 2147483647,
			cache: 1,
		}),
		steamName: varchar('steam_name', { length: 255 }),
		banned: boolean().default(false).notNull(),
		steamId: bigint('steam_id', { mode: 'bigint' }),
		discordId: bigint('discord_id', { mode: 'bigint' }),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		unique('UQ_user_steam_id').on(table.steamId),
		uniqueIndex('UQ_user_discord_id').on(table.discordId).where(sql`${table.discordId} > 0`),
		index('IX_user_steam_name_search').using('gin', table.steamName.op('gin_trgm_ops')),
	],
)

export const playerSkillAggregate = pgTable(
	'player_skill_aggregate',
	{
		idUser: integer('id_user').primaryKey(),
		placementSum: doublePrecision('placement_sum').notNull(),
		eligibleLevelCount: integer('eligible_level_count').notNull(),
		skill: real().notNull(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		foreignKey({
			columns: [table.idUser],
			foreignColumns: [user.id],
			name: 'player_skill_aggregate_user_fkey',
		}).onDelete('cascade'),
		index('IX_player_skill_aggregate_skill_user').using(
			'btree',
			table.skill.desc().nullsLast(),
			table.idUser.asc().nullsLast(),
		),
	],
)

export const version = pgTable('version', {
	id: integer().primaryKey().generatedAlwaysAsIdentity({
		name: 'versions_id_seq',
		startWith: 1,
		increment: 1,
		minValue: 1,
		maxValue: 2147483647,
		cache: 1,
	}),
	minimum: text(),
	latest: text(),
	dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
		.notNull()
		.defaultNow(),
	dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(() =>
		new Date().toISOString(),
	),
})

export const favourite = pgTable(
	'favourite',
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity({
			name: 'favorites_id_seq',
			startWith: 1,
			increment: 1,
			minValue: 1,
			maxValue: 2147483647,
			cache: 1,
		}),
		idUser: integer('id_user').notNull(),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
		idLevel: integer('id_level').notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.idLevel],
			foreignColumns: [level.id],
			name: 'favorite_level_fkey',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.idUser],
			foreignColumns: [user.id],
			name: 'favorites_user_foreign',
		}).onDelete('cascade'),
		unique('UQ_favourites_user_level').on(table.idUser, table.idLevel),
		index('IX_favorites_level').using('btree', table.idLevel.asc().nullsLast()),
	],
)

export const vote = pgTable(
	'vote',
	{
		idUser: integer('id_user').notNull(),
		idLevel: integer('id_level').notNull(),
		value: integer().notNull(),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		foreignKey({
			columns: [table.idLevel],
			foreignColumns: [level.id],
			name: 'vote_id_level_fkey',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.idUser],
			foreignColumns: [user.id],
			name: 'vote_id_user_fkey',
		}).onDelete('cascade'),
		index('IX_vote_level').using('btree', table.idLevel.asc().nullsLast()),
		index('IX_vote_date_created').using('btree', table.dateCreated.desc().nullsLast()),
		primaryKey({ columns: [table.idUser, table.idLevel] }),
	],
)

export const worldRecordGlobal = pgTable(
	'world_record_global',
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity({
			name: 'world_records_id_seq',
			startWith: 1,
			increment: 1,
			minValue: 1,
			maxValue: 2147483647,
			cache: 1,
		}),
		idRecord: integer('id_record').notNull(),
		idLevel: integer('id_level').notNull(),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
		idUser: integer('id_user').notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.idLevel],
			foreignColumns: [level.id],
			name: 'world_record_global_level_fkey',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.idRecord],
			foreignColumns: [record.id],
			name: 'world_records_global_record_fkey',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.idUser],
			foreignColumns: [user.id],
			name: 'world_records_global_user_fkey',
		}).onDelete('cascade'),
		unique('UQ_world_records_level').on(table.idLevel),
		index('IX_world_records_record').using('btree', table.idRecord.asc().nullsLast()),
		index('IX_world_records_user').using('btree', table.idUser.asc().nullsLast()),
		index('IX_world_records_date_created').using('btree', table.dateCreated.asc().nullsLast()),
		index('IX_world_records_user_level_record').using(
			'btree',
			table.idUser.asc().nullsLast(),
			table.idLevel.asc().nullsLast(),
			table.idRecord.asc().nullsLast(),
		),
	],
)

export const recordHistoryIndex = zcPrivate.table(
	'record_history_index',
	{
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
		index('IX_record_history_index_level_projection')
			.using('btree', table.levelId.asc().nullsLast())
			.where(
				sql`${table.hasContribution} = false AND (${table.isPersonalBest} OR ${table.isWorldRecord})`,
			),
	],
)

const recordHistoryEntryColumns = {
	historyView: text('history_view').notNull(),
	id: integer().notNull(),
	time: real().notNull(),
	dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' }).notNull(),
	levelId: integer('level_id').notNull(),
	userId: integer('user_id').notNull(),
	userSteamId: bigint('user_steam_id', { mode: 'bigint' }),
	userName: varchar('user_name', { length: 255 }),
	levelXxHash: text('level_xx_hash').notNull(),
	levelName: text('level_name'),
	levelPosition: integer('level_position'),
	contributionRank: integer('contribution_rank'),
	levelPoints: integer('level_points'),
	levelDecayedPoints: real('level_decayed_points'),
	playerDecayedPoints: real('player_decayed_points'),
	isPersonalBest: boolean('is_personal_best').notNull(),
	isWorldRecord: boolean('is_world_record').notNull(),
	hasContribution: boolean('has_contribution').notNull(),
}

const recordHistoryEntryProjection = sql`
	SELECT
		history_entry.history_view,
		history_entry.id,
		history_entry.time,
		history_entry.date_created,
		history_entry.level_id,
		history_entry.user_id,
		record_user.steam_id AS user_steam_id,
		record_user.steam_name AS user_name,
		record_level.xx_hash AS level_xx_hash,
		visible_level_item.name AS level_name,
		history_entry.level_position,
		history_entry.contribution_rank,
		history_entry.level_points,
		history_entry.level_decayed_points,
		history_entry.player_decayed_points,
		history_entry.is_personal_best,
		history_entry.is_world_record,
		history_entry.has_contribution
	FROM zc_private.record_history_index AS history_entry
	INNER JOIN public."user" AS record_user ON record_user.id = history_entry.user_id
	INNER JOIN public.level AS record_level ON record_level.id = history_entry.level_id
	LEFT JOIN LATERAL (
		SELECT candidate_level_item.name
		FROM public.level_item AS candidate_level_item
		WHERE candidate_level_item.id_level = history_entry.level_id
			AND candidate_level_item.publicly_visible = true
			AND candidate_level_item.deleted = false
		ORDER BY candidate_level_item.updated_at DESC, candidate_level_item.id DESC
		LIMIT 1
	) AS visible_level_item ON true
`

export const recordHistoryEntry = pgView('record_history_entry', recordHistoryEntryColumns)
	.with({ securityInvoker: true })
	.as(recordHistoryEntryProjection)

/**
 * ZSL Points Structure
 *
 * - `points` are sorted from 1st place to last place.
 * - `minimumPoints` is the minimum points awarded (e.g if points only define the
 *   top 10 places, the minimum points is awarded to all other places). DNF is
 *   always 0 points.
 * - `bestOf` is how many rounds count towards the user's total points in the
 *   season. E.g, if it is 4 and there are 6 rounds, the user's worst 2 rounds
 *   are ignored when calculating the total season points.
 */
export const zslPointsStructure = pgTable('zsl_points_structure', {
	id: integer().primaryKey().generatedAlwaysAsIdentity({
		name: 'zsl_points_structure_id_seq',
		startWith: 1,
		increment: 1,
		minValue: 1,
		maxValue: 2147483647,
		cache: 1,
	}),
	name: text('name').notNull(),
	points: integer('points').array().notNull(),
	minimumPoints: integer('minimum_points').notNull(),
	bestOf: integer('best_of').notNull(),
	dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
		.notNull()
		.defaultNow(),
	dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(() =>
		new Date().toISOString(),
	),
})

/**
 * ZSL Seasons
 */
export const zslSeason = pgTable(
	'zsl_season',
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity({
			name: 'zsl_season_id_seq',
			startWith: 1,
			increment: 1,
			minValue: 1,
			maxValue: 2147483647,
			cache: 1,
		}),
		idPointsStructure: integer('id_points_structure').notNull(),
		name: text('name').notNull(),
		dateStarted: timestamp('start_date', { withTimezone: true, mode: 'string' }).notNull(),
		dateEnded: timestamp('end_date', { withTimezone: true, mode: 'string' }).notNull(),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		foreignKey({
			columns: [table.idPointsStructure],
			foreignColumns: [zslPointsStructure.id],
			name: 'zsl_season_points_structure_fkey',
		}).onDelete('cascade'),
		index('IX_zsl_season_points_structure').using(
			'btree',
			table.idPointsStructure.asc().nullsLast(),
		),
	],
)

/**
 * ZSL Rounds
 */
export const zslRound = pgTable(
	'zsl_round',
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity({
			name: 'zsl_round_id_seq',
			startWith: 1,
			increment: 1,
			minValue: 1,
			maxValue: 2147483647,
			cache: 1,
		}),
		idSeason: integer('id_season').notNull(),
		name: text('name').notNull(),
		round: integer('round').notNull(),
		workshopId: bigint('workshop_id', { mode: 'bigint' }).notNull(),
		eventDate: timestamp('event_date', { withTimezone: true, mode: 'string' }).notNull(),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		foreignKey({
			columns: [table.idSeason],
			foreignColumns: [zslSeason.id],
			name: 'zsl_round_season_fkey',
		}).onDelete('cascade'),
		unique('UQ_zsl_round_season_round').on(table.idSeason, table.round),
		index('IX_zsl_round_season').using('btree', table.idSeason.asc().nullsLast()),
		index('IX_zsl_round_workshop_id').using('btree', table.workshopId.asc().nullsLast()),
		index('IX_zsl_round_event_date').using('btree', table.eventDate.asc().nullsLast()),
	],
)

/**
 * ZSL Levels
 */
export const zslLevel = pgTable(
	'zsl_level',
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity({
			name: 'zsl_level_id_seq',
			startWith: 1,
			increment: 1,
			minValue: 1,
			maxValue: 2147483647,
			cache: 1,
		}),
		idRound: integer('id_round').notNull(),
		idLevel: integer('id_level').notNull(),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		foreignKey({
			columns: [table.idRound],
			foreignColumns: [zslRound.id],
			name: 'zsl_level_round_fkey',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.idLevel],
			foreignColumns: [level.id],
			name: 'zsl_level_level_fkey',
		}),
		index('IX_zsl_level_round').using('btree', table.idRound.asc().nullsLast()),
		index('IX_zsl_level_id').using('btree', table.idLevel.asc().nullsLast()),
	],
)

/**
 * ZSL Level Results
 *
 * This table stores the results of users in a specific level of a ZSL round.
 */
export const zslLevelResult = pgTable(
	'zsl_level_result',
	{
		idLevel: integer('id_level').notNull(),
		idUser: integer('id_user').notNull(),
		idRecord: integer('id_record'), // Optional, can be null if record cannot be matched (e.g user doesn't have GTR)
		position: integer('position').notNull(), // Position in the level result. Duplicate points have the same position.
		points: integer('points').notNull(), // Points earned from points structure
		time: real('time').notNull(),
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		primaryKey({ columns: [table.idLevel, table.idUser] }),
		foreignKey({
			columns: [table.idLevel],
			foreignColumns: [zslLevel.id],
			name: 'zsl_level_result_level_fkey',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.idUser],
			foreignColumns: [user.id],
			name: 'zsl_level_result_user_fkey',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.idRecord],
			foreignColumns: [record.id],
			name: 'zsl_level_result_record_fkey',
		}).onDelete('cascade'),
		index('IX_zsl_level_result_user').using('btree', table.idUser.asc().nullsLast()),
		index('IX_zsl_level_result_record').using('btree', table.idRecord.asc().nullsLast()),
		index('IX_zsl_level_result_position').using('btree', table.position.asc().nullsLast()),
		index('IX_zsl_level_result_level_position_user').using(
			'btree',
			table.idLevel.asc().nullsLast(),
			table.position.asc().nullsLast(),
			table.idUser.asc().nullsLast(),
		),
		index('IX_zsl_level_result_date_created').using(
			'btree',
			table.dateCreated.asc().nullsLast(),
		),
	],
)

/**
 * Round Results
 *
 * This table stores the results of users in a specific round of a ZSL season.
 */
export const zslRoundResult = pgTable(
	'zsl_round_result',
	{
		idRound: integer('id_round').notNull(), // Foreign key to zsl_round
		idUser: integer('id_user').notNull(), // Foreign key to user
		position: integer('position').notNull(), // Position in the round result. Duplicate points have the same position.
		points: integer('points').notNull(), // Total points earned in the round
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		primaryKey({ columns: [table.idRound, table.idUser] }),
		foreignKey({
			columns: [table.idRound],
			foreignColumns: [zslRound.id],
			name: 'zsl_round_result_round_fkey',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.idUser],
			foreignColumns: [user.id],
			name: 'zsl_round_result_user_fkey',
		}).onDelete('cascade'),
		index('IX_zsl_round_result_user').using('btree', table.idUser.asc().nullsLast()),
		index('IX_zsl_round_result_position').using('btree', table.position.asc().nullsLast()),
		index('IX_zsl_round_result_round_position_user').using(
			'btree',
			table.idRound.asc().nullsLast(),
			table.position.asc().nullsLast(),
			table.idUser.asc().nullsLast(),
		),
		index('IX_zsl_round_result_date_created').using(
			'btree',
			table.dateCreated.asc().nullsLast(),
		),
	],
)

/**
 * ZSL Season Results
 *
 * This table stores the results of users in a specific season of ZSL.
 */
export const zslSeasonResult = pgTable(
	'zsl_season_result',
	{
		idSeason: integer('id_season').notNull(), // Foreign key to zsl_season
		idUser: integer('id_user').notNull(), // Foreign key to user
		position: integer('position').notNull(), // Position in the season result. Duplicate points have the same position.
		points: integer('points').notNull(), // Total points earned in the season
		dateCreated: timestamp('date_created', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		dateUpdated: timestamp('date_updated', { withTimezone: true, mode: 'string' }).$onUpdate(
			() => new Date().toISOString(),
		),
	},
	(table) => [
		primaryKey({ columns: [table.idSeason, table.idUser] }),
		foreignKey({
			columns: [table.idSeason],
			foreignColumns: [zslSeason.id],
			name: 'zsl_season_result_season_fkey',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.idUser],
			foreignColumns: [user.id],
			name: 'zsl_season_result_user_fkey',
		}).onDelete('cascade'),
		index('IX_zsl_season_result_user').using('btree', table.idUser.asc().nullsLast()),
		index('IX_zsl_season_result_position').using('btree', table.position.asc().nullsLast()),
		index('IX_zsl_season_result_season_position_user').using(
			'btree',
			table.idSeason.asc().nullsLast(),
			table.position.asc().nullsLast(),
			table.idUser.asc().nullsLast(),
		),
		index('IX_zsl_season_result_date_created').using(
			'btree',
			table.dateCreated.asc().nullsLast(),
		),
	],
)
