import { sql } from 'drizzle-orm'
import {
	bigint,
	boolean,
	foreignKey,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	real,
	text,
	timestamp,
	unique,
	uniqueIndex,
	varchar,
} from 'drizzle-orm/pg-core'
import { DEFAULT_VOTE_RATING } from './config'

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
	],
)

export const workshopItem = pgTable(
	'workshop_item',
	{
		workshopId: bigint('workshop_id', { mode: 'bigint' }).primaryKey(),
		authorId: bigint('author_id', { mode: 'bigint' }).notNull(),
		name: text().notNull(),
		imageUrl: text('image_url').notNull(),
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
	],
)

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
	],
)

export const levelPoints = pgTable(
	'level_points',
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity({
			name: 'level_points_id_seq',
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
		ratingModifier: real('modifier_rating').notNull().default(1.0),
		popularityModifier: real('modifier_popularity').notNull().default(1.0),
		cutPenalty: real('cut_penalty').notNull().default(1.0),
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
		uniqueIndex('UQ_level_points_level').using('btree', table.idLevel.asc().nullsLast()),
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
		ratingModifier: real('modifier_rating').notNull().default(1.0),
		popularityModifier: real('modifier_popularity').notNull().default(1.0),
		cutPenalty: real('cut_penalty').notNull().default(1.0),
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
		index('IX_level_request_workshop_id').using('btree', table.workshopId.asc().nullsLast()),
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
		index('IX_personal_bests_user').using('btree', table.idUser.asc().nullsLast()),
		index('IX_personal_bests_user_level_record').using(
			'btree',
			table.idUser.asc().nullsLast(),
			table.idLevel.asc().nullsLast(),
			table.idRecord.asc().nullsLast(),
		),
		index('IX_personal_bests_date_created').using('btree', table.dateCreated.asc().nullsLast()),
	],
)

export const userPoints = pgTable(
	'user_points',
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity({
			name: 'player_points_id_seq',
			startWith: 1,
			increment: 1,
			minValue: 1,
			maxValue: 2147483647,
			cache: 1,
		}),
		idUser: integer('id_user').notNull(),
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
			name: 'player_points_user_fkey',
		}).onDelete('cascade'),
		uniqueIndex('UQ_player_points_user').using('btree', table.idUser.asc().nullsLast()),
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
		index('IX_records_id_time').using(
			'btree',
			table.idLevel.asc().nullsLast(),
			table.time.asc().nullsLast(),
		),
		index('IX_records_level').using('btree', table.idLevel.asc().nullsLast()),
		index('IX_records_level_time').using(
			'btree',
			table.idLevel.asc().nullsLast(),
			table.time.asc().nullsLast(),
		),
		index('IX_records_time_id').using(
			'btree',
			table.time.asc().nullsLast(),
			table.idLevel.asc().nullsLast(),
		),
		index('IX_records_user').using('btree', table.idUser.asc().nullsLast()),
		index('IX_records_date_created').using('btree', table.dateCreated.asc().nullsLast()),
		index('IX_records_user_level_time').using(
			'btree',
			table.idUser.asc().nullsLast(),
			table.idLevel.asc().nullsLast(),
			table.time.asc().nullsLast(),
		),
		index('IX_records_user_level_date_created').using(
			'btree',
			table.idUser.asc().nullsLast(),
			table.idLevel.asc().nullsLast(),
			table.dateCreated.asc().nullsLast(),
		),
	],
)

export const recordMedia = pgTable(
	'record_media',
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity({
			name: 'media_id_seq',
			startWith: 1,
			increment: 1,
			minValue: 1,
			maxValue: 2147483647,
			cache: 1,
		}),
		idRecord: integer('id_record').notNull(),
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
		unique('UQ_record_media_record').on(table.idRecord),
		index('IX_media_record').using('btree', table.idRecord.asc().nullsLast()),
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
		uniqueIndex('UQ_user_steam_id').on(table.steamId),
		uniqueIndex('UQ_user_discord_id').on(table.discordId).where(sql`${table.discordId} > 0`),
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
		index('IX_favorites_user').using('btree', table.idUser.asc().nullsLast()),
	],
)

export const vote = pgTable(
	'vote',
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity({
			name: 'vote_id_seq',
			startWith: 1,
			increment: 1,
			minValue: 1,
			maxValue: 2147483647,
			cache: 1,
		}),
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
		index('IX_vote_user_level').using(
			'btree',
			table.idUser.asc().nullsLast(),
			table.idLevel.asc().nullsLast(),
		),
		index('IX_vote_level').using('btree', table.idLevel.asc().nullsLast()),
		unique('UQ_vote_user_level').on(table.idUser, table.idLevel),
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
		index('IX_world_records_level').using('btree', table.idLevel.asc().nullsLast()),
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
		index('IX_zsl_level_result_level').using('btree', table.idLevel.asc().nullsLast()),
		index('IX_zsl_level_result_user').using('btree', table.idUser.asc().nullsLast()),
		index('IX_zsl_level_result_record').using('btree', table.idRecord.asc().nullsLast()),
		index('IX_zsl_level_result_position').using('btree', table.position.asc().nullsLast()),
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
		index('IX_zsl_round_result_round').using('btree', table.idRound.asc().nullsLast()),
		index('IX_zsl_round_result_user').using('btree', table.idUser.asc().nullsLast()),
		index('IX_zsl_round_result_position').using('btree', table.position.asc().nullsLast()),
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
		index('IX_zsl_season_result_season').using('btree', table.idSeason.asc().nullsLast()),
		index('IX_zsl_season_result_user').using('btree', table.idUser.asc().nullsLast()),
		index('IX_zsl_season_result_position').using('btree', table.position.asc().nullsLast()),
		index('IX_zsl_season_result_date_created').using(
			'btree',
			table.dateCreated.asc().nullsLast(),
		),
	],
)
