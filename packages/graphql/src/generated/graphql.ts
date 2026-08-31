/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
/** A filter to be used against BigFloat fields. All fields are combined with a logical ‘and.’ */
export type BigFloatFilter = {
  /** Not equal to the specified value, treating null like an ordinary value. */
  distinctFrom?: unknown;
  /** Equal to the specified value. */
  equalTo?: unknown;
  /** Greater than the specified value. */
  greaterThan?: unknown;
  /** Greater than or equal to the specified value. */
  greaterThanOrEqualTo?: unknown;
  /** Included in the specified list. */
  in?: Array<unknown> | null | undefined;
  /** Is null (if `true` is specified) or is not null (if `false` is specified). */
  isNull?: boolean | null | undefined;
  /** Less than the specified value. */
  lessThan?: unknown;
  /** Less than or equal to the specified value. */
  lessThanOrEqualTo?: unknown;
  /** Equal to the specified value, treating null like an ordinary value. */
  notDistinctFrom?: unknown;
  /** Not equal to the specified value. */
  notEqualTo?: unknown;
  /** Not included in the specified list. */
  notIn?: Array<unknown> | null | undefined;
};

/** A filter to be used against BigInt fields. All fields are combined with a logical ‘and.’ */
export type BigIntFilter = {
  /** Not equal to the specified value, treating null like an ordinary value. */
  distinctFrom?: unknown;
  /** Equal to the specified value. */
  equalTo?: unknown;
  /** Greater than the specified value. */
  greaterThan?: unknown;
  /** Greater than or equal to the specified value. */
  greaterThanOrEqualTo?: unknown;
  /** Included in the specified list. */
  in?: Array<unknown> | null | undefined;
  /** Is null (if `true` is specified) or is not null (if `false` is specified). */
  isNull?: boolean | null | undefined;
  /** Less than the specified value. */
  lessThan?: unknown;
  /** Less than or equal to the specified value. */
  lessThanOrEqualTo?: unknown;
  /** Equal to the specified value, treating null like an ordinary value. */
  notDistinctFrom?: unknown;
  /** Not equal to the specified value. */
  notEqualTo?: unknown;
  /** Not included in the specified list. */
  notIn?: Array<unknown> | null | undefined;
};

/** A filter to be used against Boolean fields. All fields are combined with a logical ‘and.’ */
export type BooleanFilter = {
  /** Not equal to the specified value, treating null like an ordinary value. */
  distinctFrom?: boolean | null | undefined;
  /** Equal to the specified value. */
  equalTo?: boolean | null | undefined;
  /** Greater than the specified value. */
  greaterThan?: boolean | null | undefined;
  /** Greater than or equal to the specified value. */
  greaterThanOrEqualTo?: boolean | null | undefined;
  /** Included in the specified list. */
  in?: Array<boolean> | null | undefined;
  /** Is null (if `true` is specified) or is not null (if `false` is specified). */
  isNull?: boolean | null | undefined;
  /** Less than the specified value. */
  lessThan?: boolean | null | undefined;
  /** Less than or equal to the specified value. */
  lessThanOrEqualTo?: boolean | null | undefined;
  /** Equal to the specified value, treating null like an ordinary value. */
  notDistinctFrom?: boolean | null | undefined;
  /** Not equal to the specified value. */
  notEqualTo?: boolean | null | undefined;
  /** Not included in the specified list. */
  notIn?: Array<boolean> | null | undefined;
};

/** A filter to be used against Datetime fields. All fields are combined with a logical ‘and.’ */
export type DatetimeFilter = {
  /** Not equal to the specified value, treating null like an ordinary value. */
  distinctFrom?: unknown;
  /** Equal to the specified value. */
  equalTo?: unknown;
  /** Greater than the specified value. */
  greaterThan?: unknown;
  /** Greater than or equal to the specified value. */
  greaterThanOrEqualTo?: unknown;
  /** Included in the specified list. */
  in?: Array<unknown> | null | undefined;
  /** Is null (if `true` is specified) or is not null (if `false` is specified). */
  isNull?: boolean | null | undefined;
  /** Less than the specified value. */
  lessThan?: unknown;
  /** Less than or equal to the specified value. */
  lessThanOrEqualTo?: unknown;
  /** Equal to the specified value, treating null like an ordinary value. */
  notDistinctFrom?: unknown;
  /** Not equal to the specified value. */
  notEqualTo?: unknown;
  /** Not included in the specified list. */
  notIn?: Array<unknown> | null | undefined;
};

/** A filter to be used against aggregates of `DiscordActivityEvent` object types. */
export type DiscordActivityEventAggregatesFilter = {
  /** Mean average aggregate over matching `DiscordActivityEvent` objects. */
  average?: DiscordActivityEventAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `DiscordActivityEvent` objects. */
  distinctCount?: DiscordActivityEventDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `DiscordActivityEvent` object to be included within the aggregate. */
  filter?: DiscordActivityEventFilter | null | undefined;
  /** Maximum aggregate over matching `DiscordActivityEvent` objects. */
  max?: DiscordActivityEventMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `DiscordActivityEvent` objects. */
  min?: DiscordActivityEventMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `DiscordActivityEvent` objects. */
  stddevPopulation?: DiscordActivityEventStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `DiscordActivityEvent` objects. */
  stddevSample?: DiscordActivityEventStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `DiscordActivityEvent` objects. */
  sum?: DiscordActivityEventSumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `DiscordActivityEvent` objects. */
  variancePopulation?: DiscordActivityEventVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `DiscordActivityEvent` objects. */
  varianceSample?: DiscordActivityEventVarianceSampleAggregateFilter | null | undefined;
};

export type DiscordActivityEventAverageAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  previousRecordId?: BigFloatFilter | null | undefined;
  previousUserId?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type DiscordActivityEventDistinctCountAggregateFilter = {
  dateCreated?: BigIntFilter | null | undefined;
  id?: BigIntFilter | null | undefined;
  kind?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  occurredAt?: BigIntFilter | null | undefined;
  payload?: BigIntFilter | null | undefined;
  previousRecordId?: BigIntFilter | null | undefined;
  previousUserId?: BigIntFilter | null | undefined;
  recordId?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

/** A filter to be used against `DiscordActivityEvent` object types. All fields are combined with a logical ‘and.’ */
export type DiscordActivityEventFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<DiscordActivityEventFilter> | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `id` field. */
  id?: BigIntFilter | null | undefined;
  /** Filter by the object’s `kind` field. */
  kind?: StringFilter | null | undefined;
  /** Filter by the object’s `level` relation. */
  level?: LevelFilter | null | undefined;
  /** A related `level` exists. */
  levelExists?: boolean | null | undefined;
  /** Filter by the object’s `levelId` field. */
  levelId?: IntFilter | null | undefined;
  /** Negates the expression. */
  not?: DiscordActivityEventFilter | null | undefined;
  /** Filter by the object’s `occurredAt` field. */
  occurredAt?: DatetimeFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<DiscordActivityEventFilter> | null | undefined;
  /** Filter by the object’s `previousRecord` relation. */
  previousRecord?: RecordFilter | null | undefined;
  /** A related `previousRecord` exists. */
  previousRecordExists?: boolean | null | undefined;
  /** Filter by the object’s `previousRecordId` field. */
  previousRecordId?: IntFilter | null | undefined;
  /** Filter by the object’s `previousUser` relation. */
  previousUser?: UserFilter | null | undefined;
  /** A related `previousUser` exists. */
  previousUserExists?: boolean | null | undefined;
  /** Filter by the object’s `previousUserId` field. */
  previousUserId?: IntFilter | null | undefined;
  /** Filter by the object’s `record` relation. */
  record?: RecordFilter | null | undefined;
  /** A related `record` exists. */
  recordExists?: boolean | null | undefined;
  /** Filter by the object’s `recordId` field. */
  recordId?: IntFilter | null | undefined;
  /** Filter by the object’s `user` relation. */
  user?: UserFilter | null | undefined;
  /** A related `user` exists. */
  userExists?: boolean | null | undefined;
  /** Filter by the object’s `userId` field. */
  userId?: IntFilter | null | undefined;
};

export type DiscordActivityEventMaxAggregateFilter = {
  id?: BigIntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  previousRecordId?: IntFilter | null | undefined;
  previousUserId?: IntFilter | null | undefined;
  recordId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type DiscordActivityEventMinAggregateFilter = {
  id?: BigIntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  previousRecordId?: IntFilter | null | undefined;
  previousUserId?: IntFilter | null | undefined;
  recordId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type DiscordActivityEventStddevPopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  previousRecordId?: BigFloatFilter | null | undefined;
  previousUserId?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type DiscordActivityEventStddevSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  previousRecordId?: BigFloatFilter | null | undefined;
  previousUserId?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type DiscordActivityEventSumAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  previousRecordId?: BigIntFilter | null | undefined;
  previousUserId?: BigIntFilter | null | undefined;
  recordId?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

export type DiscordActivityEventVariancePopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  previousRecordId?: BigFloatFilter | null | undefined;
  previousUserId?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type DiscordActivityEventVarianceSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  previousRecordId?: BigFloatFilter | null | undefined;
  previousUserId?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

/** A filter to be used against aggregates of `Favourite` object types. */
export type FavouriteAggregatesFilter = {
  /** Mean average aggregate over matching `Favourite` objects. */
  average?: FavouriteAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `Favourite` objects. */
  distinctCount?: FavouriteDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `Favourite` object to be included within the aggregate. */
  filter?: FavouriteFilter | null | undefined;
  /** Maximum aggregate over matching `Favourite` objects. */
  max?: FavouriteMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `Favourite` objects. */
  min?: FavouriteMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `Favourite` objects. */
  stddevPopulation?: FavouriteStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `Favourite` objects. */
  stddevSample?: FavouriteStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `Favourite` objects. */
  sum?: FavouriteSumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `Favourite` objects. */
  variancePopulation?: FavouriteVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `Favourite` objects. */
  varianceSample?: FavouriteVarianceSampleAggregateFilter | null | undefined;
};

export type FavouriteAverageAggregateFilter = {
  levelId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type FavouriteDistinctCountAggregateFilter = {
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

/** A filter to be used against `Favourite` object types. All fields are combined with a logical ‘and.’ */
export type FavouriteFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<FavouriteFilter> | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `level` relation. */
  level?: LevelFilter | null | undefined;
  /** Filter by the object’s `levelId` field. */
  levelId?: IntFilter | null | undefined;
  /** Negates the expression. */
  not?: FavouriteFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<FavouriteFilter> | null | undefined;
  /** Filter by the object’s `user` relation. */
  user?: UserFilter | null | undefined;
  /** Filter by the object’s `userId` field. */
  userId?: IntFilter | null | undefined;
};

export type FavouriteMaxAggregateFilter = {
  levelId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type FavouriteMinAggregateFilter = {
  levelId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type FavouriteStddevPopulationAggregateFilter = {
  levelId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type FavouriteStddevSampleAggregateFilter = {
  levelId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type FavouriteSumAggregateFilter = {
  levelId?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

export type FavouriteVariancePopulationAggregateFilter = {
  levelId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type FavouriteVarianceSampleAggregateFilter = {
  levelId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

/** A filter to be used against Float fields. All fields are combined with a logical ‘and.’ */
export type FloatFilter = {
  /** Not equal to the specified value, treating null like an ordinary value. */
  distinctFrom?: number | null | undefined;
  /** Equal to the specified value. */
  equalTo?: number | null | undefined;
  /** Greater than the specified value. */
  greaterThan?: number | null | undefined;
  /** Greater than or equal to the specified value. */
  greaterThanOrEqualTo?: number | null | undefined;
  /** Included in the specified list. */
  in?: Array<number> | null | undefined;
  /** Is null (if `true` is specified) or is not null (if `false` is specified). */
  isNull?: boolean | null | undefined;
  /** Less than the specified value. */
  lessThan?: number | null | undefined;
  /** Less than or equal to the specified value. */
  lessThanOrEqualTo?: number | null | undefined;
  /** Equal to the specified value, treating null like an ordinary value. */
  notDistinctFrom?: number | null | undefined;
  /** Not equal to the specified value. */
  notEqualTo?: number | null | undefined;
  /** Not included in the specified list. */
  notIn?: Array<number> | null | undefined;
};

/** A filter to be used against Float List fields. All fields are combined with a logical ‘and.’ */
export type FloatListFilter = {
  /** Any array item is equal to the specified value. */
  anyEqualTo?: number | null | undefined;
  /** Any array item is greater than the specified value. */
  anyGreaterThan?: number | null | undefined;
  /** Any array item is greater than or equal to the specified value. */
  anyGreaterThanOrEqualTo?: number | null | undefined;
  /** Any array item is less than the specified value. */
  anyLessThan?: number | null | undefined;
  /** Any array item is less than or equal to the specified value. */
  anyLessThanOrEqualTo?: number | null | undefined;
  /** Any array item is not equal to the specified value. */
  anyNotEqualTo?: number | null | undefined;
  /** Contained by the specified list of values. */
  containedBy?: Array<number | null | undefined> | null | undefined;
  /** Contains the specified list of values. */
  contains?: Array<number | null | undefined> | null | undefined;
  /** Not equal to the specified value, treating null like an ordinary value. */
  distinctFrom?: Array<number | null | undefined> | null | undefined;
  /** Equal to the specified value. */
  equalTo?: Array<number | null | undefined> | null | undefined;
  /** Greater than the specified value. */
  greaterThan?: Array<number | null | undefined> | null | undefined;
  /** Greater than or equal to the specified value. */
  greaterThanOrEqualTo?: Array<number | null | undefined> | null | undefined;
  /** Is null (if `true` is specified) or is not null (if `false` is specified). */
  isNull?: boolean | null | undefined;
  /** Less than the specified value. */
  lessThan?: Array<number | null | undefined> | null | undefined;
  /** Less than or equal to the specified value. */
  lessThanOrEqualTo?: Array<number | null | undefined> | null | undefined;
  /** Equal to the specified value, treating null like an ordinary value. */
  notDistinctFrom?: Array<number | null | undefined> | null | undefined;
  /** Not equal to the specified value. */
  notEqualTo?: Array<number | null | undefined> | null | undefined;
  /** Overlaps the specified list of values. */
  overlaps?: Array<number | null | undefined> | null | undefined;
};

/** A filter to be used against Int fields. All fields are combined with a logical ‘and.’ */
export type IntFilter = {
  /** Not equal to the specified value, treating null like an ordinary value. */
  distinctFrom?: number | null | undefined;
  /** Equal to the specified value. */
  equalTo?: number | null | undefined;
  /** Greater than the specified value. */
  greaterThan?: number | null | undefined;
  /** Greater than or equal to the specified value. */
  greaterThanOrEqualTo?: number | null | undefined;
  /** Included in the specified list. */
  in?: Array<number> | null | undefined;
  /** Is null (if `true` is specified) or is not null (if `false` is specified). */
  isNull?: boolean | null | undefined;
  /** Less than the specified value. */
  lessThan?: number | null | undefined;
  /** Less than or equal to the specified value. */
  lessThanOrEqualTo?: number | null | undefined;
  /** Equal to the specified value, treating null like an ordinary value. */
  notDistinctFrom?: number | null | undefined;
  /** Not equal to the specified value. */
  notEqualTo?: number | null | undefined;
  /** Not included in the specified list. */
  notIn?: Array<number> | null | undefined;
};

/** A filter to be used against Int List fields. All fields are combined with a logical ‘and.’ */
export type IntListFilter = {
  /** Any array item is equal to the specified value. */
  anyEqualTo?: number | null | undefined;
  /** Any array item is greater than the specified value. */
  anyGreaterThan?: number | null | undefined;
  /** Any array item is greater than or equal to the specified value. */
  anyGreaterThanOrEqualTo?: number | null | undefined;
  /** Any array item is less than the specified value. */
  anyLessThan?: number | null | undefined;
  /** Any array item is less than or equal to the specified value. */
  anyLessThanOrEqualTo?: number | null | undefined;
  /** Any array item is not equal to the specified value. */
  anyNotEqualTo?: number | null | undefined;
  /** Contained by the specified list of values. */
  containedBy?: Array<number | null | undefined> | null | undefined;
  /** Contains the specified list of values. */
  contains?: Array<number | null | undefined> | null | undefined;
  /** Not equal to the specified value, treating null like an ordinary value. */
  distinctFrom?: Array<number | null | undefined> | null | undefined;
  /** Equal to the specified value. */
  equalTo?: Array<number | null | undefined> | null | undefined;
  /** Greater than the specified value. */
  greaterThan?: Array<number | null | undefined> | null | undefined;
  /** Greater than or equal to the specified value. */
  greaterThanOrEqualTo?: Array<number | null | undefined> | null | undefined;
  /** Is null (if `true` is specified) or is not null (if `false` is specified). */
  isNull?: boolean | null | undefined;
  /** Less than the specified value. */
  lessThan?: Array<number | null | undefined> | null | undefined;
  /** Less than or equal to the specified value. */
  lessThanOrEqualTo?: Array<number | null | undefined> | null | undefined;
  /** Equal to the specified value, treating null like an ordinary value. */
  notDistinctFrom?: Array<number | null | undefined> | null | undefined;
  /** Not equal to the specified value. */
  notEqualTo?: Array<number | null | undefined> | null | undefined;
  /** Overlaps the specified list of values. */
  overlaps?: Array<number | null | undefined> | null | undefined;
};

/** A filter to be used against `Level` object types. All fields are combined with a logical ‘and.’ */
export type LevelFilter = {
  /** Filter by the object’s `adventure` field. */
  adventure?: BooleanFilter | null | undefined;
  /** Checks for all expressions in this list. */
  and?: Array<LevelFilter> | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `discordActivityEvents` relation. */
  discordActivityEvents?: LevelToManyDiscordActivityEventFilter | null | undefined;
  /** Some related `discordActivityEvents` exist. */
  discordActivityEventsExist?: boolean | null | undefined;
  /** Filter by the object’s `favourites` relation. */
  favourites?: LevelToManyFavouriteFilter | null | undefined;
  /** Some related `favourites` exist. */
  favouritesExist?: boolean | null | undefined;
  /** Filter by the object’s `hash` field. */
  hash?: StringFilter | null | undefined;
  /** Filter by the object’s `id` field. */
  id?: IntFilter | null | undefined;
  /** Filter by the object’s `levelItems` relation. */
  levelItems?: LevelToManyLevelItemFilter | null | undefined;
  /** Some related `levelItems` exist. */
  levelItemsExist?: boolean | null | undefined;
  /** Filter by the object’s `levelMetadata` relation. */
  levelMetadata?: LevelToManyLevelMetadatumFilter | null | undefined;
  /** Some related `levelMetadata` exist. */
  levelMetadataExist?: boolean | null | undefined;
  /** A related `levelPoint` exists. */
  levelPointExists?: boolean | null | undefined;
  /** Filter by the object’s `levelPoint` relation. */
  levelPoints?: LevelPointFilter | null | undefined;
  /** Filter by the object’s `levelPointsHistories` relation. */
  levelPointsHistories?: LevelToManyLevelPointsHistoryFilter | null | undefined;
  /** Some related `levelPointsHistories` exist. */
  levelPointsHistoriesExist?: boolean | null | undefined;
  /** Negates the expression. */
  not?: LevelFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<LevelFilter> | null | undefined;
  /** Filter by the object’s `personalBestGlobals` relation. */
  personalBestGlobals?: LevelToManyPersonalBestGlobalFilter | null | undefined;
  /** Some related `personalBestGlobals` exist. */
  personalBestGlobalsExist?: boolean | null | undefined;
  /** Filter by the object’s `publiclyVisible` field. */
  publiclyVisible?: BooleanFilter | null | undefined;
  /** Filter by the object’s `records` relation. */
  records?: LevelToManyRecordFilter | null | undefined;
  /** Some related `records` exist. */
  recordsExist?: boolean | null | undefined;
  /** Filter by the object’s `trackTournaments` relation. */
  trackTournaments?: LevelToManyTrackTournamentFilter | null | undefined;
  /** Some related `trackTournaments` exist. */
  trackTournamentsExist?: boolean | null | undefined;
  /** Filter by the object’s `userPointContributions` relation. */
  userPointContributions?: LevelToManyUserPointContributionFilter | null | undefined;
  /** Some related `userPointContributions` exist. */
  userPointContributionsExist?: boolean | null | undefined;
  /** Filter by the object’s `votes` relation. */
  votes?: LevelToManyVoteFilter | null | undefined;
  /** Some related `votes` exist. */
  votesExist?: boolean | null | undefined;
  /** Filter by the object’s `worldRecordGlobal` relation. */
  worldRecordGlobal?: WorldRecordGlobalFilter | null | undefined;
  /** A related `worldRecordGlobal` exists. */
  worldRecordGlobalExists?: boolean | null | undefined;
  /** Filter by the object’s `xxHash` field. */
  xxHash?: StringFilter | null | undefined;
  /** Filter by the object’s `zslLevels` relation. */
  zslLevels?: LevelToManyZslLevelFilter | null | undefined;
  /** Some related `zslLevels` exist. */
  zslLevelsExist?: boolean | null | undefined;
};

/** A filter to be used against aggregates of `LevelItem` object types. */
export type LevelItemAggregatesFilter = {
  /** Mean average aggregate over matching `LevelItem` objects. */
  average?: LevelItemAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `LevelItem` objects. */
  distinctCount?: LevelItemDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `LevelItem` object to be included within the aggregate. */
  filter?: LevelItemFilter | null | undefined;
  /** Maximum aggregate over matching `LevelItem` objects. */
  max?: LevelItemMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `LevelItem` objects. */
  min?: LevelItemMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `LevelItem` objects. */
  stddevPopulation?: LevelItemStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `LevelItem` objects. */
  stddevSample?: LevelItemStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `LevelItem` objects. */
  sum?: LevelItemSumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `LevelItem` objects. */
  variancePopulation?: LevelItemVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `LevelItem` objects. */
  varianceSample?: LevelItemVarianceSampleAggregateFilter | null | undefined;
};

export type LevelItemAverageAggregateFilter = {
  authorId?: BigFloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  validationTimeAuthor?: FloatFilter | null | undefined;
  validationTimeBronze?: FloatFilter | null | undefined;
  validationTimeGold?: FloatFilter | null | undefined;
  validationTimeSilver?: FloatFilter | null | undefined;
  workshopId?: BigFloatFilter | null | undefined;
};

export type LevelItemDistinctCountAggregateFilter = {
  authorId?: BigIntFilter | null | undefined;
  createdAt?: BigIntFilter | null | undefined;
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  deleted?: BigIntFilter | null | undefined;
  fileAuthor?: BigIntFilter | null | undefined;
  fileUid?: BigIntFilter | null | undefined;
  id?: BigIntFilter | null | undefined;
  imageUrl?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  name?: BigIntFilter | null | undefined;
  updatedAt?: BigIntFilter | null | undefined;
  validationTimeAuthor?: BigIntFilter | null | undefined;
  validationTimeBronze?: BigIntFilter | null | undefined;
  validationTimeGold?: BigIntFilter | null | undefined;
  validationTimeSilver?: BigIntFilter | null | undefined;
  workshopId?: BigIntFilter | null | undefined;
};

/** A filter to be used against `LevelItem` object types. All fields are combined with a logical ‘and.’ */
export type LevelItemFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<LevelItemFilter> | null | undefined;
  /** Filter by the object’s `author` relation. */
  author?: UserFilter | null | undefined;
  /** Filter by the object’s `authorId` field. */
  authorId?: BigIntFilter | null | undefined;
  /** Filter by the object’s `createdAt` field. */
  createdAt?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `deleted` field. */
  deleted?: BooleanFilter | null | undefined;
  /** Filter by the object’s `fileAuthor` field. */
  fileAuthor?: StringFilter | null | undefined;
  /** Filter by the object’s `fileUid` field. */
  fileUid?: StringFilter | null | undefined;
  /** Filter by the object’s `id` field. */
  id?: IntFilter | null | undefined;
  /** Filter by the object’s `imageUrl` field. */
  imageUrl?: StringFilter | null | undefined;
  /** Filter by the object’s `level` relation. */
  level?: LevelFilter | null | undefined;
  /** Filter by the object’s `levelId` field. */
  levelId?: IntFilter | null | undefined;
  /** Filter by the object’s `name` field. */
  name?: StringFilter | null | undefined;
  /** Negates the expression. */
  not?: LevelItemFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<LevelItemFilter> | null | undefined;
  /** Filter by the object’s `updatedAt` field. */
  updatedAt?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `validationTimeAuthor` field. */
  validationTimeAuthor?: FloatFilter | null | undefined;
  /** Filter by the object’s `validationTimeBronze` field. */
  validationTimeBronze?: FloatFilter | null | undefined;
  /** Filter by the object’s `validationTimeGold` field. */
  validationTimeGold?: FloatFilter | null | undefined;
  /** Filter by the object’s `validationTimeSilver` field. */
  validationTimeSilver?: FloatFilter | null | undefined;
  /** Filter by the object’s `workshop` relation. */
  workshop?: WorkshopItemFilter | null | undefined;
  /** Filter by the object’s `workshopId` field. */
  workshopId?: BigIntFilter | null | undefined;
};

export type LevelItemMaxAggregateFilter = {
  authorId?: BigIntFilter | null | undefined;
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  validationTimeAuthor?: FloatFilter | null | undefined;
  validationTimeBronze?: FloatFilter | null | undefined;
  validationTimeGold?: FloatFilter | null | undefined;
  validationTimeSilver?: FloatFilter | null | undefined;
  workshopId?: BigIntFilter | null | undefined;
};

export type LevelItemMinAggregateFilter = {
  authorId?: BigIntFilter | null | undefined;
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  validationTimeAuthor?: FloatFilter | null | undefined;
  validationTimeBronze?: FloatFilter | null | undefined;
  validationTimeGold?: FloatFilter | null | undefined;
  validationTimeSilver?: FloatFilter | null | undefined;
  workshopId?: BigIntFilter | null | undefined;
};

export type LevelItemStddevPopulationAggregateFilter = {
  authorId?: BigFloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  validationTimeAuthor?: FloatFilter | null | undefined;
  validationTimeBronze?: FloatFilter | null | undefined;
  validationTimeGold?: FloatFilter | null | undefined;
  validationTimeSilver?: FloatFilter | null | undefined;
  workshopId?: BigFloatFilter | null | undefined;
};

export type LevelItemStddevSampleAggregateFilter = {
  authorId?: BigFloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  validationTimeAuthor?: FloatFilter | null | undefined;
  validationTimeBronze?: FloatFilter | null | undefined;
  validationTimeGold?: FloatFilter | null | undefined;
  validationTimeSilver?: FloatFilter | null | undefined;
  workshopId?: BigFloatFilter | null | undefined;
};

export type LevelItemSumAggregateFilter = {
  authorId?: BigFloatFilter | null | undefined;
  id?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  validationTimeAuthor?: FloatFilter | null | undefined;
  validationTimeBronze?: FloatFilter | null | undefined;
  validationTimeGold?: FloatFilter | null | undefined;
  validationTimeSilver?: FloatFilter | null | undefined;
  workshopId?: BigFloatFilter | null | undefined;
};

export type LevelItemVariancePopulationAggregateFilter = {
  authorId?: BigFloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  validationTimeAuthor?: FloatFilter | null | undefined;
  validationTimeBronze?: FloatFilter | null | undefined;
  validationTimeGold?: FloatFilter | null | undefined;
  validationTimeSilver?: FloatFilter | null | undefined;
  workshopId?: BigFloatFilter | null | undefined;
};

export type LevelItemVarianceSampleAggregateFilter = {
  authorId?: BigFloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  validationTimeAuthor?: FloatFilter | null | undefined;
  validationTimeBronze?: FloatFilter | null | undefined;
  validationTimeGold?: FloatFilter | null | undefined;
  validationTimeSilver?: FloatFilter | null | undefined;
  workshopId?: BigFloatFilter | null | undefined;
};

/** Methods to use when ordering `LevelItem`. */
export type LevelItemsOrderBy =
  | 'AUTHOR_ID_ASC'
  | 'AUTHOR_ID_DESC'
  | 'CREATED_AT_ASC'
  | 'CREATED_AT_DESC'
  | 'DATE_CREATED_ASC'
  | 'DATE_CREATED_DESC'
  | 'DATE_UPDATED_ASC'
  | 'DATE_UPDATED_DESC'
  | 'DELETED_ASC'
  | 'DELETED_DESC'
  | 'FILE_AUTHOR_ASC'
  | 'FILE_AUTHOR_DESC'
  | 'FILE_UID_ASC'
  | 'FILE_UID_DESC'
  | 'ID_ASC'
  | 'ID_DESC'
  | 'IMAGE_URL_ASC'
  | 'IMAGE_URL_DESC'
  | 'LEVEL_ID_ASC'
  | 'LEVEL_ID_DESC'
  | 'NAME_ASC'
  | 'NAME_DESC'
  | 'NATURAL'
  | 'PRIMARY_KEY_ASC'
  | 'PRIMARY_KEY_DESC'
  | 'UPDATED_AT_ASC'
  | 'UPDATED_AT_DESC'
  | 'VALIDATION_TIME_AUTHOR_ASC'
  | 'VALIDATION_TIME_AUTHOR_DESC'
  | 'VALIDATION_TIME_BRONZE_ASC'
  | 'VALIDATION_TIME_BRONZE_DESC'
  | 'VALIDATION_TIME_GOLD_ASC'
  | 'VALIDATION_TIME_GOLD_DESC'
  | 'VALIDATION_TIME_SILVER_ASC'
  | 'VALIDATION_TIME_SILVER_DESC'
  | 'WORKSHOP_ID_ASC'
  | 'WORKSHOP_ID_DESC';

/** A filter to be used against aggregates of `LevelMetadatum` object types. */
export type LevelMetadatumAggregatesFilter = {
  /** Mean average aggregate over matching `LevelMetadatum` objects. */
  average?: LevelMetadatumAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `LevelMetadatum` objects. */
  distinctCount?: LevelMetadatumDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `LevelMetadatum` object to be included within the aggregate. */
  filter?: LevelMetadatumFilter | null | undefined;
  /** Maximum aggregate over matching `LevelMetadatum` objects. */
  max?: LevelMetadatumMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `LevelMetadatum` objects. */
  min?: LevelMetadatumMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `LevelMetadatum` objects. */
  stddevPopulation?: LevelMetadatumStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `LevelMetadatum` objects. */
  stddevSample?: LevelMetadatumStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `LevelMetadatum` objects. */
  sum?: LevelMetadatumSumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `LevelMetadatum` objects. */
  variancePopulation?: LevelMetadatumVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `LevelMetadatum` objects. */
  varianceSample?: LevelMetadatumVarianceSampleAggregateFilter | null | undefined;
};

export type LevelMetadatumAverageAggregateFilter = {
  amountBlocks?: BigFloatFilter | null | undefined;
  amountCheckpoints?: BigFloatFilter | null | undefined;
  amountFinishes?: BigFloatFilter | null | undefined;
  format?: BigFloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  typeGround?: BigFloatFilter | null | undefined;
  typeSkybox?: BigFloatFilter | null | undefined;
};

export type LevelMetadatumDistinctCountAggregateFilter = {
  amountBlocks?: BigIntFilter | null | undefined;
  amountCheckpoints?: BigIntFilter | null | undefined;
  amountFinishes?: BigIntFilter | null | undefined;
  blocks?: BigIntFilter | null | undefined;
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  format?: BigIntFilter | null | undefined;
  id?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  typeGround?: BigIntFilter | null | undefined;
  typeSkybox?: BigIntFilter | null | undefined;
};

/** A filter to be used against `LevelMetadatum` object types. All fields are combined with a logical ‘and.’ */
export type LevelMetadatumFilter = {
  /** Filter by the object’s `amountBlocks` field. */
  amountBlocks?: IntFilter | null | undefined;
  /** Filter by the object’s `amountCheckpoints` field. */
  amountCheckpoints?: IntFilter | null | undefined;
  /** Filter by the object’s `amountFinishes` field. */
  amountFinishes?: IntFilter | null | undefined;
  /** Checks for all expressions in this list. */
  and?: Array<LevelMetadatumFilter> | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `format` field. */
  format?: IntFilter | null | undefined;
  /** Filter by the object’s `id` field. */
  id?: IntFilter | null | undefined;
  /** Filter by the object’s `level` relation. */
  level?: LevelFilter | null | undefined;
  /** Filter by the object’s `levelId` field. */
  levelId?: IntFilter | null | undefined;
  /** Negates the expression. */
  not?: LevelMetadatumFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<LevelMetadatumFilter> | null | undefined;
  /** Filter by the object’s `typeGround` field. */
  typeGround?: IntFilter | null | undefined;
  /** Filter by the object’s `typeSkybox` field. */
  typeSkybox?: IntFilter | null | undefined;
};

export type LevelMetadatumMaxAggregateFilter = {
  amountBlocks?: IntFilter | null | undefined;
  amountCheckpoints?: IntFilter | null | undefined;
  amountFinishes?: IntFilter | null | undefined;
  format?: IntFilter | null | undefined;
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  typeGround?: IntFilter | null | undefined;
  typeSkybox?: IntFilter | null | undefined;
};

export type LevelMetadatumMinAggregateFilter = {
  amountBlocks?: IntFilter | null | undefined;
  amountCheckpoints?: IntFilter | null | undefined;
  amountFinishes?: IntFilter | null | undefined;
  format?: IntFilter | null | undefined;
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  typeGround?: IntFilter | null | undefined;
  typeSkybox?: IntFilter | null | undefined;
};

export type LevelMetadatumStddevPopulationAggregateFilter = {
  amountBlocks?: BigFloatFilter | null | undefined;
  amountCheckpoints?: BigFloatFilter | null | undefined;
  amountFinishes?: BigFloatFilter | null | undefined;
  format?: BigFloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  typeGround?: BigFloatFilter | null | undefined;
  typeSkybox?: BigFloatFilter | null | undefined;
};

export type LevelMetadatumStddevSampleAggregateFilter = {
  amountBlocks?: BigFloatFilter | null | undefined;
  amountCheckpoints?: BigFloatFilter | null | undefined;
  amountFinishes?: BigFloatFilter | null | undefined;
  format?: BigFloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  typeGround?: BigFloatFilter | null | undefined;
  typeSkybox?: BigFloatFilter | null | undefined;
};

export type LevelMetadatumSumAggregateFilter = {
  amountBlocks?: BigIntFilter | null | undefined;
  amountCheckpoints?: BigIntFilter | null | undefined;
  amountFinishes?: BigIntFilter | null | undefined;
  format?: BigIntFilter | null | undefined;
  id?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  typeGround?: BigIntFilter | null | undefined;
  typeSkybox?: BigIntFilter | null | undefined;
};

export type LevelMetadatumVariancePopulationAggregateFilter = {
  amountBlocks?: BigFloatFilter | null | undefined;
  amountCheckpoints?: BigFloatFilter | null | undefined;
  amountFinishes?: BigFloatFilter | null | undefined;
  format?: BigFloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  typeGround?: BigFloatFilter | null | undefined;
  typeSkybox?: BigFloatFilter | null | undefined;
};

export type LevelMetadatumVarianceSampleAggregateFilter = {
  amountBlocks?: BigFloatFilter | null | undefined;
  amountCheckpoints?: BigFloatFilter | null | undefined;
  amountFinishes?: BigFloatFilter | null | undefined;
  format?: BigFloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  typeGround?: BigFloatFilter | null | undefined;
  typeSkybox?: BigFloatFilter | null | undefined;
};

/** A filter to be used against `LevelPoint` object types. All fields are combined with a logical ‘and.’ */
export type LevelPointFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<LevelPointFilter> | null | undefined;
  /** Filter by the object’s `complexityConfidence` field. */
  complexityConfidence?: FloatFilter | null | undefined;
  /** Filter by the object’s `complexityScore` field. */
  complexityScore?: FloatFilter | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `fieldStrength` field. */
  fieldStrength?: FloatFilter | null | undefined;
  /** Filter by the object’s `level` relation. */
  level?: LevelFilter | null | undefined;
  /** Filter by the object’s `levelId` field. */
  levelId?: IntFilter | null | undefined;
  /** Filter by the object’s `modifierEvidence` field. */
  modifierEvidence?: FloatFilter | null | undefined;
  /** Filter by the object’s `modifierLength` field. */
  modifierLength?: FloatFilter | null | undefined;
  /** Filter by the object’s `modifierQuality` field. */
  modifierQuality?: FloatFilter | null | undefined;
  /** Filter by the object’s `modifierRating` field. */
  modifierRating?: FloatFilter | null | undefined;
  /** Negates the expression. */
  not?: LevelPointFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<LevelPointFilter> | null | undefined;
  /** Filter by the object’s `points` field. */
  points?: IntFilter | null | undefined;
  /** Filter by the object’s `qualityScore` field. */
  qualityScore?: FloatFilter | null | undefined;
  /** Filter by the object’s `rating` field. */
  rating?: FloatFilter | null | undefined;
  /** Filter by the object’s `skillAlignment` field. */
  skillAlignment?: FloatFilter | null | undefined;
  /** Filter by the object’s `skillConfidence` field. */
  skillConfidence?: FloatFilter | null | undefined;
  /** Filter by the object’s `skillSampleSize` field. */
  skillSampleSize?: IntFilter | null | undefined;
  /** Filter by the object’s `skillScore` field. */
  skillScore?: FloatFilter | null | undefined;
  /** Filter by the object’s `skillSeparation` field. */
  skillSeparation?: FloatFilter | null | undefined;
};

/** A filter to be used against aggregates of `LevelPointsHistory` object types. */
export type LevelPointsHistoryAggregatesFilter = {
  /** Mean average aggregate over matching `LevelPointsHistory` objects. */
  average?: LevelPointsHistoryAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `LevelPointsHistory` objects. */
  distinctCount?: LevelPointsHistoryDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `LevelPointsHistory` object to be included within the aggregate. */
  filter?: LevelPointsHistoryFilter | null | undefined;
  /** Maximum aggregate over matching `LevelPointsHistory` objects. */
  max?: LevelPointsHistoryMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `LevelPointsHistory` objects. */
  min?: LevelPointsHistoryMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `LevelPointsHistory` objects. */
  stddevPopulation?: LevelPointsHistoryStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `LevelPointsHistory` objects. */
  stddevSample?: LevelPointsHistoryStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `LevelPointsHistory` objects. */
  sum?: LevelPointsHistorySumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `LevelPointsHistory` objects. */
  variancePopulation?: LevelPointsHistoryVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `LevelPointsHistory` objects. */
  varianceSample?: LevelPointsHistoryVarianceSampleAggregateFilter | null | undefined;
};

export type LevelPointsHistoryAverageAggregateFilter = {
  complexityConfidence?: FloatFilter | null | undefined;
  complexityScore?: FloatFilter | null | undefined;
  fieldStrength?: FloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  modifierEvidence?: FloatFilter | null | undefined;
  modifierLength?: FloatFilter | null | undefined;
  modifierQuality?: FloatFilter | null | undefined;
  modifierRating?: FloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  qualityScore?: FloatFilter | null | undefined;
  rating?: FloatFilter | null | undefined;
  skillAlignment?: FloatFilter | null | undefined;
  skillConfidence?: FloatFilter | null | undefined;
  skillSampleSize?: BigFloatFilter | null | undefined;
  skillScore?: FloatFilter | null | undefined;
  skillSeparation?: FloatFilter | null | undefined;
};

export type LevelPointsHistoryDistinctCountAggregateFilter = {
  complexityConfidence?: BigIntFilter | null | undefined;
  complexityScore?: BigIntFilter | null | undefined;
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  fieldStrength?: BigIntFilter | null | undefined;
  id?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  modifierEvidence?: BigIntFilter | null | undefined;
  modifierLength?: BigIntFilter | null | undefined;
  modifierQuality?: BigIntFilter | null | undefined;
  modifierRating?: BigIntFilter | null | undefined;
  points?: BigIntFilter | null | undefined;
  qualityScore?: BigIntFilter | null | undefined;
  rating?: BigIntFilter | null | undefined;
  skillAlignment?: BigIntFilter | null | undefined;
  skillConfidence?: BigIntFilter | null | undefined;
  skillSampleSize?: BigIntFilter | null | undefined;
  skillScore?: BigIntFilter | null | undefined;
  skillSeparation?: BigIntFilter | null | undefined;
};

/** A filter to be used against `LevelPointsHistory` object types. All fields are combined with a logical ‘and.’ */
export type LevelPointsHistoryFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<LevelPointsHistoryFilter> | null | undefined;
  /** Filter by the object’s `complexityConfidence` field. */
  complexityConfidence?: FloatFilter | null | undefined;
  /** Filter by the object’s `complexityScore` field. */
  complexityScore?: FloatFilter | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `fieldStrength` field. */
  fieldStrength?: FloatFilter | null | undefined;
  /** Filter by the object’s `id` field. */
  id?: IntFilter | null | undefined;
  /** Filter by the object’s `level` relation. */
  level?: LevelFilter | null | undefined;
  /** Filter by the object’s `levelId` field. */
  levelId?: IntFilter | null | undefined;
  /** Filter by the object’s `modifierEvidence` field. */
  modifierEvidence?: FloatFilter | null | undefined;
  /** Filter by the object’s `modifierLength` field. */
  modifierLength?: FloatFilter | null | undefined;
  /** Filter by the object’s `modifierQuality` field. */
  modifierQuality?: FloatFilter | null | undefined;
  /** Filter by the object’s `modifierRating` field. */
  modifierRating?: FloatFilter | null | undefined;
  /** Negates the expression. */
  not?: LevelPointsHistoryFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<LevelPointsHistoryFilter> | null | undefined;
  /** Filter by the object’s `points` field. */
  points?: IntFilter | null | undefined;
  /** Filter by the object’s `qualityScore` field. */
  qualityScore?: FloatFilter | null | undefined;
  /** Filter by the object’s `rating` field. */
  rating?: FloatFilter | null | undefined;
  /** Filter by the object’s `skillAlignment` field. */
  skillAlignment?: FloatFilter | null | undefined;
  /** Filter by the object’s `skillConfidence` field. */
  skillConfidence?: FloatFilter | null | undefined;
  /** Filter by the object’s `skillSampleSize` field. */
  skillSampleSize?: IntFilter | null | undefined;
  /** Filter by the object’s `skillScore` field. */
  skillScore?: FloatFilter | null | undefined;
  /** Filter by the object’s `skillSeparation` field. */
  skillSeparation?: FloatFilter | null | undefined;
};

export type LevelPointsHistoryMaxAggregateFilter = {
  complexityConfidence?: FloatFilter | null | undefined;
  complexityScore?: FloatFilter | null | undefined;
  fieldStrength?: FloatFilter | null | undefined;
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  modifierEvidence?: FloatFilter | null | undefined;
  modifierLength?: FloatFilter | null | undefined;
  modifierQuality?: FloatFilter | null | undefined;
  modifierRating?: FloatFilter | null | undefined;
  points?: IntFilter | null | undefined;
  qualityScore?: FloatFilter | null | undefined;
  rating?: FloatFilter | null | undefined;
  skillAlignment?: FloatFilter | null | undefined;
  skillConfidence?: FloatFilter | null | undefined;
  skillSampleSize?: IntFilter | null | undefined;
  skillScore?: FloatFilter | null | undefined;
  skillSeparation?: FloatFilter | null | undefined;
};

export type LevelPointsHistoryMinAggregateFilter = {
  complexityConfidence?: FloatFilter | null | undefined;
  complexityScore?: FloatFilter | null | undefined;
  fieldStrength?: FloatFilter | null | undefined;
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  modifierEvidence?: FloatFilter | null | undefined;
  modifierLength?: FloatFilter | null | undefined;
  modifierQuality?: FloatFilter | null | undefined;
  modifierRating?: FloatFilter | null | undefined;
  points?: IntFilter | null | undefined;
  qualityScore?: FloatFilter | null | undefined;
  rating?: FloatFilter | null | undefined;
  skillAlignment?: FloatFilter | null | undefined;
  skillConfidence?: FloatFilter | null | undefined;
  skillSampleSize?: IntFilter | null | undefined;
  skillScore?: FloatFilter | null | undefined;
  skillSeparation?: FloatFilter | null | undefined;
};

export type LevelPointsHistoryStddevPopulationAggregateFilter = {
  complexityConfidence?: FloatFilter | null | undefined;
  complexityScore?: FloatFilter | null | undefined;
  fieldStrength?: FloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  modifierEvidence?: FloatFilter | null | undefined;
  modifierLength?: FloatFilter | null | undefined;
  modifierQuality?: FloatFilter | null | undefined;
  modifierRating?: FloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  qualityScore?: FloatFilter | null | undefined;
  rating?: FloatFilter | null | undefined;
  skillAlignment?: FloatFilter | null | undefined;
  skillConfidence?: FloatFilter | null | undefined;
  skillSampleSize?: BigFloatFilter | null | undefined;
  skillScore?: FloatFilter | null | undefined;
  skillSeparation?: FloatFilter | null | undefined;
};

export type LevelPointsHistoryStddevSampleAggregateFilter = {
  complexityConfidence?: FloatFilter | null | undefined;
  complexityScore?: FloatFilter | null | undefined;
  fieldStrength?: FloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  modifierEvidence?: FloatFilter | null | undefined;
  modifierLength?: FloatFilter | null | undefined;
  modifierQuality?: FloatFilter | null | undefined;
  modifierRating?: FloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  qualityScore?: FloatFilter | null | undefined;
  rating?: FloatFilter | null | undefined;
  skillAlignment?: FloatFilter | null | undefined;
  skillConfidence?: FloatFilter | null | undefined;
  skillSampleSize?: BigFloatFilter | null | undefined;
  skillScore?: FloatFilter | null | undefined;
  skillSeparation?: FloatFilter | null | undefined;
};

export type LevelPointsHistorySumAggregateFilter = {
  complexityConfidence?: FloatFilter | null | undefined;
  complexityScore?: FloatFilter | null | undefined;
  fieldStrength?: FloatFilter | null | undefined;
  id?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  modifierEvidence?: FloatFilter | null | undefined;
  modifierLength?: FloatFilter | null | undefined;
  modifierQuality?: FloatFilter | null | undefined;
  modifierRating?: FloatFilter | null | undefined;
  points?: BigIntFilter | null | undefined;
  qualityScore?: FloatFilter | null | undefined;
  rating?: FloatFilter | null | undefined;
  skillAlignment?: FloatFilter | null | undefined;
  skillConfidence?: FloatFilter | null | undefined;
  skillSampleSize?: BigIntFilter | null | undefined;
  skillScore?: FloatFilter | null | undefined;
  skillSeparation?: FloatFilter | null | undefined;
};

export type LevelPointsHistoryVariancePopulationAggregateFilter = {
  complexityConfidence?: FloatFilter | null | undefined;
  complexityScore?: FloatFilter | null | undefined;
  fieldStrength?: FloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  modifierEvidence?: FloatFilter | null | undefined;
  modifierLength?: FloatFilter | null | undefined;
  modifierQuality?: FloatFilter | null | undefined;
  modifierRating?: FloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  qualityScore?: FloatFilter | null | undefined;
  rating?: FloatFilter | null | undefined;
  skillAlignment?: FloatFilter | null | undefined;
  skillConfidence?: FloatFilter | null | undefined;
  skillSampleSize?: BigFloatFilter | null | undefined;
  skillScore?: FloatFilter | null | undefined;
  skillSeparation?: FloatFilter | null | undefined;
};

export type LevelPointsHistoryVarianceSampleAggregateFilter = {
  complexityConfidence?: FloatFilter | null | undefined;
  complexityScore?: FloatFilter | null | undefined;
  fieldStrength?: FloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  modifierEvidence?: FloatFilter | null | undefined;
  modifierLength?: FloatFilter | null | undefined;
  modifierQuality?: FloatFilter | null | undefined;
  modifierRating?: FloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  qualityScore?: FloatFilter | null | undefined;
  rating?: FloatFilter | null | undefined;
  skillAlignment?: FloatFilter | null | undefined;
  skillConfidence?: FloatFilter | null | undefined;
  skillSampleSize?: BigFloatFilter | null | undefined;
  skillScore?: FloatFilter | null | undefined;
  skillSeparation?: FloatFilter | null | undefined;
};

/** A filter to be used against many `DiscordActivityEvent` object types. All fields are combined with a logical ‘and.’ */
export type LevelToManyDiscordActivityEventFilter = {
  /** Aggregates across related `DiscordActivityEvent` match the filter criteria. */
  aggregates?: DiscordActivityEventAggregatesFilter | null | undefined;
  /** Every related `DiscordActivityEvent` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: DiscordActivityEventFilter | null | undefined;
  /** No related `DiscordActivityEvent` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: DiscordActivityEventFilter | null | undefined;
  /** Some related `DiscordActivityEvent` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: DiscordActivityEventFilter | null | undefined;
};

/** A filter to be used against many `Favourite` object types. All fields are combined with a logical ‘and.’ */
export type LevelToManyFavouriteFilter = {
  /** Aggregates across related `Favourite` match the filter criteria. */
  aggregates?: FavouriteAggregatesFilter | null | undefined;
  /** Every related `Favourite` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: FavouriteFilter | null | undefined;
  /** No related `Favourite` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: FavouriteFilter | null | undefined;
  /** Some related `Favourite` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: FavouriteFilter | null | undefined;
};

/** A filter to be used against many `LevelItem` object types. All fields are combined with a logical ‘and.’ */
export type LevelToManyLevelItemFilter = {
  /** Aggregates across related `LevelItem` match the filter criteria. */
  aggregates?: LevelItemAggregatesFilter | null | undefined;
  /** Every related `LevelItem` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: LevelItemFilter | null | undefined;
  /** No related `LevelItem` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: LevelItemFilter | null | undefined;
  /** Some related `LevelItem` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: LevelItemFilter | null | undefined;
};

/** A filter to be used against many `LevelMetadatum` object types. All fields are combined with a logical ‘and.’ */
export type LevelToManyLevelMetadatumFilter = {
  /** Aggregates across related `LevelMetadatum` match the filter criteria. */
  aggregates?: LevelMetadatumAggregatesFilter | null | undefined;
  /** Every related `LevelMetadatum` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: LevelMetadatumFilter | null | undefined;
  /** No related `LevelMetadatum` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: LevelMetadatumFilter | null | undefined;
  /** Some related `LevelMetadatum` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: LevelMetadatumFilter | null | undefined;
};

/** A filter to be used against many `LevelPointsHistory` object types. All fields are combined with a logical ‘and.’ */
export type LevelToManyLevelPointsHistoryFilter = {
  /** Aggregates across related `LevelPointsHistory` match the filter criteria. */
  aggregates?: LevelPointsHistoryAggregatesFilter | null | undefined;
  /** Every related `LevelPointsHistory` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: LevelPointsHistoryFilter | null | undefined;
  /** No related `LevelPointsHistory` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: LevelPointsHistoryFilter | null | undefined;
  /** Some related `LevelPointsHistory` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: LevelPointsHistoryFilter | null | undefined;
};

/** A filter to be used against many `PersonalBestGlobal` object types. All fields are combined with a logical ‘and.’ */
export type LevelToManyPersonalBestGlobalFilter = {
  /** Aggregates across related `PersonalBestGlobal` match the filter criteria. */
  aggregates?: PersonalBestGlobalAggregatesFilter | null | undefined;
  /** Every related `PersonalBestGlobal` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: PersonalBestGlobalFilter | null | undefined;
  /** No related `PersonalBestGlobal` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: PersonalBestGlobalFilter | null | undefined;
  /** Some related `PersonalBestGlobal` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: PersonalBestGlobalFilter | null | undefined;
};

/** A filter to be used against many `Record` object types. All fields are combined with a logical ‘and.’ */
export type LevelToManyRecordFilter = {
  /** Aggregates across related `Record` match the filter criteria. */
  aggregates?: RecordAggregatesFilter | null | undefined;
  /** Every related `Record` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: RecordFilter | null | undefined;
  /** No related `Record` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: RecordFilter | null | undefined;
  /** Some related `Record` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: RecordFilter | null | undefined;
};

/** A filter to be used against many `TrackTournament` object types. All fields are combined with a logical ‘and.’ */
export type LevelToManyTrackTournamentFilter = {
  /** Aggregates across related `TrackTournament` match the filter criteria. */
  aggregates?: TrackTournamentAggregatesFilter | null | undefined;
  /** Every related `TrackTournament` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: TrackTournamentFilter | null | undefined;
  /** No related `TrackTournament` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: TrackTournamentFilter | null | undefined;
  /** Some related `TrackTournament` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: TrackTournamentFilter | null | undefined;
};

/** A filter to be used against many `UserPointContribution` object types. All fields are combined with a logical ‘and.’ */
export type LevelToManyUserPointContributionFilter = {
  /** Aggregates across related `UserPointContribution` match the filter criteria. */
  aggregates?: UserPointContributionAggregatesFilter | null | undefined;
  /** Every related `UserPointContribution` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: UserPointContributionFilter | null | undefined;
  /** No related `UserPointContribution` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: UserPointContributionFilter | null | undefined;
  /** Some related `UserPointContribution` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: UserPointContributionFilter | null | undefined;
};

/** A filter to be used against many `Vote` object types. All fields are combined with a logical ‘and.’ */
export type LevelToManyVoteFilter = {
  /** Aggregates across related `Vote` match the filter criteria. */
  aggregates?: VoteAggregatesFilter | null | undefined;
  /** Every related `Vote` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: VoteFilter | null | undefined;
  /** No related `Vote` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: VoteFilter | null | undefined;
  /** Some related `Vote` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: VoteFilter | null | undefined;
};

/** A filter to be used against many `ZslLevel` object types. All fields are combined with a logical ‘and.’ */
export type LevelToManyZslLevelFilter = {
  /** Aggregates across related `ZslLevel` match the filter criteria. */
  aggregates?: ZslLevelAggregatesFilter | null | undefined;
  /** Every related `ZslLevel` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: ZslLevelFilter | null | undefined;
  /** No related `ZslLevel` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: ZslLevelFilter | null | undefined;
  /** Some related `ZslLevel` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: ZslLevelFilter | null | undefined;
};

/** Methods to use when ordering `Level`. */
export type LevelsOrderBy =
  | 'ADVENTURE_ASC'
  | 'ADVENTURE_DESC'
  | 'DATE_CREATED_ASC'
  | 'DATE_CREATED_DESC'
  | 'DATE_UPDATED_ASC'
  | 'DATE_UPDATED_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_COUNT_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_COUNT_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_DATE_CREATED_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_DATE_CREATED_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_KIND_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_KIND_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_OCCURRED_AT_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_OCCURRED_AT_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_PAYLOAD_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_PAYLOAD_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_USER_ID_DESC'
  | 'FAVOURITES_AVERAGE_LEVEL_ID_ASC'
  | 'FAVOURITES_AVERAGE_LEVEL_ID_DESC'
  | 'FAVOURITES_AVERAGE_USER_ID_ASC'
  | 'FAVOURITES_AVERAGE_USER_ID_DESC'
  | 'FAVOURITES_COUNT_ASC'
  | 'FAVOURITES_COUNT_DESC'
  | 'FAVOURITES_DISTINCT_COUNT_DATE_CREATED_ASC'
  | 'FAVOURITES_DISTINCT_COUNT_DATE_CREATED_DESC'
  | 'FAVOURITES_DISTINCT_COUNT_DATE_UPDATED_ASC'
  | 'FAVOURITES_DISTINCT_COUNT_DATE_UPDATED_DESC'
  | 'FAVOURITES_DISTINCT_COUNT_LEVEL_ID_ASC'
  | 'FAVOURITES_DISTINCT_COUNT_LEVEL_ID_DESC'
  | 'FAVOURITES_DISTINCT_COUNT_USER_ID_ASC'
  | 'FAVOURITES_DISTINCT_COUNT_USER_ID_DESC'
  | 'FAVOURITES_MAX_LEVEL_ID_ASC'
  | 'FAVOURITES_MAX_LEVEL_ID_DESC'
  | 'FAVOURITES_MAX_USER_ID_ASC'
  | 'FAVOURITES_MAX_USER_ID_DESC'
  | 'FAVOURITES_MIN_LEVEL_ID_ASC'
  | 'FAVOURITES_MIN_LEVEL_ID_DESC'
  | 'FAVOURITES_MIN_USER_ID_ASC'
  | 'FAVOURITES_MIN_USER_ID_DESC'
  | 'FAVOURITES_STDDEV_POPULATION_LEVEL_ID_ASC'
  | 'FAVOURITES_STDDEV_POPULATION_LEVEL_ID_DESC'
  | 'FAVOURITES_STDDEV_POPULATION_USER_ID_ASC'
  | 'FAVOURITES_STDDEV_POPULATION_USER_ID_DESC'
  | 'FAVOURITES_STDDEV_SAMPLE_LEVEL_ID_ASC'
  | 'FAVOURITES_STDDEV_SAMPLE_LEVEL_ID_DESC'
  | 'FAVOURITES_STDDEV_SAMPLE_USER_ID_ASC'
  | 'FAVOURITES_STDDEV_SAMPLE_USER_ID_DESC'
  | 'FAVOURITES_SUM_LEVEL_ID_ASC'
  | 'FAVOURITES_SUM_LEVEL_ID_DESC'
  | 'FAVOURITES_SUM_USER_ID_ASC'
  | 'FAVOURITES_SUM_USER_ID_DESC'
  | 'FAVOURITES_VARIANCE_POPULATION_LEVEL_ID_ASC'
  | 'FAVOURITES_VARIANCE_POPULATION_LEVEL_ID_DESC'
  | 'FAVOURITES_VARIANCE_POPULATION_USER_ID_ASC'
  | 'FAVOURITES_VARIANCE_POPULATION_USER_ID_DESC'
  | 'FAVOURITES_VARIANCE_SAMPLE_LEVEL_ID_ASC'
  | 'FAVOURITES_VARIANCE_SAMPLE_LEVEL_ID_DESC'
  | 'FAVOURITES_VARIANCE_SAMPLE_USER_ID_ASC'
  | 'FAVOURITES_VARIANCE_SAMPLE_USER_ID_DESC'
  | 'HASH_ASC'
  | 'HASH_DESC'
  | 'ID_ASC'
  | 'ID_DESC'
  | 'LEVEL_ITEMS_AVERAGE_AUTHOR_ID_ASC'
  | 'LEVEL_ITEMS_AVERAGE_AUTHOR_ID_DESC'
  | 'LEVEL_ITEMS_AVERAGE_ID_ASC'
  | 'LEVEL_ITEMS_AVERAGE_ID_DESC'
  | 'LEVEL_ITEMS_AVERAGE_LEVEL_ID_ASC'
  | 'LEVEL_ITEMS_AVERAGE_LEVEL_ID_DESC'
  | 'LEVEL_ITEMS_AVERAGE_VALIDATION_TIME_AUTHOR_ASC'
  | 'LEVEL_ITEMS_AVERAGE_VALIDATION_TIME_AUTHOR_DESC'
  | 'LEVEL_ITEMS_AVERAGE_VALIDATION_TIME_BRONZE_ASC'
  | 'LEVEL_ITEMS_AVERAGE_VALIDATION_TIME_BRONZE_DESC'
  | 'LEVEL_ITEMS_AVERAGE_VALIDATION_TIME_GOLD_ASC'
  | 'LEVEL_ITEMS_AVERAGE_VALIDATION_TIME_GOLD_DESC'
  | 'LEVEL_ITEMS_AVERAGE_VALIDATION_TIME_SILVER_ASC'
  | 'LEVEL_ITEMS_AVERAGE_VALIDATION_TIME_SILVER_DESC'
  | 'LEVEL_ITEMS_AVERAGE_WORKSHOP_ID_ASC'
  | 'LEVEL_ITEMS_AVERAGE_WORKSHOP_ID_DESC'
  | 'LEVEL_ITEMS_COUNT_ASC'
  | 'LEVEL_ITEMS_COUNT_DESC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_AUTHOR_ID_ASC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_AUTHOR_ID_DESC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_CREATED_AT_ASC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_CREATED_AT_DESC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_DATE_CREATED_ASC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_DATE_CREATED_DESC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_DATE_UPDATED_ASC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_DATE_UPDATED_DESC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_DELETED_ASC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_DELETED_DESC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_FILE_AUTHOR_ASC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_FILE_AUTHOR_DESC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_FILE_UID_ASC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_FILE_UID_DESC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_ID_ASC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_ID_DESC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_IMAGE_URL_ASC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_IMAGE_URL_DESC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_LEVEL_ID_ASC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_LEVEL_ID_DESC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_NAME_ASC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_NAME_DESC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_UPDATED_AT_ASC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_UPDATED_AT_DESC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_VALIDATION_TIME_AUTHOR_ASC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_VALIDATION_TIME_AUTHOR_DESC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_VALIDATION_TIME_BRONZE_ASC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_VALIDATION_TIME_BRONZE_DESC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_VALIDATION_TIME_GOLD_ASC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_VALIDATION_TIME_GOLD_DESC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_VALIDATION_TIME_SILVER_ASC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_VALIDATION_TIME_SILVER_DESC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_WORKSHOP_ID_ASC'
  | 'LEVEL_ITEMS_DISTINCT_COUNT_WORKSHOP_ID_DESC'
  | 'LEVEL_ITEMS_MAX_AUTHOR_ID_ASC'
  | 'LEVEL_ITEMS_MAX_AUTHOR_ID_DESC'
  | 'LEVEL_ITEMS_MAX_ID_ASC'
  | 'LEVEL_ITEMS_MAX_ID_DESC'
  | 'LEVEL_ITEMS_MAX_LEVEL_ID_ASC'
  | 'LEVEL_ITEMS_MAX_LEVEL_ID_DESC'
  | 'LEVEL_ITEMS_MAX_VALIDATION_TIME_AUTHOR_ASC'
  | 'LEVEL_ITEMS_MAX_VALIDATION_TIME_AUTHOR_DESC'
  | 'LEVEL_ITEMS_MAX_VALIDATION_TIME_BRONZE_ASC'
  | 'LEVEL_ITEMS_MAX_VALIDATION_TIME_BRONZE_DESC'
  | 'LEVEL_ITEMS_MAX_VALIDATION_TIME_GOLD_ASC'
  | 'LEVEL_ITEMS_MAX_VALIDATION_TIME_GOLD_DESC'
  | 'LEVEL_ITEMS_MAX_VALIDATION_TIME_SILVER_ASC'
  | 'LEVEL_ITEMS_MAX_VALIDATION_TIME_SILVER_DESC'
  | 'LEVEL_ITEMS_MAX_WORKSHOP_ID_ASC'
  | 'LEVEL_ITEMS_MAX_WORKSHOP_ID_DESC'
  | 'LEVEL_ITEMS_MIN_AUTHOR_ID_ASC'
  | 'LEVEL_ITEMS_MIN_AUTHOR_ID_DESC'
  | 'LEVEL_ITEMS_MIN_ID_ASC'
  | 'LEVEL_ITEMS_MIN_ID_DESC'
  | 'LEVEL_ITEMS_MIN_LEVEL_ID_ASC'
  | 'LEVEL_ITEMS_MIN_LEVEL_ID_DESC'
  | 'LEVEL_ITEMS_MIN_VALIDATION_TIME_AUTHOR_ASC'
  | 'LEVEL_ITEMS_MIN_VALIDATION_TIME_AUTHOR_DESC'
  | 'LEVEL_ITEMS_MIN_VALIDATION_TIME_BRONZE_ASC'
  | 'LEVEL_ITEMS_MIN_VALIDATION_TIME_BRONZE_DESC'
  | 'LEVEL_ITEMS_MIN_VALIDATION_TIME_GOLD_ASC'
  | 'LEVEL_ITEMS_MIN_VALIDATION_TIME_GOLD_DESC'
  | 'LEVEL_ITEMS_MIN_VALIDATION_TIME_SILVER_ASC'
  | 'LEVEL_ITEMS_MIN_VALIDATION_TIME_SILVER_DESC'
  | 'LEVEL_ITEMS_MIN_WORKSHOP_ID_ASC'
  | 'LEVEL_ITEMS_MIN_WORKSHOP_ID_DESC'
  | 'LEVEL_ITEMS_STDDEV_POPULATION_AUTHOR_ID_ASC'
  | 'LEVEL_ITEMS_STDDEV_POPULATION_AUTHOR_ID_DESC'
  | 'LEVEL_ITEMS_STDDEV_POPULATION_ID_ASC'
  | 'LEVEL_ITEMS_STDDEV_POPULATION_ID_DESC'
  | 'LEVEL_ITEMS_STDDEV_POPULATION_LEVEL_ID_ASC'
  | 'LEVEL_ITEMS_STDDEV_POPULATION_LEVEL_ID_DESC'
  | 'LEVEL_ITEMS_STDDEV_POPULATION_VALIDATION_TIME_AUTHOR_ASC'
  | 'LEVEL_ITEMS_STDDEV_POPULATION_VALIDATION_TIME_AUTHOR_DESC'
  | 'LEVEL_ITEMS_STDDEV_POPULATION_VALIDATION_TIME_BRONZE_ASC'
  | 'LEVEL_ITEMS_STDDEV_POPULATION_VALIDATION_TIME_BRONZE_DESC'
  | 'LEVEL_ITEMS_STDDEV_POPULATION_VALIDATION_TIME_GOLD_ASC'
  | 'LEVEL_ITEMS_STDDEV_POPULATION_VALIDATION_TIME_GOLD_DESC'
  | 'LEVEL_ITEMS_STDDEV_POPULATION_VALIDATION_TIME_SILVER_ASC'
  | 'LEVEL_ITEMS_STDDEV_POPULATION_VALIDATION_TIME_SILVER_DESC'
  | 'LEVEL_ITEMS_STDDEV_POPULATION_WORKSHOP_ID_ASC'
  | 'LEVEL_ITEMS_STDDEV_POPULATION_WORKSHOP_ID_DESC'
  | 'LEVEL_ITEMS_STDDEV_SAMPLE_AUTHOR_ID_ASC'
  | 'LEVEL_ITEMS_STDDEV_SAMPLE_AUTHOR_ID_DESC'
  | 'LEVEL_ITEMS_STDDEV_SAMPLE_ID_ASC'
  | 'LEVEL_ITEMS_STDDEV_SAMPLE_ID_DESC'
  | 'LEVEL_ITEMS_STDDEV_SAMPLE_LEVEL_ID_ASC'
  | 'LEVEL_ITEMS_STDDEV_SAMPLE_LEVEL_ID_DESC'
  | 'LEVEL_ITEMS_STDDEV_SAMPLE_VALIDATION_TIME_AUTHOR_ASC'
  | 'LEVEL_ITEMS_STDDEV_SAMPLE_VALIDATION_TIME_AUTHOR_DESC'
  | 'LEVEL_ITEMS_STDDEV_SAMPLE_VALIDATION_TIME_BRONZE_ASC'
  | 'LEVEL_ITEMS_STDDEV_SAMPLE_VALIDATION_TIME_BRONZE_DESC'
  | 'LEVEL_ITEMS_STDDEV_SAMPLE_VALIDATION_TIME_GOLD_ASC'
  | 'LEVEL_ITEMS_STDDEV_SAMPLE_VALIDATION_TIME_GOLD_DESC'
  | 'LEVEL_ITEMS_STDDEV_SAMPLE_VALIDATION_TIME_SILVER_ASC'
  | 'LEVEL_ITEMS_STDDEV_SAMPLE_VALIDATION_TIME_SILVER_DESC'
  | 'LEVEL_ITEMS_STDDEV_SAMPLE_WORKSHOP_ID_ASC'
  | 'LEVEL_ITEMS_STDDEV_SAMPLE_WORKSHOP_ID_DESC'
  | 'LEVEL_ITEMS_SUM_AUTHOR_ID_ASC'
  | 'LEVEL_ITEMS_SUM_AUTHOR_ID_DESC'
  | 'LEVEL_ITEMS_SUM_ID_ASC'
  | 'LEVEL_ITEMS_SUM_ID_DESC'
  | 'LEVEL_ITEMS_SUM_LEVEL_ID_ASC'
  | 'LEVEL_ITEMS_SUM_LEVEL_ID_DESC'
  | 'LEVEL_ITEMS_SUM_VALIDATION_TIME_AUTHOR_ASC'
  | 'LEVEL_ITEMS_SUM_VALIDATION_TIME_AUTHOR_DESC'
  | 'LEVEL_ITEMS_SUM_VALIDATION_TIME_BRONZE_ASC'
  | 'LEVEL_ITEMS_SUM_VALIDATION_TIME_BRONZE_DESC'
  | 'LEVEL_ITEMS_SUM_VALIDATION_TIME_GOLD_ASC'
  | 'LEVEL_ITEMS_SUM_VALIDATION_TIME_GOLD_DESC'
  | 'LEVEL_ITEMS_SUM_VALIDATION_TIME_SILVER_ASC'
  | 'LEVEL_ITEMS_SUM_VALIDATION_TIME_SILVER_DESC'
  | 'LEVEL_ITEMS_SUM_WORKSHOP_ID_ASC'
  | 'LEVEL_ITEMS_SUM_WORKSHOP_ID_DESC'
  | 'LEVEL_ITEMS_VARIANCE_POPULATION_AUTHOR_ID_ASC'
  | 'LEVEL_ITEMS_VARIANCE_POPULATION_AUTHOR_ID_DESC'
  | 'LEVEL_ITEMS_VARIANCE_POPULATION_ID_ASC'
  | 'LEVEL_ITEMS_VARIANCE_POPULATION_ID_DESC'
  | 'LEVEL_ITEMS_VARIANCE_POPULATION_LEVEL_ID_ASC'
  | 'LEVEL_ITEMS_VARIANCE_POPULATION_LEVEL_ID_DESC'
  | 'LEVEL_ITEMS_VARIANCE_POPULATION_VALIDATION_TIME_AUTHOR_ASC'
  | 'LEVEL_ITEMS_VARIANCE_POPULATION_VALIDATION_TIME_AUTHOR_DESC'
  | 'LEVEL_ITEMS_VARIANCE_POPULATION_VALIDATION_TIME_BRONZE_ASC'
  | 'LEVEL_ITEMS_VARIANCE_POPULATION_VALIDATION_TIME_BRONZE_DESC'
  | 'LEVEL_ITEMS_VARIANCE_POPULATION_VALIDATION_TIME_GOLD_ASC'
  | 'LEVEL_ITEMS_VARIANCE_POPULATION_VALIDATION_TIME_GOLD_DESC'
  | 'LEVEL_ITEMS_VARIANCE_POPULATION_VALIDATION_TIME_SILVER_ASC'
  | 'LEVEL_ITEMS_VARIANCE_POPULATION_VALIDATION_TIME_SILVER_DESC'
  | 'LEVEL_ITEMS_VARIANCE_POPULATION_WORKSHOP_ID_ASC'
  | 'LEVEL_ITEMS_VARIANCE_POPULATION_WORKSHOP_ID_DESC'
  | 'LEVEL_ITEMS_VARIANCE_SAMPLE_AUTHOR_ID_ASC'
  | 'LEVEL_ITEMS_VARIANCE_SAMPLE_AUTHOR_ID_DESC'
  | 'LEVEL_ITEMS_VARIANCE_SAMPLE_ID_ASC'
  | 'LEVEL_ITEMS_VARIANCE_SAMPLE_ID_DESC'
  | 'LEVEL_ITEMS_VARIANCE_SAMPLE_LEVEL_ID_ASC'
  | 'LEVEL_ITEMS_VARIANCE_SAMPLE_LEVEL_ID_DESC'
  | 'LEVEL_ITEMS_VARIANCE_SAMPLE_VALIDATION_TIME_AUTHOR_ASC'
  | 'LEVEL_ITEMS_VARIANCE_SAMPLE_VALIDATION_TIME_AUTHOR_DESC'
  | 'LEVEL_ITEMS_VARIANCE_SAMPLE_VALIDATION_TIME_BRONZE_ASC'
  | 'LEVEL_ITEMS_VARIANCE_SAMPLE_VALIDATION_TIME_BRONZE_DESC'
  | 'LEVEL_ITEMS_VARIANCE_SAMPLE_VALIDATION_TIME_GOLD_ASC'
  | 'LEVEL_ITEMS_VARIANCE_SAMPLE_VALIDATION_TIME_GOLD_DESC'
  | 'LEVEL_ITEMS_VARIANCE_SAMPLE_VALIDATION_TIME_SILVER_ASC'
  | 'LEVEL_ITEMS_VARIANCE_SAMPLE_VALIDATION_TIME_SILVER_DESC'
  | 'LEVEL_ITEMS_VARIANCE_SAMPLE_WORKSHOP_ID_ASC'
  | 'LEVEL_ITEMS_VARIANCE_SAMPLE_WORKSHOP_ID_DESC'
  | 'LEVEL_METADATA_AVERAGE_AMOUNT_BLOCKS_ASC'
  | 'LEVEL_METADATA_AVERAGE_AMOUNT_BLOCKS_DESC'
  | 'LEVEL_METADATA_AVERAGE_AMOUNT_CHECKPOINTS_ASC'
  | 'LEVEL_METADATA_AVERAGE_AMOUNT_CHECKPOINTS_DESC'
  | 'LEVEL_METADATA_AVERAGE_AMOUNT_FINISHES_ASC'
  | 'LEVEL_METADATA_AVERAGE_AMOUNT_FINISHES_DESC'
  | 'LEVEL_METADATA_AVERAGE_FORMAT_ASC'
  | 'LEVEL_METADATA_AVERAGE_FORMAT_DESC'
  | 'LEVEL_METADATA_AVERAGE_ID_ASC'
  | 'LEVEL_METADATA_AVERAGE_ID_DESC'
  | 'LEVEL_METADATA_AVERAGE_LEVEL_ID_ASC'
  | 'LEVEL_METADATA_AVERAGE_LEVEL_ID_DESC'
  | 'LEVEL_METADATA_AVERAGE_TYPE_GROUND_ASC'
  | 'LEVEL_METADATA_AVERAGE_TYPE_GROUND_DESC'
  | 'LEVEL_METADATA_AVERAGE_TYPE_SKYBOX_ASC'
  | 'LEVEL_METADATA_AVERAGE_TYPE_SKYBOX_DESC'
  | 'LEVEL_METADATA_COUNT_ASC'
  | 'LEVEL_METADATA_COUNT_DESC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_AMOUNT_BLOCKS_ASC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_AMOUNT_BLOCKS_DESC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_AMOUNT_CHECKPOINTS_ASC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_AMOUNT_CHECKPOINTS_DESC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_AMOUNT_FINISHES_ASC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_AMOUNT_FINISHES_DESC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_BLOCKS_ASC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_BLOCKS_DESC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_DATE_CREATED_ASC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_DATE_CREATED_DESC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_DATE_UPDATED_ASC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_DATE_UPDATED_DESC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_FORMAT_ASC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_FORMAT_DESC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_ID_ASC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_ID_DESC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_LEVEL_ID_ASC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_LEVEL_ID_DESC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_TYPE_GROUND_ASC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_TYPE_GROUND_DESC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_TYPE_SKYBOX_ASC'
  | 'LEVEL_METADATA_DISTINCT_COUNT_TYPE_SKYBOX_DESC'
  | 'LEVEL_METADATA_MAX_AMOUNT_BLOCKS_ASC'
  | 'LEVEL_METADATA_MAX_AMOUNT_BLOCKS_DESC'
  | 'LEVEL_METADATA_MAX_AMOUNT_CHECKPOINTS_ASC'
  | 'LEVEL_METADATA_MAX_AMOUNT_CHECKPOINTS_DESC'
  | 'LEVEL_METADATA_MAX_AMOUNT_FINISHES_ASC'
  | 'LEVEL_METADATA_MAX_AMOUNT_FINISHES_DESC'
  | 'LEVEL_METADATA_MAX_FORMAT_ASC'
  | 'LEVEL_METADATA_MAX_FORMAT_DESC'
  | 'LEVEL_METADATA_MAX_ID_ASC'
  | 'LEVEL_METADATA_MAX_ID_DESC'
  | 'LEVEL_METADATA_MAX_LEVEL_ID_ASC'
  | 'LEVEL_METADATA_MAX_LEVEL_ID_DESC'
  | 'LEVEL_METADATA_MAX_TYPE_GROUND_ASC'
  | 'LEVEL_METADATA_MAX_TYPE_GROUND_DESC'
  | 'LEVEL_METADATA_MAX_TYPE_SKYBOX_ASC'
  | 'LEVEL_METADATA_MAX_TYPE_SKYBOX_DESC'
  | 'LEVEL_METADATA_MIN_AMOUNT_BLOCKS_ASC'
  | 'LEVEL_METADATA_MIN_AMOUNT_BLOCKS_DESC'
  | 'LEVEL_METADATA_MIN_AMOUNT_CHECKPOINTS_ASC'
  | 'LEVEL_METADATA_MIN_AMOUNT_CHECKPOINTS_DESC'
  | 'LEVEL_METADATA_MIN_AMOUNT_FINISHES_ASC'
  | 'LEVEL_METADATA_MIN_AMOUNT_FINISHES_DESC'
  | 'LEVEL_METADATA_MIN_FORMAT_ASC'
  | 'LEVEL_METADATA_MIN_FORMAT_DESC'
  | 'LEVEL_METADATA_MIN_ID_ASC'
  | 'LEVEL_METADATA_MIN_ID_DESC'
  | 'LEVEL_METADATA_MIN_LEVEL_ID_ASC'
  | 'LEVEL_METADATA_MIN_LEVEL_ID_DESC'
  | 'LEVEL_METADATA_MIN_TYPE_GROUND_ASC'
  | 'LEVEL_METADATA_MIN_TYPE_GROUND_DESC'
  | 'LEVEL_METADATA_MIN_TYPE_SKYBOX_ASC'
  | 'LEVEL_METADATA_MIN_TYPE_SKYBOX_DESC'
  | 'LEVEL_METADATA_STDDEV_POPULATION_AMOUNT_BLOCKS_ASC'
  | 'LEVEL_METADATA_STDDEV_POPULATION_AMOUNT_BLOCKS_DESC'
  | 'LEVEL_METADATA_STDDEV_POPULATION_AMOUNT_CHECKPOINTS_ASC'
  | 'LEVEL_METADATA_STDDEV_POPULATION_AMOUNT_CHECKPOINTS_DESC'
  | 'LEVEL_METADATA_STDDEV_POPULATION_AMOUNT_FINISHES_ASC'
  | 'LEVEL_METADATA_STDDEV_POPULATION_AMOUNT_FINISHES_DESC'
  | 'LEVEL_METADATA_STDDEV_POPULATION_FORMAT_ASC'
  | 'LEVEL_METADATA_STDDEV_POPULATION_FORMAT_DESC'
  | 'LEVEL_METADATA_STDDEV_POPULATION_ID_ASC'
  | 'LEVEL_METADATA_STDDEV_POPULATION_ID_DESC'
  | 'LEVEL_METADATA_STDDEV_POPULATION_LEVEL_ID_ASC'
  | 'LEVEL_METADATA_STDDEV_POPULATION_LEVEL_ID_DESC'
  | 'LEVEL_METADATA_STDDEV_POPULATION_TYPE_GROUND_ASC'
  | 'LEVEL_METADATA_STDDEV_POPULATION_TYPE_GROUND_DESC'
  | 'LEVEL_METADATA_STDDEV_POPULATION_TYPE_SKYBOX_ASC'
  | 'LEVEL_METADATA_STDDEV_POPULATION_TYPE_SKYBOX_DESC'
  | 'LEVEL_METADATA_STDDEV_SAMPLE_AMOUNT_BLOCKS_ASC'
  | 'LEVEL_METADATA_STDDEV_SAMPLE_AMOUNT_BLOCKS_DESC'
  | 'LEVEL_METADATA_STDDEV_SAMPLE_AMOUNT_CHECKPOINTS_ASC'
  | 'LEVEL_METADATA_STDDEV_SAMPLE_AMOUNT_CHECKPOINTS_DESC'
  | 'LEVEL_METADATA_STDDEV_SAMPLE_AMOUNT_FINISHES_ASC'
  | 'LEVEL_METADATA_STDDEV_SAMPLE_AMOUNT_FINISHES_DESC'
  | 'LEVEL_METADATA_STDDEV_SAMPLE_FORMAT_ASC'
  | 'LEVEL_METADATA_STDDEV_SAMPLE_FORMAT_DESC'
  | 'LEVEL_METADATA_STDDEV_SAMPLE_ID_ASC'
  | 'LEVEL_METADATA_STDDEV_SAMPLE_ID_DESC'
  | 'LEVEL_METADATA_STDDEV_SAMPLE_LEVEL_ID_ASC'
  | 'LEVEL_METADATA_STDDEV_SAMPLE_LEVEL_ID_DESC'
  | 'LEVEL_METADATA_STDDEV_SAMPLE_TYPE_GROUND_ASC'
  | 'LEVEL_METADATA_STDDEV_SAMPLE_TYPE_GROUND_DESC'
  | 'LEVEL_METADATA_STDDEV_SAMPLE_TYPE_SKYBOX_ASC'
  | 'LEVEL_METADATA_STDDEV_SAMPLE_TYPE_SKYBOX_DESC'
  | 'LEVEL_METADATA_SUM_AMOUNT_BLOCKS_ASC'
  | 'LEVEL_METADATA_SUM_AMOUNT_BLOCKS_DESC'
  | 'LEVEL_METADATA_SUM_AMOUNT_CHECKPOINTS_ASC'
  | 'LEVEL_METADATA_SUM_AMOUNT_CHECKPOINTS_DESC'
  | 'LEVEL_METADATA_SUM_AMOUNT_FINISHES_ASC'
  | 'LEVEL_METADATA_SUM_AMOUNT_FINISHES_DESC'
  | 'LEVEL_METADATA_SUM_FORMAT_ASC'
  | 'LEVEL_METADATA_SUM_FORMAT_DESC'
  | 'LEVEL_METADATA_SUM_ID_ASC'
  | 'LEVEL_METADATA_SUM_ID_DESC'
  | 'LEVEL_METADATA_SUM_LEVEL_ID_ASC'
  | 'LEVEL_METADATA_SUM_LEVEL_ID_DESC'
  | 'LEVEL_METADATA_SUM_TYPE_GROUND_ASC'
  | 'LEVEL_METADATA_SUM_TYPE_GROUND_DESC'
  | 'LEVEL_METADATA_SUM_TYPE_SKYBOX_ASC'
  | 'LEVEL_METADATA_SUM_TYPE_SKYBOX_DESC'
  | 'LEVEL_METADATA_VARIANCE_POPULATION_AMOUNT_BLOCKS_ASC'
  | 'LEVEL_METADATA_VARIANCE_POPULATION_AMOUNT_BLOCKS_DESC'
  | 'LEVEL_METADATA_VARIANCE_POPULATION_AMOUNT_CHECKPOINTS_ASC'
  | 'LEVEL_METADATA_VARIANCE_POPULATION_AMOUNT_CHECKPOINTS_DESC'
  | 'LEVEL_METADATA_VARIANCE_POPULATION_AMOUNT_FINISHES_ASC'
  | 'LEVEL_METADATA_VARIANCE_POPULATION_AMOUNT_FINISHES_DESC'
  | 'LEVEL_METADATA_VARIANCE_POPULATION_FORMAT_ASC'
  | 'LEVEL_METADATA_VARIANCE_POPULATION_FORMAT_DESC'
  | 'LEVEL_METADATA_VARIANCE_POPULATION_ID_ASC'
  | 'LEVEL_METADATA_VARIANCE_POPULATION_ID_DESC'
  | 'LEVEL_METADATA_VARIANCE_POPULATION_LEVEL_ID_ASC'
  | 'LEVEL_METADATA_VARIANCE_POPULATION_LEVEL_ID_DESC'
  | 'LEVEL_METADATA_VARIANCE_POPULATION_TYPE_GROUND_ASC'
  | 'LEVEL_METADATA_VARIANCE_POPULATION_TYPE_GROUND_DESC'
  | 'LEVEL_METADATA_VARIANCE_POPULATION_TYPE_SKYBOX_ASC'
  | 'LEVEL_METADATA_VARIANCE_POPULATION_TYPE_SKYBOX_DESC'
  | 'LEVEL_METADATA_VARIANCE_SAMPLE_AMOUNT_BLOCKS_ASC'
  | 'LEVEL_METADATA_VARIANCE_SAMPLE_AMOUNT_BLOCKS_DESC'
  | 'LEVEL_METADATA_VARIANCE_SAMPLE_AMOUNT_CHECKPOINTS_ASC'
  | 'LEVEL_METADATA_VARIANCE_SAMPLE_AMOUNT_CHECKPOINTS_DESC'
  | 'LEVEL_METADATA_VARIANCE_SAMPLE_AMOUNT_FINISHES_ASC'
  | 'LEVEL_METADATA_VARIANCE_SAMPLE_AMOUNT_FINISHES_DESC'
  | 'LEVEL_METADATA_VARIANCE_SAMPLE_FORMAT_ASC'
  | 'LEVEL_METADATA_VARIANCE_SAMPLE_FORMAT_DESC'
  | 'LEVEL_METADATA_VARIANCE_SAMPLE_ID_ASC'
  | 'LEVEL_METADATA_VARIANCE_SAMPLE_ID_DESC'
  | 'LEVEL_METADATA_VARIANCE_SAMPLE_LEVEL_ID_ASC'
  | 'LEVEL_METADATA_VARIANCE_SAMPLE_LEVEL_ID_DESC'
  | 'LEVEL_METADATA_VARIANCE_SAMPLE_TYPE_GROUND_ASC'
  | 'LEVEL_METADATA_VARIANCE_SAMPLE_TYPE_GROUND_DESC'
  | 'LEVEL_METADATA_VARIANCE_SAMPLE_TYPE_SKYBOX_ASC'
  | 'LEVEL_METADATA_VARIANCE_SAMPLE_TYPE_SKYBOX_DESC'
  | 'LEVEL_POINTS_COMPLEXITY_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_COMPLEXITY_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_COMPLEXITY_SCORE_ASC'
  | 'LEVEL_POINTS_COMPLEXITY_SCORE_DESC'
  | 'LEVEL_POINTS_DATE_CREATED_ASC'
  | 'LEVEL_POINTS_DATE_CREATED_DESC'
  | 'LEVEL_POINTS_DATE_UPDATED_ASC'
  | 'LEVEL_POINTS_DATE_UPDATED_DESC'
  | 'LEVEL_POINTS_FIELD_STRENGTH_ASC'
  | 'LEVEL_POINTS_FIELD_STRENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_COMPLEXITY_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_COMPLEXITY_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_COMPLEXITY_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_COMPLEXITY_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_FIELD_STRENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_FIELD_STRENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_LEVEL_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_LEVEL_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_MODIFIER_EVIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_MODIFIER_EVIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_MODIFIER_QUALITY_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_MODIFIER_QUALITY_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_POINTS_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_POINTS_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_QUALITY_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_QUALITY_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_SKILL_ALIGNMENT_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_SKILL_ALIGNMENT_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_SKILL_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_SKILL_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_SKILL_SAMPLE_SIZE_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_SKILL_SAMPLE_SIZE_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_SKILL_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_SKILL_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_SKILL_SEPARATION_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_SKILL_SEPARATION_DESC'
  | 'LEVEL_POINTS_HISTORIES_COUNT_ASC'
  | 'LEVEL_POINTS_HISTORIES_COUNT_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_COMPLEXITY_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_COMPLEXITY_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_COMPLEXITY_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_COMPLEXITY_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_DATE_CREATED_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_DATE_CREATED_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_DATE_UPDATED_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_DATE_UPDATED_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_FIELD_STRENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_FIELD_STRENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_LEVEL_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_LEVEL_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_MODIFIER_EVIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_MODIFIER_EVIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_MODIFIER_QUALITY_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_MODIFIER_QUALITY_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_POINTS_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_POINTS_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_QUALITY_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_QUALITY_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_SKILL_ALIGNMENT_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_SKILL_ALIGNMENT_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_SKILL_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_SKILL_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_SKILL_SAMPLE_SIZE_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_SKILL_SAMPLE_SIZE_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_SKILL_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_SKILL_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_SKILL_SEPARATION_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_SKILL_SEPARATION_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_COMPLEXITY_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_COMPLEXITY_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_COMPLEXITY_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_COMPLEXITY_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_FIELD_STRENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_FIELD_STRENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_LEVEL_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_LEVEL_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_MODIFIER_EVIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_MODIFIER_EVIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_MODIFIER_QUALITY_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_MODIFIER_QUALITY_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_POINTS_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_POINTS_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_QUALITY_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_QUALITY_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_SKILL_ALIGNMENT_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_SKILL_ALIGNMENT_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_SKILL_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_SKILL_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_SKILL_SAMPLE_SIZE_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_SKILL_SAMPLE_SIZE_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_SKILL_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_SKILL_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_SKILL_SEPARATION_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_SKILL_SEPARATION_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_COMPLEXITY_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_COMPLEXITY_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_COMPLEXITY_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_COMPLEXITY_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_FIELD_STRENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_FIELD_STRENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_LEVEL_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_LEVEL_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_MODIFIER_EVIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_MODIFIER_EVIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_MODIFIER_QUALITY_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_MODIFIER_QUALITY_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_POINTS_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_POINTS_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_QUALITY_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_QUALITY_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_SKILL_ALIGNMENT_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_SKILL_ALIGNMENT_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_SKILL_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_SKILL_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_SKILL_SAMPLE_SIZE_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_SKILL_SAMPLE_SIZE_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_SKILL_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_SKILL_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_SKILL_SEPARATION_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_SKILL_SEPARATION_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_COMPLEXITY_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_COMPLEXITY_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_COMPLEXITY_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_COMPLEXITY_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_FIELD_STRENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_FIELD_STRENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_LEVEL_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_LEVEL_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_MODIFIER_EVIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_MODIFIER_EVIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_MODIFIER_QUALITY_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_MODIFIER_QUALITY_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_POINTS_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_POINTS_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_QUALITY_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_QUALITY_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_SKILL_ALIGNMENT_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_SKILL_ALIGNMENT_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_SKILL_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_SKILL_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_SKILL_SAMPLE_SIZE_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_SKILL_SAMPLE_SIZE_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_SKILL_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_SKILL_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_SKILL_SEPARATION_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_SKILL_SEPARATION_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_COMPLEXITY_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_COMPLEXITY_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_COMPLEXITY_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_COMPLEXITY_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_FIELD_STRENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_FIELD_STRENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_LEVEL_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_LEVEL_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_MODIFIER_EVIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_MODIFIER_EVIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_MODIFIER_QUALITY_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_MODIFIER_QUALITY_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_POINTS_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_POINTS_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_QUALITY_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_QUALITY_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_SKILL_ALIGNMENT_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_SKILL_ALIGNMENT_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_SKILL_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_SKILL_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_SKILL_SAMPLE_SIZE_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_SKILL_SAMPLE_SIZE_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_SKILL_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_SKILL_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_SKILL_SEPARATION_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_SKILL_SEPARATION_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_COMPLEXITY_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_COMPLEXITY_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_COMPLEXITY_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_COMPLEXITY_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_FIELD_STRENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_FIELD_STRENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_LEVEL_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_LEVEL_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_MODIFIER_EVIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_MODIFIER_EVIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_MODIFIER_QUALITY_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_MODIFIER_QUALITY_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_POINTS_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_POINTS_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_QUALITY_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_QUALITY_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_SKILL_ALIGNMENT_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_SKILL_ALIGNMENT_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_SKILL_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_SKILL_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_SKILL_SAMPLE_SIZE_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_SKILL_SAMPLE_SIZE_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_SKILL_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_SKILL_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_SKILL_SEPARATION_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_SKILL_SEPARATION_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_COMPLEXITY_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_COMPLEXITY_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_COMPLEXITY_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_COMPLEXITY_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_FIELD_STRENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_FIELD_STRENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_LEVEL_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_LEVEL_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_MODIFIER_EVIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_MODIFIER_EVIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_MODIFIER_QUALITY_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_MODIFIER_QUALITY_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_POINTS_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_POINTS_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_QUALITY_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_QUALITY_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_SKILL_ALIGNMENT_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_SKILL_ALIGNMENT_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_SKILL_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_SKILL_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_SKILL_SAMPLE_SIZE_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_SKILL_SAMPLE_SIZE_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_SKILL_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_SKILL_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_SKILL_SEPARATION_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_SKILL_SEPARATION_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_COMPLEXITY_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_COMPLEXITY_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_COMPLEXITY_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_COMPLEXITY_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_FIELD_STRENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_FIELD_STRENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_LEVEL_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_LEVEL_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_MODIFIER_EVIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_MODIFIER_EVIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_MODIFIER_QUALITY_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_MODIFIER_QUALITY_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_POINTS_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_POINTS_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_QUALITY_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_QUALITY_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_SKILL_ALIGNMENT_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_SKILL_ALIGNMENT_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_SKILL_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_SKILL_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_SKILL_SAMPLE_SIZE_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_SKILL_SAMPLE_SIZE_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_SKILL_SCORE_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_SKILL_SCORE_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_SKILL_SEPARATION_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_SKILL_SEPARATION_DESC'
  | 'LEVEL_POINTS_ID_LEVEL_ASC'
  | 'LEVEL_POINTS_ID_LEVEL_DESC'
  | 'LEVEL_POINTS_MODIFIER_EVIDENCE_ASC'
  | 'LEVEL_POINTS_MODIFIER_EVIDENCE_DESC'
  | 'LEVEL_POINTS_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_MODIFIER_QUALITY_ASC'
  | 'LEVEL_POINTS_MODIFIER_QUALITY_DESC'
  | 'LEVEL_POINTS_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_POINTS_ASC'
  | 'LEVEL_POINTS_POINTS_DESC'
  | 'LEVEL_POINTS_QUALITY_SCORE_ASC'
  | 'LEVEL_POINTS_QUALITY_SCORE_DESC'
  | 'LEVEL_POINTS_RATING_ASC'
  | 'LEVEL_POINTS_RATING_DESC'
  | 'LEVEL_POINTS_SKILL_ALIGNMENT_ASC'
  | 'LEVEL_POINTS_SKILL_ALIGNMENT_DESC'
  | 'LEVEL_POINTS_SKILL_CONFIDENCE_ASC'
  | 'LEVEL_POINTS_SKILL_CONFIDENCE_DESC'
  | 'LEVEL_POINTS_SKILL_SAMPLE_SIZE_ASC'
  | 'LEVEL_POINTS_SKILL_SAMPLE_SIZE_DESC'
  | 'LEVEL_POINTS_SKILL_SCORE_ASC'
  | 'LEVEL_POINTS_SKILL_SCORE_DESC'
  | 'LEVEL_POINTS_SKILL_SEPARATION_ASC'
  | 'LEVEL_POINTS_SKILL_SEPARATION_DESC'
  | 'NATURAL'
  | 'PERSONAL_BEST_GLOBALS_AVERAGE_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_AVERAGE_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_AVERAGE_LEVEL_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_AVERAGE_LEVEL_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_AVERAGE_RECORD_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_AVERAGE_RECORD_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_AVERAGE_USER_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_AVERAGE_USER_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_COUNT_ASC'
  | 'PERSONAL_BEST_GLOBALS_COUNT_DESC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_DATE_CREATED_ASC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_DATE_CREATED_DESC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_DATE_UPDATED_ASC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_DATE_UPDATED_DESC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_LEVEL_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_LEVEL_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_RECORD_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_RECORD_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_USER_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_USER_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_MAX_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_MAX_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_MAX_LEVEL_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_MAX_LEVEL_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_MAX_RECORD_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_MAX_RECORD_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_MAX_USER_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_MAX_USER_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_MIN_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_MIN_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_MIN_LEVEL_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_MIN_LEVEL_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_MIN_RECORD_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_MIN_RECORD_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_MIN_USER_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_MIN_USER_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_POPULATION_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_POPULATION_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_POPULATION_LEVEL_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_POPULATION_LEVEL_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_POPULATION_RECORD_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_POPULATION_RECORD_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_POPULATION_USER_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_POPULATION_USER_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_SAMPLE_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_SAMPLE_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_SAMPLE_LEVEL_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_SAMPLE_LEVEL_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_SAMPLE_RECORD_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_SAMPLE_RECORD_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_SAMPLE_USER_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_SAMPLE_USER_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_SUM_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_SUM_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_SUM_LEVEL_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_SUM_LEVEL_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_SUM_RECORD_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_SUM_RECORD_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_SUM_USER_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_SUM_USER_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_POPULATION_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_POPULATION_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_POPULATION_LEVEL_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_POPULATION_LEVEL_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_POPULATION_RECORD_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_POPULATION_RECORD_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_POPULATION_USER_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_POPULATION_USER_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_SAMPLE_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_SAMPLE_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_SAMPLE_LEVEL_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_SAMPLE_LEVEL_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_SAMPLE_RECORD_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_SAMPLE_RECORD_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_SAMPLE_USER_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_SAMPLE_USER_ID_DESC'
  | 'PRIMARY_KEY_ASC'
  | 'PRIMARY_KEY_DESC'
  | 'PUBLICLY_VISIBLE_ASC'
  | 'PUBLICLY_VISIBLE_DESC'
  | 'RECORDS_AVERAGE_ID_ASC'
  | 'RECORDS_AVERAGE_ID_DESC'
  | 'RECORDS_AVERAGE_LEVEL_ID_ASC'
  | 'RECORDS_AVERAGE_LEVEL_ID_DESC'
  | 'RECORDS_AVERAGE_TIME_ASC'
  | 'RECORDS_AVERAGE_TIME_DESC'
  | 'RECORDS_AVERAGE_USER_ID_ASC'
  | 'RECORDS_AVERAGE_USER_ID_DESC'
  | 'RECORDS_COUNT_ASC'
  | 'RECORDS_COUNT_DESC'
  | 'RECORDS_DISTINCT_COUNT_DATE_CREATED_ASC'
  | 'RECORDS_DISTINCT_COUNT_DATE_CREATED_DESC'
  | 'RECORDS_DISTINCT_COUNT_DATE_UPDATED_ASC'
  | 'RECORDS_DISTINCT_COUNT_DATE_UPDATED_DESC'
  | 'RECORDS_DISTINCT_COUNT_GAME_VERSION_ASC'
  | 'RECORDS_DISTINCT_COUNT_GAME_VERSION_DESC'
  | 'RECORDS_DISTINCT_COUNT_ID_ASC'
  | 'RECORDS_DISTINCT_COUNT_ID_DESC'
  | 'RECORDS_DISTINCT_COUNT_LEVEL_ID_ASC'
  | 'RECORDS_DISTINCT_COUNT_LEVEL_ID_DESC'
  | 'RECORDS_DISTINCT_COUNT_MOD_VERSION_ASC'
  | 'RECORDS_DISTINCT_COUNT_MOD_VERSION_DESC'
  | 'RECORDS_DISTINCT_COUNT_SPEEDS_ASC'
  | 'RECORDS_DISTINCT_COUNT_SPEEDS_DESC'
  | 'RECORDS_DISTINCT_COUNT_SPLITS_ASC'
  | 'RECORDS_DISTINCT_COUNT_SPLITS_DESC'
  | 'RECORDS_DISTINCT_COUNT_TIME_ASC'
  | 'RECORDS_DISTINCT_COUNT_TIME_DESC'
  | 'RECORDS_DISTINCT_COUNT_USER_ID_ASC'
  | 'RECORDS_DISTINCT_COUNT_USER_ID_DESC'
  | 'RECORDS_MAX_ID_ASC'
  | 'RECORDS_MAX_ID_DESC'
  | 'RECORDS_MAX_LEVEL_ID_ASC'
  | 'RECORDS_MAX_LEVEL_ID_DESC'
  | 'RECORDS_MAX_TIME_ASC'
  | 'RECORDS_MAX_TIME_DESC'
  | 'RECORDS_MAX_USER_ID_ASC'
  | 'RECORDS_MAX_USER_ID_DESC'
  | 'RECORDS_MIN_ID_ASC'
  | 'RECORDS_MIN_ID_DESC'
  | 'RECORDS_MIN_LEVEL_ID_ASC'
  | 'RECORDS_MIN_LEVEL_ID_DESC'
  | 'RECORDS_MIN_TIME_ASC'
  | 'RECORDS_MIN_TIME_DESC'
  | 'RECORDS_MIN_USER_ID_ASC'
  | 'RECORDS_MIN_USER_ID_DESC'
  | 'RECORDS_STDDEV_POPULATION_ID_ASC'
  | 'RECORDS_STDDEV_POPULATION_ID_DESC'
  | 'RECORDS_STDDEV_POPULATION_LEVEL_ID_ASC'
  | 'RECORDS_STDDEV_POPULATION_LEVEL_ID_DESC'
  | 'RECORDS_STDDEV_POPULATION_TIME_ASC'
  | 'RECORDS_STDDEV_POPULATION_TIME_DESC'
  | 'RECORDS_STDDEV_POPULATION_USER_ID_ASC'
  | 'RECORDS_STDDEV_POPULATION_USER_ID_DESC'
  | 'RECORDS_STDDEV_SAMPLE_ID_ASC'
  | 'RECORDS_STDDEV_SAMPLE_ID_DESC'
  | 'RECORDS_STDDEV_SAMPLE_LEVEL_ID_ASC'
  | 'RECORDS_STDDEV_SAMPLE_LEVEL_ID_DESC'
  | 'RECORDS_STDDEV_SAMPLE_TIME_ASC'
  | 'RECORDS_STDDEV_SAMPLE_TIME_DESC'
  | 'RECORDS_STDDEV_SAMPLE_USER_ID_ASC'
  | 'RECORDS_STDDEV_SAMPLE_USER_ID_DESC'
  | 'RECORDS_SUM_ID_ASC'
  | 'RECORDS_SUM_ID_DESC'
  | 'RECORDS_SUM_LEVEL_ID_ASC'
  | 'RECORDS_SUM_LEVEL_ID_DESC'
  | 'RECORDS_SUM_TIME_ASC'
  | 'RECORDS_SUM_TIME_DESC'
  | 'RECORDS_SUM_USER_ID_ASC'
  | 'RECORDS_SUM_USER_ID_DESC'
  | 'RECORDS_VARIANCE_POPULATION_ID_ASC'
  | 'RECORDS_VARIANCE_POPULATION_ID_DESC'
  | 'RECORDS_VARIANCE_POPULATION_LEVEL_ID_ASC'
  | 'RECORDS_VARIANCE_POPULATION_LEVEL_ID_DESC'
  | 'RECORDS_VARIANCE_POPULATION_TIME_ASC'
  | 'RECORDS_VARIANCE_POPULATION_TIME_DESC'
  | 'RECORDS_VARIANCE_POPULATION_USER_ID_ASC'
  | 'RECORDS_VARIANCE_POPULATION_USER_ID_DESC'
  | 'RECORDS_VARIANCE_SAMPLE_ID_ASC'
  | 'RECORDS_VARIANCE_SAMPLE_ID_DESC'
  | 'RECORDS_VARIANCE_SAMPLE_LEVEL_ID_ASC'
  | 'RECORDS_VARIANCE_SAMPLE_LEVEL_ID_DESC'
  | 'RECORDS_VARIANCE_SAMPLE_TIME_ASC'
  | 'RECORDS_VARIANCE_SAMPLE_TIME_DESC'
  | 'RECORDS_VARIANCE_SAMPLE_USER_ID_ASC'
  | 'RECORDS_VARIANCE_SAMPLE_USER_ID_DESC'
  | 'TRACK_TOURNAMENTS_AVERAGE_ID_ASC'
  | 'TRACK_TOURNAMENTS_AVERAGE_ID_DESC'
  | 'TRACK_TOURNAMENTS_AVERAGE_LEVEL_ID_ASC'
  | 'TRACK_TOURNAMENTS_AVERAGE_LEVEL_ID_DESC'
  | 'TRACK_TOURNAMENTS_AVERAGE_POINTS_VERSION_ASC'
  | 'TRACK_TOURNAMENTS_AVERAGE_POINTS_VERSION_DESC'
  | 'TRACK_TOURNAMENTS_AVERAGE_TYPE_ASC'
  | 'TRACK_TOURNAMENTS_AVERAGE_TYPE_DESC'
  | 'TRACK_TOURNAMENTS_COUNT_ASC'
  | 'TRACK_TOURNAMENTS_COUNT_DESC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_DATE_CREATED_ASC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_DATE_CREATED_DESC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_DATE_UPDATED_ASC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_DATE_UPDATED_DESC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_END_AT_ASC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_END_AT_DESC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_FINALIZED_AT_ASC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_FINALIZED_AT_DESC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_ID_ASC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_ID_DESC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_LEVEL_ID_ASC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_LEVEL_ID_DESC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_POINTS_VERSION_ASC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_POINTS_VERSION_DESC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_SLUG_ASC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_SLUG_DESC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_START_AT_ASC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_START_AT_DESC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_TYPE_ASC'
  | 'TRACK_TOURNAMENTS_DISTINCT_COUNT_TYPE_DESC'
  | 'TRACK_TOURNAMENTS_MAX_ID_ASC'
  | 'TRACK_TOURNAMENTS_MAX_ID_DESC'
  | 'TRACK_TOURNAMENTS_MAX_LEVEL_ID_ASC'
  | 'TRACK_TOURNAMENTS_MAX_LEVEL_ID_DESC'
  | 'TRACK_TOURNAMENTS_MAX_POINTS_VERSION_ASC'
  | 'TRACK_TOURNAMENTS_MAX_POINTS_VERSION_DESC'
  | 'TRACK_TOURNAMENTS_MAX_TYPE_ASC'
  | 'TRACK_TOURNAMENTS_MAX_TYPE_DESC'
  | 'TRACK_TOURNAMENTS_MIN_ID_ASC'
  | 'TRACK_TOURNAMENTS_MIN_ID_DESC'
  | 'TRACK_TOURNAMENTS_MIN_LEVEL_ID_ASC'
  | 'TRACK_TOURNAMENTS_MIN_LEVEL_ID_DESC'
  | 'TRACK_TOURNAMENTS_MIN_POINTS_VERSION_ASC'
  | 'TRACK_TOURNAMENTS_MIN_POINTS_VERSION_DESC'
  | 'TRACK_TOURNAMENTS_MIN_TYPE_ASC'
  | 'TRACK_TOURNAMENTS_MIN_TYPE_DESC'
  | 'TRACK_TOURNAMENTS_STDDEV_POPULATION_ID_ASC'
  | 'TRACK_TOURNAMENTS_STDDEV_POPULATION_ID_DESC'
  | 'TRACK_TOURNAMENTS_STDDEV_POPULATION_LEVEL_ID_ASC'
  | 'TRACK_TOURNAMENTS_STDDEV_POPULATION_LEVEL_ID_DESC'
  | 'TRACK_TOURNAMENTS_STDDEV_POPULATION_POINTS_VERSION_ASC'
  | 'TRACK_TOURNAMENTS_STDDEV_POPULATION_POINTS_VERSION_DESC'
  | 'TRACK_TOURNAMENTS_STDDEV_POPULATION_TYPE_ASC'
  | 'TRACK_TOURNAMENTS_STDDEV_POPULATION_TYPE_DESC'
  | 'TRACK_TOURNAMENTS_STDDEV_SAMPLE_ID_ASC'
  | 'TRACK_TOURNAMENTS_STDDEV_SAMPLE_ID_DESC'
  | 'TRACK_TOURNAMENTS_STDDEV_SAMPLE_LEVEL_ID_ASC'
  | 'TRACK_TOURNAMENTS_STDDEV_SAMPLE_LEVEL_ID_DESC'
  | 'TRACK_TOURNAMENTS_STDDEV_SAMPLE_POINTS_VERSION_ASC'
  | 'TRACK_TOURNAMENTS_STDDEV_SAMPLE_POINTS_VERSION_DESC'
  | 'TRACK_TOURNAMENTS_STDDEV_SAMPLE_TYPE_ASC'
  | 'TRACK_TOURNAMENTS_STDDEV_SAMPLE_TYPE_DESC'
  | 'TRACK_TOURNAMENTS_SUM_ID_ASC'
  | 'TRACK_TOURNAMENTS_SUM_ID_DESC'
  | 'TRACK_TOURNAMENTS_SUM_LEVEL_ID_ASC'
  | 'TRACK_TOURNAMENTS_SUM_LEVEL_ID_DESC'
  | 'TRACK_TOURNAMENTS_SUM_POINTS_VERSION_ASC'
  | 'TRACK_TOURNAMENTS_SUM_POINTS_VERSION_DESC'
  | 'TRACK_TOURNAMENTS_SUM_TYPE_ASC'
  | 'TRACK_TOURNAMENTS_SUM_TYPE_DESC'
  | 'TRACK_TOURNAMENTS_VARIANCE_POPULATION_ID_ASC'
  | 'TRACK_TOURNAMENTS_VARIANCE_POPULATION_ID_DESC'
  | 'TRACK_TOURNAMENTS_VARIANCE_POPULATION_LEVEL_ID_ASC'
  | 'TRACK_TOURNAMENTS_VARIANCE_POPULATION_LEVEL_ID_DESC'
  | 'TRACK_TOURNAMENTS_VARIANCE_POPULATION_POINTS_VERSION_ASC'
  | 'TRACK_TOURNAMENTS_VARIANCE_POPULATION_POINTS_VERSION_DESC'
  | 'TRACK_TOURNAMENTS_VARIANCE_POPULATION_TYPE_ASC'
  | 'TRACK_TOURNAMENTS_VARIANCE_POPULATION_TYPE_DESC'
  | 'TRACK_TOURNAMENTS_VARIANCE_SAMPLE_ID_ASC'
  | 'TRACK_TOURNAMENTS_VARIANCE_SAMPLE_ID_DESC'
  | 'TRACK_TOURNAMENTS_VARIANCE_SAMPLE_LEVEL_ID_ASC'
  | 'TRACK_TOURNAMENTS_VARIANCE_SAMPLE_LEVEL_ID_DESC'
  | 'TRACK_TOURNAMENTS_VARIANCE_SAMPLE_POINTS_VERSION_ASC'
  | 'TRACK_TOURNAMENTS_VARIANCE_SAMPLE_POINTS_VERSION_DESC'
  | 'TRACK_TOURNAMENTS_VARIANCE_SAMPLE_TYPE_ASC'
  | 'TRACK_TOURNAMENTS_VARIANCE_SAMPLE_TYPE_DESC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_CONTRIBUTION_RANK_ASC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_CONTRIBUTION_RANK_DESC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_LEVEL_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_LEVEL_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_LEVEL_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_LEVEL_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_LEVEL_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_LEVEL_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_LEVEL_POSITION_ASC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_LEVEL_POSITION_DESC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_PLAYER_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_PLAYER_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_RECORD_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_RECORD_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_USER_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_USER_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_COUNT_ASC'
  | 'USER_POINT_CONTRIBUTIONS_COUNT_DESC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_CONTRIBUTION_RANK_ASC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_CONTRIBUTION_RANK_DESC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_DATE_CALCULATED_ASC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_DATE_CALCULATED_DESC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_LEVEL_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_LEVEL_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_LEVEL_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_LEVEL_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_LEVEL_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_LEVEL_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_LEVEL_POSITION_ASC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_LEVEL_POSITION_DESC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_PLAYER_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_PLAYER_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_RECORD_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_RECORD_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_USER_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_USER_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_CONTRIBUTION_RANK_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_CONTRIBUTION_RANK_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_LEVEL_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_LEVEL_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_LEVEL_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_LEVEL_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_LEVEL_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_LEVEL_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_LEVEL_POSITION_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_LEVEL_POSITION_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_PLAYER_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_PLAYER_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_RECORD_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_RECORD_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_USER_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_USER_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_CONTRIBUTION_RANK_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_CONTRIBUTION_RANK_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_LEVEL_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_LEVEL_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_LEVEL_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_LEVEL_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_LEVEL_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_LEVEL_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_LEVEL_POSITION_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_LEVEL_POSITION_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_PLAYER_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_PLAYER_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_RECORD_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_RECORD_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_USER_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_USER_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_CONTRIBUTION_RANK_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_CONTRIBUTION_RANK_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_LEVEL_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_LEVEL_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_LEVEL_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_LEVEL_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_LEVEL_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_LEVEL_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_LEVEL_POSITION_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_LEVEL_POSITION_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_PLAYER_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_PLAYER_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_RECORD_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_RECORD_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_USER_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_USER_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_CONTRIBUTION_RANK_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_CONTRIBUTION_RANK_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_LEVEL_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_LEVEL_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_LEVEL_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_LEVEL_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_LEVEL_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_LEVEL_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_LEVEL_POSITION_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_LEVEL_POSITION_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_PLAYER_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_PLAYER_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_RECORD_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_RECORD_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_USER_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_USER_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_CONTRIBUTION_RANK_ASC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_CONTRIBUTION_RANK_DESC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_LEVEL_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_LEVEL_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_LEVEL_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_LEVEL_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_LEVEL_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_LEVEL_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_LEVEL_POSITION_ASC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_LEVEL_POSITION_DESC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_PLAYER_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_PLAYER_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_RECORD_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_RECORD_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_USER_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_USER_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_CONTRIBUTION_RANK_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_CONTRIBUTION_RANK_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_LEVEL_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_LEVEL_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_LEVEL_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_LEVEL_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_LEVEL_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_LEVEL_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_LEVEL_POSITION_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_LEVEL_POSITION_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_PLAYER_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_PLAYER_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_RECORD_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_RECORD_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_USER_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_USER_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_CONTRIBUTION_RANK_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_CONTRIBUTION_RANK_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_LEVEL_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_LEVEL_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_LEVEL_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_LEVEL_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_LEVEL_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_LEVEL_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_LEVEL_POSITION_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_LEVEL_POSITION_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_PLAYER_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_PLAYER_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_RECORD_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_RECORD_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_USER_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_USER_ID_DESC'
  | 'VOTES_AVERAGE_LEVEL_ID_ASC'
  | 'VOTES_AVERAGE_LEVEL_ID_DESC'
  | 'VOTES_AVERAGE_USER_ID_ASC'
  | 'VOTES_AVERAGE_USER_ID_DESC'
  | 'VOTES_AVERAGE_VALUE_ASC'
  | 'VOTES_AVERAGE_VALUE_DESC'
  | 'VOTES_COUNT_ASC'
  | 'VOTES_COUNT_DESC'
  | 'VOTES_DISTINCT_COUNT_DATE_CREATED_ASC'
  | 'VOTES_DISTINCT_COUNT_DATE_CREATED_DESC'
  | 'VOTES_DISTINCT_COUNT_DATE_UPDATED_ASC'
  | 'VOTES_DISTINCT_COUNT_DATE_UPDATED_DESC'
  | 'VOTES_DISTINCT_COUNT_LEVEL_ID_ASC'
  | 'VOTES_DISTINCT_COUNT_LEVEL_ID_DESC'
  | 'VOTES_DISTINCT_COUNT_USER_ID_ASC'
  | 'VOTES_DISTINCT_COUNT_USER_ID_DESC'
  | 'VOTES_DISTINCT_COUNT_VALUE_ASC'
  | 'VOTES_DISTINCT_COUNT_VALUE_DESC'
  | 'VOTES_MAX_LEVEL_ID_ASC'
  | 'VOTES_MAX_LEVEL_ID_DESC'
  | 'VOTES_MAX_USER_ID_ASC'
  | 'VOTES_MAX_USER_ID_DESC'
  | 'VOTES_MAX_VALUE_ASC'
  | 'VOTES_MAX_VALUE_DESC'
  | 'VOTES_MIN_LEVEL_ID_ASC'
  | 'VOTES_MIN_LEVEL_ID_DESC'
  | 'VOTES_MIN_USER_ID_ASC'
  | 'VOTES_MIN_USER_ID_DESC'
  | 'VOTES_MIN_VALUE_ASC'
  | 'VOTES_MIN_VALUE_DESC'
  | 'VOTES_STDDEV_POPULATION_LEVEL_ID_ASC'
  | 'VOTES_STDDEV_POPULATION_LEVEL_ID_DESC'
  | 'VOTES_STDDEV_POPULATION_USER_ID_ASC'
  | 'VOTES_STDDEV_POPULATION_USER_ID_DESC'
  | 'VOTES_STDDEV_POPULATION_VALUE_ASC'
  | 'VOTES_STDDEV_POPULATION_VALUE_DESC'
  | 'VOTES_STDDEV_SAMPLE_LEVEL_ID_ASC'
  | 'VOTES_STDDEV_SAMPLE_LEVEL_ID_DESC'
  | 'VOTES_STDDEV_SAMPLE_USER_ID_ASC'
  | 'VOTES_STDDEV_SAMPLE_USER_ID_DESC'
  | 'VOTES_STDDEV_SAMPLE_VALUE_ASC'
  | 'VOTES_STDDEV_SAMPLE_VALUE_DESC'
  | 'VOTES_SUM_LEVEL_ID_ASC'
  | 'VOTES_SUM_LEVEL_ID_DESC'
  | 'VOTES_SUM_USER_ID_ASC'
  | 'VOTES_SUM_USER_ID_DESC'
  | 'VOTES_SUM_VALUE_ASC'
  | 'VOTES_SUM_VALUE_DESC'
  | 'VOTES_VARIANCE_POPULATION_LEVEL_ID_ASC'
  | 'VOTES_VARIANCE_POPULATION_LEVEL_ID_DESC'
  | 'VOTES_VARIANCE_POPULATION_USER_ID_ASC'
  | 'VOTES_VARIANCE_POPULATION_USER_ID_DESC'
  | 'VOTES_VARIANCE_POPULATION_VALUE_ASC'
  | 'VOTES_VARIANCE_POPULATION_VALUE_DESC'
  | 'VOTES_VARIANCE_SAMPLE_LEVEL_ID_ASC'
  | 'VOTES_VARIANCE_SAMPLE_LEVEL_ID_DESC'
  | 'VOTES_VARIANCE_SAMPLE_USER_ID_ASC'
  | 'VOTES_VARIANCE_SAMPLE_USER_ID_DESC'
  | 'VOTES_VARIANCE_SAMPLE_VALUE_ASC'
  | 'VOTES_VARIANCE_SAMPLE_VALUE_DESC'
  | 'XX_HASH_ASC'
  | 'XX_HASH_DESC'
  | 'ZSL_LEVELS_AVERAGE_ID_ASC'
  | 'ZSL_LEVELS_AVERAGE_ID_DESC'
  | 'ZSL_LEVELS_AVERAGE_LEVEL_ID_ASC'
  | 'ZSL_LEVELS_AVERAGE_LEVEL_ID_DESC'
  | 'ZSL_LEVELS_AVERAGE_ROUND_ID_ASC'
  | 'ZSL_LEVELS_AVERAGE_ROUND_ID_DESC'
  | 'ZSL_LEVELS_COUNT_ASC'
  | 'ZSL_LEVELS_COUNT_DESC'
  | 'ZSL_LEVELS_DISTINCT_COUNT_DATE_CREATED_ASC'
  | 'ZSL_LEVELS_DISTINCT_COUNT_DATE_CREATED_DESC'
  | 'ZSL_LEVELS_DISTINCT_COUNT_DATE_UPDATED_ASC'
  | 'ZSL_LEVELS_DISTINCT_COUNT_DATE_UPDATED_DESC'
  | 'ZSL_LEVELS_DISTINCT_COUNT_ID_ASC'
  | 'ZSL_LEVELS_DISTINCT_COUNT_ID_DESC'
  | 'ZSL_LEVELS_DISTINCT_COUNT_LEVEL_ID_ASC'
  | 'ZSL_LEVELS_DISTINCT_COUNT_LEVEL_ID_DESC'
  | 'ZSL_LEVELS_DISTINCT_COUNT_ROUND_ID_ASC'
  | 'ZSL_LEVELS_DISTINCT_COUNT_ROUND_ID_DESC'
  | 'ZSL_LEVELS_MAX_ID_ASC'
  | 'ZSL_LEVELS_MAX_ID_DESC'
  | 'ZSL_LEVELS_MAX_LEVEL_ID_ASC'
  | 'ZSL_LEVELS_MAX_LEVEL_ID_DESC'
  | 'ZSL_LEVELS_MAX_ROUND_ID_ASC'
  | 'ZSL_LEVELS_MAX_ROUND_ID_DESC'
  | 'ZSL_LEVELS_MIN_ID_ASC'
  | 'ZSL_LEVELS_MIN_ID_DESC'
  | 'ZSL_LEVELS_MIN_LEVEL_ID_ASC'
  | 'ZSL_LEVELS_MIN_LEVEL_ID_DESC'
  | 'ZSL_LEVELS_MIN_ROUND_ID_ASC'
  | 'ZSL_LEVELS_MIN_ROUND_ID_DESC'
  | 'ZSL_LEVELS_STDDEV_POPULATION_ID_ASC'
  | 'ZSL_LEVELS_STDDEV_POPULATION_ID_DESC'
  | 'ZSL_LEVELS_STDDEV_POPULATION_LEVEL_ID_ASC'
  | 'ZSL_LEVELS_STDDEV_POPULATION_LEVEL_ID_DESC'
  | 'ZSL_LEVELS_STDDEV_POPULATION_ROUND_ID_ASC'
  | 'ZSL_LEVELS_STDDEV_POPULATION_ROUND_ID_DESC'
  | 'ZSL_LEVELS_STDDEV_SAMPLE_ID_ASC'
  | 'ZSL_LEVELS_STDDEV_SAMPLE_ID_DESC'
  | 'ZSL_LEVELS_STDDEV_SAMPLE_LEVEL_ID_ASC'
  | 'ZSL_LEVELS_STDDEV_SAMPLE_LEVEL_ID_DESC'
  | 'ZSL_LEVELS_STDDEV_SAMPLE_ROUND_ID_ASC'
  | 'ZSL_LEVELS_STDDEV_SAMPLE_ROUND_ID_DESC'
  | 'ZSL_LEVELS_SUM_ID_ASC'
  | 'ZSL_LEVELS_SUM_ID_DESC'
  | 'ZSL_LEVELS_SUM_LEVEL_ID_ASC'
  | 'ZSL_LEVELS_SUM_LEVEL_ID_DESC'
  | 'ZSL_LEVELS_SUM_ROUND_ID_ASC'
  | 'ZSL_LEVELS_SUM_ROUND_ID_DESC'
  | 'ZSL_LEVELS_VARIANCE_POPULATION_ID_ASC'
  | 'ZSL_LEVELS_VARIANCE_POPULATION_ID_DESC'
  | 'ZSL_LEVELS_VARIANCE_POPULATION_LEVEL_ID_ASC'
  | 'ZSL_LEVELS_VARIANCE_POPULATION_LEVEL_ID_DESC'
  | 'ZSL_LEVELS_VARIANCE_POPULATION_ROUND_ID_ASC'
  | 'ZSL_LEVELS_VARIANCE_POPULATION_ROUND_ID_DESC'
  | 'ZSL_LEVELS_VARIANCE_SAMPLE_ID_ASC'
  | 'ZSL_LEVELS_VARIANCE_SAMPLE_ID_DESC'
  | 'ZSL_LEVELS_VARIANCE_SAMPLE_LEVEL_ID_ASC'
  | 'ZSL_LEVELS_VARIANCE_SAMPLE_LEVEL_ID_DESC'
  | 'ZSL_LEVELS_VARIANCE_SAMPLE_ROUND_ID_ASC'
  | 'ZSL_LEVELS_VARIANCE_SAMPLE_ROUND_ID_DESC';

/** A filter to be used against aggregates of `PersonalBestGlobal` object types. */
export type PersonalBestGlobalAggregatesFilter = {
  /** Mean average aggregate over matching `PersonalBestGlobal` objects. */
  average?: PersonalBestGlobalAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `PersonalBestGlobal` objects. */
  distinctCount?: PersonalBestGlobalDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `PersonalBestGlobal` object to be included within the aggregate. */
  filter?: PersonalBestGlobalFilter | null | undefined;
  /** Maximum aggregate over matching `PersonalBestGlobal` objects. */
  max?: PersonalBestGlobalMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `PersonalBestGlobal` objects. */
  min?: PersonalBestGlobalMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `PersonalBestGlobal` objects. */
  stddevPopulation?: PersonalBestGlobalStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `PersonalBestGlobal` objects. */
  stddevSample?: PersonalBestGlobalStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `PersonalBestGlobal` objects. */
  sum?: PersonalBestGlobalSumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `PersonalBestGlobal` objects. */
  variancePopulation?: PersonalBestGlobalVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `PersonalBestGlobal` objects. */
  varianceSample?: PersonalBestGlobalVarianceSampleAggregateFilter | null | undefined;
};

export type PersonalBestGlobalAverageAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type PersonalBestGlobalDistinctCountAggregateFilter = {
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  id?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  recordId?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

/** A filter to be used against `PersonalBestGlobal` object types. All fields are combined with a logical ‘and.’ */
export type PersonalBestGlobalFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<PersonalBestGlobalFilter> | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `id` field. */
  id?: IntFilter | null | undefined;
  /** Filter by the object’s `level` relation. */
  level?: LevelFilter | null | undefined;
  /** Filter by the object’s `levelId` field. */
  levelId?: IntFilter | null | undefined;
  /** Negates the expression. */
  not?: PersonalBestGlobalFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<PersonalBestGlobalFilter> | null | undefined;
  /** Filter by the object’s `record` relation. */
  record?: RecordFilter | null | undefined;
  /** Filter by the object’s `recordId` field. */
  recordId?: IntFilter | null | undefined;
  /** Filter by the object’s `user` relation. */
  user?: UserFilter | null | undefined;
  /** Filter by the object’s `userId` field. */
  userId?: IntFilter | null | undefined;
};

export type PersonalBestGlobalMaxAggregateFilter = {
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  recordId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type PersonalBestGlobalMinAggregateFilter = {
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  recordId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type PersonalBestGlobalStddevPopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type PersonalBestGlobalStddevSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type PersonalBestGlobalSumAggregateFilter = {
  id?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  recordId?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

export type PersonalBestGlobalVariancePopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type PersonalBestGlobalVarianceSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

/** A filter to be used against `PlayerSkillAggregate` object types. All fields are combined with a logical ‘and.’ */
export type PlayerSkillAggregateFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<PlayerSkillAggregateFilter> | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `eligibleLevelCount` field. */
  eligibleLevelCount?: IntFilter | null | undefined;
  /** Negates the expression. */
  not?: PlayerSkillAggregateFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<PlayerSkillAggregateFilter> | null | undefined;
  /** Filter by the object’s `placementSum` field. */
  placementSum?: FloatFilter | null | undefined;
  /** Filter by the object’s `skill` field. */
  skill?: FloatFilter | null | undefined;
  /** Filter by the object’s `user` relation. */
  user?: UserFilter | null | undefined;
  /** Filter by the object’s `userId` field. */
  userId?: IntFilter | null | undefined;
};

/** A filter to be used against aggregates of `Record` object types. */
export type RecordAggregatesFilter = {
  /** Mean average aggregate over matching `Record` objects. */
  average?: RecordAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `Record` objects. */
  distinctCount?: RecordDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `Record` object to be included within the aggregate. */
  filter?: RecordFilter | null | undefined;
  /** Maximum aggregate over matching `Record` objects. */
  max?: RecordMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `Record` objects. */
  min?: RecordMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `Record` objects. */
  stddevPopulation?: RecordStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `Record` objects. */
  stddevSample?: RecordStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `Record` objects. */
  sum?: RecordSumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `Record` objects. */
  variancePopulation?: RecordVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `Record` objects. */
  varianceSample?: RecordVarianceSampleAggregateFilter | null | undefined;
};

export type RecordAverageAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type RecordDistinctCountAggregateFilter = {
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  gameVersion?: BigIntFilter | null | undefined;
  id?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  modVersion?: BigIntFilter | null | undefined;
  speeds?: BigIntFilter | null | undefined;
  splits?: BigIntFilter | null | undefined;
  time?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

/** A filter to be used against `Record` object types. All fields are combined with a logical ‘and.’ */
export type RecordFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<RecordFilter> | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `discordActivityEvents` relation. */
  discordActivityEvents?: RecordToManyDiscordActivityEventFilter | null | undefined;
  /** Filter by the object’s `discordActivityEventsAsPreviousRecord` relation. */
  discordActivityEventsAsPreviousRecord?: RecordToManyDiscordActivityEventFilter | null | undefined;
  /** Some related `discordActivityEventsAsPreviousRecord` exist. */
  discordActivityEventsAsPreviousRecordExist?: boolean | null | undefined;
  /** Some related `discordActivityEvents` exist. */
  discordActivityEventsExist?: boolean | null | undefined;
  /** Filter by the object’s `gameVersion` field. */
  gameVersion?: StringFilter | null | undefined;
  /** Filter by the object’s `id` field. */
  id?: IntFilter | null | undefined;
  /** Filter by the object’s `level` relation. */
  level?: LevelFilter | null | undefined;
  /** Filter by the object’s `levelId` field. */
  levelId?: IntFilter | null | undefined;
  /** Filter by the object’s `modVersion` field. */
  modVersion?: StringFilter | null | undefined;
  /** Negates the expression. */
  not?: RecordFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<RecordFilter> | null | undefined;
  /** Filter by the object’s `personalBestGlobals` relation. */
  personalBestGlobals?: RecordToManyPersonalBestGlobalFilter | null | undefined;
  /** Some related `personalBestGlobals` exist. */
  personalBestGlobalsExist?: boolean | null | undefined;
  /** Filter by the object’s `recordMedia` relation. */
  recordMedia?: RecordMediaFilter | null | undefined;
  /** A related `recordMedia` exists. */
  recordMediaExists?: boolean | null | undefined;
  /** Filter by the object’s `recordStatistic` relation. */
  recordStatistic?: RecordStatisticFilter | null | undefined;
  /** A related `recordStatistic` exists. */
  recordStatisticExists?: boolean | null | undefined;
  /** Filter by the object’s `speeds` field. */
  speeds?: FloatListFilter | null | undefined;
  /** Filter by the object’s `splits` field. */
  splits?: FloatListFilter | null | undefined;
  /** Filter by the object’s `time` field. */
  time?: FloatFilter | null | undefined;
  /** Filter by the object’s `trackTournamentResults` relation. */
  trackTournamentResults?: RecordToManyTrackTournamentResultFilter | null | undefined;
  /** Some related `trackTournamentResults` exist. */
  trackTournamentResultsExist?: boolean | null | undefined;
  /** Filter by the object’s `user` relation. */
  user?: UserFilter | null | undefined;
  /** Filter by the object’s `userId` field. */
  userId?: IntFilter | null | undefined;
  /** Filter by the object’s `userPointContributions` relation. */
  userPointContributions?: RecordToManyUserPointContributionFilter | null | undefined;
  /** Some related `userPointContributions` exist. */
  userPointContributionsExist?: boolean | null | undefined;
  /** Filter by the object’s `worldRecordGlobals` relation. */
  worldRecordGlobals?: RecordToManyWorldRecordGlobalFilter | null | undefined;
  /** Some related `worldRecordGlobals` exist. */
  worldRecordGlobalsExist?: boolean | null | undefined;
  /** Filter by the object’s `zslLevelResults` relation. */
  zslLevelResults?: RecordToManyZslLevelResultFilter | null | undefined;
  /** Some related `zslLevelResults` exist. */
  zslLevelResultsExist?: boolean | null | undefined;
};

/** Methods to use when ordering `RecordHistoryEntry`. */
export type RecordHistoryEntriesOrderBy =
  | 'CONTRIBUTION_RANK_ASC'
  | 'CONTRIBUTION_RANK_DESC'
  | 'DATE_CREATED_ASC'
  | 'DATE_CREATED_DESC'
  | 'HAS_CONTRIBUTION_ASC'
  | 'HAS_CONTRIBUTION_DESC'
  | 'HISTORY_VIEW_ASC'
  | 'HISTORY_VIEW_DESC'
  | 'ID_ASC'
  | 'ID_DESC'
  | 'IS_PERSONAL_BEST_ASC'
  | 'IS_PERSONAL_BEST_DESC'
  | 'IS_WORLD_RECORD_ASC'
  | 'IS_WORLD_RECORD_DESC'
  | 'LEVEL_DECAYED_POINTS_ASC'
  | 'LEVEL_DECAYED_POINTS_DESC'
  | 'LEVEL_ID_ASC'
  | 'LEVEL_ID_DESC'
  | 'LEVEL_NAME_ASC'
  | 'LEVEL_NAME_DESC'
  | 'LEVEL_POINTS_ASC'
  | 'LEVEL_POINTS_DESC'
  | 'LEVEL_POSITION_ASC'
  | 'LEVEL_POSITION_DESC'
  | 'LEVEL_XX_HASH_ASC'
  | 'LEVEL_XX_HASH_DESC'
  | 'NATURAL'
  | 'PLAYER_DECAYED_POINTS_ASC'
  | 'PLAYER_DECAYED_POINTS_DESC'
  | 'PRIMARY_KEY_ASC'
  | 'PRIMARY_KEY_DESC'
  | 'TIME_ASC'
  | 'TIME_DESC'
  | 'USER_ID_ASC'
  | 'USER_ID_DESC'
  | 'USER_NAME_ASC'
  | 'USER_NAME_DESC'
  | 'USER_STEAM_ID_ASC'
  | 'USER_STEAM_ID_DESC';

/** A filter to be used against `RecordHistoryEntry` object types. All fields are combined with a logical ‘and.’ */
export type RecordHistoryEntryFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<RecordHistoryEntryFilter> | null | undefined;
  /** Filter by the object’s `contributionRank` field. */
  contributionRank?: IntFilter | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `hasContribution` field. */
  hasContribution?: BooleanFilter | null | undefined;
  /** Filter by the object’s `historyView` field. */
  historyView?: StringFilter | null | undefined;
  /** Filter by the object’s `id` field. */
  id?: IntFilter | null | undefined;
  /** Filter by the object’s `isPersonalBest` field. */
  isPersonalBest?: BooleanFilter | null | undefined;
  /** Filter by the object’s `isWorldRecord` field. */
  isWorldRecord?: BooleanFilter | null | undefined;
  /** Filter by the object’s `levelDecayedPoints` field. */
  levelDecayedPoints?: FloatFilter | null | undefined;
  /** Filter by the object’s `levelId` field. */
  levelId?: IntFilter | null | undefined;
  /** Filter by the object’s `levelName` field. */
  levelName?: StringFilter | null | undefined;
  /** Filter by the object’s `levelPoints` field. */
  levelPoints?: IntFilter | null | undefined;
  /** Filter by the object’s `levelPosition` field. */
  levelPosition?: IntFilter | null | undefined;
  /** Filter by the object’s `levelXxHash` field. */
  levelXxHash?: StringFilter | null | undefined;
  /** Negates the expression. */
  not?: RecordHistoryEntryFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<RecordHistoryEntryFilter> | null | undefined;
  /** Filter by the object’s `playerDecayedPoints` field. */
  playerDecayedPoints?: FloatFilter | null | undefined;
  /** Filter by the object’s `time` field. */
  time?: FloatFilter | null | undefined;
  /** Filter by the object’s `userId` field. */
  userId?: IntFilter | null | undefined;
  /** Filter by the object’s `userName` field. */
  userName?: StringFilter | null | undefined;
  /** Filter by the object’s `userSteamId` field. */
  userSteamId?: BigIntFilter | null | undefined;
};

export type RecordMaxAggregateFilter = {
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

/** A filter to be used against `RecordMedia` object types. All fields are combined with a logical ‘and.’ */
export type RecordMediaFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<RecordMediaFilter> | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `ghostUrl` field. */
  ghostUrl?: StringFilter | null | undefined;
  /** Negates the expression. */
  not?: RecordMediaFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<RecordMediaFilter> | null | undefined;
  /** Filter by the object’s `record` relation. */
  record?: RecordFilter | null | undefined;
  /** Filter by the object’s `recordId` field. */
  recordId?: IntFilter | null | undefined;
};

export type RecordMinAggregateFilter = {
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

/** A filter to be used against `RecordStatistic` object types. All fields are combined with a logical ‘and.’ */
export type RecordStatisticFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<RecordStatisticFilter> | null | undefined;
  /** Filter by the object’s `armsUpCount` field. */
  armsUpCount?: IntFilter | null | undefined;
  /** Filter by the object’s `armsUpTime` field. */
  armsUpTime?: FloatFilter | null | undefined;
  /** Filter by the object’s `averageAngularVelocity` field. */
  averageAngularVelocity?: FloatFilter | null | undefined;
  /** Filter by the object’s `averageGforce` field. */
  averageGforce?: FloatFilter | null | undefined;
  /** Filter by the object’s `averageSpeed` field. */
  averageSpeed?: FloatFilter | null | undefined;
  /** Filter by the object’s `averageVelocity` field. */
  averageVelocity?: FloatFilter | null | undefined;
  /** Filter by the object’s `brakeCount` field. */
  brakeCount?: IntFilter | null | undefined;
  /** Filter by the object’s `brakeTime` field. */
  brakeTime?: FloatFilter | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `distance` field. */
  distance?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceInAir` field. */
  distanceInAir?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOffroadWheels` field. */
  distanceOffroadWheels?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOn1Wheel` field. */
  distanceOn1Wheel?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOn2Wheels` field. */
  distanceOn2Wheels?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOn3Wheels` field. */
  distanceOn3Wheels?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOn4Wheels` field. */
  distanceOn4Wheels?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOnGrass` field. */
  distanceOnGrass?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOnGround` field. */
  distanceOnGround?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOnIce1` field. */
  distanceOnIce1?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOnIce2` field. */
  distanceOnIce2?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOnIce3` field. */
  distanceOnIce3?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOnMonorail` field. */
  distanceOnMonorail?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOnMud` field. */
  distanceOnMud?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOnSand` field. */
  distanceOnSand?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOnSoap` field. */
  distanceOnSoap?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOnTarmac` field. */
  distanceOnTarmac?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOnWood` field. */
  distanceOnWood?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceParaglider` field. */
  distanceParaglider?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceParked` field. */
  distanceParked?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceRagdoll` field. */
  distanceRagdoll?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceSlipping` field. */
  distanceSlipping?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceSoapWheels` field. */
  distanceSoapWheels?: FloatFilter | null | undefined;
  /** Filter by the object’s `driverInputTransitionCount` field. */
  driverInputTransitionCount?: IntFilter | null | undefined;
  /** Filter by the object’s `frameCount` field. */
  frameCount?: IntFilter | null | undefined;
  /** Filter by the object’s `ghostVersion` field. */
  ghostVersion?: IntFilter | null | undefined;
  /** Filter by the object’s `hasAirData` field. */
  hasAirData?: BooleanFilter | null | undefined;
  /** Filter by the object’s `hasInputData` field. */
  hasInputData?: BooleanFilter | null | undefined;
  /** Filter by the object’s `hasRagdollData` field. */
  hasRagdollData?: BooleanFilter | null | undefined;
  /** Filter by the object’s `hasSlipData` field. */
  hasSlipData?: BooleanFilter | null | undefined;
  /** Filter by the object’s `hasStateData` field. */
  hasStateData?: BooleanFilter | null | undefined;
  /** Filter by the object’s `hasSurfaceData` field. */
  hasSurfaceData?: BooleanFilter | null | undefined;
  /** Filter by the object’s `hasVelocityData` field. */
  hasVelocityData?: BooleanFilter | null | undefined;
  /** Filter by the object’s `hasWheelData` field. */
  hasWheelData?: BooleanFilter | null | undefined;
  /** Filter by the object’s `hornCount` field. */
  hornCount?: IntFilter | null | undefined;
  /** Filter by the object’s `hornTime` field. */
  hornTime?: FloatFilter | null | undefined;
  /** Filter by the object’s `maxAngularVelocity` field. */
  maxAngularVelocity?: FloatFilter | null | undefined;
  /** Filter by the object’s `maxGforce` field. */
  maxGforce?: FloatFilter | null | undefined;
  /** Filter by the object’s `maxSpeed` field. */
  maxSpeed?: FloatFilter | null | undefined;
  /** Filter by the object’s `maxVelocity` field. */
  maxVelocity?: FloatFilter | null | undefined;
  /** Negates the expression. */
  not?: RecordStatisticFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<RecordStatisticFilter> | null | undefined;
  /** Filter by the object’s `record` relation. */
  record?: RecordFilter | null | undefined;
  /** Filter by the object’s `recordId` field. */
  recordId?: IntFilter | null | undefined;
  /** Filter by the object’s `time` field. */
  time?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeAnyDriverInput` field. */
  timeAnyDriverInput?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeInAir` field. */
  timeInAir?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOffroadWheels` field. */
  timeOffroadWheels?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOn1Wheel` field. */
  timeOn1Wheel?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOn2Wheels` field. */
  timeOn2Wheels?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOn3Wheels` field. */
  timeOn3Wheels?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOn4Wheels` field. */
  timeOn4Wheels?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOnGrass` field. */
  timeOnGrass?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOnGround` field. */
  timeOnGround?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOnIce1` field. */
  timeOnIce1?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOnIce2` field. */
  timeOnIce2?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOnIce3` field. */
  timeOnIce3?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOnMonorail` field. */
  timeOnMonorail?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOnMud` field. */
  timeOnMud?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOnSand` field. */
  timeOnSand?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOnSoap` field. */
  timeOnSoap?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOnTarmac` field. */
  timeOnTarmac?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOnWood` field. */
  timeOnWood?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeParaglider` field. */
  timeParaglider?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeParked` field. */
  timeParked?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeRagdoll` field. */
  timeRagdoll?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeSlipping` field. */
  timeSlipping?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeSoapWheels` field. */
  timeSoapWheels?: FloatFilter | null | undefined;
  /** Filter by the object’s `turnLeftCount` field. */
  turnLeftCount?: IntFilter | null | undefined;
  /** Filter by the object’s `turnLeftTime` field. */
  turnLeftTime?: FloatFilter | null | undefined;
  /** Filter by the object’s `turnRightCount` field. */
  turnRightCount?: IntFilter | null | undefined;
  /** Filter by the object’s `turnRightTime` field. */
  turnRightTime?: FloatFilter | null | undefined;
};

export type RecordStddevPopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type RecordStddevSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type RecordSumAggregateFilter = {
  id?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

/** A filter to be used against many `DiscordActivityEvent` object types. All fields are combined with a logical ‘and.’ */
export type RecordToManyDiscordActivityEventFilter = {
  /** Aggregates across related `DiscordActivityEvent` match the filter criteria. */
  aggregates?: DiscordActivityEventAggregatesFilter | null | undefined;
  /** Every related `DiscordActivityEvent` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: DiscordActivityEventFilter | null | undefined;
  /** No related `DiscordActivityEvent` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: DiscordActivityEventFilter | null | undefined;
  /** Some related `DiscordActivityEvent` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: DiscordActivityEventFilter | null | undefined;
};

/** A filter to be used against many `PersonalBestGlobal` object types. All fields are combined with a logical ‘and.’ */
export type RecordToManyPersonalBestGlobalFilter = {
  /** Aggregates across related `PersonalBestGlobal` match the filter criteria. */
  aggregates?: PersonalBestGlobalAggregatesFilter | null | undefined;
  /** Every related `PersonalBestGlobal` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: PersonalBestGlobalFilter | null | undefined;
  /** No related `PersonalBestGlobal` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: PersonalBestGlobalFilter | null | undefined;
  /** Some related `PersonalBestGlobal` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: PersonalBestGlobalFilter | null | undefined;
};

/** A filter to be used against many `TrackTournamentResult` object types. All fields are combined with a logical ‘and.’ */
export type RecordToManyTrackTournamentResultFilter = {
  /** Aggregates across related `TrackTournamentResult` match the filter criteria. */
  aggregates?: TrackTournamentResultAggregatesFilter | null | undefined;
  /** Every related `TrackTournamentResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: TrackTournamentResultFilter | null | undefined;
  /** No related `TrackTournamentResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: TrackTournamentResultFilter | null | undefined;
  /** Some related `TrackTournamentResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: TrackTournamentResultFilter | null | undefined;
};

/** A filter to be used against many `UserPointContribution` object types. All fields are combined with a logical ‘and.’ */
export type RecordToManyUserPointContributionFilter = {
  /** Aggregates across related `UserPointContribution` match the filter criteria. */
  aggregates?: UserPointContributionAggregatesFilter | null | undefined;
  /** Every related `UserPointContribution` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: UserPointContributionFilter | null | undefined;
  /** No related `UserPointContribution` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: UserPointContributionFilter | null | undefined;
  /** Some related `UserPointContribution` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: UserPointContributionFilter | null | undefined;
};

/** A filter to be used against many `WorldRecordGlobal` object types. All fields are combined with a logical ‘and.’ */
export type RecordToManyWorldRecordGlobalFilter = {
  /** Aggregates across related `WorldRecordGlobal` match the filter criteria. */
  aggregates?: WorldRecordGlobalAggregatesFilter | null | undefined;
  /** Every related `WorldRecordGlobal` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: WorldRecordGlobalFilter | null | undefined;
  /** No related `WorldRecordGlobal` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: WorldRecordGlobalFilter | null | undefined;
  /** Some related `WorldRecordGlobal` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: WorldRecordGlobalFilter | null | undefined;
};

/** A filter to be used against many `ZslLevelResult` object types. All fields are combined with a logical ‘and.’ */
export type RecordToManyZslLevelResultFilter = {
  /** Aggregates across related `ZslLevelResult` match the filter criteria. */
  aggregates?: ZslLevelResultAggregatesFilter | null | undefined;
  /** Every related `ZslLevelResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: ZslLevelResultFilter | null | undefined;
  /** No related `ZslLevelResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: ZslLevelResultFilter | null | undefined;
  /** Some related `ZslLevelResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: ZslLevelResultFilter | null | undefined;
};

export type RecordVariancePopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type RecordVarianceSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

/** Methods to use when ordering `Record`. */
export type RecordsOrderBy =
  | 'DATE_CREATED_ASC'
  | 'DATE_CREATED_DESC'
  | 'DATE_UPDATED_ASC'
  | 'DATE_UPDATED_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_AVERAGE_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_AVERAGE_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_AVERAGE_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_AVERAGE_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_AVERAGE_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_AVERAGE_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_AVERAGE_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_AVERAGE_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_AVERAGE_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_AVERAGE_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_AVERAGE_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_AVERAGE_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_COUNT_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_COUNT_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_DATE_CREATED_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_DATE_CREATED_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_KIND_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_KIND_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_OCCURRED_AT_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_OCCURRED_AT_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_PAYLOAD_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_PAYLOAD_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_DISTINCT_COUNT_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MAX_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MAX_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MAX_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MAX_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MAX_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MAX_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MAX_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MAX_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MAX_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MAX_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MAX_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MAX_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MIN_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MIN_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MIN_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MIN_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MIN_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MIN_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MIN_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MIN_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MIN_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MIN_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MIN_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_MIN_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_POPULATION_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_POPULATION_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_POPULATION_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_POPULATION_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_POPULATION_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_POPULATION_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_POPULATION_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_POPULATION_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_POPULATION_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_POPULATION_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_POPULATION_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_POPULATION_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_SAMPLE_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_SAMPLE_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_SAMPLE_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_SAMPLE_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_SAMPLE_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_SAMPLE_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_SAMPLE_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_SAMPLE_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_SAMPLE_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_SAMPLE_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_SAMPLE_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_STDDEV_SAMPLE_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_SUM_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_SUM_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_SUM_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_SUM_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_SUM_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_SUM_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_SUM_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_SUM_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_SUM_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_SUM_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_SUM_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_SUM_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_POPULATION_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_POPULATION_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_POPULATION_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_POPULATION_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_POPULATION_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_POPULATION_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_POPULATION_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_POPULATION_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_POPULATION_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_POPULATION_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_POPULATION_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_POPULATION_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_SAMPLE_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_SAMPLE_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_SAMPLE_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_SAMPLE_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_SAMPLE_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_SAMPLE_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_SAMPLE_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_SAMPLE_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_SAMPLE_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_SAMPLE_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_SAMPLE_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AS_PREVIOUS_RECORD_VARIANCE_SAMPLE_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_AVERAGE_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_COUNT_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_COUNT_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_DATE_CREATED_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_DATE_CREATED_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_KIND_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_KIND_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_OCCURRED_AT_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_OCCURRED_AT_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_PAYLOAD_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_PAYLOAD_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_DISTINCT_COUNT_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MAX_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_MIN_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_POPULATION_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_STDDEV_SAMPLE_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_SUM_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_POPULATION_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_LEVEL_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_LEVEL_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_PREVIOUS_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_PREVIOUS_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_PREVIOUS_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_PREVIOUS_USER_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_RECORD_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_RECORD_ID_DESC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_USER_ID_ASC'
  | 'DISCORD_ACTIVITY_EVENTS_VARIANCE_SAMPLE_USER_ID_DESC'
  | 'GAME_VERSION_ASC'
  | 'GAME_VERSION_DESC'
  | 'ID_ASC'
  | 'ID_DESC'
  | 'LEVEL_ID_ASC'
  | 'LEVEL_ID_DESC'
  | 'MOD_VERSION_ASC'
  | 'MOD_VERSION_DESC'
  | 'NATURAL'
  | 'PERSONAL_BEST_GLOBALS_AVERAGE_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_AVERAGE_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_AVERAGE_LEVEL_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_AVERAGE_LEVEL_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_AVERAGE_RECORD_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_AVERAGE_RECORD_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_AVERAGE_USER_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_AVERAGE_USER_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_COUNT_ASC'
  | 'PERSONAL_BEST_GLOBALS_COUNT_DESC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_DATE_CREATED_ASC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_DATE_CREATED_DESC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_DATE_UPDATED_ASC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_DATE_UPDATED_DESC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_LEVEL_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_LEVEL_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_RECORD_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_RECORD_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_USER_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_DISTINCT_COUNT_USER_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_MAX_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_MAX_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_MAX_LEVEL_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_MAX_LEVEL_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_MAX_RECORD_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_MAX_RECORD_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_MAX_USER_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_MAX_USER_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_MIN_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_MIN_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_MIN_LEVEL_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_MIN_LEVEL_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_MIN_RECORD_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_MIN_RECORD_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_MIN_USER_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_MIN_USER_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_POPULATION_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_POPULATION_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_POPULATION_LEVEL_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_POPULATION_LEVEL_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_POPULATION_RECORD_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_POPULATION_RECORD_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_POPULATION_USER_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_POPULATION_USER_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_SAMPLE_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_SAMPLE_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_SAMPLE_LEVEL_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_SAMPLE_LEVEL_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_SAMPLE_RECORD_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_SAMPLE_RECORD_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_SAMPLE_USER_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_STDDEV_SAMPLE_USER_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_SUM_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_SUM_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_SUM_LEVEL_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_SUM_LEVEL_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_SUM_RECORD_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_SUM_RECORD_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_SUM_USER_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_SUM_USER_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_POPULATION_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_POPULATION_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_POPULATION_LEVEL_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_POPULATION_LEVEL_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_POPULATION_RECORD_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_POPULATION_RECORD_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_POPULATION_USER_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_POPULATION_USER_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_SAMPLE_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_SAMPLE_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_SAMPLE_LEVEL_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_SAMPLE_LEVEL_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_SAMPLE_RECORD_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_SAMPLE_RECORD_ID_DESC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_SAMPLE_USER_ID_ASC'
  | 'PERSONAL_BEST_GLOBALS_VARIANCE_SAMPLE_USER_ID_DESC'
  | 'PRIMARY_KEY_ASC'
  | 'PRIMARY_KEY_DESC'
  | 'TIME_ASC'
  | 'TIME_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_AVERAGE_POINTS_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_AVERAGE_POINTS_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_AVERAGE_RANK_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_AVERAGE_RANK_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_AVERAGE_RECORD_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_AVERAGE_RECORD_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_AVERAGE_TIME_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_AVERAGE_TIME_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_AVERAGE_TOURNAMENT_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_AVERAGE_TOURNAMENT_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_AVERAGE_USER_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_AVERAGE_USER_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_COUNT_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_COUNT_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_DISTINCT_COUNT_DATE_CREATED_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_DISTINCT_COUNT_DATE_CREATED_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_DISTINCT_COUNT_DATE_UPDATED_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_DISTINCT_COUNT_DATE_UPDATED_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_DISTINCT_COUNT_POINTS_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_DISTINCT_COUNT_POINTS_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_DISTINCT_COUNT_RANK_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_DISTINCT_COUNT_RANK_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_DISTINCT_COUNT_RECORD_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_DISTINCT_COUNT_RECORD_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_DISTINCT_COUNT_TIME_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_DISTINCT_COUNT_TIME_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_DISTINCT_COUNT_TOURNAMENT_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_DISTINCT_COUNT_TOURNAMENT_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_DISTINCT_COUNT_USER_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_DISTINCT_COUNT_USER_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_MAX_POINTS_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_MAX_POINTS_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_MAX_RANK_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_MAX_RANK_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_MAX_RECORD_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_MAX_RECORD_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_MAX_TIME_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_MAX_TIME_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_MAX_TOURNAMENT_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_MAX_TOURNAMENT_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_MAX_USER_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_MAX_USER_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_MIN_POINTS_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_MIN_POINTS_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_MIN_RANK_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_MIN_RANK_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_MIN_RECORD_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_MIN_RECORD_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_MIN_TIME_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_MIN_TIME_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_MIN_TOURNAMENT_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_MIN_TOURNAMENT_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_MIN_USER_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_MIN_USER_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_POPULATION_POINTS_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_POPULATION_POINTS_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_POPULATION_RANK_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_POPULATION_RANK_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_POPULATION_RECORD_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_POPULATION_RECORD_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_POPULATION_TIME_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_POPULATION_TIME_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_POPULATION_TOURNAMENT_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_POPULATION_TOURNAMENT_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_POPULATION_USER_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_POPULATION_USER_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_SAMPLE_POINTS_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_SAMPLE_POINTS_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_SAMPLE_RANK_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_SAMPLE_RANK_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_SAMPLE_RECORD_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_SAMPLE_RECORD_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_SAMPLE_TIME_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_SAMPLE_TIME_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_SAMPLE_TOURNAMENT_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_SAMPLE_TOURNAMENT_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_SAMPLE_USER_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_STDDEV_SAMPLE_USER_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_SUM_POINTS_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_SUM_POINTS_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_SUM_RANK_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_SUM_RANK_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_SUM_RECORD_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_SUM_RECORD_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_SUM_TIME_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_SUM_TIME_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_SUM_TOURNAMENT_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_SUM_TOURNAMENT_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_SUM_USER_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_SUM_USER_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_POPULATION_POINTS_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_POPULATION_POINTS_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_POPULATION_RANK_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_POPULATION_RANK_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_POPULATION_RECORD_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_POPULATION_RECORD_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_POPULATION_TIME_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_POPULATION_TIME_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_POPULATION_TOURNAMENT_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_POPULATION_TOURNAMENT_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_POPULATION_USER_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_POPULATION_USER_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_SAMPLE_POINTS_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_SAMPLE_POINTS_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_SAMPLE_RANK_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_SAMPLE_RANK_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_SAMPLE_RECORD_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_SAMPLE_RECORD_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_SAMPLE_TIME_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_SAMPLE_TIME_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_SAMPLE_TOURNAMENT_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_SAMPLE_TOURNAMENT_ID_DESC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_SAMPLE_USER_ID_ASC'
  | 'TRACK_TOURNAMENT_RESULTS_VARIANCE_SAMPLE_USER_ID_DESC'
  | 'USER_ID_ASC'
  | 'USER_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_CONTRIBUTION_RANK_ASC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_CONTRIBUTION_RANK_DESC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_LEVEL_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_LEVEL_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_LEVEL_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_LEVEL_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_LEVEL_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_LEVEL_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_LEVEL_POSITION_ASC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_LEVEL_POSITION_DESC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_PLAYER_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_PLAYER_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_RECORD_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_RECORD_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_USER_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_AVERAGE_USER_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_COUNT_ASC'
  | 'USER_POINT_CONTRIBUTIONS_COUNT_DESC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_CONTRIBUTION_RANK_ASC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_CONTRIBUTION_RANK_DESC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_DATE_CALCULATED_ASC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_DATE_CALCULATED_DESC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_LEVEL_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_LEVEL_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_LEVEL_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_LEVEL_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_LEVEL_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_LEVEL_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_LEVEL_POSITION_ASC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_LEVEL_POSITION_DESC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_PLAYER_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_PLAYER_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_RECORD_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_RECORD_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_USER_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_DISTINCT_COUNT_USER_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_CONTRIBUTION_RANK_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_CONTRIBUTION_RANK_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_LEVEL_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_LEVEL_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_LEVEL_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_LEVEL_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_LEVEL_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_LEVEL_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_LEVEL_POSITION_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_LEVEL_POSITION_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_PLAYER_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_PLAYER_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_RECORD_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_RECORD_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_USER_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MAX_USER_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_CONTRIBUTION_RANK_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_CONTRIBUTION_RANK_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_LEVEL_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_LEVEL_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_LEVEL_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_LEVEL_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_LEVEL_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_LEVEL_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_LEVEL_POSITION_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_LEVEL_POSITION_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_PLAYER_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_PLAYER_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_RECORD_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_RECORD_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_USER_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_MIN_USER_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_CONTRIBUTION_RANK_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_CONTRIBUTION_RANK_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_LEVEL_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_LEVEL_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_LEVEL_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_LEVEL_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_LEVEL_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_LEVEL_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_LEVEL_POSITION_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_LEVEL_POSITION_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_PLAYER_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_PLAYER_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_RECORD_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_RECORD_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_USER_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_POPULATION_USER_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_CONTRIBUTION_RANK_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_CONTRIBUTION_RANK_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_LEVEL_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_LEVEL_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_LEVEL_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_LEVEL_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_LEVEL_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_LEVEL_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_LEVEL_POSITION_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_LEVEL_POSITION_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_PLAYER_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_PLAYER_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_RECORD_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_RECORD_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_USER_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_STDDEV_SAMPLE_USER_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_CONTRIBUTION_RANK_ASC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_CONTRIBUTION_RANK_DESC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_LEVEL_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_LEVEL_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_LEVEL_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_LEVEL_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_LEVEL_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_LEVEL_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_LEVEL_POSITION_ASC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_LEVEL_POSITION_DESC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_PLAYER_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_PLAYER_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_RECORD_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_RECORD_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_USER_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_SUM_USER_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_CONTRIBUTION_RANK_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_CONTRIBUTION_RANK_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_LEVEL_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_LEVEL_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_LEVEL_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_LEVEL_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_LEVEL_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_LEVEL_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_LEVEL_POSITION_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_LEVEL_POSITION_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_PLAYER_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_PLAYER_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_RECORD_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_RECORD_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_USER_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_POPULATION_USER_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_CONTRIBUTION_RANK_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_CONTRIBUTION_RANK_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_LEVEL_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_LEVEL_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_LEVEL_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_LEVEL_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_LEVEL_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_LEVEL_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_LEVEL_POSITION_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_LEVEL_POSITION_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_PLAYER_DECAYED_POINTS_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_PLAYER_DECAYED_POINTS_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_RECORD_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_RECORD_ID_DESC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_USER_ID_ASC'
  | 'USER_POINT_CONTRIBUTIONS_VARIANCE_SAMPLE_USER_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_AVERAGE_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_AVERAGE_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_AVERAGE_LEVEL_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_AVERAGE_LEVEL_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_AVERAGE_RECORD_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_AVERAGE_RECORD_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_AVERAGE_USER_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_AVERAGE_USER_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_COUNT_ASC'
  | 'WORLD_RECORD_GLOBALS_COUNT_DESC'
  | 'WORLD_RECORD_GLOBALS_DISTINCT_COUNT_DATE_CREATED_ASC'
  | 'WORLD_RECORD_GLOBALS_DISTINCT_COUNT_DATE_CREATED_DESC'
  | 'WORLD_RECORD_GLOBALS_DISTINCT_COUNT_DATE_UPDATED_ASC'
  | 'WORLD_RECORD_GLOBALS_DISTINCT_COUNT_DATE_UPDATED_DESC'
  | 'WORLD_RECORD_GLOBALS_DISTINCT_COUNT_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_DISTINCT_COUNT_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_DISTINCT_COUNT_LEVEL_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_DISTINCT_COUNT_LEVEL_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_DISTINCT_COUNT_RECORD_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_DISTINCT_COUNT_RECORD_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_DISTINCT_COUNT_USER_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_DISTINCT_COUNT_USER_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_MAX_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_MAX_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_MAX_LEVEL_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_MAX_LEVEL_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_MAX_RECORD_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_MAX_RECORD_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_MAX_USER_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_MAX_USER_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_MIN_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_MIN_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_MIN_LEVEL_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_MIN_LEVEL_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_MIN_RECORD_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_MIN_RECORD_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_MIN_USER_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_MIN_USER_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_STDDEV_POPULATION_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_STDDEV_POPULATION_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_STDDEV_POPULATION_LEVEL_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_STDDEV_POPULATION_LEVEL_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_STDDEV_POPULATION_RECORD_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_STDDEV_POPULATION_RECORD_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_STDDEV_POPULATION_USER_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_STDDEV_POPULATION_USER_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_STDDEV_SAMPLE_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_STDDEV_SAMPLE_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_STDDEV_SAMPLE_LEVEL_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_STDDEV_SAMPLE_LEVEL_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_STDDEV_SAMPLE_RECORD_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_STDDEV_SAMPLE_RECORD_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_STDDEV_SAMPLE_USER_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_STDDEV_SAMPLE_USER_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_SUM_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_SUM_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_SUM_LEVEL_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_SUM_LEVEL_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_SUM_RECORD_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_SUM_RECORD_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_SUM_USER_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_SUM_USER_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_VARIANCE_POPULATION_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_VARIANCE_POPULATION_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_VARIANCE_POPULATION_LEVEL_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_VARIANCE_POPULATION_LEVEL_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_VARIANCE_POPULATION_RECORD_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_VARIANCE_POPULATION_RECORD_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_VARIANCE_POPULATION_USER_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_VARIANCE_POPULATION_USER_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_VARIANCE_SAMPLE_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_VARIANCE_SAMPLE_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_VARIANCE_SAMPLE_LEVEL_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_VARIANCE_SAMPLE_LEVEL_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_VARIANCE_SAMPLE_RECORD_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_VARIANCE_SAMPLE_RECORD_ID_DESC'
  | 'WORLD_RECORD_GLOBALS_VARIANCE_SAMPLE_USER_ID_ASC'
  | 'WORLD_RECORD_GLOBALS_VARIANCE_SAMPLE_USER_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_AVERAGE_LEVEL_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_AVERAGE_LEVEL_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_AVERAGE_POINTS_ASC'
  | 'ZSL_LEVEL_RESULTS_AVERAGE_POINTS_DESC'
  | 'ZSL_LEVEL_RESULTS_AVERAGE_POSITION_ASC'
  | 'ZSL_LEVEL_RESULTS_AVERAGE_POSITION_DESC'
  | 'ZSL_LEVEL_RESULTS_AVERAGE_RECORD_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_AVERAGE_RECORD_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_AVERAGE_TIME_ASC'
  | 'ZSL_LEVEL_RESULTS_AVERAGE_TIME_DESC'
  | 'ZSL_LEVEL_RESULTS_AVERAGE_USER_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_AVERAGE_USER_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_COUNT_ASC'
  | 'ZSL_LEVEL_RESULTS_COUNT_DESC'
  | 'ZSL_LEVEL_RESULTS_DISTINCT_COUNT_DATE_CREATED_ASC'
  | 'ZSL_LEVEL_RESULTS_DISTINCT_COUNT_DATE_CREATED_DESC'
  | 'ZSL_LEVEL_RESULTS_DISTINCT_COUNT_DATE_UPDATED_ASC'
  | 'ZSL_LEVEL_RESULTS_DISTINCT_COUNT_DATE_UPDATED_DESC'
  | 'ZSL_LEVEL_RESULTS_DISTINCT_COUNT_LEVEL_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_DISTINCT_COUNT_LEVEL_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_DISTINCT_COUNT_POINTS_ASC'
  | 'ZSL_LEVEL_RESULTS_DISTINCT_COUNT_POINTS_DESC'
  | 'ZSL_LEVEL_RESULTS_DISTINCT_COUNT_POSITION_ASC'
  | 'ZSL_LEVEL_RESULTS_DISTINCT_COUNT_POSITION_DESC'
  | 'ZSL_LEVEL_RESULTS_DISTINCT_COUNT_RECORD_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_DISTINCT_COUNT_RECORD_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_DISTINCT_COUNT_TIME_ASC'
  | 'ZSL_LEVEL_RESULTS_DISTINCT_COUNT_TIME_DESC'
  | 'ZSL_LEVEL_RESULTS_DISTINCT_COUNT_USER_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_DISTINCT_COUNT_USER_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_MAX_LEVEL_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_MAX_LEVEL_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_MAX_POINTS_ASC'
  | 'ZSL_LEVEL_RESULTS_MAX_POINTS_DESC'
  | 'ZSL_LEVEL_RESULTS_MAX_POSITION_ASC'
  | 'ZSL_LEVEL_RESULTS_MAX_POSITION_DESC'
  | 'ZSL_LEVEL_RESULTS_MAX_RECORD_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_MAX_RECORD_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_MAX_TIME_ASC'
  | 'ZSL_LEVEL_RESULTS_MAX_TIME_DESC'
  | 'ZSL_LEVEL_RESULTS_MAX_USER_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_MAX_USER_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_MIN_LEVEL_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_MIN_LEVEL_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_MIN_POINTS_ASC'
  | 'ZSL_LEVEL_RESULTS_MIN_POINTS_DESC'
  | 'ZSL_LEVEL_RESULTS_MIN_POSITION_ASC'
  | 'ZSL_LEVEL_RESULTS_MIN_POSITION_DESC'
  | 'ZSL_LEVEL_RESULTS_MIN_RECORD_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_MIN_RECORD_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_MIN_TIME_ASC'
  | 'ZSL_LEVEL_RESULTS_MIN_TIME_DESC'
  | 'ZSL_LEVEL_RESULTS_MIN_USER_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_MIN_USER_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_POPULATION_LEVEL_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_POPULATION_LEVEL_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_POPULATION_POINTS_ASC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_POPULATION_POINTS_DESC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_POPULATION_POSITION_ASC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_POPULATION_POSITION_DESC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_POPULATION_RECORD_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_POPULATION_RECORD_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_POPULATION_TIME_ASC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_POPULATION_TIME_DESC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_POPULATION_USER_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_POPULATION_USER_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_SAMPLE_LEVEL_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_SAMPLE_LEVEL_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_SAMPLE_POINTS_ASC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_SAMPLE_POINTS_DESC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_SAMPLE_POSITION_ASC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_SAMPLE_POSITION_DESC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_SAMPLE_RECORD_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_SAMPLE_RECORD_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_SAMPLE_TIME_ASC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_SAMPLE_TIME_DESC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_SAMPLE_USER_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_STDDEV_SAMPLE_USER_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_SUM_LEVEL_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_SUM_LEVEL_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_SUM_POINTS_ASC'
  | 'ZSL_LEVEL_RESULTS_SUM_POINTS_DESC'
  | 'ZSL_LEVEL_RESULTS_SUM_POSITION_ASC'
  | 'ZSL_LEVEL_RESULTS_SUM_POSITION_DESC'
  | 'ZSL_LEVEL_RESULTS_SUM_RECORD_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_SUM_RECORD_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_SUM_TIME_ASC'
  | 'ZSL_LEVEL_RESULTS_SUM_TIME_DESC'
  | 'ZSL_LEVEL_RESULTS_SUM_USER_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_SUM_USER_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_POPULATION_LEVEL_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_POPULATION_LEVEL_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_POPULATION_POINTS_ASC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_POPULATION_POINTS_DESC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_POPULATION_POSITION_ASC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_POPULATION_POSITION_DESC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_POPULATION_RECORD_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_POPULATION_RECORD_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_POPULATION_TIME_ASC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_POPULATION_TIME_DESC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_POPULATION_USER_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_POPULATION_USER_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_SAMPLE_LEVEL_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_SAMPLE_LEVEL_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_SAMPLE_POINTS_ASC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_SAMPLE_POINTS_DESC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_SAMPLE_POSITION_ASC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_SAMPLE_POSITION_DESC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_SAMPLE_RECORD_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_SAMPLE_RECORD_ID_DESC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_SAMPLE_TIME_ASC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_SAMPLE_TIME_DESC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_SAMPLE_USER_ID_ASC'
  | 'ZSL_LEVEL_RESULTS_VARIANCE_SAMPLE_USER_ID_DESC';

/** A filter to be used against String fields. All fields are combined with a logical ‘and.’ */
export type StringFilter = {
  /** Not equal to the specified value, treating null like an ordinary value. */
  distinctFrom?: string | null | undefined;
  /** Not equal to the specified value, treating null like an ordinary value (case-insensitive). */
  distinctFromInsensitive?: string | null | undefined;
  /** Ends with the specified string (case-sensitive). */
  endsWith?: string | null | undefined;
  /** Ends with the specified string (case-insensitive). */
  endsWithInsensitive?: string | null | undefined;
  /** Equal to the specified value. */
  equalTo?: string | null | undefined;
  /** Equal to the specified value (case-insensitive). */
  equalToInsensitive?: string | null | undefined;
  /** Greater than the specified value. */
  greaterThan?: string | null | undefined;
  /** Greater than the specified value (case-insensitive). */
  greaterThanInsensitive?: string | null | undefined;
  /** Greater than or equal to the specified value. */
  greaterThanOrEqualTo?: string | null | undefined;
  /** Greater than or equal to the specified value (case-insensitive). */
  greaterThanOrEqualToInsensitive?: string | null | undefined;
  /** Included in the specified list. */
  in?: Array<string> | null | undefined;
  /** Included in the specified list (case-insensitive). */
  inInsensitive?: Array<string> | null | undefined;
  /** Contains the specified string (case-sensitive). */
  includes?: string | null | undefined;
  /** Contains the specified string (case-insensitive). */
  includesInsensitive?: string | null | undefined;
  /** Is null (if `true` is specified) or is not null (if `false` is specified). */
  isNull?: boolean | null | undefined;
  /** Less than the specified value. */
  lessThan?: string | null | undefined;
  /** Less than the specified value (case-insensitive). */
  lessThanInsensitive?: string | null | undefined;
  /** Less than or equal to the specified value. */
  lessThanOrEqualTo?: string | null | undefined;
  /** Less than or equal to the specified value (case-insensitive). */
  lessThanOrEqualToInsensitive?: string | null | undefined;
  /** Matches the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters. */
  like?: string | null | undefined;
  /** Matches the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters. */
  likeInsensitive?: string | null | undefined;
  /** Equal to the specified value, treating null like an ordinary value. */
  notDistinctFrom?: string | null | undefined;
  /** Equal to the specified value, treating null like an ordinary value (case-insensitive). */
  notDistinctFromInsensitive?: string | null | undefined;
  /** Does not end with the specified string (case-sensitive). */
  notEndsWith?: string | null | undefined;
  /** Does not end with the specified string (case-insensitive). */
  notEndsWithInsensitive?: string | null | undefined;
  /** Not equal to the specified value. */
  notEqualTo?: string | null | undefined;
  /** Not equal to the specified value (case-insensitive). */
  notEqualToInsensitive?: string | null | undefined;
  /** Not included in the specified list. */
  notIn?: Array<string> | null | undefined;
  /** Not included in the specified list (case-insensitive). */
  notInInsensitive?: Array<string> | null | undefined;
  /** Does not contain the specified string (case-sensitive). */
  notIncludes?: string | null | undefined;
  /** Does not contain the specified string (case-insensitive). */
  notIncludesInsensitive?: string | null | undefined;
  /** Does not match the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters. */
  notLike?: string | null | undefined;
  /** Does not match the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters. */
  notLikeInsensitive?: string | null | undefined;
  /** Does not start with the specified string (case-sensitive). */
  notStartsWith?: string | null | undefined;
  /** Does not start with the specified string (case-insensitive). */
  notStartsWithInsensitive?: string | null | undefined;
  /** Starts with the specified string (case-sensitive). */
  startsWith?: string | null | undefined;
  /** Starts with the specified string (case-insensitive). */
  startsWithInsensitive?: string | null | undefined;
};

/** A filter to be used against aggregates of `TrackTournament` object types. */
export type TrackTournamentAggregatesFilter = {
  /** Mean average aggregate over matching `TrackTournament` objects. */
  average?: TrackTournamentAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `TrackTournament` objects. */
  distinctCount?: TrackTournamentDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `TrackTournament` object to be included within the aggregate. */
  filter?: TrackTournamentFilter | null | undefined;
  /** Maximum aggregate over matching `TrackTournament` objects. */
  max?: TrackTournamentMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `TrackTournament` objects. */
  min?: TrackTournamentMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `TrackTournament` objects. */
  stddevPopulation?: TrackTournamentStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `TrackTournament` objects. */
  stddevSample?: TrackTournamentStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `TrackTournament` objects. */
  sum?: TrackTournamentSumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `TrackTournament` objects. */
  variancePopulation?: TrackTournamentVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `TrackTournament` objects. */
  varianceSample?: TrackTournamentVarianceSampleAggregateFilter | null | undefined;
};

export type TrackTournamentAverageAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  pointsVersion?: BigFloatFilter | null | undefined;
  type?: BigFloatFilter | null | undefined;
};

export type TrackTournamentDistinctCountAggregateFilter = {
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  endAt?: BigIntFilter | null | undefined;
  finalizedAt?: BigIntFilter | null | undefined;
  id?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  pointsVersion?: BigIntFilter | null | undefined;
  slug?: BigIntFilter | null | undefined;
  startAt?: BigIntFilter | null | undefined;
  type?: BigIntFilter | null | undefined;
};

/** A filter to be used against `TrackTournament` object types. All fields are combined with a logical ‘and.’ */
export type TrackTournamentFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<TrackTournamentFilter> | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `endAt` field. */
  endAt?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `finalizedAt` field. */
  finalizedAt?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `id` field. */
  id?: IntFilter | null | undefined;
  /** Filter by the object’s `level` relation. */
  level?: LevelFilter | null | undefined;
  /** Filter by the object’s `levelId` field. */
  levelId?: IntFilter | null | undefined;
  /** Negates the expression. */
  not?: TrackTournamentFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<TrackTournamentFilter> | null | undefined;
  /** Filter by the object’s `pointsVersion` field. */
  pointsVersion?: IntFilter | null | undefined;
  /** Filter by the object’s `slug` field. */
  slug?: StringFilter | null | undefined;
  /** Filter by the object’s `startAt` field. */
  startAt?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `trackTournamentResults` relation. */
  trackTournamentResults?: TrackTournamentToManyTrackTournamentResultFilter | null | undefined;
  /** Some related `trackTournamentResults` exist. */
  trackTournamentResultsExist?: boolean | null | undefined;
  /** Filter by the object’s `type` field. */
  type?: IntFilter | null | undefined;
};

export type TrackTournamentMaxAggregateFilter = {
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  pointsVersion?: IntFilter | null | undefined;
  type?: IntFilter | null | undefined;
};

export type TrackTournamentMinAggregateFilter = {
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  pointsVersion?: IntFilter | null | undefined;
  type?: IntFilter | null | undefined;
};

/** A filter to be used against aggregates of `TrackTournamentResult` object types. */
export type TrackTournamentResultAggregatesFilter = {
  /** Mean average aggregate over matching `TrackTournamentResult` objects. */
  average?: TrackTournamentResultAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `TrackTournamentResult` objects. */
  distinctCount?: TrackTournamentResultDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `TrackTournamentResult` object to be included within the aggregate. */
  filter?: TrackTournamentResultFilter | null | undefined;
  /** Maximum aggregate over matching `TrackTournamentResult` objects. */
  max?: TrackTournamentResultMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `TrackTournamentResult` objects. */
  min?: TrackTournamentResultMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `TrackTournamentResult` objects. */
  stddevPopulation?: TrackTournamentResultStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `TrackTournamentResult` objects. */
  stddevSample?: TrackTournamentResultStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `TrackTournamentResult` objects. */
  sum?: TrackTournamentResultSumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `TrackTournamentResult` objects. */
  variancePopulation?: TrackTournamentResultVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `TrackTournamentResult` objects. */
  varianceSample?: TrackTournamentResultVarianceSampleAggregateFilter | null | undefined;
};

export type TrackTournamentResultAverageAggregateFilter = {
  points?: BigFloatFilter | null | undefined;
  rank?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  tournamentId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type TrackTournamentResultDistinctCountAggregateFilter = {
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  points?: BigIntFilter | null | undefined;
  rank?: BigIntFilter | null | undefined;
  recordId?: BigIntFilter | null | undefined;
  time?: BigIntFilter | null | undefined;
  tournamentId?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

/** A filter to be used against `TrackTournamentResult` object types. All fields are combined with a logical ‘and.’ */
export type TrackTournamentResultFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<TrackTournamentResultFilter> | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Negates the expression. */
  not?: TrackTournamentResultFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<TrackTournamentResultFilter> | null | undefined;
  /** Filter by the object’s `points` field. */
  points?: IntFilter | null | undefined;
  /** Filter by the object’s `rank` field. */
  rank?: IntFilter | null | undefined;
  /** Filter by the object’s `record` relation. */
  record?: RecordFilter | null | undefined;
  /** Filter by the object’s `recordId` field. */
  recordId?: IntFilter | null | undefined;
  /** Filter by the object’s `time` field. */
  time?: FloatFilter | null | undefined;
  /** Filter by the object’s `tournament` relation. */
  tournament?: TrackTournamentFilter | null | undefined;
  /** Filter by the object’s `tournamentId` field. */
  tournamentId?: IntFilter | null | undefined;
  /** Filter by the object’s `user` relation. */
  user?: UserFilter | null | undefined;
  /** Filter by the object’s `userId` field. */
  userId?: IntFilter | null | undefined;
};

export type TrackTournamentResultMaxAggregateFilter = {
  points?: IntFilter | null | undefined;
  rank?: IntFilter | null | undefined;
  recordId?: IntFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  tournamentId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type TrackTournamentResultMinAggregateFilter = {
  points?: IntFilter | null | undefined;
  rank?: IntFilter | null | undefined;
  recordId?: IntFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  tournamentId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type TrackTournamentResultStddevPopulationAggregateFilter = {
  points?: BigFloatFilter | null | undefined;
  rank?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  tournamentId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type TrackTournamentResultStddevSampleAggregateFilter = {
  points?: BigFloatFilter | null | undefined;
  rank?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  tournamentId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type TrackTournamentResultSumAggregateFilter = {
  points?: BigIntFilter | null | undefined;
  rank?: BigIntFilter | null | undefined;
  recordId?: BigIntFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  tournamentId?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

export type TrackTournamentResultVariancePopulationAggregateFilter = {
  points?: BigFloatFilter | null | undefined;
  rank?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  tournamentId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type TrackTournamentResultVarianceSampleAggregateFilter = {
  points?: BigFloatFilter | null | undefined;
  rank?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  tournamentId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type TrackTournamentStddevPopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  pointsVersion?: BigFloatFilter | null | undefined;
  type?: BigFloatFilter | null | undefined;
};

export type TrackTournamentStddevSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  pointsVersion?: BigFloatFilter | null | undefined;
  type?: BigFloatFilter | null | undefined;
};

export type TrackTournamentSumAggregateFilter = {
  id?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  pointsVersion?: BigIntFilter | null | undefined;
  type?: BigIntFilter | null | undefined;
};

/** A filter to be used against many `TrackTournamentResult` object types. All fields are combined with a logical ‘and.’ */
export type TrackTournamentToManyTrackTournamentResultFilter = {
  /** Aggregates across related `TrackTournamentResult` match the filter criteria. */
  aggregates?: TrackTournamentResultAggregatesFilter | null | undefined;
  /** Every related `TrackTournamentResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: TrackTournamentResultFilter | null | undefined;
  /** No related `TrackTournamentResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: TrackTournamentResultFilter | null | undefined;
  /** Some related `TrackTournamentResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: TrackTournamentResultFilter | null | undefined;
};

export type TrackTournamentVariancePopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  pointsVersion?: BigFloatFilter | null | undefined;
  type?: BigFloatFilter | null | undefined;
};

export type TrackTournamentVarianceSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  pointsVersion?: BigFloatFilter | null | undefined;
  type?: BigFloatFilter | null | undefined;
};

/** A filter to be used against `User` object types. All fields are combined with a logical ‘and.’ */
export type UserFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<UserFilter> | null | undefined;
  /** Filter by the object’s `banned` field. */
  banned?: BooleanFilter | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `discordActivityEvents` relation. */
  discordActivityEvents?: UserToManyDiscordActivityEventFilter | null | undefined;
  /** Filter by the object’s `discordActivityEventsAsPreviousUser` relation. */
  discordActivityEventsAsPreviousUser?: UserToManyDiscordActivityEventFilter | null | undefined;
  /** Some related `discordActivityEventsAsPreviousUser` exist. */
  discordActivityEventsAsPreviousUserExist?: boolean | null | undefined;
  /** Some related `discordActivityEvents` exist. */
  discordActivityEventsExist?: boolean | null | undefined;
  /** Filter by the object’s `discordId` field. */
  discordId?: BigIntFilter | null | undefined;
  /** Filter by the object’s `favourites` relation. */
  favourites?: UserToManyFavouriteFilter | null | undefined;
  /** Some related `favourites` exist. */
  favouritesExist?: boolean | null | undefined;
  /** Filter by the object’s `id` field. */
  id?: IntFilter | null | undefined;
  /** Filter by the object’s `levelItems` relation. */
  levelItems?: UserToManyLevelItemFilter | null | undefined;
  /** Some related `levelItems` exist. */
  levelItemsExist?: boolean | null | undefined;
  /** Negates the expression. */
  not?: UserFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<UserFilter> | null | undefined;
  /** Filter by the object’s `personalBestGlobals` relation. */
  personalBestGlobals?: UserToManyPersonalBestGlobalFilter | null | undefined;
  /** Some related `personalBestGlobals` exist. */
  personalBestGlobalsExist?: boolean | null | undefined;
  /** Filter by the object’s `playerSkillAggregate` relation. */
  playerSkillAggregate?: PlayerSkillAggregateFilter | null | undefined;
  /** A related `playerSkillAggregate` exists. */
  playerSkillAggregateExists?: boolean | null | undefined;
  /** Filter by the object’s `records` relation. */
  records?: UserToManyRecordFilter | null | undefined;
  /** Some related `records` exist. */
  recordsExist?: boolean | null | undefined;
  /** Filter by the object’s `steamId` field. */
  steamId?: BigIntFilter | null | undefined;
  /** Filter by the object’s `steamName` field. */
  steamName?: StringFilter | null | undefined;
  /** Filter by the object’s `trackTournamentResults` relation. */
  trackTournamentResults?: UserToManyTrackTournamentResultFilter | null | undefined;
  /** Some related `trackTournamentResults` exist. */
  trackTournamentResultsExist?: boolean | null | undefined;
  /** Filter by the object’s `userPointContributions` relation. */
  userPointContributions?: UserToManyUserPointContributionFilter | null | undefined;
  /** Some related `userPointContributions` exist. */
  userPointContributionsExist?: boolean | null | undefined;
  /** A related `userPoint` exists. */
  userPointExists?: boolean | null | undefined;
  /** Filter by the object’s `userPoint` relation. */
  userPoints?: UserPointFilter | null | undefined;
  /** Filter by the object’s `userPointsHistories` relation. */
  userPointsHistories?: UserToManyUserPointsHistoryFilter | null | undefined;
  /** Some related `userPointsHistories` exist. */
  userPointsHistoriesExist?: boolean | null | undefined;
  /** Filter by the object’s `votes` relation. */
  votes?: UserToManyVoteFilter | null | undefined;
  /** Some related `votes` exist. */
  votesExist?: boolean | null | undefined;
  /** Filter by the object’s `workshopItems` relation. */
  workshopItems?: UserToManyWorkshopItemFilter | null | undefined;
  /** Some related `workshopItems` exist. */
  workshopItemsExist?: boolean | null | undefined;
  /** Filter by the object’s `worldRecordGlobals` relation. */
  worldRecordGlobals?: UserToManyWorldRecordGlobalFilter | null | undefined;
  /** Some related `worldRecordGlobals` exist. */
  worldRecordGlobalsExist?: boolean | null | undefined;
  /** Filter by the object’s `zslLevelResults` relation. */
  zslLevelResults?: UserToManyZslLevelResultFilter | null | undefined;
  /** Some related `zslLevelResults` exist. */
  zslLevelResultsExist?: boolean | null | undefined;
  /** Filter by the object’s `zslRoundResults` relation. */
  zslRoundResults?: UserToManyZslRoundResultFilter | null | undefined;
  /** Some related `zslRoundResults` exist. */
  zslRoundResultsExist?: boolean | null | undefined;
  /** Filter by the object’s `zslSeasonResults` relation. */
  zslSeasonResults?: UserToManyZslSeasonResultFilter | null | undefined;
  /** Some related `zslSeasonResults` exist. */
  zslSeasonResultsExist?: boolean | null | undefined;
};

/** A filter to be used against aggregates of `UserPointContribution` object types. */
export type UserPointContributionAggregatesFilter = {
  /** Mean average aggregate over matching `UserPointContribution` objects. */
  average?: UserPointContributionAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `UserPointContribution` objects. */
  distinctCount?: UserPointContributionDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `UserPointContribution` object to be included within the aggregate. */
  filter?: UserPointContributionFilter | null | undefined;
  /** Maximum aggregate over matching `UserPointContribution` objects. */
  max?: UserPointContributionMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `UserPointContribution` objects. */
  min?: UserPointContributionMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `UserPointContribution` objects. */
  stddevPopulation?: UserPointContributionStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `UserPointContribution` objects. */
  stddevSample?: UserPointContributionStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `UserPointContribution` objects. */
  sum?: UserPointContributionSumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `UserPointContribution` objects. */
  variancePopulation?: UserPointContributionVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `UserPointContribution` objects. */
  varianceSample?: UserPointContributionVarianceSampleAggregateFilter | null | undefined;
};

export type UserPointContributionAverageAggregateFilter = {
  contributionRank?: BigFloatFilter | null | undefined;
  levelDecayedPoints?: FloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  levelPoints?: BigFloatFilter | null | undefined;
  levelPosition?: BigFloatFilter | null | undefined;
  playerDecayedPoints?: FloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type UserPointContributionDistinctCountAggregateFilter = {
  contributionRank?: BigIntFilter | null | undefined;
  dateCalculated?: BigIntFilter | null | undefined;
  levelDecayedPoints?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  levelPoints?: BigIntFilter | null | undefined;
  levelPosition?: BigIntFilter | null | undefined;
  playerDecayedPoints?: BigIntFilter | null | undefined;
  recordId?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

/** A filter to be used against `UserPointContribution` object types. All fields are combined with a logical ‘and.’ */
export type UserPointContributionFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<UserPointContributionFilter> | null | undefined;
  /** Filter by the object’s `contributionRank` field. */
  contributionRank?: IntFilter | null | undefined;
  /** Filter by the object’s `dateCalculated` field. */
  dateCalculated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `level` relation. */
  level?: LevelFilter | null | undefined;
  /** Filter by the object’s `levelDecayedPoints` field. */
  levelDecayedPoints?: FloatFilter | null | undefined;
  /** Filter by the object’s `levelId` field. */
  levelId?: IntFilter | null | undefined;
  /** Filter by the object’s `levelPoints` field. */
  levelPoints?: IntFilter | null | undefined;
  /** Filter by the object’s `levelPosition` field. */
  levelPosition?: IntFilter | null | undefined;
  /** Negates the expression. */
  not?: UserPointContributionFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<UserPointContributionFilter> | null | undefined;
  /** Filter by the object’s `playerDecayedPoints` field. */
  playerDecayedPoints?: FloatFilter | null | undefined;
  /** Filter by the object’s `record` relation. */
  record?: RecordFilter | null | undefined;
  /** Filter by the object’s `recordId` field. */
  recordId?: IntFilter | null | undefined;
  /** Filter by the object’s `user` relation. */
  user?: UserFilter | null | undefined;
  /** Filter by the object’s `userId` field. */
  userId?: IntFilter | null | undefined;
};

export type UserPointContributionMaxAggregateFilter = {
  contributionRank?: IntFilter | null | undefined;
  levelDecayedPoints?: FloatFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  levelPoints?: IntFilter | null | undefined;
  levelPosition?: IntFilter | null | undefined;
  playerDecayedPoints?: FloatFilter | null | undefined;
  recordId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type UserPointContributionMinAggregateFilter = {
  contributionRank?: IntFilter | null | undefined;
  levelDecayedPoints?: FloatFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  levelPoints?: IntFilter | null | undefined;
  levelPosition?: IntFilter | null | undefined;
  playerDecayedPoints?: FloatFilter | null | undefined;
  recordId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type UserPointContributionStddevPopulationAggregateFilter = {
  contributionRank?: BigFloatFilter | null | undefined;
  levelDecayedPoints?: FloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  levelPoints?: BigFloatFilter | null | undefined;
  levelPosition?: BigFloatFilter | null | undefined;
  playerDecayedPoints?: FloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type UserPointContributionStddevSampleAggregateFilter = {
  contributionRank?: BigFloatFilter | null | undefined;
  levelDecayedPoints?: FloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  levelPoints?: BigFloatFilter | null | undefined;
  levelPosition?: BigFloatFilter | null | undefined;
  playerDecayedPoints?: FloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type UserPointContributionSumAggregateFilter = {
  contributionRank?: BigIntFilter | null | undefined;
  levelDecayedPoints?: FloatFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  levelPoints?: BigIntFilter | null | undefined;
  levelPosition?: BigIntFilter | null | undefined;
  playerDecayedPoints?: FloatFilter | null | undefined;
  recordId?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

export type UserPointContributionVariancePopulationAggregateFilter = {
  contributionRank?: BigFloatFilter | null | undefined;
  levelDecayedPoints?: FloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  levelPoints?: BigFloatFilter | null | undefined;
  levelPosition?: BigFloatFilter | null | undefined;
  playerDecayedPoints?: FloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type UserPointContributionVarianceSampleAggregateFilter = {
  contributionRank?: BigFloatFilter | null | undefined;
  levelDecayedPoints?: FloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  levelPoints?: BigFloatFilter | null | undefined;
  levelPosition?: BigFloatFilter | null | undefined;
  playerDecayedPoints?: FloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

/** Methods to use when ordering `UserPointContribution`. */
export type UserPointContributionsOrderBy =
  | 'CONTRIBUTION_RANK_ASC'
  | 'CONTRIBUTION_RANK_DESC'
  | 'DATE_CALCULATED_ASC'
  | 'DATE_CALCULATED_DESC'
  | 'LEVEL_DECAYED_POINTS_ASC'
  | 'LEVEL_DECAYED_POINTS_DESC'
  | 'LEVEL_ID_ASC'
  | 'LEVEL_ID_DESC'
  | 'LEVEL_POINTS_ASC'
  | 'LEVEL_POINTS_DESC'
  | 'LEVEL_POSITION_ASC'
  | 'LEVEL_POSITION_DESC'
  | 'NATURAL'
  | 'PLAYER_DECAYED_POINTS_ASC'
  | 'PLAYER_DECAYED_POINTS_DESC'
  | 'PRIMARY_KEY_ASC'
  | 'PRIMARY_KEY_DESC'
  | 'RECORD_ID_ASC'
  | 'RECORD_ID_DESC'
  | 'USER_ID_ASC'
  | 'USER_ID_DESC';

/** A filter to be used against `UserPoint` object types. All fields are combined with a logical ‘and.’ */
export type UserPointFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<UserPointFilter> | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Negates the expression. */
  not?: UserPointFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<UserPointFilter> | null | undefined;
  /** Filter by the object’s `points` field. */
  points?: IntFilter | null | undefined;
  /** Filter by the object’s `rank` field. */
  rank?: IntFilter | null | undefined;
  /** Filter by the object’s `totalPoints` field. */
  totalPoints?: IntFilter | null | undefined;
  /** Filter by the object’s `user` relation. */
  user?: UserFilter | null | undefined;
  /** Filter by the object’s `userId` field. */
  userId?: IntFilter | null | undefined;
  /** Filter by the object’s `worldRecords` field. */
  worldRecords?: IntFilter | null | undefined;
};

/** A filter to be used against aggregates of `UserPointsHistory` object types. */
export type UserPointsHistoryAggregatesFilter = {
  /** Mean average aggregate over matching `UserPointsHistory` objects. */
  average?: UserPointsHistoryAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `UserPointsHistory` objects. */
  distinctCount?: UserPointsHistoryDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `UserPointsHistory` object to be included within the aggregate. */
  filter?: UserPointsHistoryFilter | null | undefined;
  /** Maximum aggregate over matching `UserPointsHistory` objects. */
  max?: UserPointsHistoryMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `UserPointsHistory` objects. */
  min?: UserPointsHistoryMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `UserPointsHistory` objects. */
  stddevPopulation?: UserPointsHistoryStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `UserPointsHistory` objects. */
  stddevSample?: UserPointsHistoryStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `UserPointsHistory` objects. */
  sum?: UserPointsHistorySumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `UserPointsHistory` objects. */
  variancePopulation?: UserPointsHistoryVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `UserPointsHistory` objects. */
  varianceSample?: UserPointsHistoryVarianceSampleAggregateFilter | null | undefined;
};

export type UserPointsHistoryAverageAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  rank?: BigFloatFilter | null | undefined;
  totalPoints?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
  worldRecords?: BigFloatFilter | null | undefined;
};

export type UserPointsHistoryDistinctCountAggregateFilter = {
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  id?: BigIntFilter | null | undefined;
  points?: BigIntFilter | null | undefined;
  rank?: BigIntFilter | null | undefined;
  totalPoints?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
  worldRecords?: BigIntFilter | null | undefined;
};

/** A filter to be used against `UserPointsHistory` object types. All fields are combined with a logical ‘and.’ */
export type UserPointsHistoryFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<UserPointsHistoryFilter> | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `id` field. */
  id?: IntFilter | null | undefined;
  /** Negates the expression. */
  not?: UserPointsHistoryFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<UserPointsHistoryFilter> | null | undefined;
  /** Filter by the object’s `points` field. */
  points?: IntFilter | null | undefined;
  /** Filter by the object’s `rank` field. */
  rank?: IntFilter | null | undefined;
  /** Filter by the object’s `totalPoints` field. */
  totalPoints?: IntFilter | null | undefined;
  /** Filter by the object’s `user` relation. */
  user?: UserFilter | null | undefined;
  /** Filter by the object’s `userId` field. */
  userId?: IntFilter | null | undefined;
  /** Filter by the object’s `worldRecords` field. */
  worldRecords?: IntFilter | null | undefined;
};

export type UserPointsHistoryMaxAggregateFilter = {
  id?: IntFilter | null | undefined;
  points?: IntFilter | null | undefined;
  rank?: IntFilter | null | undefined;
  totalPoints?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
  worldRecords?: IntFilter | null | undefined;
};

export type UserPointsHistoryMinAggregateFilter = {
  id?: IntFilter | null | undefined;
  points?: IntFilter | null | undefined;
  rank?: IntFilter | null | undefined;
  totalPoints?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
  worldRecords?: IntFilter | null | undefined;
};

export type UserPointsHistoryStddevPopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  rank?: BigFloatFilter | null | undefined;
  totalPoints?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
  worldRecords?: BigFloatFilter | null | undefined;
};

export type UserPointsHistoryStddevSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  rank?: BigFloatFilter | null | undefined;
  totalPoints?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
  worldRecords?: BigFloatFilter | null | undefined;
};

export type UserPointsHistorySumAggregateFilter = {
  id?: BigIntFilter | null | undefined;
  points?: BigIntFilter | null | undefined;
  rank?: BigIntFilter | null | undefined;
  totalPoints?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
  worldRecords?: BigIntFilter | null | undefined;
};

export type UserPointsHistoryVariancePopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  rank?: BigFloatFilter | null | undefined;
  totalPoints?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
  worldRecords?: BigFloatFilter | null | undefined;
};

export type UserPointsHistoryVarianceSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  rank?: BigFloatFilter | null | undefined;
  totalPoints?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
  worldRecords?: BigFloatFilter | null | undefined;
};

/** Methods to use when ordering `UserPoint`. */
export type UserPointsOrderBy =
  | 'DATE_CREATED_ASC'
  | 'DATE_CREATED_DESC'
  | 'DATE_UPDATED_ASC'
  | 'DATE_UPDATED_DESC'
  | 'NATURAL'
  | 'POINTS_ASC'
  | 'POINTS_DESC'
  | 'PRIMARY_KEY_ASC'
  | 'PRIMARY_KEY_DESC'
  | 'RANK_ASC'
  | 'RANK_DESC'
  | 'TOTAL_POINTS_ASC'
  | 'TOTAL_POINTS_DESC'
  | 'USER_ID_ASC'
  | 'USER_ID_DESC'
  | 'WORLD_RECORDS_ASC'
  | 'WORLD_RECORDS_DESC';

/** A filter to be used against many `DiscordActivityEvent` object types. All fields are combined with a logical ‘and.’ */
export type UserToManyDiscordActivityEventFilter = {
  /** Aggregates across related `DiscordActivityEvent` match the filter criteria. */
  aggregates?: DiscordActivityEventAggregatesFilter | null | undefined;
  /** Every related `DiscordActivityEvent` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: DiscordActivityEventFilter | null | undefined;
  /** No related `DiscordActivityEvent` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: DiscordActivityEventFilter | null | undefined;
  /** Some related `DiscordActivityEvent` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: DiscordActivityEventFilter | null | undefined;
};

/** A filter to be used against many `Favourite` object types. All fields are combined with a logical ‘and.’ */
export type UserToManyFavouriteFilter = {
  /** Aggregates across related `Favourite` match the filter criteria. */
  aggregates?: FavouriteAggregatesFilter | null | undefined;
  /** Every related `Favourite` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: FavouriteFilter | null | undefined;
  /** No related `Favourite` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: FavouriteFilter | null | undefined;
  /** Some related `Favourite` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: FavouriteFilter | null | undefined;
};

/** A filter to be used against many `LevelItem` object types. All fields are combined with a logical ‘and.’ */
export type UserToManyLevelItemFilter = {
  /** Aggregates across related `LevelItem` match the filter criteria. */
  aggregates?: LevelItemAggregatesFilter | null | undefined;
  /** Every related `LevelItem` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: LevelItemFilter | null | undefined;
  /** No related `LevelItem` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: LevelItemFilter | null | undefined;
  /** Some related `LevelItem` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: LevelItemFilter | null | undefined;
};

/** A filter to be used against many `PersonalBestGlobal` object types. All fields are combined with a logical ‘and.’ */
export type UserToManyPersonalBestGlobalFilter = {
  /** Aggregates across related `PersonalBestGlobal` match the filter criteria. */
  aggregates?: PersonalBestGlobalAggregatesFilter | null | undefined;
  /** Every related `PersonalBestGlobal` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: PersonalBestGlobalFilter | null | undefined;
  /** No related `PersonalBestGlobal` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: PersonalBestGlobalFilter | null | undefined;
  /** Some related `PersonalBestGlobal` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: PersonalBestGlobalFilter | null | undefined;
};

/** A filter to be used against many `Record` object types. All fields are combined with a logical ‘and.’ */
export type UserToManyRecordFilter = {
  /** Aggregates across related `Record` match the filter criteria. */
  aggregates?: RecordAggregatesFilter | null | undefined;
  /** Every related `Record` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: RecordFilter | null | undefined;
  /** No related `Record` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: RecordFilter | null | undefined;
  /** Some related `Record` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: RecordFilter | null | undefined;
};

/** A filter to be used against many `TrackTournamentResult` object types. All fields are combined with a logical ‘and.’ */
export type UserToManyTrackTournamentResultFilter = {
  /** Aggregates across related `TrackTournamentResult` match the filter criteria. */
  aggregates?: TrackTournamentResultAggregatesFilter | null | undefined;
  /** Every related `TrackTournamentResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: TrackTournamentResultFilter | null | undefined;
  /** No related `TrackTournamentResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: TrackTournamentResultFilter | null | undefined;
  /** Some related `TrackTournamentResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: TrackTournamentResultFilter | null | undefined;
};

/** A filter to be used against many `UserPointContribution` object types. All fields are combined with a logical ‘and.’ */
export type UserToManyUserPointContributionFilter = {
  /** Aggregates across related `UserPointContribution` match the filter criteria. */
  aggregates?: UserPointContributionAggregatesFilter | null | undefined;
  /** Every related `UserPointContribution` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: UserPointContributionFilter | null | undefined;
  /** No related `UserPointContribution` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: UserPointContributionFilter | null | undefined;
  /** Some related `UserPointContribution` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: UserPointContributionFilter | null | undefined;
};

/** A filter to be used against many `UserPointsHistory` object types. All fields are combined with a logical ‘and.’ */
export type UserToManyUserPointsHistoryFilter = {
  /** Aggregates across related `UserPointsHistory` match the filter criteria. */
  aggregates?: UserPointsHistoryAggregatesFilter | null | undefined;
  /** Every related `UserPointsHistory` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: UserPointsHistoryFilter | null | undefined;
  /** No related `UserPointsHistory` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: UserPointsHistoryFilter | null | undefined;
  /** Some related `UserPointsHistory` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: UserPointsHistoryFilter | null | undefined;
};

/** A filter to be used against many `Vote` object types. All fields are combined with a logical ‘and.’ */
export type UserToManyVoteFilter = {
  /** Aggregates across related `Vote` match the filter criteria. */
  aggregates?: VoteAggregatesFilter | null | undefined;
  /** Every related `Vote` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: VoteFilter | null | undefined;
  /** No related `Vote` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: VoteFilter | null | undefined;
  /** Some related `Vote` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: VoteFilter | null | undefined;
};

/** A filter to be used against many `WorkshopItem` object types. All fields are combined with a logical ‘and.’ */
export type UserToManyWorkshopItemFilter = {
  /** Aggregates across related `WorkshopItem` match the filter criteria. */
  aggregates?: WorkshopItemAggregatesFilter | null | undefined;
  /** Every related `WorkshopItem` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: WorkshopItemFilter | null | undefined;
  /** No related `WorkshopItem` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: WorkshopItemFilter | null | undefined;
  /** Some related `WorkshopItem` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: WorkshopItemFilter | null | undefined;
};

/** A filter to be used against many `WorldRecordGlobal` object types. All fields are combined with a logical ‘and.’ */
export type UserToManyWorldRecordGlobalFilter = {
  /** Aggregates across related `WorldRecordGlobal` match the filter criteria. */
  aggregates?: WorldRecordGlobalAggregatesFilter | null | undefined;
  /** Every related `WorldRecordGlobal` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: WorldRecordGlobalFilter | null | undefined;
  /** No related `WorldRecordGlobal` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: WorldRecordGlobalFilter | null | undefined;
  /** Some related `WorldRecordGlobal` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: WorldRecordGlobalFilter | null | undefined;
};

/** A filter to be used against many `ZslLevelResult` object types. All fields are combined with a logical ‘and.’ */
export type UserToManyZslLevelResultFilter = {
  /** Aggregates across related `ZslLevelResult` match the filter criteria. */
  aggregates?: ZslLevelResultAggregatesFilter | null | undefined;
  /** Every related `ZslLevelResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: ZslLevelResultFilter | null | undefined;
  /** No related `ZslLevelResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: ZslLevelResultFilter | null | undefined;
  /** Some related `ZslLevelResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: ZslLevelResultFilter | null | undefined;
};

/** A filter to be used against many `ZslRoundResult` object types. All fields are combined with a logical ‘and.’ */
export type UserToManyZslRoundResultFilter = {
  /** Aggregates across related `ZslRoundResult` match the filter criteria. */
  aggregates?: ZslRoundResultAggregatesFilter | null | undefined;
  /** Every related `ZslRoundResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: ZslRoundResultFilter | null | undefined;
  /** No related `ZslRoundResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: ZslRoundResultFilter | null | undefined;
  /** Some related `ZslRoundResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: ZslRoundResultFilter | null | undefined;
};

/** A filter to be used against many `ZslSeasonResult` object types. All fields are combined with a logical ‘and.’ */
export type UserToManyZslSeasonResultFilter = {
  /** Aggregates across related `ZslSeasonResult` match the filter criteria. */
  aggregates?: ZslSeasonResultAggregatesFilter | null | undefined;
  /** Every related `ZslSeasonResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: ZslSeasonResultFilter | null | undefined;
  /** No related `ZslSeasonResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: ZslSeasonResultFilter | null | undefined;
  /** Some related `ZslSeasonResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: ZslSeasonResultFilter | null | undefined;
};

/** A filter to be used against aggregates of `Vote` object types. */
export type VoteAggregatesFilter = {
  /** Mean average aggregate over matching `Vote` objects. */
  average?: VoteAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `Vote` objects. */
  distinctCount?: VoteDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `Vote` object to be included within the aggregate. */
  filter?: VoteFilter | null | undefined;
  /** Maximum aggregate over matching `Vote` objects. */
  max?: VoteMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `Vote` objects. */
  min?: VoteMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `Vote` objects. */
  stddevPopulation?: VoteStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `Vote` objects. */
  stddevSample?: VoteStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `Vote` objects. */
  sum?: VoteSumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `Vote` objects. */
  variancePopulation?: VoteVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `Vote` objects. */
  varianceSample?: VoteVarianceSampleAggregateFilter | null | undefined;
};

export type VoteAverageAggregateFilter = {
  levelId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
  value?: BigFloatFilter | null | undefined;
};

export type VoteDistinctCountAggregateFilter = {
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
  value?: BigIntFilter | null | undefined;
};

/** A filter to be used against `Vote` object types. All fields are combined with a logical ‘and.’ */
export type VoteFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<VoteFilter> | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `level` relation. */
  level?: LevelFilter | null | undefined;
  /** Filter by the object’s `levelId` field. */
  levelId?: IntFilter | null | undefined;
  /** Negates the expression. */
  not?: VoteFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<VoteFilter> | null | undefined;
  /** Filter by the object’s `user` relation. */
  user?: UserFilter | null | undefined;
  /** Filter by the object’s `userId` field. */
  userId?: IntFilter | null | undefined;
  /** Filter by the object’s `value` field. */
  value?: IntFilter | null | undefined;
};

export type VoteMaxAggregateFilter = {
  levelId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
  value?: IntFilter | null | undefined;
};

export type VoteMinAggregateFilter = {
  levelId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
  value?: IntFilter | null | undefined;
};

export type VoteStddevPopulationAggregateFilter = {
  levelId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
  value?: BigFloatFilter | null | undefined;
};

export type VoteStddevSampleAggregateFilter = {
  levelId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
  value?: BigFloatFilter | null | undefined;
};

export type VoteSumAggregateFilter = {
  levelId?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
  value?: BigIntFilter | null | undefined;
};

export type VoteVariancePopulationAggregateFilter = {
  levelId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
  value?: BigFloatFilter | null | undefined;
};

export type VoteVarianceSampleAggregateFilter = {
  levelId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
  value?: BigFloatFilter | null | undefined;
};

/** A filter to be used against aggregates of `WorkshopItem` object types. */
export type WorkshopItemAggregatesFilter = {
  /** Mean average aggregate over matching `WorkshopItem` objects. */
  average?: WorkshopItemAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `WorkshopItem` objects. */
  distinctCount?: WorkshopItemDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `WorkshopItem` object to be included within the aggregate. */
  filter?: WorkshopItemFilter | null | undefined;
  /** Maximum aggregate over matching `WorkshopItem` objects. */
  max?: WorkshopItemMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `WorkshopItem` objects. */
  min?: WorkshopItemMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `WorkshopItem` objects. */
  stddevPopulation?: WorkshopItemStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `WorkshopItem` objects. */
  stddevSample?: WorkshopItemStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `WorkshopItem` objects. */
  sum?: WorkshopItemSumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `WorkshopItem` objects. */
  variancePopulation?: WorkshopItemVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `WorkshopItem` objects. */
  varianceSample?: WorkshopItemVarianceSampleAggregateFilter | null | undefined;
};

export type WorkshopItemAverageAggregateFilter = {
  authorId?: BigFloatFilter | null | undefined;
  fileSize?: BigFloatFilter | null | undefined;
  visibility?: BigFloatFilter | null | undefined;
  workshopId?: BigFloatFilter | null | undefined;
};

export type WorkshopItemDistinctCountAggregateFilter = {
  authorId?: BigIntFilter | null | undefined;
  createdAt?: BigIntFilter | null | undefined;
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  fileSize?: BigIntFilter | null | undefined;
  imageUrl?: BigIntFilter | null | undefined;
  name?: BigIntFilter | null | undefined;
  updatedAt?: BigIntFilter | null | undefined;
  visibility?: BigIntFilter | null | undefined;
  workshopId?: BigIntFilter | null | undefined;
};

/** A filter to be used against `WorkshopItem` object types. All fields are combined with a logical ‘and.’ */
export type WorkshopItemFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<WorkshopItemFilter> | null | undefined;
  /** Filter by the object’s `author` relation. */
  author?: UserFilter | null | undefined;
  /** Filter by the object’s `authorId` field. */
  authorId?: BigIntFilter | null | undefined;
  /** Filter by the object’s `createdAt` field. */
  createdAt?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `fileSize` field. */
  fileSize?: IntFilter | null | undefined;
  /** Filter by the object’s `imageUrl` field. */
  imageUrl?: StringFilter | null | undefined;
  /** Filter by the object’s `levelItems` relation. */
  levelItems?: WorkshopItemToManyLevelItemFilter | null | undefined;
  /** Some related `levelItems` exist. */
  levelItemsExist?: boolean | null | undefined;
  /** Filter by the object’s `name` field. */
  name?: StringFilter | null | undefined;
  /** Negates the expression. */
  not?: WorkshopItemFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<WorkshopItemFilter> | null | undefined;
  /** Filter by the object’s `updatedAt` field. */
  updatedAt?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `visibility` field. */
  visibility?: IntFilter | null | undefined;
  /** Filter by the object’s `workshopId` field. */
  workshopId?: BigIntFilter | null | undefined;
};

export type WorkshopItemMaxAggregateFilter = {
  authorId?: BigIntFilter | null | undefined;
  fileSize?: IntFilter | null | undefined;
  visibility?: IntFilter | null | undefined;
  workshopId?: BigIntFilter | null | undefined;
};

export type WorkshopItemMinAggregateFilter = {
  authorId?: BigIntFilter | null | undefined;
  fileSize?: IntFilter | null | undefined;
  visibility?: IntFilter | null | undefined;
  workshopId?: BigIntFilter | null | undefined;
};

export type WorkshopItemStddevPopulationAggregateFilter = {
  authorId?: BigFloatFilter | null | undefined;
  fileSize?: BigFloatFilter | null | undefined;
  visibility?: BigFloatFilter | null | undefined;
  workshopId?: BigFloatFilter | null | undefined;
};

export type WorkshopItemStddevSampleAggregateFilter = {
  authorId?: BigFloatFilter | null | undefined;
  fileSize?: BigFloatFilter | null | undefined;
  visibility?: BigFloatFilter | null | undefined;
  workshopId?: BigFloatFilter | null | undefined;
};

export type WorkshopItemSumAggregateFilter = {
  authorId?: BigFloatFilter | null | undefined;
  fileSize?: BigIntFilter | null | undefined;
  visibility?: BigIntFilter | null | undefined;
  workshopId?: BigFloatFilter | null | undefined;
};

/** A filter to be used against many `LevelItem` object types. All fields are combined with a logical ‘and.’ */
export type WorkshopItemToManyLevelItemFilter = {
  /** Aggregates across related `LevelItem` match the filter criteria. */
  aggregates?: LevelItemAggregatesFilter | null | undefined;
  /** Every related `LevelItem` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: LevelItemFilter | null | undefined;
  /** No related `LevelItem` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: LevelItemFilter | null | undefined;
  /** Some related `LevelItem` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: LevelItemFilter | null | undefined;
};

export type WorkshopItemVariancePopulationAggregateFilter = {
  authorId?: BigFloatFilter | null | undefined;
  fileSize?: BigFloatFilter | null | undefined;
  visibility?: BigFloatFilter | null | undefined;
  workshopId?: BigFloatFilter | null | undefined;
};

export type WorkshopItemVarianceSampleAggregateFilter = {
  authorId?: BigFloatFilter | null | undefined;
  fileSize?: BigFloatFilter | null | undefined;
  visibility?: BigFloatFilter | null | undefined;
  workshopId?: BigFloatFilter | null | undefined;
};

/** A filter to be used against aggregates of `WorldRecordGlobal` object types. */
export type WorldRecordGlobalAggregatesFilter = {
  /** Mean average aggregate over matching `WorldRecordGlobal` objects. */
  average?: WorldRecordGlobalAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `WorldRecordGlobal` objects. */
  distinctCount?: WorldRecordGlobalDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `WorldRecordGlobal` object to be included within the aggregate. */
  filter?: WorldRecordGlobalFilter | null | undefined;
  /** Maximum aggregate over matching `WorldRecordGlobal` objects. */
  max?: WorldRecordGlobalMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `WorldRecordGlobal` objects. */
  min?: WorldRecordGlobalMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `WorldRecordGlobal` objects. */
  stddevPopulation?: WorldRecordGlobalStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `WorldRecordGlobal` objects. */
  stddevSample?: WorldRecordGlobalStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `WorldRecordGlobal` objects. */
  sum?: WorldRecordGlobalSumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `WorldRecordGlobal` objects. */
  variancePopulation?: WorldRecordGlobalVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `WorldRecordGlobal` objects. */
  varianceSample?: WorldRecordGlobalVarianceSampleAggregateFilter | null | undefined;
};

export type WorldRecordGlobalAverageAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type WorldRecordGlobalDistinctCountAggregateFilter = {
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  id?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  recordId?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

/** A filter to be used against `WorldRecordGlobal` object types. All fields are combined with a logical ‘and.’ */
export type WorldRecordGlobalFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<WorldRecordGlobalFilter> | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `id` field. */
  id?: IntFilter | null | undefined;
  /** Filter by the object’s `level` relation. */
  level?: LevelFilter | null | undefined;
  /** Filter by the object’s `levelId` field. */
  levelId?: IntFilter | null | undefined;
  /** Negates the expression. */
  not?: WorldRecordGlobalFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<WorldRecordGlobalFilter> | null | undefined;
  /** Filter by the object’s `record` relation. */
  record?: RecordFilter | null | undefined;
  /** Filter by the object’s `recordId` field. */
  recordId?: IntFilter | null | undefined;
  /** Filter by the object’s `user` relation. */
  user?: UserFilter | null | undefined;
  /** Filter by the object’s `userId` field. */
  userId?: IntFilter | null | undefined;
};

export type WorldRecordGlobalMaxAggregateFilter = {
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  recordId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type WorldRecordGlobalMinAggregateFilter = {
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  recordId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type WorldRecordGlobalStddevPopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type WorldRecordGlobalStddevSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type WorldRecordGlobalSumAggregateFilter = {
  id?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  recordId?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

export type WorldRecordGlobalVariancePopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type WorldRecordGlobalVarianceSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

/** A filter to be used against aggregates of `ZslLevel` object types. */
export type ZslLevelAggregatesFilter = {
  /** Mean average aggregate over matching `ZslLevel` objects. */
  average?: ZslLevelAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `ZslLevel` objects. */
  distinctCount?: ZslLevelDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `ZslLevel` object to be included within the aggregate. */
  filter?: ZslLevelFilter | null | undefined;
  /** Maximum aggregate over matching `ZslLevel` objects. */
  max?: ZslLevelMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `ZslLevel` objects. */
  min?: ZslLevelMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `ZslLevel` objects. */
  stddevPopulation?: ZslLevelStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `ZslLevel` objects. */
  stddevSample?: ZslLevelStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `ZslLevel` objects. */
  sum?: ZslLevelSumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `ZslLevel` objects. */
  variancePopulation?: ZslLevelVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `ZslLevel` objects. */
  varianceSample?: ZslLevelVarianceSampleAggregateFilter | null | undefined;
};

export type ZslLevelAverageAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  roundId?: BigFloatFilter | null | undefined;
};

export type ZslLevelDistinctCountAggregateFilter = {
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  id?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  roundId?: BigIntFilter | null | undefined;
};

/** A filter to be used against `ZslLevel` object types. All fields are combined with a logical ‘and.’ */
export type ZslLevelFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<ZslLevelFilter> | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `id` field. */
  id?: IntFilter | null | undefined;
  /** Filter by the object’s `level` relation. */
  level?: LevelFilter | null | undefined;
  /** Filter by the object’s `levelId` field. */
  levelId?: IntFilter | null | undefined;
  /** Negates the expression. */
  not?: ZslLevelFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<ZslLevelFilter> | null | undefined;
  /** Filter by the object’s `round` relation. */
  round?: ZslRoundFilter | null | undefined;
  /** Filter by the object’s `roundId` field. */
  roundId?: IntFilter | null | undefined;
  /** Filter by the object’s `zslLevelResults` relation. */
  zslLevelResults?: ZslLevelToManyZslLevelResultFilter | null | undefined;
  /** Some related `zslLevelResults` exist. */
  zslLevelResultsExist?: boolean | null | undefined;
};

export type ZslLevelMaxAggregateFilter = {
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  roundId?: IntFilter | null | undefined;
};

export type ZslLevelMinAggregateFilter = {
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  roundId?: IntFilter | null | undefined;
};

/** A filter to be used against aggregates of `ZslLevelResult` object types. */
export type ZslLevelResultAggregatesFilter = {
  /** Mean average aggregate over matching `ZslLevelResult` objects. */
  average?: ZslLevelResultAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `ZslLevelResult` objects. */
  distinctCount?: ZslLevelResultDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `ZslLevelResult` object to be included within the aggregate. */
  filter?: ZslLevelResultFilter | null | undefined;
  /** Maximum aggregate over matching `ZslLevelResult` objects. */
  max?: ZslLevelResultMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `ZslLevelResult` objects. */
  min?: ZslLevelResultMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `ZslLevelResult` objects. */
  stddevPopulation?: ZslLevelResultStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `ZslLevelResult` objects. */
  stddevSample?: ZslLevelResultStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `ZslLevelResult` objects. */
  sum?: ZslLevelResultSumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `ZslLevelResult` objects. */
  variancePopulation?: ZslLevelResultVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `ZslLevelResult` objects. */
  varianceSample?: ZslLevelResultVarianceSampleAggregateFilter | null | undefined;
};

export type ZslLevelResultAverageAggregateFilter = {
  levelId?: BigFloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  position?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type ZslLevelResultDistinctCountAggregateFilter = {
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  points?: BigIntFilter | null | undefined;
  position?: BigIntFilter | null | undefined;
  recordId?: BigIntFilter | null | undefined;
  time?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

/** A filter to be used against `ZslLevelResult` object types. All fields are combined with a logical ‘and.’ */
export type ZslLevelResultFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<ZslLevelResultFilter> | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `level` relation. */
  level?: ZslLevelFilter | null | undefined;
  /** Filter by the object’s `levelId` field. */
  levelId?: IntFilter | null | undefined;
  /** Negates the expression. */
  not?: ZslLevelResultFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<ZslLevelResultFilter> | null | undefined;
  /** Filter by the object’s `points` field. */
  points?: IntFilter | null | undefined;
  /** Filter by the object’s `position` field. */
  position?: IntFilter | null | undefined;
  /** Filter by the object’s `record` relation. */
  record?: RecordFilter | null | undefined;
  /** A related `record` exists. */
  recordExists?: boolean | null | undefined;
  /** Filter by the object’s `recordId` field. */
  recordId?: IntFilter | null | undefined;
  /** Filter by the object’s `time` field. */
  time?: FloatFilter | null | undefined;
  /** Filter by the object’s `user` relation. */
  user?: UserFilter | null | undefined;
  /** Filter by the object’s `userId` field. */
  userId?: IntFilter | null | undefined;
};

export type ZslLevelResultMaxAggregateFilter = {
  levelId?: IntFilter | null | undefined;
  points?: IntFilter | null | undefined;
  position?: IntFilter | null | undefined;
  recordId?: IntFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type ZslLevelResultMinAggregateFilter = {
  levelId?: IntFilter | null | undefined;
  points?: IntFilter | null | undefined;
  position?: IntFilter | null | undefined;
  recordId?: IntFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type ZslLevelResultStddevPopulationAggregateFilter = {
  levelId?: BigFloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  position?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type ZslLevelResultStddevSampleAggregateFilter = {
  levelId?: BigFloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  position?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type ZslLevelResultSumAggregateFilter = {
  levelId?: BigIntFilter | null | undefined;
  points?: BigIntFilter | null | undefined;
  position?: BigIntFilter | null | undefined;
  recordId?: BigIntFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

export type ZslLevelResultVariancePopulationAggregateFilter = {
  levelId?: BigFloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  position?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type ZslLevelResultVarianceSampleAggregateFilter = {
  levelId?: BigFloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  position?: BigFloatFilter | null | undefined;
  recordId?: BigFloatFilter | null | undefined;
  time?: FloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type ZslLevelStddevPopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  roundId?: BigFloatFilter | null | undefined;
};

export type ZslLevelStddevSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  roundId?: BigFloatFilter | null | undefined;
};

export type ZslLevelSumAggregateFilter = {
  id?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  roundId?: BigIntFilter | null | undefined;
};

/** A filter to be used against many `ZslLevelResult` object types. All fields are combined with a logical ‘and.’ */
export type ZslLevelToManyZslLevelResultFilter = {
  /** Aggregates across related `ZslLevelResult` match the filter criteria. */
  aggregates?: ZslLevelResultAggregatesFilter | null | undefined;
  /** Every related `ZslLevelResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: ZslLevelResultFilter | null | undefined;
  /** No related `ZslLevelResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: ZslLevelResultFilter | null | undefined;
  /** Some related `ZslLevelResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: ZslLevelResultFilter | null | undefined;
};

export type ZslLevelVariancePopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  roundId?: BigFloatFilter | null | undefined;
};

export type ZslLevelVarianceSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  roundId?: BigFloatFilter | null | undefined;
};

/** A filter to be used against `ZslPointsStructure` object types. All fields are combined with a logical ‘and.’ */
export type ZslPointsStructureFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<ZslPointsStructureFilter> | null | undefined;
  /** Filter by the object’s `bestOf` field. */
  bestOf?: IntFilter | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `id` field. */
  id?: IntFilter | null | undefined;
  /** Filter by the object’s `minimumPoints` field. */
  minimumPoints?: IntFilter | null | undefined;
  /** Filter by the object’s `name` field. */
  name?: StringFilter | null | undefined;
  /** Negates the expression. */
  not?: ZslPointsStructureFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<ZslPointsStructureFilter> | null | undefined;
  /** Filter by the object’s `points` field. */
  points?: IntListFilter | null | undefined;
  /** Filter by the object’s `zslSeasons` relation. */
  zslSeasons?: ZslPointsStructureToManyZslSeasonFilter | null | undefined;
  /** Some related `zslSeasons` exist. */
  zslSeasonsExist?: boolean | null | undefined;
};

/** A filter to be used against many `ZslSeason` object types. All fields are combined with a logical ‘and.’ */
export type ZslPointsStructureToManyZslSeasonFilter = {
  /** Aggregates across related `ZslSeason` match the filter criteria. */
  aggregates?: ZslSeasonAggregatesFilter | null | undefined;
  /** Every related `ZslSeason` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: ZslSeasonFilter | null | undefined;
  /** No related `ZslSeason` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: ZslSeasonFilter | null | undefined;
  /** Some related `ZslSeason` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: ZslSeasonFilter | null | undefined;
};

/** A filter to be used against aggregates of `ZslRound` object types. */
export type ZslRoundAggregatesFilter = {
  /** Mean average aggregate over matching `ZslRound` objects. */
  average?: ZslRoundAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `ZslRound` objects. */
  distinctCount?: ZslRoundDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `ZslRound` object to be included within the aggregate. */
  filter?: ZslRoundFilter | null | undefined;
  /** Maximum aggregate over matching `ZslRound` objects. */
  max?: ZslRoundMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `ZslRound` objects. */
  min?: ZslRoundMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `ZslRound` objects. */
  stddevPopulation?: ZslRoundStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `ZslRound` objects. */
  stddevSample?: ZslRoundStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `ZslRound` objects. */
  sum?: ZslRoundSumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `ZslRound` objects. */
  variancePopulation?: ZslRoundVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `ZslRound` objects. */
  varianceSample?: ZslRoundVarianceSampleAggregateFilter | null | undefined;
};

export type ZslRoundAverageAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  round?: BigFloatFilter | null | undefined;
  seasonId?: BigFloatFilter | null | undefined;
  workshopId?: BigFloatFilter | null | undefined;
};

export type ZslRoundDistinctCountAggregateFilter = {
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  eventDate?: BigIntFilter | null | undefined;
  id?: BigIntFilter | null | undefined;
  name?: BigIntFilter | null | undefined;
  round?: BigIntFilter | null | undefined;
  seasonId?: BigIntFilter | null | undefined;
  workshopId?: BigIntFilter | null | undefined;
};

/** A filter to be used against `ZslRound` object types. All fields are combined with a logical ‘and.’ */
export type ZslRoundFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<ZslRoundFilter> | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `eventDate` field. */
  eventDate?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `id` field. */
  id?: IntFilter | null | undefined;
  /** Filter by the object’s `name` field. */
  name?: StringFilter | null | undefined;
  /** Negates the expression. */
  not?: ZslRoundFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<ZslRoundFilter> | null | undefined;
  /** Filter by the object’s `round` field. */
  round?: IntFilter | null | undefined;
  /** Filter by the object’s `season` relation. */
  season?: ZslSeasonFilter | null | undefined;
  /** Filter by the object’s `seasonId` field. */
  seasonId?: IntFilter | null | undefined;
  /** Filter by the object’s `workshopId` field. */
  workshopId?: BigIntFilter | null | undefined;
  /** Filter by the object’s `zslLevels` relation. */
  zslLevels?: ZslRoundToManyZslLevelFilter | null | undefined;
  /** Some related `zslLevels` exist. */
  zslLevelsExist?: boolean | null | undefined;
  /** Filter by the object’s `zslRoundResults` relation. */
  zslRoundResults?: ZslRoundToManyZslRoundResultFilter | null | undefined;
  /** Some related `zslRoundResults` exist. */
  zslRoundResultsExist?: boolean | null | undefined;
};

export type ZslRoundMaxAggregateFilter = {
  id?: IntFilter | null | undefined;
  round?: IntFilter | null | undefined;
  seasonId?: IntFilter | null | undefined;
  workshopId?: BigIntFilter | null | undefined;
};

export type ZslRoundMinAggregateFilter = {
  id?: IntFilter | null | undefined;
  round?: IntFilter | null | undefined;
  seasonId?: IntFilter | null | undefined;
  workshopId?: BigIntFilter | null | undefined;
};

/** A filter to be used against aggregates of `ZslRoundResult` object types. */
export type ZslRoundResultAggregatesFilter = {
  /** Mean average aggregate over matching `ZslRoundResult` objects. */
  average?: ZslRoundResultAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `ZslRoundResult` objects. */
  distinctCount?: ZslRoundResultDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `ZslRoundResult` object to be included within the aggregate. */
  filter?: ZslRoundResultFilter | null | undefined;
  /** Maximum aggregate over matching `ZslRoundResult` objects. */
  max?: ZslRoundResultMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `ZslRoundResult` objects. */
  min?: ZslRoundResultMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `ZslRoundResult` objects. */
  stddevPopulation?: ZslRoundResultStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `ZslRoundResult` objects. */
  stddevSample?: ZslRoundResultStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `ZslRoundResult` objects. */
  sum?: ZslRoundResultSumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `ZslRoundResult` objects. */
  variancePopulation?: ZslRoundResultVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `ZslRoundResult` objects. */
  varianceSample?: ZslRoundResultVarianceSampleAggregateFilter | null | undefined;
};

export type ZslRoundResultAverageAggregateFilter = {
  points?: BigFloatFilter | null | undefined;
  position?: BigFloatFilter | null | undefined;
  roundId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type ZslRoundResultDistinctCountAggregateFilter = {
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  points?: BigIntFilter | null | undefined;
  position?: BigIntFilter | null | undefined;
  roundId?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

/** A filter to be used against `ZslRoundResult` object types. All fields are combined with a logical ‘and.’ */
export type ZslRoundResultFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<ZslRoundResultFilter> | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Negates the expression. */
  not?: ZslRoundResultFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<ZslRoundResultFilter> | null | undefined;
  /** Filter by the object’s `points` field. */
  points?: IntFilter | null | undefined;
  /** Filter by the object’s `position` field. */
  position?: IntFilter | null | undefined;
  /** Filter by the object’s `round` relation. */
  round?: ZslRoundFilter | null | undefined;
  /** Filter by the object’s `roundId` field. */
  roundId?: IntFilter | null | undefined;
  /** Filter by the object’s `user` relation. */
  user?: UserFilter | null | undefined;
  /** Filter by the object’s `userId` field. */
  userId?: IntFilter | null | undefined;
};

export type ZslRoundResultMaxAggregateFilter = {
  points?: IntFilter | null | undefined;
  position?: IntFilter | null | undefined;
  roundId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type ZslRoundResultMinAggregateFilter = {
  points?: IntFilter | null | undefined;
  position?: IntFilter | null | undefined;
  roundId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type ZslRoundResultStddevPopulationAggregateFilter = {
  points?: BigFloatFilter | null | undefined;
  position?: BigFloatFilter | null | undefined;
  roundId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type ZslRoundResultStddevSampleAggregateFilter = {
  points?: BigFloatFilter | null | undefined;
  position?: BigFloatFilter | null | undefined;
  roundId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type ZslRoundResultSumAggregateFilter = {
  points?: BigIntFilter | null | undefined;
  position?: BigIntFilter | null | undefined;
  roundId?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

export type ZslRoundResultVariancePopulationAggregateFilter = {
  points?: BigFloatFilter | null | undefined;
  position?: BigFloatFilter | null | undefined;
  roundId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type ZslRoundResultVarianceSampleAggregateFilter = {
  points?: BigFloatFilter | null | undefined;
  position?: BigFloatFilter | null | undefined;
  roundId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type ZslRoundStddevPopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  round?: BigFloatFilter | null | undefined;
  seasonId?: BigFloatFilter | null | undefined;
  workshopId?: BigFloatFilter | null | undefined;
};

export type ZslRoundStddevSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  round?: BigFloatFilter | null | undefined;
  seasonId?: BigFloatFilter | null | undefined;
  workshopId?: BigFloatFilter | null | undefined;
};

export type ZslRoundSumAggregateFilter = {
  id?: BigIntFilter | null | undefined;
  round?: BigIntFilter | null | undefined;
  seasonId?: BigIntFilter | null | undefined;
  workshopId?: BigFloatFilter | null | undefined;
};

/** A filter to be used against many `ZslLevel` object types. All fields are combined with a logical ‘and.’ */
export type ZslRoundToManyZslLevelFilter = {
  /** Aggregates across related `ZslLevel` match the filter criteria. */
  aggregates?: ZslLevelAggregatesFilter | null | undefined;
  /** Every related `ZslLevel` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: ZslLevelFilter | null | undefined;
  /** No related `ZslLevel` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: ZslLevelFilter | null | undefined;
  /** Some related `ZslLevel` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: ZslLevelFilter | null | undefined;
};

/** A filter to be used against many `ZslRoundResult` object types. All fields are combined with a logical ‘and.’ */
export type ZslRoundToManyZslRoundResultFilter = {
  /** Aggregates across related `ZslRoundResult` match the filter criteria. */
  aggregates?: ZslRoundResultAggregatesFilter | null | undefined;
  /** Every related `ZslRoundResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: ZslRoundResultFilter | null | undefined;
  /** No related `ZslRoundResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: ZslRoundResultFilter | null | undefined;
  /** Some related `ZslRoundResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: ZslRoundResultFilter | null | undefined;
};

export type ZslRoundVariancePopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  round?: BigFloatFilter | null | undefined;
  seasonId?: BigFloatFilter | null | undefined;
  workshopId?: BigFloatFilter | null | undefined;
};

export type ZslRoundVarianceSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  round?: BigFloatFilter | null | undefined;
  seasonId?: BigFloatFilter | null | undefined;
  workshopId?: BigFloatFilter | null | undefined;
};

/** A filter to be used against aggregates of `ZslSeason` object types. */
export type ZslSeasonAggregatesFilter = {
  /** Mean average aggregate over matching `ZslSeason` objects. */
  average?: ZslSeasonAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `ZslSeason` objects. */
  distinctCount?: ZslSeasonDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `ZslSeason` object to be included within the aggregate. */
  filter?: ZslSeasonFilter | null | undefined;
  /** Maximum aggregate over matching `ZslSeason` objects. */
  max?: ZslSeasonMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `ZslSeason` objects. */
  min?: ZslSeasonMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `ZslSeason` objects. */
  stddevPopulation?: ZslSeasonStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `ZslSeason` objects. */
  stddevSample?: ZslSeasonStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `ZslSeason` objects. */
  sum?: ZslSeasonSumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `ZslSeason` objects. */
  variancePopulation?: ZslSeasonVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `ZslSeason` objects. */
  varianceSample?: ZslSeasonVarianceSampleAggregateFilter | null | undefined;
};

export type ZslSeasonAverageAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  pointsStructureId?: BigFloatFilter | null | undefined;
};

export type ZslSeasonDistinctCountAggregateFilter = {
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  endDate?: BigIntFilter | null | undefined;
  id?: BigIntFilter | null | undefined;
  name?: BigIntFilter | null | undefined;
  pointsStructureId?: BigIntFilter | null | undefined;
  startDate?: BigIntFilter | null | undefined;
};

/** A filter to be used against `ZslSeason` object types. All fields are combined with a logical ‘and.’ */
export type ZslSeasonFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<ZslSeasonFilter> | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `endDate` field. */
  endDate?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `id` field. */
  id?: IntFilter | null | undefined;
  /** Filter by the object’s `name` field. */
  name?: StringFilter | null | undefined;
  /** Negates the expression. */
  not?: ZslSeasonFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<ZslSeasonFilter> | null | undefined;
  /** Filter by the object’s `pointsStructure` relation. */
  pointsStructure?: ZslPointsStructureFilter | null | undefined;
  /** Filter by the object’s `pointsStructureId` field. */
  pointsStructureId?: IntFilter | null | undefined;
  /** Filter by the object’s `startDate` field. */
  startDate?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `zslRounds` relation. */
  zslRounds?: ZslSeasonToManyZslRoundFilter | null | undefined;
  /** Some related `zslRounds` exist. */
  zslRoundsExist?: boolean | null | undefined;
  /** Filter by the object’s `zslSeasonResults` relation. */
  zslSeasonResults?: ZslSeasonToManyZslSeasonResultFilter | null | undefined;
  /** Some related `zslSeasonResults` exist. */
  zslSeasonResultsExist?: boolean | null | undefined;
};

export type ZslSeasonMaxAggregateFilter = {
  id?: IntFilter | null | undefined;
  pointsStructureId?: IntFilter | null | undefined;
};

export type ZslSeasonMinAggregateFilter = {
  id?: IntFilter | null | undefined;
  pointsStructureId?: IntFilter | null | undefined;
};

/** A filter to be used against aggregates of `ZslSeasonResult` object types. */
export type ZslSeasonResultAggregatesFilter = {
  /** Mean average aggregate over matching `ZslSeasonResult` objects. */
  average?: ZslSeasonResultAverageAggregateFilter | null | undefined;
  /** Distinct count aggregate over matching `ZslSeasonResult` objects. */
  distinctCount?: ZslSeasonResultDistinctCountAggregateFilter | null | undefined;
  /** A filter that must pass for the relevant `ZslSeasonResult` object to be included within the aggregate. */
  filter?: ZslSeasonResultFilter | null | undefined;
  /** Maximum aggregate over matching `ZslSeasonResult` objects. */
  max?: ZslSeasonResultMaxAggregateFilter | null | undefined;
  /** Minimum aggregate over matching `ZslSeasonResult` objects. */
  min?: ZslSeasonResultMinAggregateFilter | null | undefined;
  /** Population standard deviation aggregate over matching `ZslSeasonResult` objects. */
  stddevPopulation?: ZslSeasonResultStddevPopulationAggregateFilter | null | undefined;
  /** Sample standard deviation aggregate over matching `ZslSeasonResult` objects. */
  stddevSample?: ZslSeasonResultStddevSampleAggregateFilter | null | undefined;
  /** Sum aggregate over matching `ZslSeasonResult` objects. */
  sum?: ZslSeasonResultSumAggregateFilter | null | undefined;
  /** Population variance aggregate over matching `ZslSeasonResult` objects. */
  variancePopulation?: ZslSeasonResultVariancePopulationAggregateFilter | null | undefined;
  /** Sample variance aggregate over matching `ZslSeasonResult` objects. */
  varianceSample?: ZslSeasonResultVarianceSampleAggregateFilter | null | undefined;
};

export type ZslSeasonResultAverageAggregateFilter = {
  points?: BigFloatFilter | null | undefined;
  position?: BigFloatFilter | null | undefined;
  seasonId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type ZslSeasonResultDistinctCountAggregateFilter = {
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  points?: BigIntFilter | null | undefined;
  position?: BigIntFilter | null | undefined;
  seasonId?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

/** A filter to be used against `ZslSeasonResult` object types. All fields are combined with a logical ‘and.’ */
export type ZslSeasonResultFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<ZslSeasonResultFilter> | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Negates the expression. */
  not?: ZslSeasonResultFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<ZslSeasonResultFilter> | null | undefined;
  /** Filter by the object’s `points` field. */
  points?: IntFilter | null | undefined;
  /** Filter by the object’s `position` field. */
  position?: IntFilter | null | undefined;
  /** Filter by the object’s `season` relation. */
  season?: ZslSeasonFilter | null | undefined;
  /** Filter by the object’s `seasonId` field. */
  seasonId?: IntFilter | null | undefined;
  /** Filter by the object’s `user` relation. */
  user?: UserFilter | null | undefined;
  /** Filter by the object’s `userId` field. */
  userId?: IntFilter | null | undefined;
};

export type ZslSeasonResultMaxAggregateFilter = {
  points?: IntFilter | null | undefined;
  position?: IntFilter | null | undefined;
  seasonId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type ZslSeasonResultMinAggregateFilter = {
  points?: IntFilter | null | undefined;
  position?: IntFilter | null | undefined;
  seasonId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type ZslSeasonResultStddevPopulationAggregateFilter = {
  points?: BigFloatFilter | null | undefined;
  position?: BigFloatFilter | null | undefined;
  seasonId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type ZslSeasonResultStddevSampleAggregateFilter = {
  points?: BigFloatFilter | null | undefined;
  position?: BigFloatFilter | null | undefined;
  seasonId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type ZslSeasonResultSumAggregateFilter = {
  points?: BigIntFilter | null | undefined;
  position?: BigIntFilter | null | undefined;
  seasonId?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

export type ZslSeasonResultVariancePopulationAggregateFilter = {
  points?: BigFloatFilter | null | undefined;
  position?: BigFloatFilter | null | undefined;
  seasonId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type ZslSeasonResultVarianceSampleAggregateFilter = {
  points?: BigFloatFilter | null | undefined;
  position?: BigFloatFilter | null | undefined;
  seasonId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type ZslSeasonStddevPopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  pointsStructureId?: BigFloatFilter | null | undefined;
};

export type ZslSeasonStddevSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  pointsStructureId?: BigFloatFilter | null | undefined;
};

export type ZslSeasonSumAggregateFilter = {
  id?: BigIntFilter | null | undefined;
  pointsStructureId?: BigIntFilter | null | undefined;
};

/** A filter to be used against many `ZslRound` object types. All fields are combined with a logical ‘and.’ */
export type ZslSeasonToManyZslRoundFilter = {
  /** Aggregates across related `ZslRound` match the filter criteria. */
  aggregates?: ZslRoundAggregatesFilter | null | undefined;
  /** Every related `ZslRound` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: ZslRoundFilter | null | undefined;
  /** No related `ZslRound` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: ZslRoundFilter | null | undefined;
  /** Some related `ZslRound` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: ZslRoundFilter | null | undefined;
};

/** A filter to be used against many `ZslSeasonResult` object types. All fields are combined with a logical ‘and.’ */
export type ZslSeasonToManyZslSeasonResultFilter = {
  /** Aggregates across related `ZslSeasonResult` match the filter criteria. */
  aggregates?: ZslSeasonResultAggregatesFilter | null | undefined;
  /** Every related `ZslSeasonResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  every?: ZslSeasonResultFilter | null | undefined;
  /** No related `ZslSeasonResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  none?: ZslSeasonResultFilter | null | undefined;
  /** Some related `ZslSeasonResult` matches the filter criteria. All fields are combined with a logical ‘and.’ */
  some?: ZslSeasonResultFilter | null | undefined;
};

export type ZslSeasonVariancePopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  pointsStructureId?: BigFloatFilter | null | undefined;
};

export type ZslSeasonVarianceSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  pointsStructureId?: BigFloatFilter | null | undefined;
};

export type Zc_DiscordPlaylistLevelFragment = { id: number, xxHash: string, publiclyVisible: boolean, adventure: boolean, dateCreated: unknown, levelItems: { nodes: Array<{ name: string, imageUrl: string, fileUid: string, fileAuthor: string, workshopId: unknown, createdAt: unknown, updatedAt: unknown, author: { id: number, steamId: unknown, steamName: string | null, discordId: unknown } | null }> }, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, worldRecordGlobal: { record: { time: number } | null, user: { id: number, steamId: unknown, steamName: string | null, discordId: unknown } | null } | null };

export type Zc_DiscordLevelByIdQueryVariables = Exact<{
  id: number;
}>;


export type Zc_DiscordLevelByIdQuery = { level: { id: number, xxHash: string, publiclyVisible: boolean, adventure: boolean, dateCreated: unknown, levelItems: { nodes: Array<{ name: string, imageUrl: string, authorId: unknown, workshopId: unknown, fileUid: string, fileAuthor: string, createdAt: unknown, updatedAt: unknown, author: { id: number, steamId: unknown, steamName: string | null, discordId: unknown } | null }> }, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, worldRecordGlobal: { record: { id: number, time: number, modVersion: string } | null, user: { id: number, steamId: unknown, steamName: string | null, discordId: unknown } | null } | null } | null };

export type Zc_DiscordLevelsByIdsQueryVariables = Exact<{
  ids: Array<number> | number;
}>;


export type Zc_DiscordLevelsByIdsQuery = { levels: { nodes: Array<{ id: number, xxHash: string, publiclyVisible: boolean, adventure: boolean, dateCreated: unknown, levelItems: { nodes: Array<{ name: string, imageUrl: string, fileUid: string, fileAuthor: string, workshopId: unknown, createdAt: unknown, updatedAt: unknown, author: { id: number, steamId: unknown, steamName: string | null, discordId: unknown } | null }> }, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, worldRecordGlobal: { record: { time: number } | null, user: { id: number, steamId: unknown, steamName: string | null, discordId: unknown } | null } | null }> } | null };

export type Zc_DiscordRecentWorkshopLevelsQueryVariables = Exact<{
  first: number;
  orderBy: Array<LevelItemsOrderBy> | LevelItemsOrderBy;
  levelFilter: LevelFilter;
}>;


export type Zc_DiscordRecentWorkshopLevelsQuery = { levelItems: { nodes: Array<{ name: string, imageUrl: string, fileUid: string, fileAuthor: string, workshopId: unknown, createdAt: unknown, updatedAt: unknown, level: { id: number, xxHash: string, publiclyVisible: boolean, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, worldRecordGlobal: { record: { time: number } | null, user: { id: number, steamId: unknown, steamName: string | null, discordId: unknown } | null } | null } | null }> } | null };

export type Zc_DiscordLevelDetailByHashQueryVariables = Exact<{
  xxHash: string;
}>;


export type Zc_DiscordLevelDetailByHashQuery = { levelByXxHash: { id: number, xxHash: string, publiclyVisible: boolean, levelItems: { nodes: Array<{ name: string, imageUrl: string, workshopId: unknown, author: { id: number, steamId: unknown, steamName: string | null, discordId: unknown } | null }> }, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, worldRecordGlobal: { record: { time: number } | null, user: { id: number, steamId: unknown, steamName: string | null, discordId: unknown } | null } | null } | null };

export type Zc_DiscordLevelSearchQueryVariables = Exact<{
  search: string;
}>;


export type Zc_DiscordLevelSearchQuery = { levels: { nodes: Array<{ id: number, xxHash: string, levelItems: { nodes: Array<{ name: string, imageUrl: string, author: { steamName: string | null } | null }> }, levelPoints: { points: number, rating: number } | null, votes: { totalCount: number } }> } | null };

export type Zc_DiscordLevelsQueryVariables = Exact<{
  first?: number | null | undefined;
  filter: LevelFilter;
  orderBy?: Array<LevelsOrderBy> | LevelsOrderBy | null | undefined;
}>;


export type Zc_DiscordLevelsQuery = { levels: { edges: Array<{ node: { id: number, xxHash: string, publiclyVisible: boolean, adventure: boolean, dateCreated: unknown, levelItems: { nodes: Array<{ name: string, imageUrl: string, fileUid: string, fileAuthor: string, workshopId: unknown, createdAt: unknown, updatedAt: unknown, author: { id: number, steamId: unknown, steamName: string | null, discordId: unknown } | null }> }, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, worldRecordGlobal: { record: { time: number } | null, user: { id: number, steamId: unknown, steamName: string | null, discordId: unknown } | null } | null } }> } | null };

export type Zc_DiscordHotLevelsQueryVariables = Exact<{
  first?: number | null | undefined;
  filter: LevelFilter;
  since: unknown;
}>;


export type Zc_DiscordHotLevelsQuery = { levels: { edges: Array<{ node: { id: number, xxHash: string, publiclyVisible: boolean, adventure: boolean, dateCreated: unknown, levelItems: { nodes: Array<{ name: string, imageUrl: string, fileUid: string, fileAuthor: string, workshopId: unknown, createdAt: unknown, updatedAt: unknown, author: { id: number, steamId: unknown, steamName: string | null, discordId: unknown } | null }> }, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, worldRecordGlobal: { record: { time: number } | null, user: { id: number, steamId: unknown, steamName: string | null, discordId: unknown } | null } | null } }> } | null };

export type Zc_DiscordLevelRecordsQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: unknown;
  last?: number | null | undefined;
  before?: unknown;
  filter: RecordFilter;
  orderBy?: Array<RecordsOrderBy> | RecordsOrderBy | null | undefined;
}>;


export type Zc_DiscordLevelRecordsQuery = { records: { totalCount: number, edges: Array<{ node: { time: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null, discordId: unknown } | null } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } } | null };

export type Zc_DiscordTournamentSnapshotFragment = { id: number, type: number, slug: string, endAt: unknown, level: { levelItems: { nodes: Array<{ name: string, imageUrl: string }> } } | null, trackTournamentResults: { totalCount: number, nodes: Array<{ userId: number, time: number, rank: number, points: number, user: { steamName: string | null } | null }> } };

export type Zc_DiscordTournamentSnapshotsQueryVariables = Exact<{
  now: unknown;
}>;


export type Zc_DiscordTournamentSnapshotsQuery = { weekly: { nodes: Array<{ id: number, type: number, slug: string, endAt: unknown, level: { levelItems: { nodes: Array<{ name: string, imageUrl: string }> } } | null, trackTournamentResults: { totalCount: number, nodes: Array<{ userId: number, time: number, rank: number, points: number, user: { steamName: string | null } | null }> } }> } | null, monthly: { nodes: Array<{ id: number, type: number, slug: string, endAt: unknown, level: { levelItems: { nodes: Array<{ name: string, imageUrl: string }> } } | null, trackTournamentResults: { totalCount: number, nodes: Array<{ userId: number, time: number, rank: number, points: number, user: { steamName: string | null } | null }> } }> } | null };

export type Zc_DiscordTournamentLeaderboardQueryVariables = Exact<{
  type: number;
  slug: string;
  first?: number | null | undefined;
  after?: unknown;
  last?: number | null | undefined;
  before?: unknown;
}>;


export type Zc_DiscordTournamentLeaderboardQuery = { tournament: { leaderboard: { totalCount: number, edges: Array<{ cursor: unknown, node: { userId: number, time: number, rank: number, points: number, user: { steamName: string | null } | null } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } } } | null };

export type Zc_DiscordUsersByIdsQueryVariables = Exact<{
  ids?: Array<number> | number | null | undefined;
}>;


export type Zc_DiscordUsersByIdsQuery = { users: { nodes: Array<{ id: number, steamId: unknown, steamName: string | null, discordId: unknown, userPoints: { points: number } | null }> } | null };

export type Zc_DiscordUserStatsQueryVariables = Exact<{
  userId: number;
  from?: unknown;
  to?: unknown;
}>;


export type Zc_DiscordUserStatsQuery = { records: { totalCount: number } | null, personalBests: { totalCount: number } | null, worldRecords: { totalCount: number } | null, levels: { totalCount: number } | null, votes: { totalCount: number } | null, recordStatistics: { totalCount: number, aggregates: { sum: { distance: number, time: number, distanceOnTarmac: number, distanceOnGrass: number, distanceOnSand: number, distanceOnSoap: number, distanceOnWood: number, distanceOnMud: number, distanceOnIce1: number, distanceOnIce2: number, distanceOnIce3: number, distanceInAir: number } | null, average: { averageSpeed: number | null, averageGforce: number | null } | null, max: { maxSpeed: number | null, maxGforce: number | null } | null } | null } | null };

export type Zc_DiscordModVersionsQueryVariables = Exact<{
  userId: number;
}>;


export type Zc_DiscordModVersionsQuery = { versions: { nodes: Array<{ latest: string | null, minimum: string | null }> } | null, records: { nodes: Array<{ modVersion: string, dateCreated: unknown }> } | null };

export type Zc_DiscordUserLookupQueryVariables = Exact<{
  filter: UserFilter;
}>;


export type Zc_DiscordUserLookupQuery = { users: { nodes: Array<{ id: number, steamId: unknown, steamName: string | null, discordId: unknown, dateCreated: unknown, userPoints: { points: number, rank: number, totalPoints: number, worldRecords: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number }, levelItems: { totalCount: number }, votes: { totalCount: number } }> } | null };

export type Zc_DiscordUserContributionsQueryVariables = Exact<{
  first?: number | null | undefined;
  filter: UserPointContributionFilter;
  orderBy: Array<UserPointContributionsOrderBy> | UserPointContributionsOrderBy;
}>;


export type Zc_DiscordUserContributionsQuery = { userPointContributions: { edges: Array<{ node: { levelPoints: number, playerDecayedPoints: number, record: { levelId: number } | null } }> } | null };

export type Zc_DiscordActivityEventsLiveSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type Zc_DiscordActivityEventsLiveSubscription = { discordActivityEvents: { nodes: Array<{ id: unknown, kind: string, levelId: number | null, userId: number | null, previousUserId: number | null, recordId: number | null, previousRecordId: number | null, payload: unknown, occurredAt: unknown, level: { id: number, xxHash: string, levelItems: { nodes: Array<{ name: string, imageUrl: string, workshopId: unknown, author: { id: number, steamId: unknown, steamName: string | null, discordId: unknown } | null }> }, levelPoints: { points: number, rating: number } | null, personalBestGlobals: { totalCount: number } } | null, user: { id: number, steamId: unknown, steamName: string | null, discordId: unknown } | null, previousUser: { id: number, steamId: unknown, steamName: string | null, discordId: unknown } | null, record: { id: number, time: number, modVersion: string } | null, previousRecord: { id: number, time: number, modVersion: string } | null }> } | null };

export type Zc_TrackTournamentLobbyLeaderboardLiveSubscriptionVariables = Exact<{
  id: number;
}>;


export type Zc_TrackTournamentLobbyLeaderboardLiveSubscription = { trackTournament: { id: number, slug: string, leaderboard: { totalCount: number, nodes: Array<{ tournamentId: number, userId: number, recordId: number, time: number, rank: number, user: { steamName: string | null } | null }> } } | null };

export type Zc_TrackTournamentLobbyPlayerContextQueryVariables = Exact<{
  tournamentId: number;
  steamId: unknown;
  recentSince: unknown;
}>;


export type Zc_TrackTournamentLobbyPlayerContextQuery = { versions: { nodes: Array<{ minimum: string | null }> } | null, user: { id: number, recentRecords: { totalCount: number }, standing: { nodes: Array<{ rank: number, time: number }> } } | null };

export type Zc_AdventureLevelCardFragment = { id: number, xxHash: string, adventure: boolean, dateCreated: unknown, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, viewerFavourites?: { totalCount: number }, worldRecordGlobal: { record: { time: number } | null, user: { steamId: unknown, steamName: string | null } | null } | null, levelItems: { nodes: Array<{ name: string, imageUrl: string, fileUid: string, fileAuthor: string, workshopId: unknown, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, author: { steamId: unknown, steamName: string | null } | null }> } };

export type Zc_AdventureSeriesCountsQueryVariables = Exact<{ [key: string]: never; }>;


export type Zc_AdventureSeriesCountsQuery = { seriesA: { totalCount: number } | null, seriesB: { totalCount: number } | null, seriesC: { totalCount: number } | null, seriesCl: { totalCount: number } | null, seriesD: { totalCount: number } | null, seriesE: { totalCount: number } | null, seriesEz: { totalCount: number } | null, seriesF: { totalCount: number } | null, seriesFl: { totalCount: number } | null, seriesG: { totalCount: number } | null, seriesH: { totalCount: number } | null, seriesI: { totalCount: number } | null, seriesL: { totalCount: number } | null, seriesOr: { totalCount: number } | null, seriesX: { totalCount: number } | null, seriesXg: { totalCount: number } | null, seriesY: { totalCount: number } | null };

export type Zc_AdventureSeriesQueryVariables = Exact<{
  prefix: string;
  viewerId: number;
  includeViewer: boolean;
}>;


export type Zc_AdventureSeriesQuery = { levels: { nodes: Array<{ id: number, xxHash: string, adventure: boolean, dateCreated: unknown, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, viewerFavourites?: { totalCount: number }, worldRecordGlobal: { record: { time: number } | null, user: { steamId: unknown, steamName: string | null } | null } | null, levelItems: { nodes: Array<{ name: string, imageUrl: string, fileUid: string, fileAuthor: string, workshopId: unknown, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, author: { steamId: unknown, steamName: string | null } | null }> } }> } | null };

export type Zc_DashboardLevelFragment = { id: number, xxHash: string, adventure: boolean, dateCreated: unknown, levelItems: { nodes: Array<{ name: string, imageUrl: string, fileUid: string, fileAuthor: string, workshopId: unknown, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, author: { steamId: unknown, steamName: string | null } | null }> }, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, viewerFavourites?: { totalCount: number }, worldRecordGlobal: { record: { time: number } | null, user: { steamId: unknown, steamName: string | null } | null } | null };

export type Zc_DashboardMetricCountsFragment = { records: { totalCount: number } | null, recordsDay: { totalCount: number } | null, recordsMonth: { totalCount: number } | null, personalBestGlobals: { totalCount: number } | null, personalBestGlobalsDay: { totalCount: number } | null, personalBestGlobalsMonth: { totalCount: number } | null, worldRecordGlobals: { totalCount: number } | null, worldRecordGlobalsDay: { totalCount: number } | null, worldRecordGlobalsMonth: { totalCount: number } | null, levels: { totalCount: number } | null, levelsDay: { totalCount: number } | null, levelsMonth: { totalCount: number } | null, votes: { totalCount: number } | null, votesDay: { totalCount: number } | null, votesMonth: { totalCount: number } | null, totalUsers: { totalCount: number } | null, rankedUsers: { totalCount: number } | null, activeUsersDay: { totalCount: number } | null, activeUsersMonth: { totalCount: number } | null };

export type Zc_DashboardCriticalQueryVariables = Exact<{
  daySince: unknown;
  monthSince: unknown;
  now: unknown;
  viewerId: number;
  includeViewer: boolean;
}>;


export type Zc_DashboardCriticalQuery = { activeWeeklyTournament: { nodes: Array<{ id: number, type: number, slug: string, startAt: unknown, endAt: unknown, finalizedAt: unknown, level: { id: number, xxHash: string, levelItems: { nodes: Array<{ name: string, imageUrl: string, author: { steamId: unknown, steamName: string | null } | null }> } } | null, trackTournamentResults: { totalCount: number } }> } | null, activeMonthlyTournament: { nodes: Array<{ id: number, type: number, slug: string, startAt: unknown, endAt: unknown, finalizedAt: unknown, level: { id: number, xxHash: string, levelItems: { nodes: Array<{ name: string, imageUrl: string, author: { steamId: unknown, steamName: string | null } | null }> } } | null, trackTournamentResults: { totalCount: number } }> } | null, trendingLevels: { nodes: Array<{ id: number, xxHash: string, adventure: boolean, dateCreated: unknown, periodRecords: { totalCount: number }, levelItems: { nodes: Array<{ name: string, imageUrl: string, fileUid: string, fileAuthor: string, workshopId: unknown, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, author: { steamId: unknown, steamName: string | null } | null }> }, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, viewerFavourites?: { totalCount: number }, worldRecordGlobal: { record: { time: number } | null, user: { steamId: unknown, steamName: string | null } | null } | null }> } | null, records: { totalCount: number } | null, recordsDay: { totalCount: number } | null, recordsMonth: { totalCount: number } | null, personalBestGlobals: { totalCount: number } | null, personalBestGlobalsDay: { totalCount: number } | null, personalBestGlobalsMonth: { totalCount: number } | null, worldRecordGlobals: { totalCount: number } | null, worldRecordGlobalsDay: { totalCount: number } | null, worldRecordGlobalsMonth: { totalCount: number } | null, levels: { totalCount: number } | null, levelsDay: { totalCount: number } | null, levelsMonth: { totalCount: number } | null, votes: { totalCount: number } | null, votesDay: { totalCount: number } | null, votesMonth: { totalCount: number } | null, totalUsers: { totalCount: number } | null, rankedUsers: { totalCount: number } | null, activeUsersDay: { totalCount: number } | null, activeUsersMonth: { totalCount: number } | null };

export type Zc_DashboardHotLevelsQueryVariables = Exact<{
  since: unknown;
  viewerId: number;
  includeViewer: boolean;
}>;


export type Zc_DashboardHotLevelsQuery = { levels: { nodes: Array<{ id: number, xxHash: string, adventure: boolean, dateCreated: unknown, periodRecords: { totalCount: number }, levelItems: { nodes: Array<{ name: string, imageUrl: string, fileUid: string, fileAuthor: string, workshopId: unknown, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, author: { steamId: unknown, steamName: string | null } | null }> }, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, viewerFavourites?: { totalCount: number }, worldRecordGlobal: { record: { time: number } | null, user: { steamId: unknown, steamName: string | null } | null } | null }> } | null };

export type Zc_DashboardV6StatisticAggregatesFragment = { sum: { distance: number, distanceInAir: number, distanceOn1Wheel: number, distanceOn2Wheels: number, distanceOn3Wheels: number, distanceOn4Wheels: number, distanceOnGrass: number, distanceOnGround: number, distanceOnIce1: number, distanceOnIce2: number, distanceOnIce3: number, distanceOnWood: number, distanceOnMud: number, distanceOnSand: number, distanceOnSoap: number, distanceOnTarmac: number, distanceRagdoll: number, time: number, timeInAir: number, timeOnGrass: number, timeOnGround: number, timeOnIce1: number, timeOnIce2: number, timeOnIce3: number, timeOnWood: number, timeOnMud: number, timeOnSand: number, timeOnSoap: number, timeOnTarmac: number, timeRagdoll: number, turnLeftCount: unknown, turnRightCount: unknown, armsUpCount: unknown, brakeCount: unknown, hornCount: unknown } | null, average: { averageGforce: number | null, averageSpeed: number | null } | null };

export type Zc_DashboardStatisticsQueryVariables = Exact<{
  daySince: unknown;
  monthSince: unknown;
  minimumModVersion: string;
}>;


export type Zc_DashboardStatisticsQuery = { allTimeStatistics: { aggregates: { sum: { distance: number } | null } | null } | null, dayStatistics: { aggregates: { sum: { distance: number } | null } | null } | null, monthStatistics: { aggregates: { sum: { distance: number } | null } | null } | null, v6DayStatistics: { aggregates: { sum: { distance: number, distanceInAir: number, distanceOn1Wheel: number, distanceOn2Wheels: number, distanceOn3Wheels: number, distanceOn4Wheels: number, distanceOnGrass: number, distanceOnGround: number, distanceOnIce1: number, distanceOnIce2: number, distanceOnIce3: number, distanceOnWood: number, distanceOnMud: number, distanceOnSand: number, distanceOnSoap: number, distanceOnTarmac: number, distanceRagdoll: number, time: number, timeInAir: number, timeOnGrass: number, timeOnGround: number, timeOnIce1: number, timeOnIce2: number, timeOnIce3: number, timeOnWood: number, timeOnMud: number, timeOnSand: number, timeOnSoap: number, timeOnTarmac: number, timeRagdoll: number, turnLeftCount: unknown, turnRightCount: unknown, armsUpCount: unknown, brakeCount: unknown, hornCount: unknown } | null, average: { averageGforce: number | null, averageSpeed: number | null } | null } | null } | null, v6MonthStatistics: { aggregates: { sum: { distance: number, distanceInAir: number, distanceOn1Wheel: number, distanceOn2Wheels: number, distanceOn3Wheels: number, distanceOn4Wheels: number, distanceOnGrass: number, distanceOnGround: number, distanceOnIce1: number, distanceOnIce2: number, distanceOnIce3: number, distanceOnWood: number, distanceOnMud: number, distanceOnSand: number, distanceOnSoap: number, distanceOnTarmac: number, distanceRagdoll: number, time: number, timeInAir: number, timeOnGrass: number, timeOnGround: number, timeOnIce1: number, timeOnIce2: number, timeOnIce3: number, timeOnWood: number, timeOnMud: number, timeOnSand: number, timeOnSoap: number, timeOnTarmac: number, timeRagdoll: number, turnLeftCount: unknown, turnRightCount: unknown, armsUpCount: unknown, brakeCount: unknown, hornCount: unknown } | null, average: { averageGforce: number | null, averageSpeed: number | null } | null } | null } | null };

export type Zc_DashboardHeroSummaryQueryVariables = Exact<{
  id: number;
}>;


export type Zc_DashboardHeroSummaryQuery = { user: { id: number, steamId: unknown, steamName: string | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number }, userPoints: { rank: number, points: number, totalPoints: number, worldRecords: number } | null } | null, zslSeasons: { nodes: Array<{ id: number, name: string, zslSeasonResults: { nodes: Array<{ position: number, points: number }> } }> } | null };

export type Zc_DashboardViewerLevelsQueryVariables = Exact<{
  id: number;
  viewerId: number;
  includeViewer: boolean;
}>;


export type Zc_DashboardViewerLevelsQuery = { user: { levelItems: { nodes: Array<{ fileUid: string, fileAuthor: string, workshopId: unknown, name: string, imageUrl: string, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, level: { id: number, xxHash: string, adventure: boolean, dateCreated: unknown, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, viewerFavourites?: { totalCount: number }, worldRecordGlobal: { record: { time: number } | null, user: { steamId: unknown, steamName: string | null } | null } | null } | null, author: { steamId: unknown, steamName: string | null } | null }> } } | null };

export type Zc_GhostComparisonRecordFragment = { id: number, time: number, dateCreated: unknown, dateUpdated: unknown, splits: Array<number | null> | null, speeds: Array<number | null> | null, levelId: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null } | null, recordMedia: { ghostUrl: string | null, dateCreated: unknown, dateUpdated: unknown } | null, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number } };

export type Zc_HomeStatsQueryVariables = Exact<{ [key: string]: never; }>;


export type Zc_HomeStatsQuery = { levels: { totalCount: number } | null, users: { totalCount: number } | null, records: { totalCount: number } | null };

export type Zc_LeaderboardsQueryVariables = Exact<{
  first?: number | null | undefined;
}>;


export type Zc_LeaderboardsQuery = { records: { totalCount: number, nodes: Array<{ id: number, levelId: number, userId: number, time: number, dateCreated: unknown }> } | null };

export type Zc_LevelDetailQueryVariables = Exact<{
  xxHash: string;
  now: unknown;
  viewerId: number;
  includeViewer: boolean;
}>;


export type Zc_LevelDetailQuery = { levelByXxHash: { id: number, xxHash: string, publiclyVisible: boolean, adventure: boolean, dateCreated: unknown, levelItems: { nodes: Array<{ name: string, imageUrl: string, fileUid: string, fileAuthor: string, authorId: unknown, workshopId: unknown, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, author: { id: number, steamId: unknown, steamName: string | null } | null }> }, levelPoints: { points: number, rating: number, modifierLength: number, modifierEvidence: number, modifierQuality: number, modifierRating: number, complexityConfidence: number | null, complexityScore: number | null, fieldStrength: number | null, qualityScore: number | null, skillAlignment: number | null, skillConfidence: number | null, skillSampleSize: number | null, skillScore: number | null, skillSeparation: number | null } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number, groupedAggregates: Array<{ keys: Array<string | null> | null, sum: { value: unknown } | null }> | null }, favourites: { totalCount: number }, viewerFavourites?: { totalCount: number }, trackTournaments: { nodes: Array<{ id: number, type: number, slug: string, startAt: unknown, endAt: unknown, finalizedAt: unknown, level: { id: number, xxHash: string, levelItems: { nodes: Array<{ name: string, imageUrl: string, author: { steamId: unknown, steamName: string | null } | null }> } } | null, trackTournamentResults: { totalCount: number } }> }, worldRecordGlobal: { record: { id: number, time: number, dateCreated: unknown, levelId: number, userId: number, recordStatistic: { distance: number | null } | null } | null, user: { id: number, steamId: unknown, steamName: string | null } | null } | null } | null };

export type Zc_LevelGhostDefaultsQueryVariables = Exact<{
  levelId: number;
  viewerId: number;
  includeViewer: boolean;
}>;


export type Zc_LevelGhostDefaultsQuery = { level: { id: number } | null, worldRecord: { nodes: Array<{ id: number, time: number, dateCreated: unknown, dateUpdated: unknown, splits: Array<number | null> | null, speeds: Array<number | null> | null, levelId: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null } | null, recordMedia: { ghostUrl: string | null, dateCreated: unknown, dateUpdated: unknown } | null, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number } }> } | null, viewerPersonalBest?: { nodes: Array<{ id: number, time: number, dateCreated: unknown, dateUpdated: unknown, splits: Array<number | null> | null, speeds: Array<number | null> | null, levelId: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null } | null, recordMedia: { ghostUrl: string | null, dateCreated: unknown, dateUpdated: unknown } | null, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number } }> } | null };

export type Zc_LevelGhostPresetQueryVariables = Exact<{
  first: number;
  filter: RecordFilter;
}>;


export type Zc_LevelGhostPresetQuery = { records: { nodes: Array<{ id: number, time: number, dateCreated: unknown, dateUpdated: unknown, splits: Array<number | null> | null, speeds: Array<number | null> | null, levelId: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null } | null, recordMedia: { ghostUrl: string | null, dateCreated: unknown, dateUpdated: unknown } | null, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number } }> } | null };

export type Zc_LevelGhostUserSearchQueryVariables = Exact<{
  levelId: number;
  search: string;
}>;


export type Zc_LevelGhostUserSearchQuery = { users: { nodes: Array<{ id: number, steamId: unknown, steamName: string | null, personalBestGlobals: { nodes: Array<{ record: { id: number, time: number, dateCreated: unknown, dateUpdated: unknown, splits: Array<number | null> | null, speeds: Array<number | null> | null, levelId: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null } | null, recordMedia: { ghostUrl: string | null, dateCreated: unknown, dateUpdated: unknown } | null, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number } } | null }> } }> } | null };

export type Zc_LevelPersonalBestRanksQueryVariables = Exact<{
  levelId: number;
  minimumTime: number;
  maximumTime: number;
}>;


export type Zc_LevelPersonalBestRanksQuery = { fasterPersonalBests: { totalCount: number } | null, visiblePersonalBestTimes: { groupedAggregates: Array<{ keys: Array<string | null> | null, distinctCount: { id: unknown } | null }> | null } | null };

export type Zc_LevelPointsHistoryQueryVariables = Exact<{
  levelId: number;
  since: unknown;
}>;


export type Zc_LevelPointsHistoryQuery = { baseline: { nodes: Array<{ dateCreated: unknown, points: number }> } | null, history: { groupedAggregates: Array<{ keys: Array<string | null> | null, max: { points: number | null } | null }> | null } | null };

export type Zc_LevelRecordsQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: unknown;
  last?: number | null | undefined;
  before?: unknown;
  filter: RecordFilter;
  orderBy?: Array<RecordsOrderBy> | RecordsOrderBy | null | undefined;
  includeStatus: boolean;
}>;


export type Zc_LevelRecordsQuery = { records: { totalCount: number, edges: Array<{ cursor: unknown, node: { id: number, time: number, dateCreated: unknown, levelId: number, userId: number, user: { steamId: unknown, steamName: string | null } | null, userPointContributions: { nodes: Array<{ levelPosition: number, contributionRank: number, levelPoints: number, levelDecayedPoints: number, playerDecayedPoints: number }> }, personalBestGlobals?: { totalCount: number }, worldRecordGlobals?: { totalCount: number } } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } } | null };

export type Zc_LevelSplitRecordFragment = { id: number, time: number, splits: Array<number | null> | null, speeds: Array<number | null> | null, user: { steamId: unknown, steamName: string | null } | null };

export type Zc_LevelSplitAnalysisQueryVariables = Exact<{
  levelId: number;
  viewerId: number;
  includeViewer: boolean;
}>;


export type Zc_LevelSplitAnalysisQuery = { records: { nodes: Array<{ id: number, time: number, splits: Array<number | null> | null, speeds: Array<number | null> | null, user: { steamId: unknown, steamName: string | null } | null }> } | null, viewerPersonalBest?: { record: { id: number, time: number, splits: Array<number | null> | null, speeds: Array<number | null> | null, user: { steamId: unknown, steamName: string | null } | null } | null } | null };

export type Zc_LevelStatisticsQueryVariables = Exact<{
  levelId: number;
  minimumModVersion: string;
}>;


export type Zc_LevelStatisticsQuery = { allStatistics: { totalCount: number, aggregates: { sum: { distance: number } | null } | null } | null, v6Statistics: { totalCount: number, aggregates: { sum: { distance: number, distanceInAir: number, distanceOn1Wheel: number, distanceOn2Wheels: number, distanceOn3Wheels: number, distanceOn4Wheels: number, distanceOnGrass: number, distanceOnGround: number, distanceOnIce1: number, distanceOnIce2: number, distanceOnIce3: number, distanceOnWood: number, distanceOnMud: number, distanceOnSand: number, distanceOnSoap: number, distanceOnTarmac: number, distanceRagdoll: number, time: number, timeInAir: number, timeOnGrass: number, timeOnGround: number, timeOnIce1: number, timeOnIce2: number, timeOnIce3: number, timeOnWood: number, timeOnMud: number, timeOnSand: number, timeOnSoap: number, timeOnTarmac: number, timeRagdoll: number, turnLeftCount: unknown, turnRightCount: unknown, armsUpCount: unknown, brakeCount: unknown, hornCount: unknown } | null, average: { averageGforce: number | null, averageSpeed: number | null } | null, max: { maxGforce: number | null, maxSpeed: number | null } | null } | null } | null };

export type Zc_LevelViewerBestQueryVariables = Exact<{
  userId: number;
  levelId: number;
}>;


export type Zc_LevelViewerBestQuery = { personalBestGlobalByUserIdAndLevelId: { record: { id: number, time: number, dateCreated: unknown, levelId: number, userId: number, user: { steamId: unknown, steamName: string | null } | null, userPointContributions: { nodes: Array<{ levelPosition: number, contributionRank: number, levelPoints: number, levelDecayedPoints: number, playerDecayedPoints: number }> } } | null } | null };

export type Zc_LevelExplorerCardFragment = { id: number, xxHash: string, adventure: boolean, dateCreated: unknown, levelItems: { nodes: Array<{ name: string, imageUrl: string, fileUid: string, fileAuthor: string, workshopId: unknown, createdAt: unknown, updatedAt: unknown, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, author: { steamId: unknown, steamName: string | null } | null }> }, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, viewerFavourites?: { totalCount: number }, worldRecordGlobal: { record: { time: number } | null, user: { steamId: unknown, steamName: string | null } | null } | null };

export type Zc_LevelsQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: unknown;
  last?: number | null | undefined;
  before?: unknown;
  filter?: LevelFilter | null | undefined;
  orderBy?: Array<LevelsOrderBy> | LevelsOrderBy | null | undefined;
  viewerId: number;
  includeViewer: boolean;
}>;


export type Zc_LevelsQuery = { levels: { totalCount: number, edges: Array<{ cursor: unknown, node: { id: number, xxHash: string, adventure: boolean, dateCreated: unknown, levelItems: { nodes: Array<{ name: string, imageUrl: string, fileUid: string, fileAuthor: string, workshopId: unknown, createdAt: unknown, updatedAt: unknown, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, author: { steamId: unknown, steamName: string | null } | null }> }, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, viewerFavourites?: { totalCount: number }, worldRecordGlobal: { record: { time: number } | null, user: { steamId: unknown, steamName: string | null } | null } | null } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } } | null };

export type Zc_HotLevelsQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: unknown;
  last?: number | null | undefined;
  before?: unknown;
  filter: LevelFilter;
  since: unknown;
  viewerId: number;
  includeViewer: boolean;
}>;


export type Zc_HotLevelsQuery = { levels: { totalCount: number, edges: Array<{ cursor: unknown, node: { id: number, xxHash: string, adventure: boolean, dateCreated: unknown, levelItems: { nodes: Array<{ name: string, imageUrl: string, fileUid: string, fileAuthor: string, workshopId: unknown, createdAt: unknown, updatedAt: unknown, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, author: { steamId: unknown, steamName: string | null } | null }> }, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, viewerFavourites?: { totalCount: number }, worldRecordGlobal: { record: { time: number } | null, user: { steamId: unknown, steamName: string | null } | null } | null } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } } | null };

export type Zc_PlayersQueryVariables = Exact<{
  first?: number | null | undefined;
}>;


export type Zc_PlayersQuery = { users: { totalCount: number, nodes: Array<{ id: number, steamId: unknown, steamName: string | null, banned: boolean, dateCreated: unknown }> } | null };

export type Zc_PlaylistLevelsByUidQueryVariables = Exact<{
  uids: Array<string> | string;
}>;


export type Zc_PlaylistLevelsByUidQuery = { levelItems: { nodes: Array<{ fileUid: string, fileAuthor: string, workshopId: unknown, name: string, imageUrl: string, level: { xxHash: string } | null, author: { steamName: string | null } | null }> } | null };

export type Zc_RecordComparisonCatalogQueryVariables = Exact<{
  levelId: number;
  ownerId: number;
  viewerId: number;
  includeViewer: boolean;
}>;


export type Zc_RecordComparisonCatalogQuery = { topPersonalBests: { nodes: Array<{ id: number, time: number, dateCreated: unknown, dateUpdated: unknown, splits: Array<number | null> | null, speeds: Array<number | null> | null, levelId: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null } | null, recordMedia: { ghostUrl: string | null, dateCreated: unknown, dateUpdated: unknown } | null, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number } }> } | null, ownerRuns: { nodes: Array<{ id: number, time: number, dateCreated: unknown, dateUpdated: unknown, splits: Array<number | null> | null, speeds: Array<number | null> | null, levelId: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null } | null, recordMedia: { ghostUrl: string | null, dateCreated: unknown, dateUpdated: unknown } | null, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number } }> } | null, viewerPersonalBest?: { record: { id: number, time: number, dateCreated: unknown, dateUpdated: unknown, splits: Array<number | null> | null, speeds: Array<number | null> | null, levelId: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null } | null, recordMedia: { ghostUrl: string | null, dateCreated: unknown, dateUpdated: unknown } | null, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number } } | null } | null };

export type Zc_RecordComparisonRecordsQueryVariables = Exact<{
  levelId: number;
  recordIds: Array<number> | number;
}>;


export type Zc_RecordComparisonRecordsQuery = { records: { nodes: Array<{ id: number, time: number, dateCreated: unknown, dateUpdated: unknown, splits: Array<number | null> | null, speeds: Array<number | null> | null, levelId: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null } | null, recordMedia: { ghostUrl: string | null, dateCreated: unknown, dateUpdated: unknown } | null, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number } }> } | null };

export type Zc_RecordComparisonUserSearchQueryVariables = Exact<{
  levelId: number;
  search: string;
}>;


export type Zc_RecordComparisonUserSearchQuery = { users: { nodes: Array<{ id: number, steamId: unknown, steamName: string | null, personalBestGlobals: { nodes: Array<{ record: { id: number, time: number, dateCreated: unknown, dateUpdated: unknown, splits: Array<number | null> | null, speeds: Array<number | null> | null, levelId: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null } | null, recordMedia: { ghostUrl: string | null, dateCreated: unknown, dateUpdated: unknown } | null, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number } } | null }> } }> } | null };

export type Zc_RecordStatisticFragment = { armsUpCount: number | null, armsUpTime: number | null, averageAngularVelocity: number | null, averageGforce: number | null, averageSpeed: number | null, averageVelocity: number | null, brakeCount: number | null, brakeTime: number | null, dateCreated: unknown, dateUpdated: unknown, distance: number | null, distanceInAir: number | null, distanceOffroadWheels: number | null, distanceOn1Wheel: number | null, distanceOn2Wheels: number | null, distanceOn3Wheels: number | null, distanceOn4Wheels: number | null, distanceOnGrass: number | null, distanceOnGround: number | null, distanceOnIce1: number | null, distanceOnIce2: number | null, distanceOnIce3: number | null, distanceOnWood: number | null, distanceOnMud: number | null, distanceOnMonorail: number | null, distanceOnSand: number | null, distanceOnSoap: number | null, distanceOnTarmac: number | null, distanceParaglider: number | null, distanceParked: number | null, distanceRagdoll: number | null, distanceSlipping: number | null, distanceSoapWheels: number | null, driverInputTransitionCount: number | null, frameCount: number | null, ghostVersion: number | null, hasAirData: boolean | null, hasInputData: boolean | null, hasRagdollData: boolean | null, hasSlipData: boolean | null, hasStateData: boolean | null, hasSurfaceData: boolean | null, hasVelocityData: boolean | null, hasWheelData: boolean | null, hornCount: number | null, hornTime: number | null, maxAngularVelocity: number | null, maxGforce: number | null, maxSpeed: number | null, maxVelocity: number | null, nodeId: string, recordId: number, time: number | null, timeAnyDriverInput: number | null, timeInAir: number | null, timeOffroadWheels: number | null, timeOn1Wheel: number | null, timeOn2Wheels: number | null, timeOn3Wheels: number | null, timeOn4Wheels: number | null, timeOnGrass: number | null, timeOnGround: number | null, timeOnIce1: number | null, timeOnIce2: number | null, timeOnIce3: number | null, timeOnWood: number | null, timeOnMud: number | null, timeOnMonorail: number | null, timeOnSand: number | null, timeOnSoap: number | null, timeOnTarmac: number | null, timeParaglider: number | null, timeParked: number | null, timeRagdoll: number | null, timeSlipping: number | null, timeSoapWheels: number | null, turnLeftCount: number | null, turnLeftTime: number | null, turnRightCount: number | null, turnRightTime: number | null };

export type Zc_RecordDetailQueryVariables = Exact<{
  recordId: number;
}>;


export type Zc_RecordDetailQuery = { record: { gameVersion: string, modVersion: string, splits: Array<number | null> | null, speeds: Array<number | null> | null, id: number, time: number, dateCreated: unknown, dateUpdated: unknown, levelId: number, userId: number, level: { id: number, xxHash: string, publiclyVisible: boolean, levelItems: { nodes: Array<{ name: string, imageUrl: string, authorId: unknown, workshopId: unknown, author: { id: number, steamId: unknown, steamName: string | null } | null }> }, worldRecordGlobal: { record: { id: number, time: number, dateCreated: unknown, dateUpdated: unknown, splits: Array<number | null> | null, speeds: Array<number | null> | null, levelId: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null } | null, recordMedia: { ghostUrl: string | null, dateCreated: unknown, dateUpdated: unknown } | null, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number } } | null } | null } | null, recordStatistic: { armsUpCount: number | null, armsUpTime: number | null, averageAngularVelocity: number | null, averageGforce: number | null, averageSpeed: number | null, averageVelocity: number | null, brakeCount: number | null, brakeTime: number | null, dateCreated: unknown, dateUpdated: unknown, distance: number | null, distanceInAir: number | null, distanceOffroadWheels: number | null, distanceOn1Wheel: number | null, distanceOn2Wheels: number | null, distanceOn3Wheels: number | null, distanceOn4Wheels: number | null, distanceOnGrass: number | null, distanceOnGround: number | null, distanceOnIce1: number | null, distanceOnIce2: number | null, distanceOnIce3: number | null, distanceOnWood: number | null, distanceOnMud: number | null, distanceOnMonorail: number | null, distanceOnSand: number | null, distanceOnSoap: number | null, distanceOnTarmac: number | null, distanceParaglider: number | null, distanceParked: number | null, distanceRagdoll: number | null, distanceSlipping: number | null, distanceSoapWheels: number | null, driverInputTransitionCount: number | null, frameCount: number | null, ghostVersion: number | null, hasAirData: boolean | null, hasInputData: boolean | null, hasRagdollData: boolean | null, hasSlipData: boolean | null, hasStateData: boolean | null, hasSurfaceData: boolean | null, hasVelocityData: boolean | null, hasWheelData: boolean | null, hornCount: number | null, hornTime: number | null, maxAngularVelocity: number | null, maxGforce: number | null, maxSpeed: number | null, maxVelocity: number | null, nodeId: string, recordId: number, time: number | null, timeAnyDriverInput: number | null, timeInAir: number | null, timeOffroadWheels: number | null, timeOn1Wheel: number | null, timeOn2Wheels: number | null, timeOn3Wheels: number | null, timeOn4Wheels: number | null, timeOnGrass: number | null, timeOnGround: number | null, timeOnIce1: number | null, timeOnIce2: number | null, timeOnIce3: number | null, timeOnWood: number | null, timeOnMud: number | null, timeOnMonorail: number | null, timeOnSand: number | null, timeOnSoap: number | null, timeOnTarmac: number | null, timeParaglider: number | null, timeParked: number | null, timeRagdoll: number | null, timeSlipping: number | null, timeSoapWheels: number | null, turnLeftCount: number | null, turnLeftTime: number | null, turnRightCount: number | null, turnRightTime: number | null } | null, userPointContributions: { nodes: Array<{ contributionRank: number, dateCalculated: unknown, levelDecayedPoints: number, levelPoints: number, levelPosition: number, playerDecayedPoints: number }> }, user: { id: number, steamId: unknown, steamName: string | null } | null, recordMedia: { ghostUrl: string | null, dateCreated: unknown, dateUpdated: unknown } | null, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number } } | null };

export type Zc_RecordDetailSummaryQueryVariables = Exact<{
  recordId: number;
}>;


export type Zc_RecordDetailSummaryQuery = { record: { id: number, time: number, dateCreated: unknown, gameVersion: string, modVersion: string, user: { steamId: unknown, steamName: string | null } | null, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number }, level: { xxHash: string, publiclyVisible: boolean, levelItems: { nodes: Array<{ name: string, imageUrl: string }> } } | null, recordStatistic: { ghostVersion: number | null } | null, userPointContributions: { nodes: Array<{ levelPosition: number, playerDecayedPoints: number }> } } | null };

export type Zc_MyRecordCountQueryVariables = Exact<{
  id: number;
}>;


export type Zc_MyRecordCountQuery = { records: { totalCount: number } | null };

export type Zc_RecordHistoryRowFragment = { id: number, time: number | null, dateCreated: unknown, levelId: number | null, userId: number | null, userSteamId: unknown, userName: string | null, levelXxHash: string | null, levelName: string | null, levelPosition: number | null, contributionRank: number | null, levelPoints: number | null, playerDecayedPoints: number | null, levelDecayedPoints: number | null, isPersonalBest: boolean | null, isWorldRecord: boolean | null, hasContribution: boolean | null };

export type Zc_RecordHistoryQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: unknown;
  last?: number | null | undefined;
  before?: unknown;
  filter?: RecordHistoryEntryFilter | null | undefined;
  orderBy: Array<RecordHistoryEntriesOrderBy> | RecordHistoryEntriesOrderBy;
}>;


export type Zc_RecordHistoryQuery = { recordHistoryEntries: { edges: Array<{ cursor: unknown, node: { id: number, time: number | null, dateCreated: unknown, levelId: number | null, userId: number | null, userSteamId: unknown, userName: string | null, levelXxHash: string | null, levelName: string | null, levelPosition: number | null, contributionRank: number | null, levelPoints: number | null, playerDecayedPoints: number | null, levelDecayedPoints: number | null, isPersonalBest: boolean | null, isWorldRecord: boolean | null, hasContribution: boolean | null } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } } | null };

export type Zc_RecordLevelGeometryQueryVariables = Exact<{
  levelId: number;
}>;


export type Zc_RecordLevelGeometryQuery = { level: { levelMetadata: { nodes: Array<{ blocks: unknown, format: number, typeGround: number, typeSkybox: number }> } } | null };

export type Zc_RecordPersonalBestRankQueryVariables = Exact<{
  levelId: number;
  time: number;
}>;


export type Zc_RecordPersonalBestRankQuery = { fasterPersonalBests: { totalCount: number } | null };

export type Zc_OmniSearchQueryVariables = Exact<{
  search: string;
}>;


export type Zc_OmniSearchQuery = { rankedUsers: { nodes: Array<{ id: number, steamId: unknown, steamName: string | null, userPoints: { rank: number } | null }> } | null, unrankedUsers: { nodes: Array<{ id: number, steamId: unknown, steamName: string | null, userPoints: { rank: number } | null }> } | null, levels: { nodes: Array<{ id: number, xxHash: string, levelItems: { nodes: Array<{ name: string, imageUrl: string, author: { steamName: string | null } | null }> }, levelPoints: { points: number, rating: number } | null, votes: { totalCount: number } }> } | null };

export type Zc_SitemapMaxIdsQueryVariables = Exact<{
  now: unknown;
}>;


export type Zc_SitemapMaxIdsQuery = { users: { aggregates: { max: { id: number | null } | null } | null } | null, levels: { aggregates: { max: { id: number | null } | null } | null } | null, records: { aggregates: { max: { id: number | null } | null } | null } | null, trackTournaments: { aggregates: { max: { id: number | null } | null } | null } | null, zslSeasons: { aggregates: { max: { id: number | null } | null } | null } | null, zslRounds: { aggregates: { max: { id: number | null } | null } | null } | null, zslLevels: { aggregates: { max: { id: number | null } | null } | null } | null };

export type Zc_SitemapUsersPageQueryVariables = Exact<{
  startId: number;
  endId: number;
}>;


export type Zc_SitemapUsersPageQuery = { users: { nodes: Array<{ steamId: unknown, dateUpdated: unknown, dateCreated: unknown }> } | null };

export type Zc_SitemapLevelsPageQueryVariables = Exact<{
  startId: number;
  endId: number;
}>;


export type Zc_SitemapLevelsPageQuery = { levels: { nodes: Array<{ xxHash: string, dateUpdated: unknown, dateCreated: unknown }> } | null };

export type Zc_SitemapRecordsPageQueryVariables = Exact<{
  startId: number;
  endId: number;
}>;


export type Zc_SitemapRecordsPageQuery = { records: { nodes: Array<{ id: number, dateUpdated: unknown, dateCreated: unknown }> } | null };

export type Zc_SitemapTrackTournamentsPageQueryVariables = Exact<{
  startId: number;
  endId: number;
  now: unknown;
}>;


export type Zc_SitemapTrackTournamentsPageQuery = { trackTournaments: { nodes: Array<{ type: number, slug: string, dateUpdated: unknown, dateCreated: unknown }> } | null };

export type Zc_SitemapSuperLeagueSeasonsPageQueryVariables = Exact<{
  startId: number;
  endId: number;
}>;


export type Zc_SitemapSuperLeagueSeasonsPageQuery = { zslSeasons: { nodes: Array<{ id: number, dateUpdated: unknown, dateCreated: unknown }> } | null };

export type Zc_SitemapSuperLeagueRoundsPageQueryVariables = Exact<{
  startId: number;
  endId: number;
}>;


export type Zc_SitemapSuperLeagueRoundsPageQuery = { zslRounds: { nodes: Array<{ round: number, dateUpdated: unknown, dateCreated: unknown, season: { id: number } | null }> } | null };

export type Zc_SitemapSuperLeagueLevelsPageQueryVariables = Exact<{
  startId: number;
  endId: number;
}>;


export type Zc_SitemapSuperLeagueLevelsPageQuery = { zslLevels: { nodes: Array<{ id: number, dateUpdated: unknown, dateCreated: unknown, round: { round: number, season: { id: number } | null } | null }> } | null };

export type Zc_TrackTournamentPlaylistEntryFragment = { id: number, type: number, slug: string, startAt: unknown, level: { levelItems: { nodes: Array<{ fileUid: string, workshopId: unknown, name: string, fileAuthor: string, validationTimeAuthor: number }> }, worldRecordGlobal: { record: { time: number } | null } | null } | null };

export type Zc_TrackTournamentPlaylistQueryVariables = Exact<{
  first: number;
  after?: unknown;
  filter: TrackTournamentFilter;
}>;


export type Zc_TrackTournamentPlaylistQuery = { trackTournaments: { nodes: Array<{ id: number, type: number, slug: string, startAt: unknown, level: { levelItems: { nodes: Array<{ fileUid: string, workshopId: unknown, name: string, fileAuthor: string, validationTimeAuthor: number }> }, worldRecordGlobal: { record: { time: number } | null } | null } | null }>, pageInfo: { endCursor: unknown, hasNextPage: boolean } } | null };

export type Zc_TrackTournamentLevelFragment = { id: number, xxHash: string, adventure: boolean, publiclyVisible: boolean, dateCreated: unknown, levelPoints: { points: number, rating: number } | null, levelItems: { nodes: Array<{ name: string, imageUrl: string, authorId: unknown, workshopId: unknown, author: { steamId: unknown, steamName: string | null } | null }> } };

export type Zc_TrackTournamentStandingFragment = { tournamentId: number, userId: number, recordId: number, time: number, rank: number, points: number, user: { steamId: unknown, steamName: string | null } | null, record: { dateCreated: unknown } | null };

export type Zc_TrackTournamentGhostStandingFragment = { tournamentId: number, userId: number, recordId: number, time: number, rank: number, points: number, record: { dateCreated: unknown, id: number, time: number, dateUpdated: unknown, splits: Array<number | null> | null, speeds: Array<number | null> | null, levelId: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null } | null, recordMedia: { ghostUrl: string | null, dateCreated: unknown, dateUpdated: unknown } | null, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number } } | null, user: { steamId: unknown, steamName: string | null } | null };

export type Zc_TrackTournamentFeatureFragment = { id: number, type: number, slug: string, startAt: unknown, endAt: unknown, finalizedAt: unknown, level: { id: number, xxHash: string, levelItems: { nodes: Array<{ name: string, imageUrl: string, author: { steamId: unknown, steamName: string | null } | null }> } } | null, trackTournamentResults: { totalCount: number } };

export type Zc_TrackTournamentSummaryFragment = { id: number, type: number, slug: string, startAt: unknown, endAt: unknown, finalizedAt: unknown, dateCreated: unknown, dateUpdated: unknown, level: { id: number, xxHash: string, adventure: boolean, publiclyVisible: boolean, dateCreated: unknown, levelPoints: { points: number, rating: number } | null, levelItems: { nodes: Array<{ name: string, imageUrl: string, authorId: unknown, workshopId: unknown, author: { steamId: unknown, steamName: string | null } | null }> } } | null, trackTournamentResults: { totalCount: number, nodes: Array<{ tournamentId: number, userId: number, recordId: number, time: number, rank: number, points: number, user: { steamId: unknown, steamName: string | null } | null, record: { dateCreated: unknown } | null }> } };

export type Zc_TrackTournamentIndexQueryVariables = Exact<{
  type: number;
  now: unknown;
  first?: number | null | undefined;
  after?: unknown;
  last?: number | null | undefined;
  before?: unknown;
}>;


export type Zc_TrackTournamentIndexQuery = { active: { nodes: Array<{ id: number, type: number, slug: string, startAt: unknown, endAt: unknown, finalizedAt: unknown, dateCreated: unknown, dateUpdated: unknown, level: { id: number, xxHash: string, adventure: boolean, publiclyVisible: boolean, dateCreated: unknown, levelPoints: { points: number, rating: number } | null, levelItems: { nodes: Array<{ name: string, imageUrl: string, authorId: unknown, workshopId: unknown, author: { steamId: unknown, steamName: string | null } | null }> } } | null, trackTournamentResults: { totalCount: number, nodes: Array<{ tournamentId: number, userId: number, recordId: number, time: number, rank: number, points: number, user: { steamId: unknown, steamName: string | null } | null, record: { dateCreated: unknown } | null }> } }> } | null, future: { nodes: Array<{ id: number, type: number, slug: string, startAt: unknown, endAt: unknown, finalizedAt: unknown, dateCreated: unknown, dateUpdated: unknown, level: { id: number, xxHash: string, adventure: boolean, publiclyVisible: boolean, dateCreated: unknown, levelPoints: { points: number, rating: number } | null, levelItems: { nodes: Array<{ name: string, imageUrl: string, authorId: unknown, workshopId: unknown, author: { steamId: unknown, steamName: string | null } | null }> } } | null, trackTournamentResults: { totalCount: number, nodes: Array<{ tournamentId: number, userId: number, recordId: number, time: number, rank: number, points: number, user: { steamId: unknown, steamName: string | null } | null, record: { dateCreated: unknown } | null }> } }> } | null, history: { edges: Array<{ cursor: unknown, node: { id: number, type: number, slug: string, startAt: unknown, endAt: unknown, finalizedAt: unknown, dateCreated: unknown, dateUpdated: unknown, level: { id: number, xxHash: string, adventure: boolean, publiclyVisible: boolean, dateCreated: unknown, levelPoints: { points: number, rating: number } | null, levelItems: { nodes: Array<{ name: string, imageUrl: string, authorId: unknown, workshopId: unknown, author: { steamId: unknown, steamName: string | null } | null }> } } | null, trackTournamentResults: { totalCount: number, nodes: Array<{ tournamentId: number, userId: number, recordId: number, time: number, rank: number, points: number, user: { steamId: unknown, steamName: string | null } | null, record: { dateCreated: unknown } | null }> } } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } } | null };

export type Zc_TrackTournamentDetailQueryVariables = Exact<{
  type: number;
  slug: string;
  viewerId: number;
  includeViewer: boolean;
  first?: number | null | undefined;
  after?: unknown;
  last?: number | null | undefined;
  before?: unknown;
}>;


export type Zc_TrackTournamentDetailQuery = { tournament: { id: number, type: number, slug: string, startAt: unknown, endAt: unknown, finalizedAt: unknown, dateCreated: unknown, dateUpdated: unknown, leaderboard: { totalCount: number, edges: Array<{ cursor: unknown, node: { tournamentId: number, userId: number, recordId: number, time: number, rank: number, points: number, user: { steamId: unknown, steamName: string | null } | null, record: { dateCreated: unknown } | null } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } }, viewerStanding?: { nodes: Array<{ tournamentId: number, userId: number, recordId: number, time: number, rank: number, points: number, user: { steamId: unknown, steamName: string | null } | null, record: { dateCreated: unknown } | null }> }, updateFeed: { nodes: Array<{ userId: number, recordId: number, rank: number }> }, ghostFeed: { totalCount: number, nodes: Array<{ tournamentId: number, userId: number, recordId: number, time: number, rank: number, points: number, record: { dateCreated: unknown, id: number, time: number, dateUpdated: unknown, splits: Array<number | null> | null, speeds: Array<number | null> | null, levelId: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null } | null, recordMedia: { ghostUrl: string | null, dateCreated: unknown, dateUpdated: unknown } | null, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number } } | null, user: { steamId: unknown, steamName: string | null } | null }> }, level: { id: number, xxHash: string, adventure: boolean, publiclyVisible: boolean, dateCreated: unknown, levelPoints: { points: number, rating: number } | null, levelItems: { nodes: Array<{ name: string, imageUrl: string, authorId: unknown, workshopId: unknown, author: { steamId: unknown, steamName: string | null } | null }> } } | null, trackTournamentResults: { totalCount: number, nodes: Array<{ tournamentId: number, userId: number, recordId: number, time: number, rank: number, points: number, user: { steamId: unknown, steamName: string | null } | null, record: { dateCreated: unknown } | null }> } } | null };

export type Zc_TrackTournamentNavigationQueryVariables = Exact<{
  type: number;
  startAt: unknown;
  now: unknown;
}>;


export type Zc_TrackTournamentNavigationQuery = { previous: { nodes: Array<{ id: number, type: number, slug: string, startAt: unknown, endAt: unknown, finalizedAt: unknown, dateCreated: unknown, dateUpdated: unknown, level: { id: number, xxHash: string, adventure: boolean, publiclyVisible: boolean, dateCreated: unknown, levelPoints: { points: number, rating: number } | null, levelItems: { nodes: Array<{ name: string, imageUrl: string, authorId: unknown, workshopId: unknown, author: { steamId: unknown, steamName: string | null } | null }> } } | null, trackTournamentResults: { totalCount: number, nodes: Array<{ tournamentId: number, userId: number, recordId: number, time: number, rank: number, points: number, user: { steamId: unknown, steamName: string | null } | null, record: { dateCreated: unknown } | null }> } }> } | null, current: { nodes: Array<{ id: number, type: number, slug: string, startAt: unknown, endAt: unknown, finalizedAt: unknown, dateCreated: unknown, dateUpdated: unknown, level: { id: number, xxHash: string, adventure: boolean, publiclyVisible: boolean, dateCreated: unknown, levelPoints: { points: number, rating: number } | null, levelItems: { nodes: Array<{ name: string, imageUrl: string, authorId: unknown, workshopId: unknown, author: { steamId: unknown, steamName: string | null } | null }> } } | null, trackTournamentResults: { totalCount: number, nodes: Array<{ tournamentId: number, userId: number, recordId: number, time: number, rank: number, points: number, user: { steamId: unknown, steamName: string | null } | null, record: { dateCreated: unknown } | null }> } }> } | null, next: { nodes: Array<{ id: number, type: number, slug: string, startAt: unknown, endAt: unknown, finalizedAt: unknown, dateCreated: unknown, dateUpdated: unknown, level: { id: number, xxHash: string, adventure: boolean, publiclyVisible: boolean, dateCreated: unknown, levelPoints: { points: number, rating: number } | null, levelItems: { nodes: Array<{ name: string, imageUrl: string, authorId: unknown, workshopId: unknown, author: { steamId: unknown, steamName: string | null } | null }> } } | null, trackTournamentResults: { totalCount: number, nodes: Array<{ tournamentId: number, userId: number, recordId: number, time: number, rank: number, points: number, user: { steamId: unknown, steamName: string | null } | null, record: { dateCreated: unknown } | null }> } }> } | null };

export type Zc_TrackTournamentLiveSubscriptionVariables = Exact<{
  id: number;
  viewerId: number;
  includeViewer: boolean;
}>;


export type Zc_TrackTournamentLiveSubscription = { trackTournament: { id: number, leaderboard: { totalCount: number, edges: Array<{ cursor: unknown, node: { tournamentId: number, userId: number, recordId: number, time: number, rank: number, points: number, user: { steamId: unknown, steamName: string | null } | null, record: { dateCreated: unknown } | null } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } }, viewerStanding?: { nodes: Array<{ tournamentId: number, userId: number, recordId: number, time: number, rank: number, points: number, user: { steamId: unknown, steamName: string | null } | null, record: { dateCreated: unknown } | null }> }, updateFeed: { nodes: Array<{ userId: number, recordId: number, rank: number }> }, ghostFeed: { totalCount: number, nodes: Array<{ tournamentId: number, userId: number, recordId: number, time: number, rank: number, points: number, record: { dateCreated: unknown, id: number, time: number, dateUpdated: unknown, splits: Array<number | null> | null, speeds: Array<number | null> | null, levelId: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null } | null, recordMedia: { ghostUrl: string | null, dateCreated: unknown, dateUpdated: unknown } | null, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number } } | null, user: { steamId: unknown, steamName: string | null } | null }> } } | null };

export type Zc_UserContributionsQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: unknown;
  last?: number | null | undefined;
  before?: unknown;
  filter: UserPointContributionFilter;
  orderBy: Array<UserPointContributionsOrderBy> | UserPointContributionsOrderBy;
}>;


export type Zc_UserContributionsQuery = { userPointContributions: { totalCount: number, edges: Array<{ cursor: unknown, node: { contributionRank: number, levelPosition: number, levelPoints: number, levelDecayedPoints: number, playerDecayedPoints: number, dateCalculated: unknown, record: { id: number, time: number, dateCreated: unknown, levelId: number, userId: number } | null, level: { xxHash: string, levelItems: { nodes: Array<{ name: string }> } } | null } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } } | null };

export type Zc_UserLevelCardFragment = { id: number, xxHash: string, adventure: boolean, dateCreated: unknown, levelItems: { nodes: Array<{ name: string, imageUrl: string, fileUid: string, fileAuthor: string, workshopId: unknown, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, author: { steamId: unknown, steamName: string | null } | null }> }, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, viewerFavourites?: { totalCount: number }, worldRecordGlobal: { record: { time: number } | null, user: { steamId: unknown, steamName: string | null } | null } | null };

export type Zc_UserLevelsQueryVariables = Exact<{
  userId: number;
  steamId: unknown;
  since: unknown;
  viewerId: number;
  includeViewer: boolean;
}>;


export type Zc_UserLevelsQuery = { recentUser: { levelItems: { nodes: Array<{ level: { id: number, xxHash: string, adventure: boolean, dateCreated: unknown, levelItems: { nodes: Array<{ name: string, imageUrl: string, fileUid: string, fileAuthor: string, workshopId: unknown, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, author: { steamId: unknown, steamName: string | null } | null }> }, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, viewerFavourites?: { totalCount: number }, worldRecordGlobal: { record: { time: number } | null, user: { steamId: unknown, steamName: string | null } | null } | null } | null }> } } | null, popularLevels: { nodes: Array<{ id: number, xxHash: string, adventure: boolean, dateCreated: unknown, periodRecords: { totalCount: number }, levelItems: { nodes: Array<{ name: string, imageUrl: string, fileUid: string, fileAuthor: string, workshopId: unknown, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, author: { steamId: unknown, steamName: string | null } | null }> }, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, viewerFavourites?: { totalCount: number }, worldRecordGlobal: { record: { time: number } | null, user: { steamId: unknown, steamName: string | null } | null } | null }> } | null };

export type Zc_UserFavouriteLevelsQueryVariables = Exact<{
  userId: number;
  first?: number | null | undefined;
  after?: unknown;
  last?: number | null | undefined;
  before?: unknown;
  viewerId: number;
  includeViewer: boolean;
}>;


export type Zc_UserFavouriteLevelsQuery = { user: { favourites: { totalCount: number, edges: Array<{ cursor: unknown, node: { level: { id: number, xxHash: string, adventure: boolean, dateCreated: unknown, levelItems: { nodes: Array<{ name: string, imageUrl: string, fileUid: string, fileAuthor: string, workshopId: unknown, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, author: { steamId: unknown, steamName: string | null } | null }> }, levelPoints: { points: number, rating: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, viewerFavourites?: { totalCount: number }, worldRecordGlobal: { record: { time: number } | null, user: { steamId: unknown, steamName: string | null } | null } | null } | null } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } } } | null };

export type Zc_UserPointsHistoryQueryVariables = Exact<{
  userId: number;
  since: unknown;
}>;


export type Zc_UserPointsHistoryQuery = { baseline: { nodes: Array<{ dateCreated: unknown, points: number, rank: number }> } | null, history: { groupedAggregates: Array<{ keys: Array<string | null> | null, max: { points: number | null } | null, min: { rank: number | null } | null }> | null } | null };

export type Zc_UserPointsHistorySecondaryQueryVariables = Exact<{
  userId: number;
  since: unknown;
}>;


export type Zc_UserPointsHistorySecondaryQuery = { baseline: { nodes: Array<{ dateCreated: unknown, totalPoints: number, worldRecords: number }> } | null, history: { groupedAggregates: Array<{ keys: Array<string | null> | null, max: { totalPoints: number | null, worldRecords: number | null } | null }> | null } | null };

export type Zc_UserProfileQueryVariables = Exact<{
  steamId: unknown;
}>;


export type Zc_UserProfileQuery = { users: { nodes: Array<{ id: number, steamId: unknown, steamName: string | null, dateCreated: unknown, userPoints: { points: number, rank: number, totalPoints: number, worldRecords: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number }, levelItems: { totalCount: number }, votes: { totalCount: number, groupedAggregates: Array<{ keys: Array<string | null> | null, sum: { value: unknown } | null }> | null } }> } | null };

export type Zc_UserResultsQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: unknown;
  last?: number | null | undefined;
  before?: unknown;
  filter: RecordFilter;
}>;


export type Zc_UserResultsQuery = { records: { totalCount: number, edges: Array<{ cursor: unknown, node: { id: number, time: number, dateCreated: unknown, levelId: number, userId: number, level: { xxHash: string, levelPoints: { points: number } | null, levelItems: { nodes: Array<{ name: string }> } } | null, userPointContributions: { nodes: Array<{ levelPoints: number, playerDecayedPoints: number, levelDecayedPoints: number, levelPosition: number, contributionRank: number }> }, personalBestGlobals: { totalCount: number }, worldRecordGlobals: { totalCount: number } } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } } | null };

export type Zc_UserStatisticTotalsFragment = { totalCount: number, aggregates: { sum: { distance: number } | null } | null };

export type Zc_UserV6StatisticAggregatesFragment = { sum: { distance: number, distanceInAir: number, distanceOn1Wheel: number, distanceOn2Wheels: number, distanceOn3Wheels: number, distanceOn4Wheels: number, distanceOnGrass: number, distanceOnGround: number, distanceOnIce1: number, distanceOnIce2: number, distanceOnIce3: number, distanceOnWood: number, distanceOnMud: number, distanceOnSand: number, distanceOnSoap: number, distanceOnTarmac: number, distanceRagdoll: number, time: number, timeInAir: number, timeOnGrass: number, timeOnGround: number, timeOnIce1: number, timeOnIce2: number, timeOnIce3: number, timeOnWood: number, timeOnMud: number, timeOnSand: number, timeOnSoap: number, timeOnTarmac: number, timeRagdoll: number, turnLeftCount: unknown, turnRightCount: unknown, armsUpCount: unknown, brakeCount: unknown, hornCount: unknown } | null, average: { averageGforce: number | null, averageSpeed: number | null } | null, max: { maxGforce: number | null, maxSpeed: number | null } | null };

export type Zc_UserStatisticsQueryVariables = Exact<{
  userId: number;
  minimumModVersion: string;
  daySince: unknown;
  monthSince: unknown;
  yearSince: unknown;
}>;


export type Zc_UserStatisticsQuery = { allStatistics: { totalCount: number, aggregates: { sum: { distance: number } | null } | null } | null, dayStatistics: { totalCount: number, aggregates: { sum: { distance: number } | null } | null } | null, monthStatistics: { totalCount: number, aggregates: { sum: { distance: number } | null } | null } | null, yearStatistics: { totalCount: number, aggregates: { sum: { distance: number } | null } | null } | null, v6Statistics: { totalCount: number, aggregates: { sum: { distance: number, distanceInAir: number, distanceOn1Wheel: number, distanceOn2Wheels: number, distanceOn3Wheels: number, distanceOn4Wheels: number, distanceOnGrass: number, distanceOnGround: number, distanceOnIce1: number, distanceOnIce2: number, distanceOnIce3: number, distanceOnWood: number, distanceOnMud: number, distanceOnSand: number, distanceOnSoap: number, distanceOnTarmac: number, distanceRagdoll: number, time: number, timeInAir: number, timeOnGrass: number, timeOnGround: number, timeOnIce1: number, timeOnIce2: number, timeOnIce3: number, timeOnWood: number, timeOnMud: number, timeOnSand: number, timeOnSoap: number, timeOnTarmac: number, timeRagdoll: number, turnLeftCount: unknown, turnRightCount: unknown, armsUpCount: unknown, brakeCount: unknown, hornCount: unknown } | null, average: { averageGforce: number | null, averageSpeed: number | null } | null, max: { maxGforce: number | null, maxSpeed: number | null } | null } | null } | null, v6DayStatistics: { totalCount: number, aggregates: { sum: { distance: number, distanceInAir: number, distanceOn1Wheel: number, distanceOn2Wheels: number, distanceOn3Wheels: number, distanceOn4Wheels: number, distanceOnGrass: number, distanceOnGround: number, distanceOnIce1: number, distanceOnIce2: number, distanceOnIce3: number, distanceOnWood: number, distanceOnMud: number, distanceOnSand: number, distanceOnSoap: number, distanceOnTarmac: number, distanceRagdoll: number, time: number, timeInAir: number, timeOnGrass: number, timeOnGround: number, timeOnIce1: number, timeOnIce2: number, timeOnIce3: number, timeOnWood: number, timeOnMud: number, timeOnSand: number, timeOnSoap: number, timeOnTarmac: number, timeRagdoll: number, turnLeftCount: unknown, turnRightCount: unknown, armsUpCount: unknown, brakeCount: unknown, hornCount: unknown } | null, average: { averageGforce: number | null, averageSpeed: number | null } | null, max: { maxGforce: number | null, maxSpeed: number | null } | null } | null } | null, v6MonthStatistics: { totalCount: number, aggregates: { sum: { distance: number, distanceInAir: number, distanceOn1Wheel: number, distanceOn2Wheels: number, distanceOn3Wheels: number, distanceOn4Wheels: number, distanceOnGrass: number, distanceOnGround: number, distanceOnIce1: number, distanceOnIce2: number, distanceOnIce3: number, distanceOnWood: number, distanceOnMud: number, distanceOnSand: number, distanceOnSoap: number, distanceOnTarmac: number, distanceRagdoll: number, time: number, timeInAir: number, timeOnGrass: number, timeOnGround: number, timeOnIce1: number, timeOnIce2: number, timeOnIce3: number, timeOnWood: number, timeOnMud: number, timeOnSand: number, timeOnSoap: number, timeOnTarmac: number, timeRagdoll: number, turnLeftCount: unknown, turnRightCount: unknown, armsUpCount: unknown, brakeCount: unknown, hornCount: unknown } | null, average: { averageGforce: number | null, averageSpeed: number | null } | null, max: { maxGforce: number | null, maxSpeed: number | null } | null } | null } | null, v6YearStatistics: { totalCount: number, aggregates: { sum: { distance: number, distanceInAir: number, distanceOn1Wheel: number, distanceOn2Wheels: number, distanceOn3Wheels: number, distanceOn4Wheels: number, distanceOnGrass: number, distanceOnGround: number, distanceOnIce1: number, distanceOnIce2: number, distanceOnIce3: number, distanceOnWood: number, distanceOnMud: number, distanceOnSand: number, distanceOnSoap: number, distanceOnTarmac: number, distanceRagdoll: number, time: number, timeInAir: number, timeOnGrass: number, timeOnGround: number, timeOnIce1: number, timeOnIce2: number, timeOnIce3: number, timeOnWood: number, timeOnMud: number, timeOnSand: number, timeOnSoap: number, timeOnTarmac: number, timeRagdoll: number, turnLeftCount: unknown, turnRightCount: unknown, armsUpCount: unknown, brakeCount: unknown, hornCount: unknown } | null, average: { averageGforce: number | null, averageSpeed: number | null } | null, max: { maxGforce: number | null, maxSpeed: number | null } | null } | null } | null };

export type Zc_UserSuperLeagueSeasonsQueryVariables = Exact<{
  userId: number;
}>;


export type Zc_UserSuperLeagueSeasonsQuery = { zslSeasons: { nodes: Array<{ id: number, name: string, startDate: unknown, endDate: unknown }> } | null, currentSeason: { nodes: Array<{ id: number, name: string, startDate: unknown, endDate: unknown, pointsStructure: { bestOf: number } | null, zslSeasonResults: { nodes: Array<{ position: number, points: number }> }, zslRounds: { nodes: Array<{ id: number, round: number, name: string, eventDate: unknown, zslRoundResults: { nodes: Array<{ position: number, points: number }> } }> } }> } | null };

export type Zc_UserSuperLeagueSeasonQueryVariables = Exact<{
  seasonId: number;
  userId: number;
}>;


export type Zc_UserSuperLeagueSeasonQuery = { zslSeason: { id: number, name: string, startDate: unknown, endDate: unknown, pointsStructure: { bestOf: number } | null, zslSeasonResults: { nodes: Array<{ position: number, points: number }> }, zslRounds: { nodes: Array<{ id: number, round: number, name: string, eventDate: unknown, zslRoundResults: { nodes: Array<{ position: number, points: number }> } }> } } | null };

export type Zc_UsersQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: unknown;
  last?: number | null | undefined;
  before?: unknown;
  filter?: UserPointFilter | null | undefined;
  orderBy?: Array<UserPointsOrderBy> | UserPointsOrderBy | null | undefined;
}>;


export type Zc_UsersQuery = { userPoints: { totalCount: number, edges: Array<{ cursor: unknown, node: { points: number, rank: number, totalPoints: number, worldRecords: number, user: { id: number, steamId: unknown, steamName: string | null } | null } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } } | null };

export type Zc_UserSuggestionsQueryVariables = Exact<{
  search: string;
}>;


export type Zc_UserSuggestionsQuery = { users: { nodes: Array<{ id: number, steamId: unknown, steamName: string | null }> } | null };

export type Zc_ZslLevelQueryVariables = Exact<{
  id: number;
}>;


export type Zc_ZslLevelQuery = { zslLevel: { id: number, roundId: number, round: { name: string, round: number, eventDate: unknown, seasonId: number, season: { name: string } | null } | null, zslLevelResults: { aggregates: { min: { time: number | null } | null } | null }, level: { xxHash: string, levelItems: { nodes: Array<{ name: string, imageUrl: string, workshopId: unknown }> } } | null } | null };

export type Zc_ZslLevelStandingFieldsFragment = { position: number, points: number, userId: number, time: number, user: { id: number, steamId: unknown, steamName: string | null } | null, record: { id: number } | null };

export type Zc_ZslLevelResultsQueryVariables = Exact<{
  id: number;
  viewerId: number;
  includeViewer: boolean;
  first?: number | null | undefined;
  after?: unknown;
  last?: number | null | undefined;
  before?: unknown;
}>;


export type Zc_ZslLevelResultsQuery = { zslLevelResults: { totalCount: number, edges: Array<{ cursor: unknown, node: { position: number, points: number, userId: number, time: number, user: { id: number, steamId: unknown, steamName: string | null } | null, record: { id: number } | null } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } } | null, viewerStanding?: { nodes: Array<{ position: number, points: number, userId: number, time: number, user: { id: number, steamId: unknown, steamName: string | null } | null, record: { id: number } | null }> } | null };

export type Zc_ZslRoundBySeasonAndNumberQueryVariables = Exact<{
  seasonId: number;
  round: number;
}>;


export type Zc_ZslRoundBySeasonAndNumberQuery = { zslRounds: { nodes: Array<{ id: number, round: number, name: string, eventDate: unknown, seasonId: number, season: { name: string } | null, zslLevels: { nodes: Array<{ id: number, level: { levelItems: { nodes: Array<{ name: string, imageUrl: string }> } } | null }> } }> } | null };

export type Zc_ZslRoundStandingFieldsFragment = { position: number, points: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null, zslLevelResults: { totalCount: number } } | null };

export type Zc_ZslRoundResultsQueryVariables = Exact<{
  seasonId: number;
  round: number;
  viewerId: number;
  includeViewer: boolean;
  first?: number | null | undefined;
  after?: unknown;
  last?: number | null | undefined;
  before?: unknown;
}>;


export type Zc_ZslRoundResultsQuery = { zslRoundResults: { totalCount: number, edges: Array<{ cursor: unknown, node: { position: number, points: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null, zslLevelResults: { totalCount: number } } | null } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } } | null, viewerStanding?: { nodes: Array<{ position: number, points: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null, zslLevelResults: { totalCount: number } } | null }> } | null };

export type Zc_ZslSeasonQueryVariables = Exact<{
  id: number;
}>;


export type Zc_ZslSeasonQuery = { zslSeason: { id: number, name: string, startDate: unknown, endDate: unknown, pointsStructure: { bestOf: number } | null, zslRounds: { nodes: Array<{ id: number, round: number, name: string, eventDate: unknown }> } } | null };

export type Zc_ZslSeasonStandingFieldsFragment = { position: number, points: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null, zslRoundResults: { nodes: Array<{ points: number, round: { round: number } | null }> } } | null };

export type Zc_ZslSeasonResultsQueryVariables = Exact<{
  id: number;
  viewerId: number;
  includeViewer: boolean;
  first?: number | null | undefined;
  after?: unknown;
  last?: number | null | undefined;
  before?: unknown;
}>;


export type Zc_ZslSeasonResultsQuery = { zslSeasonResults: { totalCount: number, edges: Array<{ cursor: unknown, node: { position: number, points: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null, zslRoundResults: { nodes: Array<{ points: number, round: { round: number } | null }> } } | null } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } } | null, viewerStanding?: { nodes: Array<{ position: number, points: number, userId: number, user: { id: number, steamId: unknown, steamName: string | null, zslRoundResults: { nodes: Array<{ points: number, round: { round: number } | null }> } } | null }> } | null };

export type Zc_ZslSeasonsQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: unknown;
  last?: number | null | undefined;
  before?: unknown;
}>;


export type Zc_ZslSeasonsQuery = { zslSeasons: { totalCount: number, edges: Array<{ cursor: unknown, node: { id: number, name: string, startDate: unknown, endDate: unknown, zslSeasonResults: { totalCount: number }, zslRounds: { nodes: Array<{ id: number, round: number, name: string, eventDate: unknown }> } } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } } | null };

export type Zc_DashboardMetricsLiveSubscriptionVariables = Exact<{
  daySince: unknown;
  monthSince: unknown;
}>;


export type Zc_DashboardMetricsLiveSubscription = { query: { records: { totalCount: number } | null, recordsDay: { totalCount: number } | null, recordsMonth: { totalCount: number } | null, personalBestGlobals: { totalCount: number } | null, personalBestGlobalsDay: { totalCount: number } | null, personalBestGlobalsMonth: { totalCount: number } | null, worldRecordGlobals: { totalCount: number } | null, worldRecordGlobalsDay: { totalCount: number } | null, worldRecordGlobalsMonth: { totalCount: number } | null, levels: { totalCount: number } | null, levelsDay: { totalCount: number } | null, levelsMonth: { totalCount: number } | null, votes: { totalCount: number } | null, votesDay: { totalCount: number } | null, votesMonth: { totalCount: number } | null, totalUsers: { totalCount: number } | null, rankedUsers: { totalCount: number } | null, activeUsersDay: { totalCount: number } | null, activeUsersMonth: { totalCount: number } | null } };

export type Zc_RecordHistoryLiveSubscriptionVariables = Exact<{
  filter?: RecordHistoryEntryFilter | null | undefined;
}>;


export type Zc_RecordHistoryLiveSubscription = { recordHistoryEntries: { edges: Array<{ cursor: unknown, node: { id: number, time: number | null, dateCreated: unknown, levelId: number | null, userId: number | null, userSteamId: unknown, userName: string | null, levelXxHash: string | null, levelName: string | null, levelPosition: number | null, contributionRank: number | null, levelPoints: number | null, playerDecayedPoints: number | null, levelDecayedPoints: number | null, isPersonalBest: boolean | null, isWorldRecord: boolean | null, hasContribution: boolean | null } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } } | null };

export const Zc_DiscordPlaylistLevelFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_DiscordPlaylistLevel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"publiclyVisible"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"discordId"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"discordId"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DiscordPlaylistLevelFragment, unknown>;
export const Zc_DiscordTournamentSnapshotFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_DiscordTournamentSnapshot"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournament"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"3"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"RANK_ASC"},{"kind":"EnumValue","value":"TIME_ASC"},{"kind":"EnumValue","value":"RECORD_ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DiscordTournamentSnapshotFragment, unknown>;
export const Zc_AdventureLevelCardFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_AdventureLevelCard"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerFavourites"},"name":{"kind":"Name","value":"favourites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeGold"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeSilver"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeBronze"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_AdventureLevelCardFragment, unknown>;
export const Zc_DashboardLevelFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_DashboardLevel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeGold"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeSilver"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeBronze"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerFavourites"},"name":{"kind":"Name","value":"favourites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DashboardLevelFragment, unknown>;
export const Zc_DashboardMetricCountsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_DashboardMetricCounts"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Query"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"recordsDay"},"name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"recordsMonth"},"name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"personalBestGlobalsDay"},"name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"personalBestGlobalsMonth"},"name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"worldRecordGlobalsDay"},"name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"worldRecordGlobalsMonth"},"name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"levelsDay"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"levelsMonth"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"votesDay"},"name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"votesMonth"},"name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"totalUsers"},"name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"rankedUsers"},"name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"userPointExists"},"value":{"kind":"BooleanValue","value":true}},{"kind":"ObjectField","name":{"kind":"Name","value":"userPoints"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"rank"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"notEqualTo"},"value":{"kind":"IntValue","value":"-1"}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"activeUsersDay"},"name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"or"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"records"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}]}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"createdAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}}]}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"zslLevelResults"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"level"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"round"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eventDate"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}]}}]}}]}}]}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"activeUsersMonth"},"name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"or"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"records"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}]}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"createdAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}}]}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"zslLevelResults"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"level"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"round"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eventDate"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}]}}]}}]}}]}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_DashboardMetricCountsFragment, unknown>;
export const Zc_DashboardV6StatisticAggregatesFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_DashboardV6StatisticAggregates"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RecordStatisticAggregates"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sum"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"distance"}},{"kind":"Field","name":{"kind":"Name","value":"distanceInAir"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn1Wheel"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn2Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn3Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn4Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnGrass"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnGround"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce1"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce2"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce3"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnWood"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnMud"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnSand"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnSoap"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnTarmac"}},{"kind":"Field","name":{"kind":"Name","value":"distanceRagdoll"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"timeInAir"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnGrass"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnGround"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce1"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce2"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce3"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnWood"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnMud"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnSand"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnSoap"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnTarmac"}},{"kind":"Field","name":{"kind":"Name","value":"timeRagdoll"}},{"kind":"Field","name":{"kind":"Name","value":"turnLeftCount"}},{"kind":"Field","name":{"kind":"Name","value":"turnRightCount"}},{"kind":"Field","name":{"kind":"Name","value":"armsUpCount"}},{"kind":"Field","name":{"kind":"Name","value":"brakeCount"}},{"kind":"Field","name":{"kind":"Name","value":"hornCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"average"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"averageGforce"}},{"kind":"Field","name":{"kind":"Name","value":"averageSpeed"}}]}}]}}]} as unknown as DocumentNode<Zc_DashboardV6StatisticAggregatesFragment, unknown>;
export const Zc_LevelSplitRecordFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_LevelSplitRecord"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Record"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"splits"}},{"kind":"Field","name":{"kind":"Name","value":"speeds"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]} as unknown as DocumentNode<Zc_LevelSplitRecordFragment, unknown>;
export const Zc_LevelExplorerCardFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_LevelExplorerCard"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeGold"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeSilver"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeBronze"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerFavourites"},"name":{"kind":"Name","value":"favourites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_LevelExplorerCardFragment, unknown>;
export const Zc_RecordStatisticFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_RecordStatistic"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RecordStatistic"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"armsUpCount"}},{"kind":"Field","name":{"kind":"Name","value":"armsUpTime"}},{"kind":"Field","name":{"kind":"Name","value":"averageAngularVelocity"}},{"kind":"Field","name":{"kind":"Name","value":"averageGforce"}},{"kind":"Field","name":{"kind":"Name","value":"averageSpeed"}},{"kind":"Field","name":{"kind":"Name","value":"averageVelocity"}},{"kind":"Field","name":{"kind":"Name","value":"brakeCount"}},{"kind":"Field","name":{"kind":"Name","value":"brakeTime"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"distance"}},{"kind":"Field","name":{"kind":"Name","value":"distanceInAir"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOffroadWheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn1Wheel"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn2Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn3Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn4Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnGrass"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnGround"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce1"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce2"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce3"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnWood"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnMud"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnMonorail"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnSand"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnSoap"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnTarmac"}},{"kind":"Field","name":{"kind":"Name","value":"distanceParaglider"}},{"kind":"Field","name":{"kind":"Name","value":"distanceParked"}},{"kind":"Field","name":{"kind":"Name","value":"distanceRagdoll"}},{"kind":"Field","name":{"kind":"Name","value":"distanceSlipping"}},{"kind":"Field","name":{"kind":"Name","value":"distanceSoapWheels"}},{"kind":"Field","name":{"kind":"Name","value":"driverInputTransitionCount"}},{"kind":"Field","name":{"kind":"Name","value":"frameCount"}},{"kind":"Field","name":{"kind":"Name","value":"ghostVersion"}},{"kind":"Field","name":{"kind":"Name","value":"hasAirData"}},{"kind":"Field","name":{"kind":"Name","value":"hasInputData"}},{"kind":"Field","name":{"kind":"Name","value":"hasRagdollData"}},{"kind":"Field","name":{"kind":"Name","value":"hasSlipData"}},{"kind":"Field","name":{"kind":"Name","value":"hasStateData"}},{"kind":"Field","name":{"kind":"Name","value":"hasSurfaceData"}},{"kind":"Field","name":{"kind":"Name","value":"hasVelocityData"}},{"kind":"Field","name":{"kind":"Name","value":"hasWheelData"}},{"kind":"Field","name":{"kind":"Name","value":"hornCount"}},{"kind":"Field","name":{"kind":"Name","value":"hornTime"}},{"kind":"Field","name":{"kind":"Name","value":"maxAngularVelocity"}},{"kind":"Field","name":{"kind":"Name","value":"maxGforce"}},{"kind":"Field","name":{"kind":"Name","value":"maxSpeed"}},{"kind":"Field","name":{"kind":"Name","value":"maxVelocity"}},{"kind":"Field","name":{"kind":"Name","value":"nodeId"}},{"kind":"Field","name":{"kind":"Name","value":"recordId"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"timeAnyDriverInput"}},{"kind":"Field","name":{"kind":"Name","value":"timeInAir"}},{"kind":"Field","name":{"kind":"Name","value":"timeOffroadWheels"}},{"kind":"Field","name":{"kind":"Name","value":"timeOn1Wheel"}},{"kind":"Field","name":{"kind":"Name","value":"timeOn2Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"timeOn3Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"timeOn4Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnGrass"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnGround"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce1"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce2"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce3"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnWood"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnMud"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnMonorail"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnSand"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnSoap"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnTarmac"}},{"kind":"Field","name":{"kind":"Name","value":"timeParaglider"}},{"kind":"Field","name":{"kind":"Name","value":"timeParked"}},{"kind":"Field","name":{"kind":"Name","value":"timeRagdoll"}},{"kind":"Field","name":{"kind":"Name","value":"timeSlipping"}},{"kind":"Field","name":{"kind":"Name","value":"timeSoapWheels"}},{"kind":"Field","name":{"kind":"Name","value":"turnLeftCount"}},{"kind":"Field","name":{"kind":"Name","value":"turnLeftTime"}},{"kind":"Field","name":{"kind":"Name","value":"turnRightCount"}},{"kind":"Field","name":{"kind":"Name","value":"turnRightTime"}}]}}]} as unknown as DocumentNode<Zc_RecordStatisticFragment, unknown>;
export const Zc_RecordHistoryRowFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_RecordHistoryRow"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RecordHistoryEntry"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"userSteamId"}},{"kind":"Field","name":{"kind":"Name","value":"userName"}},{"kind":"Field","name":{"kind":"Name","value":"levelXxHash"}},{"kind":"Field","name":{"kind":"Name","value":"levelName"}},{"kind":"Field","name":{"kind":"Name","value":"levelPosition"}},{"kind":"Field","name":{"kind":"Name","value":"contributionRank"}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"}},{"kind":"Field","name":{"kind":"Name","value":"playerDecayedPoints"}},{"kind":"Field","name":{"kind":"Name","value":"levelDecayedPoints"}},{"kind":"Field","name":{"kind":"Name","value":"isPersonalBest"}},{"kind":"Field","name":{"kind":"Name","value":"isWorldRecord"}},{"kind":"Field","name":{"kind":"Name","value":"hasContribution"}}]}}]} as unknown as DocumentNode<Zc_RecordHistoryRowFragment, unknown>;
export const Zc_TrackTournamentPlaylistEntryFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentPlaylistEntry"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournament"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_TrackTournamentPlaylistEntryFragment, unknown>;
export const Zc_TrackTournamentStandingFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentStanding"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournamentResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tournamentId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"recordId"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}}]}}]}}]} as unknown as DocumentNode<Zc_TrackTournamentStandingFragment, unknown>;
export const Zc_GhostComparisonRecordFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Record"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"splits"}},{"kind":"Field","name":{"kind":"Name","value":"speeds"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recordMedia"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ghostUrl"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_GhostComparisonRecordFragment, unknown>;
export const Zc_TrackTournamentGhostStandingFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentGhostStanding"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournamentResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentStanding"}},{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Record"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"splits"}},{"kind":"Field","name":{"kind":"Name","value":"speeds"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recordMedia"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ghostUrl"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentStanding"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournamentResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tournamentId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"recordId"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}}]}}]}}]} as unknown as DocumentNode<Zc_TrackTournamentGhostStandingFragment, unknown>;
export const Zc_TrackTournamentFeatureFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentFeature"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournament"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"finalizedAt"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_TrackTournamentFeatureFragment, unknown>;
export const Zc_TrackTournamentLevelFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentLevel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"publiclyVisible"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"authorId"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_TrackTournamentLevelFragment, unknown>;
export const Zc_TrackTournamentSummaryFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournament"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"finalizedAt"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentLevel"}}]}},{"kind":"Field","name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"3"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"RANK_ASC"},{"kind":"EnumValue","value":"TIME_ASC"},{"kind":"EnumValue","value":"RECORD_ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentStanding"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentLevel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"publiclyVisible"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"authorId"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentStanding"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournamentResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tournamentId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"recordId"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}}]}}]}}]} as unknown as DocumentNode<Zc_TrackTournamentSummaryFragment, unknown>;
export const Zc_UserLevelCardFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_UserLevelCard"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeGold"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeSilver"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeBronze"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerFavourites"},"name":{"kind":"Name","value":"favourites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_UserLevelCardFragment, unknown>;
export const Zc_UserStatisticTotalsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_UserStatisticTotals"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RecordStatisticsConnection"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sum"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"distance"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_UserStatisticTotalsFragment, unknown>;
export const Zc_UserV6StatisticAggregatesFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_UserV6StatisticAggregates"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RecordStatisticAggregates"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sum"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"distance"}},{"kind":"Field","name":{"kind":"Name","value":"distanceInAir"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn1Wheel"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn2Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn3Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn4Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnGrass"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnGround"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce1"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce2"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce3"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnWood"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnMud"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnSand"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnSoap"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnTarmac"}},{"kind":"Field","name":{"kind":"Name","value":"distanceRagdoll"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"timeInAir"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnGrass"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnGround"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce1"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce2"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce3"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnWood"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnMud"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnSand"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnSoap"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnTarmac"}},{"kind":"Field","name":{"kind":"Name","value":"timeRagdoll"}},{"kind":"Field","name":{"kind":"Name","value":"turnLeftCount"}},{"kind":"Field","name":{"kind":"Name","value":"turnRightCount"}},{"kind":"Field","name":{"kind":"Name","value":"armsUpCount"}},{"kind":"Field","name":{"kind":"Name","value":"brakeCount"}},{"kind":"Field","name":{"kind":"Name","value":"hornCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"average"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"averageGforce"}},{"kind":"Field","name":{"kind":"Name","value":"averageSpeed"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxGforce"}},{"kind":"Field","name":{"kind":"Name","value":"maxSpeed"}}]}}]}}]} as unknown as DocumentNode<Zc_UserV6StatisticAggregatesFragment, unknown>;
export const Zc_ZslLevelStandingFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_ZslLevelStandingFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ZslLevelResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<Zc_ZslLevelStandingFieldsFragment, unknown>;
export const Zc_ZslRoundStandingFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_ZslRoundStandingFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ZslRoundResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"zslLevelResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"level"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"round"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"seasonId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"seasonId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"round"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"round"}}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_ZslRoundStandingFieldsFragment, unknown>;
export const Zc_ZslSeasonStandingFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_ZslSeasonStandingFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ZslSeasonResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"zslRoundResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"6"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"round"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"seasonId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ROUND_ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"round"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"round"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_ZslSeasonStandingFieldsFragment, unknown>;
export const Zc_DiscordLevelByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DiscordLevelById"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"level"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"publiclyVisible"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"authorId"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"discordId"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"modVersion"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"discordId"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DiscordLevelByIdQuery, Zc_DiscordLevelByIdQueryVariables>;
export const Zc_DiscordLevelsByIdsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DiscordLevelsByIds"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"50"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_DiscordPlaylistLevel"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_DiscordPlaylistLevel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"publiclyVisible"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"discordId"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"discordId"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DiscordLevelsByIdsQuery, Zc_DiscordLevelsByIdsQueryVariables>;
export const Zc_DiscordRecentWorkshopLevelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DiscordRecentWorkshopLevels"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LevelItemsOrderBy"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"levelFilter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LevelFilter"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"level"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelFilter"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"publiclyVisible"}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"discordId"}}]}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DiscordRecentWorkshopLevelsQuery, Zc_DiscordRecentWorkshopLevelsQueryVariables>;
export const Zc_DiscordLevelDetailByHashDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DiscordLevelDetailByHash"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"xxHash"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levelByXxHash"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"xxHash"},"value":{"kind":"Variable","name":{"kind":"Name","value":"xxHash"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"publiclyVisible"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"discordId"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"discordId"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DiscordLevelDetailByHashQuery, Zc_DiscordLevelDetailByHashQueryVariables>;
export const Zc_DiscordLevelSearchDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DiscordLevelSearch"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"search"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"8"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"or"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"includesInsensitive"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}}]}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"author"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"steamName"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"includesInsensitive"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}}]}}]}}]}]}}]}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"LEVEL_POINTS_POINTS_DESC"},{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DiscordLevelSearchQuery, Zc_DiscordLevelSearchQueryVariables>;
export const Zc_DiscordLevelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DiscordLevels"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LevelFilter"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LevelsOrderBy"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_DiscordPlaylistLevel"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_DiscordPlaylistLevel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"publiclyVisible"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"discordId"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"discordId"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DiscordLevelsQuery, Zc_DiscordLevelsQueryVariables>;
export const Zc_DiscordHotLevelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DiscordHotLevels"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LevelFilter"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"since"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"levels"},"name":{"kind":"Name","value":"hotLevelsSince"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"and"},"value":{"kind":"ListValue","values":[{"kind":"Variable","name":{"kind":"Name","value":"filter"}},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"worldRecordGlobal"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"time"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThan"},"value":{"kind":"IntValue","value":"10"}}]}}]}}]}}]}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"since"},"value":{"kind":"Variable","name":{"kind":"Name","value":"since"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_DiscordPlaylistLevel"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_DiscordPlaylistLevel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"publiclyVisible"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"discordId"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"discordId"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DiscordHotLevelsQuery, Zc_DiscordHotLevelsQueryVariables>;
export const Zc_DiscordLevelRecordsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DiscordLevelRecords"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"last"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"before"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RecordFilter"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RecordsOrderBy"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"Variable","name":{"kind":"Name","value":"last"}}},{"kind":"Argument","name":{"kind":"Name","value":"before"},"value":{"kind":"Variable","name":{"kind":"Name","value":"before"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"discordId"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_DiscordLevelRecordsQuery, Zc_DiscordLevelRecordsQueryVariables>;
export const Zc_DiscordTournamentSnapshotsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DiscordTournamentSnapshots"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"now"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"weekly"},"name":{"kind":"Name","value":"trackTournaments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"type"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"IntValue","value":"0"}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"startAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lessThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"now"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"or"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"endAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lessThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"now"}}}]}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"endAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"now"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"finalizedAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isNull"},"value":{"kind":"BooleanValue","value":true}}]}}]}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"START_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_DiscordTournamentSnapshot"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"monthly"},"name":{"kind":"Name","value":"trackTournaments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"type"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"IntValue","value":"1"}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"startAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lessThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"now"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"or"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"endAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lessThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"now"}}}]}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"endAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"now"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"finalizedAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isNull"},"value":{"kind":"BooleanValue","value":true}}]}}]}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"START_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_DiscordTournamentSnapshot"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_DiscordTournamentSnapshot"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournament"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"3"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"RANK_ASC"},{"kind":"EnumValue","value":"TIME_ASC"},{"kind":"EnumValue","value":"RECORD_ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DiscordTournamentSnapshotsQuery, Zc_DiscordTournamentSnapshotsQueryVariables>;
export const Zc_DiscordTournamentLeaderboardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DiscordTournamentLeaderboard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"type"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"last"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"before"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"tournament"},"name":{"kind":"Name","value":"trackTournamentByTypeAndSlug"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"Variable","name":{"kind":"Name","value":"type"}}},{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"leaderboard"},"name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"Variable","name":{"kind":"Name","value":"last"}}},{"kind":"Argument","name":{"kind":"Name","value":"before"},"value":{"kind":"Variable","name":{"kind":"Name","value":"before"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"RANK_ASC"},{"kind":"EnumValue","value":"TIME_ASC"},{"kind":"EnumValue","value":"RECORD_ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DiscordTournamentLeaderboardQuery, Zc_DiscordTournamentLeaderboardQueryVariables>;
export const Zc_DiscordUsersByIdsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DiscordUsersByIds"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"discordId"}},{"kind":"Field","name":{"kind":"Name","value":"userPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DiscordUsersByIdsQuery, Zc_DiscordUsersByIdsQueryVariables>;
export const Zc_DiscordUserStatsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DiscordUserStats"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"from"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"to"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"records"},"name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"personalBests"},"name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"worldRecords"},"name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"levels"},"name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"author"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"createdAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"votes"},"name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recordStatistics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sum"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"distance"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnTarmac"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnGrass"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnSand"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnSoap"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnWood"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnMud"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce1"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce2"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce3"}},{"kind":"Field","name":{"kind":"Name","value":"distanceInAir"}}]}},{"kind":"Field","name":{"kind":"Name","value":"average"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"averageSpeed"}},{"kind":"Field","name":{"kind":"Name","value":"averageGforce"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxSpeed"}},{"kind":"Field","name":{"kind":"Name","value":"maxGforce"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DiscordUserStatsQuery, Zc_DiscordUserStatsQueryVariables>;
export const Zc_DiscordModVersionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DiscordModVersions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"versions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"latest"}},{"kind":"Field","name":{"kind":"Name","value":"minimum"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_CREATED_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modVersion"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DiscordModVersionsQuery, Zc_DiscordModVersionsQueryVariables>;
export const Zc_DiscordUserLookupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DiscordUserLookup"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UserFilter"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"discordId"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"userPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"totalPoints"}},{"kind":"Field","name":{"kind":"Name","value":"worldRecords"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DiscordUserLookupQuery, Zc_DiscordUserLookupQueryVariables>;
export const Zc_DiscordUserContributionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DiscordUserContributions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UserPointContributionFilter"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UserPointContributionsOrderBy"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userPointContributions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levelPoints"}},{"kind":"Field","name":{"kind":"Name","value":"playerDecayedPoints"}},{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levelId"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DiscordUserContributionsQuery, Zc_DiscordUserContributionsQueryVariables>;
export const Zc_DiscordActivityEventsLiveDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"ZC_DiscordActivityEventsLive"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"discordActivityEvents"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"previousUserId"}},{"kind":"Field","name":{"kind":"Name","value":"recordId"}},{"kind":"Field","name":{"kind":"Name","value":"previousRecordId"}},{"kind":"Field","name":{"kind":"Name","value":"payload"}},{"kind":"Field","name":{"kind":"Name","value":"occurredAt"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"discordId"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"discordId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"previousUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"discordId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"modVersion"}}]}},{"kind":"Field","name":{"kind":"Name","value":"previousRecord"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"modVersion"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DiscordActivityEventsLiveSubscription, Zc_DiscordActivityEventsLiveSubscriptionVariables>;
export const Zc_TrackTournamentLobbyLeaderboardLiveDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"ZC_TrackTournamentLobbyLeaderboardLive"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trackTournament"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","alias":{"kind":"Name","value":"leaderboard"},"name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"6"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"RANK_ASC"},{"kind":"EnumValue","value":"TIME_ASC"},{"kind":"EnumValue","value":"RECORD_ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tournamentId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"recordId"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_TrackTournamentLobbyLeaderboardLiveSubscription, Zc_TrackTournamentLobbyLeaderboardLiveSubscriptionVariables>;
export const Zc_TrackTournamentLobbyPlayerContextDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_TrackTournamentLobbyPlayerContext"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tournamentId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"steamId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"BigInt"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"recentSince"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"versions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"minimum"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"user"},"name":{"kind":"Name","value":"userBySteamId"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"steamId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"steamId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","alias":{"kind":"Name","value":"recentRecords"},"name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"recentSince"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_CREATED_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"standing"},"name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"tournamentId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tournamentId"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"time"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_TrackTournamentLobbyPlayerContextQuery, Zc_TrackTournamentLobbyPlayerContextQueryVariables>;
export const Zc_AdventureSeriesCountsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_AdventureSeriesCounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"seriesA"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"adventure"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWithInsensitive"},"value":{"kind":"StringValue","value":"A-","block":false}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"seriesB"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"adventure"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWithInsensitive"},"value":{"kind":"StringValue","value":"B-","block":false}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"seriesC"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"adventure"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWithInsensitive"},"value":{"kind":"StringValue","value":"C-","block":false}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"seriesCl"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"adventure"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWithInsensitive"},"value":{"kind":"StringValue","value":"CL-","block":false}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"seriesD"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"adventure"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWithInsensitive"},"value":{"kind":"StringValue","value":"D-","block":false}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"seriesE"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"adventure"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWithInsensitive"},"value":{"kind":"StringValue","value":"E-","block":false}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"seriesEz"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"adventure"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWithInsensitive"},"value":{"kind":"StringValue","value":"EZ-","block":false}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"seriesF"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"adventure"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWithInsensitive"},"value":{"kind":"StringValue","value":"F-","block":false}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"seriesFl"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"adventure"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWithInsensitive"},"value":{"kind":"StringValue","value":"FL-","block":false}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"seriesG"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"adventure"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWithInsensitive"},"value":{"kind":"StringValue","value":"G-","block":false}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"seriesH"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"adventure"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWithInsensitive"},"value":{"kind":"StringValue","value":"H-","block":false}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"seriesI"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"adventure"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWithInsensitive"},"value":{"kind":"StringValue","value":"I-","block":false}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"seriesL"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"adventure"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWithInsensitive"},"value":{"kind":"StringValue","value":"L-","block":false}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"seriesOr"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"adventure"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWithInsensitive"},"value":{"kind":"StringValue","value":"OR-","block":false}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"seriesX"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"adventure"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWithInsensitive"},"value":{"kind":"StringValue","value":"X-","block":false}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"seriesXg"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"adventure"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWithInsensitive"},"value":{"kind":"StringValue","value":"XG-","block":false}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"seriesY"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"adventure"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWithInsensitive"},"value":{"kind":"StringValue","value":"Y-","block":false}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_AdventureSeriesCountsQuery, Zc_AdventureSeriesCountsQueryVariables>;
export const Zc_AdventureSeriesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_AdventureSeries"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"prefix"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1000"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"adventure"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWithInsensitive"},"value":{"kind":"Variable","name":{"kind":"Name","value":"prefix"}}}]}}]}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_CREATED_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_AdventureLevelCard"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_AdventureLevelCard"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerFavourites"},"name":{"kind":"Name","value":"favourites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeGold"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeSilver"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeBronze"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_AdventureSeriesQuery, Zc_AdventureSeriesQueryVariables>;
export const Zc_DashboardCriticalDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DashboardCritical"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"now"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_DashboardMetricCounts"}},{"kind":"Field","alias":{"kind":"Name","value":"activeWeeklyTournament"},"name":{"kind":"Name","value":"trackTournaments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"type"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"IntValue","value":"0"}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"startAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lessThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"now"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"endAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"now"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"finalizedAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isNull"},"value":{"kind":"BooleanValue","value":true}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"START_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentFeature"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"activeMonthlyTournament"},"name":{"kind":"Name","value":"trackTournaments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"type"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"IntValue","value":"1"}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"startAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lessThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"now"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"endAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"now"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"finalizedAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isNull"},"value":{"kind":"BooleanValue","value":true}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"START_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentFeature"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"trendingLevels"},"name":{"kind":"Name","value":"hotLevelsSince"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"since"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"6"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"worldRecordGlobal"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"time"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThan"},"value":{"kind":"IntValue","value":"10"}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_DashboardLevel"}},{"kind":"Field","alias":{"kind":"Name","value":"periodRecords"},"name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_DashboardLevel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeGold"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeSilver"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeBronze"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerFavourites"},"name":{"kind":"Name","value":"favourites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_DashboardMetricCounts"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Query"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"recordsDay"},"name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"recordsMonth"},"name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"personalBestGlobalsDay"},"name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"personalBestGlobalsMonth"},"name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"worldRecordGlobalsDay"},"name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"worldRecordGlobalsMonth"},"name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"levelsDay"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"levelsMonth"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"votesDay"},"name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"votesMonth"},"name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"totalUsers"},"name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"rankedUsers"},"name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"userPointExists"},"value":{"kind":"BooleanValue","value":true}},{"kind":"ObjectField","name":{"kind":"Name","value":"userPoints"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"rank"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"notEqualTo"},"value":{"kind":"IntValue","value":"-1"}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"activeUsersDay"},"name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"or"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"records"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}]}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"createdAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}}]}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"zslLevelResults"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"level"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"round"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eventDate"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}]}}]}}]}}]}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"activeUsersMonth"},"name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"or"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"records"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}]}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"createdAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}}]}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"zslLevelResults"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"level"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"round"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eventDate"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}]}}]}}]}}]}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentFeature"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournament"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"finalizedAt"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_DashboardCriticalQuery, Zc_DashboardCriticalQueryVariables>;
export const Zc_DashboardHotLevelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DashboardHotLevels"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"since"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"levels"},"name":{"kind":"Name","value":"hotLevelsSince"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"since"},"value":{"kind":"Variable","name":{"kind":"Name","value":"since"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"6"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"worldRecordGlobal"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"time"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThan"},"value":{"kind":"IntValue","value":"10"}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_DashboardLevel"}},{"kind":"Field","alias":{"kind":"Name","value":"periodRecords"},"name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"since"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_DashboardLevel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeGold"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeSilver"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeBronze"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerFavourites"},"name":{"kind":"Name","value":"favourites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DashboardHotLevelsQuery, Zc_DashboardHotLevelsQueryVariables>;
export const Zc_DashboardStatisticsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DashboardStatistics"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"minimumModVersion"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"allTimeStatistics"},"name":{"kind":"Name","value":"recordStatistics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sum"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"distance"}}]}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"dayStatistics"},"name":{"kind":"Name","value":"recordStatistics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sum"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"distance"}}]}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"monthStatistics"},"name":{"kind":"Name","value":"recordStatistics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sum"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"distance"}}]}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"v6DayStatistics"},"name":{"kind":"Name","value":"recordStatistics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"modVersion"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"minimumModVersion"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_DashboardV6StatisticAggregates"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"v6MonthStatistics"},"name":{"kind":"Name","value":"recordStatistics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"modVersion"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"minimumModVersion"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_DashboardV6StatisticAggregates"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_DashboardV6StatisticAggregates"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RecordStatisticAggregates"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sum"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"distance"}},{"kind":"Field","name":{"kind":"Name","value":"distanceInAir"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn1Wheel"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn2Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn3Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn4Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnGrass"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnGround"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce1"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce2"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce3"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnWood"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnMud"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnSand"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnSoap"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnTarmac"}},{"kind":"Field","name":{"kind":"Name","value":"distanceRagdoll"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"timeInAir"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnGrass"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnGround"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce1"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce2"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce3"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnWood"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnMud"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnSand"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnSoap"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnTarmac"}},{"kind":"Field","name":{"kind":"Name","value":"timeRagdoll"}},{"kind":"Field","name":{"kind":"Name","value":"turnLeftCount"}},{"kind":"Field","name":{"kind":"Name","value":"turnRightCount"}},{"kind":"Field","name":{"kind":"Name","value":"armsUpCount"}},{"kind":"Field","name":{"kind":"Name","value":"brakeCount"}},{"kind":"Field","name":{"kind":"Name","value":"hornCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"average"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"averageGforce"}},{"kind":"Field","name":{"kind":"Name","value":"averageSpeed"}}]}}]}}]} as unknown as DocumentNode<Zc_DashboardStatisticsQuery, Zc_DashboardStatisticsQueryVariables>;
export const Zc_DashboardHeroSummaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DashboardHeroSummary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"user"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"userPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"totalPoints"}},{"kind":"Field","name":{"kind":"Name","value":"worldRecords"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"zslSeasons"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"START_DATE_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"zslSeasonResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"points"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DashboardHeroSummaryQuery, Zc_DashboardHeroSummaryQueryVariables>;
export const Zc_DashboardViewerLevelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DashboardViewerLevels"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"user"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"6"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"level"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"CREATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerFavourites"},"name":{"kind":"Name","value":"favourites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeGold"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeSilver"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeBronze"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DashboardViewerLevelsQuery, Zc_DashboardViewerLevelsQueryVariables>;
export const Zc_HomeStatsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_HomeStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_HomeStatsQuery, Zc_HomeStatsQueryVariables>;
export const Zc_LeaderboardsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_Leaderboards"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"10"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_CREATED_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_LeaderboardsQuery, Zc_LeaderboardsQueryVariables>;
export const Zc_LevelDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_LevelDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"xxHash"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"now"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levelByXxHash"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"xxHash"},"value":{"kind":"Variable","name":{"kind":"Name","value":"xxHash"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"publiclyVisible"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"authorId"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeGold"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeSilver"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeBronze"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"modifierLength"}},{"kind":"Field","name":{"kind":"Name","value":"modifierEvidence"}},{"kind":"Field","name":{"kind":"Name","value":"modifierQuality"}},{"kind":"Field","name":{"kind":"Name","value":"modifierRating"}},{"kind":"Field","name":{"kind":"Name","value":"complexityConfidence"}},{"kind":"Field","name":{"kind":"Name","value":"complexityScore"}},{"kind":"Field","name":{"kind":"Name","value":"fieldStrength"}},{"kind":"Field","name":{"kind":"Name","value":"qualityScore"}},{"kind":"Field","name":{"kind":"Name","value":"skillAlignment"}},{"kind":"Field","name":{"kind":"Name","value":"skillConfidence"}},{"kind":"Field","name":{"kind":"Name","value":"skillSampleSize"}},{"kind":"Field","name":{"kind":"Name","value":"skillScore"}},{"kind":"Field","name":{"kind":"Name","value":"skillSeparation"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"groupedAggregates"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupBy"},"value":{"kind":"EnumValue","value":"VALUE"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"keys"}},{"kind":"Field","name":{"kind":"Name","value":"sum"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"favourites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerFavourites"},"name":{"kind":"Name","value":"favourites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"trackTournaments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"2"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lessThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"now"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"TYPE_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentFeature"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"recordStatistic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"distance"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentFeature"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournament"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"finalizedAt"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_LevelDetailQuery, Zc_LevelDetailQueryVariables>;
export const Zc_LevelGhostDefaultsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_LevelGhostDefaults"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"level"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"worldRecord"},"name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"worldRecordGlobalsExist"},"value":{"kind":"BooleanValue","value":true}},{"kind":"ObjectField","name":{"kind":"Name","value":"recordMedia"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"ghostUrl"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isNull"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"recordMediaExists"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"TIME_ASC"},{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerPersonalBest"},"name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"personalBestGlobalsExist"},"value":{"kind":"BooleanValue","value":true}},{"kind":"ObjectField","name":{"kind":"Name","value":"recordMedia"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"ghostUrl"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isNull"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"recordMediaExists"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"TIME_ASC"},{"kind":"EnumValue","value":"ID_ASC"}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Record"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"splits"}},{"kind":"Field","name":{"kind":"Name","value":"speeds"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recordMedia"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ghostUrl"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_LevelGhostDefaultsQuery, Zc_LevelGhostDefaultsQueryVariables>;
export const Zc_LevelGhostPresetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_LevelGhostPreset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RecordFilter"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"TIME_ASC"},{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Record"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"splits"}},{"kind":"Field","name":{"kind":"Name","value":"speeds"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recordMedia"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ghostUrl"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_LevelGhostPresetQuery, Zc_LevelGhostPresetQueryVariables>;
export const Zc_LevelGhostUserSearchDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_LevelGhostUserSearch"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"search"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"8"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"steamName"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"includesInsensitive"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"personalBestGlobals"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"recordMedia"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"ghostUrl"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isNull"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"recordMediaExists"},"value":{"kind":"BooleanValue","value":true}}]}}]}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"STEAM_NAME_ASC"},{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"recordMedia"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"ghostUrl"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isNull"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"recordMediaExists"},"value":{"kind":"BooleanValue","value":true}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"}}]}}]}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Record"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"splits"}},{"kind":"Field","name":{"kind":"Name","value":"speeds"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recordMedia"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ghostUrl"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_LevelGhostUserSearchQuery, Zc_LevelGhostUserSearchQueryVariables>;
export const Zc_LevelPersonalBestRanksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_LevelPersonalBestRanks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"minimumTime"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"maximumTime"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"fasterPersonalBests"},"name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"personalBestGlobalsExist"},"value":{"kind":"BooleanValue","value":true}},{"kind":"ObjectField","name":{"kind":"Name","value":"time"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"minimumTime"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"visiblePersonalBestTimes"},"name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"personalBestGlobalsExist"},"value":{"kind":"BooleanValue","value":true}},{"kind":"ObjectField","name":{"kind":"Name","value":"time"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"minimumTime"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"lessThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"maximumTime"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"groupedAggregates"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"TIME"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"keys"}},{"kind":"Field","name":{"kind":"Name","value":"distinctCount"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_LevelPersonalBestRanksQuery, Zc_LevelPersonalBestRanksQueryVariables>;
export const Zc_LevelPointsHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_LevelPointsHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"since"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"baseline"},"name":{"kind":"Name","value":"levelPointsHistories"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"since"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_CREATED_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"points"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"history"},"name":{"kind":"Name","value":"levelPointsHistories"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"since"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"groupedAggregates"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_CREATED"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"keys"}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_LevelPointsHistoryQuery, Zc_LevelPointsHistoryQueryVariables>;
export const Zc_LevelRecordsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_LevelRecords"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"last"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"before"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RecordFilter"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RecordsOrderBy"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeStatus"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"Variable","name":{"kind":"Name","value":"last"}}},{"kind":"Argument","name":{"kind":"Name","value":"before"},"value":{"kind":"Variable","name":{"kind":"Name","value":"before"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"userPointContributions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levelPosition"}},{"kind":"Field","name":{"kind":"Name","value":"contributionRank"}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"}},{"kind":"Field","name":{"kind":"Name","value":"levelDecayedPoints"}},{"kind":"Field","name":{"kind":"Name","value":"playerDecayedPoints"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeStatus"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeStatus"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_LevelRecordsQuery, Zc_LevelRecordsQueryVariables>;
export const Zc_LevelSplitAnalysisDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_LevelSplitAnalysis"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"5"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"personalBestGlobalsExist"},"value":{"kind":"BooleanValue","value":true}},{"kind":"ObjectField","name":{"kind":"Name","value":"splits"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isNull"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"speeds"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isNull"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"TIME_ASC"},{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_LevelSplitRecord"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerPersonalBest"},"name":{"kind":"Name","value":"personalBestGlobalByUserIdAndLevelId"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}},{"kind":"Argument","name":{"kind":"Name","value":"levelId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_LevelSplitRecord"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_LevelSplitRecord"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Record"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"splits"}},{"kind":"Field","name":{"kind":"Name","value":"speeds"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]} as unknown as DocumentNode<Zc_LevelSplitAnalysisQuery, Zc_LevelSplitAnalysisQueryVariables>;
export const Zc_LevelStatisticsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_LevelStatistics"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"minimumModVersion"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"allStatistics"},"name":{"kind":"Name","value":"recordStatistics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sum"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"distance"}}]}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"v6Statistics"},"name":{"kind":"Name","value":"recordStatistics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"modVersion"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"minimumModVersion"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sum"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"distance"}},{"kind":"Field","name":{"kind":"Name","value":"distanceInAir"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn1Wheel"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn2Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn3Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn4Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnGrass"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnGround"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce1"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce2"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce3"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnWood"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnMud"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnSand"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnSoap"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnTarmac"}},{"kind":"Field","name":{"kind":"Name","value":"distanceRagdoll"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"timeInAir"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnGrass"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnGround"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce1"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce2"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce3"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnWood"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnMud"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnSand"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnSoap"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnTarmac"}},{"kind":"Field","name":{"kind":"Name","value":"timeRagdoll"}},{"kind":"Field","name":{"kind":"Name","value":"turnLeftCount"}},{"kind":"Field","name":{"kind":"Name","value":"turnRightCount"}},{"kind":"Field","name":{"kind":"Name","value":"armsUpCount"}},{"kind":"Field","name":{"kind":"Name","value":"brakeCount"}},{"kind":"Field","name":{"kind":"Name","value":"hornCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"average"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"averageGforce"}},{"kind":"Field","name":{"kind":"Name","value":"averageSpeed"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxGforce"}},{"kind":"Field","name":{"kind":"Name","value":"maxSpeed"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_LevelStatisticsQuery, Zc_LevelStatisticsQueryVariables>;
export const Zc_LevelViewerBestDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_LevelViewerBest"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobalByUserIdAndLevelId"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"Argument","name":{"kind":"Name","value":"levelId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"userPointContributions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levelPosition"}},{"kind":"Field","name":{"kind":"Name","value":"contributionRank"}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"}},{"kind":"Field","name":{"kind":"Name","value":"levelDecayedPoints"}},{"kind":"Field","name":{"kind":"Name","value":"playerDecayedPoints"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_LevelViewerBestQuery, Zc_LevelViewerBestQueryVariables>;
export const Zc_LevelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_Levels"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"last"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"before"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"LevelFilter"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LevelsOrderBy"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"Variable","name":{"kind":"Name","value":"last"}}},{"kind":"Argument","name":{"kind":"Name","value":"before"},"value":{"kind":"Variable","name":{"kind":"Name","value":"before"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_LevelExplorerCard"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_LevelExplorerCard"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeGold"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeSilver"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeBronze"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerFavourites"},"name":{"kind":"Name","value":"favourites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_LevelsQuery, Zc_LevelsQueryVariables>;
export const Zc_HotLevelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_HotLevels"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"last"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"before"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LevelFilter"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"since"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"levels"},"name":{"kind":"Name","value":"hotLevelsSince"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"Variable","name":{"kind":"Name","value":"last"}}},{"kind":"Argument","name":{"kind":"Name","value":"before"},"value":{"kind":"Variable","name":{"kind":"Name","value":"before"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"and"},"value":{"kind":"ListValue","values":[{"kind":"Variable","name":{"kind":"Name","value":"filter"}},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"worldRecordGlobal"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"time"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThan"},"value":{"kind":"IntValue","value":"10"}}]}}]}}]}}]}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"since"},"value":{"kind":"Variable","name":{"kind":"Name","value":"since"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_LevelExplorerCard"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_LevelExplorerCard"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeGold"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeSilver"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeBronze"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerFavourites"},"name":{"kind":"Name","value":"favourites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_HotLevelsQuery, Zc_HotLevelsQueryVariables>;
export const Zc_PlayersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_Players"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"10"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_CREATED_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"banned"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_PlayersQuery, Zc_PlayersQueryVariables>;
export const Zc_PlaylistLevelsByUidDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_PlaylistLevelsByUid"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"uids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"fileUid"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"uids"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"level"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"xxHash"}}]}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_PlaylistLevelsByUidQuery, Zc_PlaylistLevelsByUidQueryVariables>;
export const Zc_RecordComparisonCatalogDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_RecordComparisonCatalog"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ownerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"topPersonalBests"},"name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"10"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"personalBestGlobalsExist"},"value":{"kind":"BooleanValue","value":true}},{"kind":"ObjectField","name":{"kind":"Name","value":"recordMedia"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"ghostUrl"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isNull"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"recordMediaExists"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"TIME_ASC"},{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"ownerRuns"},"name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"10"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ownerId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"recordMedia"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"ghostUrl"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isNull"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"recordMediaExists"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"TIME_ASC"},{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerPersonalBest"},"name":{"kind":"Name","value":"personalBestGlobalByUserIdAndLevelId"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"levelId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}},{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Record"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"splits"}},{"kind":"Field","name":{"kind":"Name","value":"speeds"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recordMedia"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ghostUrl"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_RecordComparisonCatalogQuery, Zc_RecordComparisonCatalogQueryVariables>;
export const Zc_RecordComparisonRecordsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_RecordComparisonRecords"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"recordIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"10"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"recordIds"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"recordMedia"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"ghostUrl"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isNull"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"recordMediaExists"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"TIME_ASC"},{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Record"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"splits"}},{"kind":"Field","name":{"kind":"Name","value":"speeds"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recordMedia"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ghostUrl"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_RecordComparisonRecordsQuery, Zc_RecordComparisonRecordsQueryVariables>;
export const Zc_RecordComparisonUserSearchDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_RecordComparisonUserSearch"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"search"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"8"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"steamName"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"includesInsensitive"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"STEAM_NAME_ASC"},{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"}}]}}]}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Record"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"splits"}},{"kind":"Field","name":{"kind":"Name","value":"speeds"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recordMedia"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ghostUrl"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_RecordComparisonUserSearchQuery, Zc_RecordComparisonUserSearchQueryVariables>;
export const Zc_RecordDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_RecordDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"recordId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"recordId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"}},{"kind":"Field","name":{"kind":"Name","value":"gameVersion"}},{"kind":"Field","name":{"kind":"Name","value":"modVersion"}},{"kind":"Field","name":{"kind":"Name","value":"splits"}},{"kind":"Field","name":{"kind":"Name","value":"speeds"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"publiclyVisible"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"authorId"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"recordStatistic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_RecordStatistic"}}]}},{"kind":"Field","name":{"kind":"Name","value":"userPointContributions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"contributionRank"}},{"kind":"Field","name":{"kind":"Name","value":"dateCalculated"}},{"kind":"Field","name":{"kind":"Name","value":"levelDecayedPoints"}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"}},{"kind":"Field","name":{"kind":"Name","value":"levelPosition"}},{"kind":"Field","name":{"kind":"Name","value":"playerDecayedPoints"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Record"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"splits"}},{"kind":"Field","name":{"kind":"Name","value":"speeds"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recordMedia"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ghostUrl"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_RecordStatistic"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RecordStatistic"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"armsUpCount"}},{"kind":"Field","name":{"kind":"Name","value":"armsUpTime"}},{"kind":"Field","name":{"kind":"Name","value":"averageAngularVelocity"}},{"kind":"Field","name":{"kind":"Name","value":"averageGforce"}},{"kind":"Field","name":{"kind":"Name","value":"averageSpeed"}},{"kind":"Field","name":{"kind":"Name","value":"averageVelocity"}},{"kind":"Field","name":{"kind":"Name","value":"brakeCount"}},{"kind":"Field","name":{"kind":"Name","value":"brakeTime"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"distance"}},{"kind":"Field","name":{"kind":"Name","value":"distanceInAir"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOffroadWheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn1Wheel"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn2Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn3Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn4Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnGrass"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnGround"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce1"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce2"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce3"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnWood"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnMud"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnMonorail"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnSand"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnSoap"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnTarmac"}},{"kind":"Field","name":{"kind":"Name","value":"distanceParaglider"}},{"kind":"Field","name":{"kind":"Name","value":"distanceParked"}},{"kind":"Field","name":{"kind":"Name","value":"distanceRagdoll"}},{"kind":"Field","name":{"kind":"Name","value":"distanceSlipping"}},{"kind":"Field","name":{"kind":"Name","value":"distanceSoapWheels"}},{"kind":"Field","name":{"kind":"Name","value":"driverInputTransitionCount"}},{"kind":"Field","name":{"kind":"Name","value":"frameCount"}},{"kind":"Field","name":{"kind":"Name","value":"ghostVersion"}},{"kind":"Field","name":{"kind":"Name","value":"hasAirData"}},{"kind":"Field","name":{"kind":"Name","value":"hasInputData"}},{"kind":"Field","name":{"kind":"Name","value":"hasRagdollData"}},{"kind":"Field","name":{"kind":"Name","value":"hasSlipData"}},{"kind":"Field","name":{"kind":"Name","value":"hasStateData"}},{"kind":"Field","name":{"kind":"Name","value":"hasSurfaceData"}},{"kind":"Field","name":{"kind":"Name","value":"hasVelocityData"}},{"kind":"Field","name":{"kind":"Name","value":"hasWheelData"}},{"kind":"Field","name":{"kind":"Name","value":"hornCount"}},{"kind":"Field","name":{"kind":"Name","value":"hornTime"}},{"kind":"Field","name":{"kind":"Name","value":"maxAngularVelocity"}},{"kind":"Field","name":{"kind":"Name","value":"maxGforce"}},{"kind":"Field","name":{"kind":"Name","value":"maxSpeed"}},{"kind":"Field","name":{"kind":"Name","value":"maxVelocity"}},{"kind":"Field","name":{"kind":"Name","value":"nodeId"}},{"kind":"Field","name":{"kind":"Name","value":"recordId"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"timeAnyDriverInput"}},{"kind":"Field","name":{"kind":"Name","value":"timeInAir"}},{"kind":"Field","name":{"kind":"Name","value":"timeOffroadWheels"}},{"kind":"Field","name":{"kind":"Name","value":"timeOn1Wheel"}},{"kind":"Field","name":{"kind":"Name","value":"timeOn2Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"timeOn3Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"timeOn4Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnGrass"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnGround"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce1"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce2"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce3"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnWood"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnMud"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnMonorail"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnSand"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnSoap"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnTarmac"}},{"kind":"Field","name":{"kind":"Name","value":"timeParaglider"}},{"kind":"Field","name":{"kind":"Name","value":"timeParked"}},{"kind":"Field","name":{"kind":"Name","value":"timeRagdoll"}},{"kind":"Field","name":{"kind":"Name","value":"timeSlipping"}},{"kind":"Field","name":{"kind":"Name","value":"timeSoapWheels"}},{"kind":"Field","name":{"kind":"Name","value":"turnLeftCount"}},{"kind":"Field","name":{"kind":"Name","value":"turnLeftTime"}},{"kind":"Field","name":{"kind":"Name","value":"turnRightCount"}},{"kind":"Field","name":{"kind":"Name","value":"turnRightTime"}}]}}]} as unknown as DocumentNode<Zc_RecordDetailQuery, Zc_RecordDetailQueryVariables>;
export const Zc_RecordDetailSummaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_RecordDetailSummary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"recordId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"recordId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"gameVersion"}},{"kind":"Field","name":{"kind":"Name","value":"modVersion"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"publiclyVisible"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"recordStatistic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ghostVersion"}}]}},{"kind":"Field","name":{"kind":"Name","value":"userPointContributions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levelPosition"}},{"kind":"Field","name":{"kind":"Name","value":"playerDecayedPoints"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_RecordDetailSummaryQuery, Zc_RecordDetailSummaryQueryVariables>;
export const Zc_MyRecordCountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_MyRecordCount"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_MyRecordCountQuery, Zc_MyRecordCountQueryVariables>;
export const Zc_RecordHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_RecordHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"last"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"before"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"RecordHistoryEntryFilter"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RecordHistoryEntriesOrderBy"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordHistoryEntries"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"Variable","name":{"kind":"Name","value":"last"}}},{"kind":"Argument","name":{"kind":"Name","value":"before"},"value":{"kind":"Variable","name":{"kind":"Name","value":"before"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_RecordHistoryRow"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_RecordHistoryRow"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RecordHistoryEntry"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"userSteamId"}},{"kind":"Field","name":{"kind":"Name","value":"userName"}},{"kind":"Field","name":{"kind":"Name","value":"levelXxHash"}},{"kind":"Field","name":{"kind":"Name","value":"levelName"}},{"kind":"Field","name":{"kind":"Name","value":"levelPosition"}},{"kind":"Field","name":{"kind":"Name","value":"contributionRank"}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"}},{"kind":"Field","name":{"kind":"Name","value":"playerDecayedPoints"}},{"kind":"Field","name":{"kind":"Name","value":"levelDecayedPoints"}},{"kind":"Field","name":{"kind":"Name","value":"isPersonalBest"}},{"kind":"Field","name":{"kind":"Name","value":"isWorldRecord"}},{"kind":"Field","name":{"kind":"Name","value":"hasContribution"}}]}}]} as unknown as DocumentNode<Zc_RecordHistoryQuery, Zc_RecordHistoryQueryVariables>;
export const Zc_RecordLevelGeometryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_RecordLevelGeometry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"level"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levelMetadata"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_UPDATED_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"blocks"}},{"kind":"Field","name":{"kind":"Name","value":"format"}},{"kind":"Field","name":{"kind":"Name","value":"typeGround"}},{"kind":"Field","name":{"kind":"Name","value":"typeSkybox"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_RecordLevelGeometryQuery, Zc_RecordLevelGeometryQueryVariables>;
export const Zc_RecordPersonalBestRankDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_RecordPersonalBestRank"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"time"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"fasterPersonalBests"},"name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"personalBestGlobalsExist"},"value":{"kind":"BooleanValue","value":true}},{"kind":"ObjectField","name":{"kind":"Name","value":"time"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"time"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_RecordPersonalBestRankQuery, Zc_RecordPersonalBestRankQueryVariables>;
export const Zc_OmniSearchDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_OmniSearch"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"search"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"rankedUsers"},"name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"6"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"steamName"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"includesInsensitive"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"userPoints"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"rank"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThan"},"value":{"kind":"IntValue","value":"0"}}]}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"USER_POINTS_RANK_ASC"},{"kind":"EnumValue","value":"STEAM_NAME_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"userPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rank"}}]}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"unrankedUsers"},"name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"6"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"steamName"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"includesInsensitive"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"or"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userPointExists"},"value":{"kind":"BooleanValue","value":false}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userPoints"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"rank"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"IntValue","value":"-1"}}]}}]}}]}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"STEAM_NAME_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"userPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rank"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"8"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"or"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"includesInsensitive"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}}]}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"author"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"steamName"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"includesInsensitive"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}}]}}]}}]}]}}]}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"LEVEL_POINTS_POINTS_DESC"},{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_OmniSearchQuery, Zc_OmniSearchQueryVariables>;
export const Zc_SitemapMaxIdsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_SitemapMaxIds"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"now"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"level"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"trackTournaments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lessThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"now"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"type"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"in"},"value":{"kind":"ListValue","values":[{"kind":"IntValue","value":"0"},{"kind":"IntValue","value":"1"}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"zslSeasons"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"zslRounds"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"zslLevels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_SitemapMaxIdsQuery, Zc_SitemapMaxIdsQueryVariables>;
export const Zc_SitemapUsersPageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_SitemapUsersPage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"startId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1000"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startId"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endId"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_SitemapUsersPageQuery, Zc_SitemapUsersPageQueryVariables>;
export const Zc_SitemapLevelsPageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_SitemapLevelsPage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"startId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1000"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startId"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endId"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_SitemapLevelsPageQuery, Zc_SitemapLevelsPageQueryVariables>;
export const Zc_SitemapRecordsPageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_SitemapRecordsPage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"startId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1000"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"level"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startId"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endId"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_SitemapRecordsPageQuery, Zc_SitemapRecordsPageQueryVariables>;
export const Zc_SitemapTrackTournamentsPageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_SitemapTrackTournamentsPage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"startId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"now"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trackTournaments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1000"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lessThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"now"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"type"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"in"},"value":{"kind":"ListValue","values":[{"kind":"IntValue","value":"0"},{"kind":"IntValue","value":"1"}]}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startId"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endId"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_SitemapTrackTournamentsPageQuery, Zc_SitemapTrackTournamentsPageQueryVariables>;
export const Zc_SitemapSuperLeagueSeasonsPageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_SitemapSuperLeagueSeasonsPage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"startId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"zslSeasons"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1000"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startId"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endId"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_SitemapSuperLeagueSeasonsPageQuery, Zc_SitemapSuperLeagueSeasonsPageQueryVariables>;
export const Zc_SitemapSuperLeagueRoundsPageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_SitemapSuperLeagueRoundsPage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"startId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"zslRounds"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1000"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startId"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endId"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"round"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"season"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_SitemapSuperLeagueRoundsPageQuery, Zc_SitemapSuperLeagueRoundsPageQueryVariables>;
export const Zc_SitemapSuperLeagueLevelsPageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_SitemapSuperLeagueLevelsPage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"startId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"zslLevels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1000"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startId"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endId"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"round"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"round"}},{"kind":"Field","name":{"kind":"Name","value":"season"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_SitemapSuperLeagueLevelsPageQuery, Zc_SitemapSuperLeagueLevelsPageQueryVariables>;
export const Zc_TrackTournamentPlaylistDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_TrackTournamentPlaylist"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournamentFilter"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trackTournaments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"START_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentPlaylistEntry"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentPlaylistEntry"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournament"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_TrackTournamentPlaylistQuery, Zc_TrackTournamentPlaylistQueryVariables>;
export const Zc_TrackTournamentIndexDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_TrackTournamentIndex"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"type"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"now"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"last"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"before"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"active"},"name":{"kind":"Name","value":"trackTournaments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"type"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"type"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"startAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lessThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"now"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"endAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"now"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"finalizedAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isNull"},"value":{"kind":"BooleanValue","value":true}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"START_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentSummary"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"future"},"name":{"kind":"Name","value":"trackTournaments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"type"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"type"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"startAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"now"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"START_AT_ASC"},{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentSummary"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"history"},"name":{"kind":"Name","value":"trackTournaments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"Variable","name":{"kind":"Name","value":"last"}}},{"kind":"Argument","name":{"kind":"Name","value":"before"},"value":{"kind":"Variable","name":{"kind":"Name","value":"before"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"type"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"type"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"endAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lessThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"now"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentSummary"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentLevel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"publiclyVisible"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"authorId"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentStanding"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournamentResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tournamentId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"recordId"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournament"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"finalizedAt"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentLevel"}}]}},{"kind":"Field","name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"3"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"RANK_ASC"},{"kind":"EnumValue","value":"TIME_ASC"},{"kind":"EnumValue","value":"RECORD_ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentStanding"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_TrackTournamentIndexQuery, Zc_TrackTournamentIndexQueryVariables>;
export const Zc_TrackTournamentDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_TrackTournamentDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"type"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"last"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"before"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"tournament"},"name":{"kind":"Name","value":"trackTournamentByTypeAndSlug"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"Variable","name":{"kind":"Name","value":"type"}}},{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentSummary"}},{"kind":"Field","alias":{"kind":"Name","value":"leaderboard"},"name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"Variable","name":{"kind":"Name","value":"last"}}},{"kind":"Argument","name":{"kind":"Name","value":"before"},"value":{"kind":"Variable","name":{"kind":"Name","value":"before"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"RANK_ASC"},{"kind":"EnumValue","value":"TIME_ASC"},{"kind":"EnumValue","value":"RECORD_ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentStanding"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerStanding"},"name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentStanding"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"updateFeed"},"name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"200"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_UPDATED_DESC"},{"kind":"EnumValue","value":"RECORD_ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"recordId"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"ghostFeed"},"name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"200"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"recordMedia"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"ghostUrl"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isNull"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"recordMediaExists"},"value":{"kind":"BooleanValue","value":true}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"TIME_ASC"},{"kind":"EnumValue","value":"RECORD_ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentGhostStanding"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Record"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"splits"}},{"kind":"Field","name":{"kind":"Name","value":"speeds"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recordMedia"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ghostUrl"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentLevel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"publiclyVisible"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"authorId"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentStanding"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournamentResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tournamentId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"recordId"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentGhostStanding"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournamentResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentStanding"}},{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournament"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"finalizedAt"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentLevel"}}]}},{"kind":"Field","name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"3"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"RANK_ASC"},{"kind":"EnumValue","value":"TIME_ASC"},{"kind":"EnumValue","value":"RECORD_ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentStanding"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_TrackTournamentDetailQuery, Zc_TrackTournamentDetailQueryVariables>;
export const Zc_TrackTournamentNavigationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_TrackTournamentNavigation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"type"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"startAt"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"now"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"previous"},"name":{"kind":"Name","value":"trackTournaments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"type"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"type"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"startAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startAt"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"START_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentSummary"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"current"},"name":{"kind":"Name","value":"trackTournaments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"type"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"type"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"startAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lessThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"now"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"endAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"now"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"finalizedAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isNull"},"value":{"kind":"BooleanValue","value":true}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"START_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentSummary"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"next"},"name":{"kind":"Name","value":"trackTournaments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"type"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"type"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"startAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startAt"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"START_AT_ASC"},{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentSummary"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentLevel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"publiclyVisible"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"authorId"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentStanding"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournamentResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tournamentId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"recordId"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournament"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"finalizedAt"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentLevel"}}]}},{"kind":"Field","name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"3"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"RANK_ASC"},{"kind":"EnumValue","value":"TIME_ASC"},{"kind":"EnumValue","value":"RECORD_ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentStanding"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_TrackTournamentNavigationQuery, Zc_TrackTournamentNavigationQueryVariables>;
export const Zc_TrackTournamentLiveDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"ZC_TrackTournamentLive"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trackTournament"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","alias":{"kind":"Name","value":"leaderboard"},"name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"50"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"RANK_ASC"},{"kind":"EnumValue","value":"TIME_ASC"},{"kind":"EnumValue","value":"RECORD_ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentStanding"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerStanding"},"name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentStanding"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"updateFeed"},"name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"200"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_UPDATED_DESC"},{"kind":"EnumValue","value":"RECORD_ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"recordId"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"ghostFeed"},"name":{"kind":"Name","value":"trackTournamentResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"200"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"recordMedia"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"ghostUrl"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isNull"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"recordMediaExists"},"value":{"kind":"BooleanValue","value":true}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"TIME_ASC"},{"kind":"EnumValue","value":"RECORD_ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentGhostStanding"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Record"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"splits"}},{"kind":"Field","name":{"kind":"Name","value":"speeds"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recordMedia"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ghostUrl"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"dateUpdated"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentStanding"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournamentResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tournamentId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"recordId"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_TrackTournamentGhostStanding"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackTournamentResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_TrackTournamentStanding"}},{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_GhostComparisonRecord"}}]}}]}}]} as unknown as DocumentNode<Zc_TrackTournamentLiveSubscription, Zc_TrackTournamentLiveSubscriptionVariables>;
export const Zc_UserContributionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_UserContributions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"last"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"before"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UserPointContributionFilter"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UserPointContributionsOrderBy"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userPointContributions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"Variable","name":{"kind":"Name","value":"last"}}},{"kind":"Argument","name":{"kind":"Name","value":"before"},"value":{"kind":"Variable","name":{"kind":"Name","value":"before"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"contributionRank"}},{"kind":"Field","name":{"kind":"Name","value":"levelPosition"}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"}},{"kind":"Field","name":{"kind":"Name","value":"levelDecayedPoints"}},{"kind":"Field","name":{"kind":"Name","value":"playerDecayedPoints"}},{"kind":"Field","name":{"kind":"Name","value":"dateCalculated"}},{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_UserContributionsQuery, Zc_UserContributionsQueryVariables>;
export const Zc_UserLevelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_UserLevels"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"steamId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"BigInt"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"since"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"recentUser"},"name":{"kind":"Name","value":"user"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"6"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"level"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"CREATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_UserLevelCard"}}]}}]}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"popularLevels"},"name":{"kind":"Name","value":"hotLevelsSince"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"6"}},{"kind":"Argument","name":{"kind":"Name","value":"since"},"value":{"kind":"Variable","name":{"kind":"Name","value":"since"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"authorId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"steamId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"worldRecordGlobal"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"time"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThan"},"value":{"kind":"IntValue","value":"10"}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_UserLevelCard"}},{"kind":"Field","alias":{"kind":"Name","value":"periodRecords"},"name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"since"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_UserLevelCard"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeGold"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeSilver"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeBronze"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerFavourites"},"name":{"kind":"Name","value":"favourites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_UserLevelsQuery, Zc_UserLevelsQueryVariables>;
export const Zc_UserFavouriteLevelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_UserFavouriteLevels"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"last"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"before"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"user"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"favourites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"Variable","name":{"kind":"Name","value":"last"}}},{"kind":"Argument","name":{"kind":"Name","value":"before"},"value":{"kind":"Variable","name":{"kind":"Name","value":"before"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"level"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_CREATED_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_UserLevelCard"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_UserLevelCard"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"fileUid"}},{"kind":"Field","name":{"kind":"Name","value":"fileAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeGold"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeSilver"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeBronze"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerFavourites"},"name":{"kind":"Name","value":"favourites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_UserFavouriteLevelsQuery, Zc_UserFavouriteLevelsQueryVariables>;
export const Zc_UserPointsHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_UserPointsHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"since"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"baseline"},"name":{"kind":"Name","value":"userPointsHistories"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"since"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_CREATED_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"history"},"name":{"kind":"Name","value":"userPointsHistories"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"since"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"groupedAggregates"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_CREATED"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"keys"}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}}]}},{"kind":"Field","name":{"kind":"Name","value":"min"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rank"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_UserPointsHistoryQuery, Zc_UserPointsHistoryQueryVariables>;
export const Zc_UserPointsHistorySecondaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_UserPointsHistorySecondary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"since"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"baseline"},"name":{"kind":"Name","value":"userPointsHistories"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"since"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_CREATED_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"totalPoints"}},{"kind":"Field","name":{"kind":"Name","value":"worldRecords"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"history"},"name":{"kind":"Name","value":"userPointsHistories"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"since"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"groupedAggregates"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_CREATED"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"keys"}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalPoints"}},{"kind":"Field","name":{"kind":"Name","value":"worldRecords"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_UserPointsHistorySecondaryQuery, Zc_UserPointsHistorySecondaryQueryVariables>;
export const Zc_UserProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_UserProfile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"steamId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"BigInt"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"steamId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"steamId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"userPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"totalPoints"}},{"kind":"Field","name":{"kind":"Name","value":"worldRecords"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"groupedAggregates"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupBy"},"value":{"kind":"EnumValue","value":"VALUE"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"keys"}},{"kind":"Field","name":{"kind":"Name","value":"sum"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_UserProfileQuery, Zc_UserProfileQueryVariables>;
export const Zc_UserResultsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_UserResults"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"last"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"before"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RecordFilter"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"Variable","name":{"kind":"Name","value":"last"}}},{"kind":"Argument","name":{"kind":"Name","value":"before"},"value":{"kind":"Variable","name":{"kind":"Name","value":"before"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_CREATED_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"userPointContributions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levelPoints"}},{"kind":"Field","name":{"kind":"Name","value":"playerDecayedPoints"}},{"kind":"Field","name":{"kind":"Name","value":"levelDecayedPoints"}},{"kind":"Field","name":{"kind":"Name","value":"levelPosition"}},{"kind":"Field","name":{"kind":"Name","value":"contributionRank"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_UserResultsQuery, Zc_UserResultsQueryVariables>;
export const Zc_UserStatisticsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_UserStatistics"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"minimumModVersion"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"yearSince"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"allStatistics"},"name":{"kind":"Name","value":"recordStatistics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_UserStatisticTotals"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"dayStatistics"},"name":{"kind":"Name","value":"recordStatistics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_UserStatisticTotals"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"monthStatistics"},"name":{"kind":"Name","value":"recordStatistics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_UserStatisticTotals"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"yearStatistics"},"name":{"kind":"Name","value":"recordStatistics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"yearSince"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_UserStatisticTotals"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"v6Statistics"},"name":{"kind":"Name","value":"recordStatistics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"modVersion"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"minimumModVersion"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_UserV6StatisticAggregates"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"v6DayStatistics"},"name":{"kind":"Name","value":"recordStatistics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"modVersion"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"minimumModVersion"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_UserV6StatisticAggregates"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"v6MonthStatistics"},"name":{"kind":"Name","value":"recordStatistics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"modVersion"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"minimumModVersion"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_UserV6StatisticAggregates"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"v6YearStatistics"},"name":{"kind":"Name","value":"recordStatistics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"yearSince"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"modVersion"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"minimumModVersion"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_UserV6StatisticAggregates"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_UserStatisticTotals"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RecordStatisticsConnection"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sum"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"distance"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_UserV6StatisticAggregates"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RecordStatisticAggregates"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sum"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"distance"}},{"kind":"Field","name":{"kind":"Name","value":"distanceInAir"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn1Wheel"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn2Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn3Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOn4Wheels"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnGrass"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnGround"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce1"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce2"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnIce3"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnWood"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnMud"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnSand"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnSoap"}},{"kind":"Field","name":{"kind":"Name","value":"distanceOnTarmac"}},{"kind":"Field","name":{"kind":"Name","value":"distanceRagdoll"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"timeInAir"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnGrass"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnGround"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce1"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce2"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnIce3"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnWood"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnMud"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnSand"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnSoap"}},{"kind":"Field","name":{"kind":"Name","value":"timeOnTarmac"}},{"kind":"Field","name":{"kind":"Name","value":"timeRagdoll"}},{"kind":"Field","name":{"kind":"Name","value":"turnLeftCount"}},{"kind":"Field","name":{"kind":"Name","value":"turnRightCount"}},{"kind":"Field","name":{"kind":"Name","value":"armsUpCount"}},{"kind":"Field","name":{"kind":"Name","value":"brakeCount"}},{"kind":"Field","name":{"kind":"Name","value":"hornCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"average"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"averageGforce"}},{"kind":"Field","name":{"kind":"Name","value":"averageSpeed"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxGforce"}},{"kind":"Field","name":{"kind":"Name","value":"maxSpeed"}}]}}]}}]} as unknown as DocumentNode<Zc_UserStatisticsQuery, Zc_UserStatisticsQueryVariables>;
export const Zc_UserSuperLeagueSeasonsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_UserSuperLeagueSeasons"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"zslSeasons"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1000"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"START_DATE_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"currentSeason"},"name":{"kind":"Name","value":"zslSeasons"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"START_DATE_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"pointsStructure"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bestOf"}}]}},{"kind":"Field","name":{"kind":"Name","value":"zslSeasonResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"points"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"zslRounds"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"6"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ROUND_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"round"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"eventDate"}},{"kind":"Field","name":{"kind":"Name","value":"zslRoundResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"points"}}]}}]}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_UserSuperLeagueSeasonsQuery, Zc_UserSuperLeagueSeasonsQueryVariables>;
export const Zc_UserSuperLeagueSeasonDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_UserSuperLeagueSeason"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"seasonId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"zslSeason"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"seasonId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"pointsStructure"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bestOf"}}]}},{"kind":"Field","name":{"kind":"Name","value":"zslSeasonResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"points"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"zslRounds"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"6"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ROUND_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"round"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"eventDate"}},{"kind":"Field","name":{"kind":"Name","value":"zslRoundResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"points"}}]}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_UserSuperLeagueSeasonQuery, Zc_UserSuperLeagueSeasonQueryVariables>;
export const Zc_UsersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_Users"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"last"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"before"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"UserPointFilter"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UserPointsOrderBy"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userPoints"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"Variable","name":{"kind":"Name","value":"last"}}},{"kind":"Argument","name":{"kind":"Name","value":"before"},"value":{"kind":"Variable","name":{"kind":"Name","value":"before"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"totalPoints"}},{"kind":"Field","name":{"kind":"Name","value":"worldRecords"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_UsersQuery, Zc_UsersQueryVariables>;
export const Zc_UserSuggestionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_UserSuggestions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"search"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"8"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"steamName"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"includesInsensitive"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"STEAM_NAME_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_UserSuggestionsQuery, Zc_UserSuggestionsQueryVariables>;
export const Zc_ZslLevelDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_ZslLevel"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"zslLevel"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"roundId"}},{"kind":"Field","name":{"kind":"Name","value":"round"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"round"}},{"kind":"Field","name":{"kind":"Name","value":"eventDate"}},{"kind":"Field","name":{"kind":"Name","value":"seasonId"}},{"kind":"Field","name":{"kind":"Name","value":"season"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"zslLevelResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_ZslLevelQuery, Zc_ZslLevelQueryVariables>;
export const Zc_ZslLevelResultsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_ZslLevelResults"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"last"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"before"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"zslLevelResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"Variable","name":{"kind":"Name","value":"last"}}},{"kind":"Argument","name":{"kind":"Name","value":"before"},"value":{"kind":"Variable","name":{"kind":"Name","value":"before"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"POSITION_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_ZslLevelStandingFields"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerStanding"},"name":{"kind":"Name","value":"zslLevelResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_ZslLevelStandingFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_ZslLevelStandingFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ZslLevelResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<Zc_ZslLevelResultsQuery, Zc_ZslLevelResultsQueryVariables>;
export const Zc_ZslRoundBySeasonAndNumberDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_ZslRoundBySeasonAndNumber"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"seasonId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"round"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"zslRounds"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"seasonId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"seasonId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"round"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"round"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"round"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"eventDate"}},{"kind":"Field","name":{"kind":"Name","value":"seasonId"}},{"kind":"Field","name":{"kind":"Name","value":"season"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"zslLevels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"15"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}}]}}]}}]}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_ZslRoundBySeasonAndNumberQuery, Zc_ZslRoundBySeasonAndNumberQueryVariables>;
export const Zc_ZslRoundResultsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_ZslRoundResults"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"seasonId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"round"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"last"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"before"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"zslRoundResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"Variable","name":{"kind":"Name","value":"last"}}},{"kind":"Argument","name":{"kind":"Name","value":"before"},"value":{"kind":"Variable","name":{"kind":"Name","value":"before"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"round"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"seasonId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"seasonId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"round"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"round"}}}]}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"POSITION_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_ZslRoundStandingFields"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerStanding"},"name":{"kind":"Name","value":"zslRoundResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"round"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"seasonId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"seasonId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"round"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"round"}}}]}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_ZslRoundStandingFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_ZslRoundStandingFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ZslRoundResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"zslLevelResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"level"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"round"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"seasonId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"seasonId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"round"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"round"}}}]}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_ZslRoundResultsQuery, Zc_ZslRoundResultsQueryVariables>;
export const Zc_ZslSeasonDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_ZslSeason"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"zslSeason"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"pointsStructure"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bestOf"}}]}},{"kind":"Field","name":{"kind":"Name","value":"zslRounds"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"6"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ROUND_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"round"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"eventDate"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_ZslSeasonQuery, Zc_ZslSeasonQueryVariables>;
export const Zc_ZslSeasonResultsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_ZslSeasonResults"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"last"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"before"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"zslSeasonResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"Variable","name":{"kind":"Name","value":"last"}}},{"kind":"Argument","name":{"kind":"Name","value":"before"},"value":{"kind":"Variable","name":{"kind":"Name","value":"before"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"seasonId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"POSITION_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_ZslSeasonStandingFields"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"viewerStanding"},"name":{"kind":"Name","value":"zslSeasonResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"seasonId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"viewerId"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeViewer"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_ZslSeasonStandingFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_ZslSeasonStandingFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ZslSeasonResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"zslRoundResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"6"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"round"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"seasonId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ROUND_ID_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"round"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"round"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_ZslSeasonResultsQuery, Zc_ZslSeasonResultsQueryVariables>;
export const Zc_ZslSeasonsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_ZslSeasons"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"last"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"before"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"zslSeasons"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"Variable","name":{"kind":"Name","value":"last"}}},{"kind":"Argument","name":{"kind":"Name","value":"before"},"value":{"kind":"Variable","name":{"kind":"Name","value":"before"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"START_DATE_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"zslSeasonResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"zslRounds"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"6"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ROUND_ASC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"round"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"eventDate"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_ZslSeasonsQuery, Zc_ZslSeasonsQueryVariables>;
export const Zc_DashboardMetricsLiveDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"ZC_DashboardMetricsLive"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"query"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_DashboardMetricCounts"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_DashboardMetricCounts"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Query"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"recordsDay"},"name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"recordsMonth"},"name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"personalBestGlobalsDay"},"name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"personalBestGlobalsMonth"},"name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"worldRecordGlobalsDay"},"name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"worldRecordGlobalsMonth"},"name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"levelsDay"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"levelsMonth"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"publiclyVisible"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"votesDay"},"name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"votesMonth"},"name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"totalUsers"},"name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"rankedUsers"},"name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"userPointExists"},"value":{"kind":"BooleanValue","value":true}},{"kind":"ObjectField","name":{"kind":"Name","value":"userPoints"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"rank"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"notEqualTo"},"value":{"kind":"IntValue","value":"-1"}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"activeUsersDay"},"name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"or"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"records"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}]}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"createdAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}}]}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"zslLevelResults"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"level"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"round"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eventDate"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"daySince"}}}]}}]}}]}}]}}]}}]}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"activeUsersMonth"},"name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"banned"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"or"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"records"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}]}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"createdAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}}]}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"zslLevelResults"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"level"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"round"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eventDate"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthSince"}}}]}}]}}]}}]}}]}}]}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_DashboardMetricsLiveSubscription, Zc_DashboardMetricsLiveSubscriptionVariables>;
export const Zc_RecordHistoryLiveDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"ZC_RecordHistoryLive"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"RecordHistoryEntryFilter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordHistoryEntries"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"25"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_CREATED_DESC"},{"kind":"EnumValue","value":"ID_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_RecordHistoryRow"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_RecordHistoryRow"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RecordHistoryEntry"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"userSteamId"}},{"kind":"Field","name":{"kind":"Name","value":"userName"}},{"kind":"Field","name":{"kind":"Name","value":"levelXxHash"}},{"kind":"Field","name":{"kind":"Name","value":"levelName"}},{"kind":"Field","name":{"kind":"Name","value":"levelPosition"}},{"kind":"Field","name":{"kind":"Name","value":"contributionRank"}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"}},{"kind":"Field","name":{"kind":"Name","value":"playerDecayedPoints"}},{"kind":"Field","name":{"kind":"Name","value":"levelDecayedPoints"}},{"kind":"Field","name":{"kind":"Name","value":"isPersonalBest"}},{"kind":"Field","name":{"kind":"Name","value":"isWorldRecord"}},{"kind":"Field","name":{"kind":"Name","value":"hasContribution"}}]}}]} as unknown as DocumentNode<Zc_RecordHistoryLiveSubscription, Zc_RecordHistoryLiveSubscriptionVariables>;