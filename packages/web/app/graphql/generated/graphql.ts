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
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type FavouriteDistinctCountAggregateFilter = {
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  id?: BigIntFilter | null | undefined;
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
  /** Filter by the object’s `id` field. */
  id?: IntFilter | null | undefined;
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
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type FavouriteMinAggregateFilter = {
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  userId?: IntFilter | null | undefined;
};

export type FavouriteStddevPopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type FavouriteStddevSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type FavouriteSumAggregateFilter = {
  id?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  userId?: BigIntFilter | null | undefined;
};

export type FavouriteVariancePopulationAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  userId?: BigFloatFilter | null | undefined;
};

export type FavouriteVarianceSampleAggregateFilter = {
  id?: BigFloatFilter | null | undefined;
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
  /** Filter by the object’s `records` relation. */
  records?: LevelToManyRecordFilter | null | undefined;
  /** Some related `records` exist. */
  recordsExist?: boolean | null | undefined;
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
  /** Filter by the object’s `cutPenalty` field. */
  cutPenalty?: FloatFilter | null | undefined;
  /** Filter by the object’s `dateCreated` field. */
  dateCreated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `dateUpdated` field. */
  dateUpdated?: DatetimeFilter | null | undefined;
  /** Filter by the object’s `level` relation. */
  level?: LevelFilter | null | undefined;
  /** Filter by the object’s `levelId` field. */
  levelId?: IntFilter | null | undefined;
  /** Filter by the object’s `modifierCompetitiveness` field. */
  modifierCompetitiveness?: FloatFilter | null | undefined;
  /** Filter by the object’s `modifierLength` field. */
  modifierLength?: FloatFilter | null | undefined;
  /** Filter by the object’s `modifierPopularity` field. */
  modifierPopularity?: FloatFilter | null | undefined;
  /** Filter by the object’s `modifierRating` field. */
  modifierRating?: FloatFilter | null | undefined;
  /** Negates the expression. */
  not?: LevelPointFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<LevelPointFilter> | null | undefined;
  /** Filter by the object’s `points` field. */
  points?: IntFilter | null | undefined;
  /** Filter by the object’s `rating` field. */
  rating?: FloatFilter | null | undefined;
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
  cutPenalty?: FloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  modifierCompetitiveness?: FloatFilter | null | undefined;
  modifierLength?: FloatFilter | null | undefined;
  modifierPopularity?: FloatFilter | null | undefined;
  modifierRating?: FloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  rating?: FloatFilter | null | undefined;
};

export type LevelPointsHistoryDistinctCountAggregateFilter = {
  cutPenalty?: BigIntFilter | null | undefined;
  dateCreated?: BigIntFilter | null | undefined;
  dateUpdated?: BigIntFilter | null | undefined;
  id?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  modifierCompetitiveness?: BigIntFilter | null | undefined;
  modifierLength?: BigIntFilter | null | undefined;
  modifierPopularity?: BigIntFilter | null | undefined;
  modifierRating?: BigIntFilter | null | undefined;
  points?: BigIntFilter | null | undefined;
  rating?: BigIntFilter | null | undefined;
};

/** A filter to be used against `LevelPointsHistory` object types. All fields are combined with a logical ‘and.’ */
export type LevelPointsHistoryFilter = {
  /** Checks for all expressions in this list. */
  and?: Array<LevelPointsHistoryFilter> | null | undefined;
  /** Filter by the object’s `cutPenalty` field. */
  cutPenalty?: FloatFilter | null | undefined;
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
  /** Filter by the object’s `modifierCompetitiveness` field. */
  modifierCompetitiveness?: FloatFilter | null | undefined;
  /** Filter by the object’s `modifierLength` field. */
  modifierLength?: FloatFilter | null | undefined;
  /** Filter by the object’s `modifierPopularity` field. */
  modifierPopularity?: FloatFilter | null | undefined;
  /** Filter by the object’s `modifierRating` field. */
  modifierRating?: FloatFilter | null | undefined;
  /** Negates the expression. */
  not?: LevelPointsHistoryFilter | null | undefined;
  /** Checks for any expressions in this list. */
  or?: Array<LevelPointsHistoryFilter> | null | undefined;
  /** Filter by the object’s `points` field. */
  points?: IntFilter | null | undefined;
  /** Filter by the object’s `rating` field. */
  rating?: FloatFilter | null | undefined;
};

export type LevelPointsHistoryMaxAggregateFilter = {
  cutPenalty?: FloatFilter | null | undefined;
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  modifierCompetitiveness?: FloatFilter | null | undefined;
  modifierLength?: FloatFilter | null | undefined;
  modifierPopularity?: FloatFilter | null | undefined;
  modifierRating?: FloatFilter | null | undefined;
  points?: IntFilter | null | undefined;
  rating?: FloatFilter | null | undefined;
};

export type LevelPointsHistoryMinAggregateFilter = {
  cutPenalty?: FloatFilter | null | undefined;
  id?: IntFilter | null | undefined;
  levelId?: IntFilter | null | undefined;
  modifierCompetitiveness?: FloatFilter | null | undefined;
  modifierLength?: FloatFilter | null | undefined;
  modifierPopularity?: FloatFilter | null | undefined;
  modifierRating?: FloatFilter | null | undefined;
  points?: IntFilter | null | undefined;
  rating?: FloatFilter | null | undefined;
};

export type LevelPointsHistoryStddevPopulationAggregateFilter = {
  cutPenalty?: FloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  modifierCompetitiveness?: FloatFilter | null | undefined;
  modifierLength?: FloatFilter | null | undefined;
  modifierPopularity?: FloatFilter | null | undefined;
  modifierRating?: FloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  rating?: FloatFilter | null | undefined;
};

export type LevelPointsHistoryStddevSampleAggregateFilter = {
  cutPenalty?: FloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  modifierCompetitiveness?: FloatFilter | null | undefined;
  modifierLength?: FloatFilter | null | undefined;
  modifierPopularity?: FloatFilter | null | undefined;
  modifierRating?: FloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  rating?: FloatFilter | null | undefined;
};

export type LevelPointsHistorySumAggregateFilter = {
  cutPenalty?: FloatFilter | null | undefined;
  id?: BigIntFilter | null | undefined;
  levelId?: BigIntFilter | null | undefined;
  modifierCompetitiveness?: FloatFilter | null | undefined;
  modifierLength?: FloatFilter | null | undefined;
  modifierPopularity?: FloatFilter | null | undefined;
  modifierRating?: FloatFilter | null | undefined;
  points?: BigIntFilter | null | undefined;
  rating?: FloatFilter | null | undefined;
};

export type LevelPointsHistoryVariancePopulationAggregateFilter = {
  cutPenalty?: FloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  modifierCompetitiveness?: FloatFilter | null | undefined;
  modifierLength?: FloatFilter | null | undefined;
  modifierPopularity?: FloatFilter | null | undefined;
  modifierRating?: FloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  rating?: FloatFilter | null | undefined;
};

export type LevelPointsHistoryVarianceSampleAggregateFilter = {
  cutPenalty?: FloatFilter | null | undefined;
  id?: BigFloatFilter | null | undefined;
  levelId?: BigFloatFilter | null | undefined;
  modifierCompetitiveness?: FloatFilter | null | undefined;
  modifierLength?: FloatFilter | null | undefined;
  modifierPopularity?: FloatFilter | null | undefined;
  modifierRating?: FloatFilter | null | undefined;
  points?: BigFloatFilter | null | undefined;
  rating?: FloatFilter | null | undefined;
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
  | 'FAVOURITES_AVERAGE_ID_ASC'
  | 'FAVOURITES_AVERAGE_ID_DESC'
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
  | 'FAVOURITES_DISTINCT_COUNT_ID_ASC'
  | 'FAVOURITES_DISTINCT_COUNT_ID_DESC'
  | 'FAVOURITES_DISTINCT_COUNT_LEVEL_ID_ASC'
  | 'FAVOURITES_DISTINCT_COUNT_LEVEL_ID_DESC'
  | 'FAVOURITES_DISTINCT_COUNT_USER_ID_ASC'
  | 'FAVOURITES_DISTINCT_COUNT_USER_ID_DESC'
  | 'FAVOURITES_MAX_ID_ASC'
  | 'FAVOURITES_MAX_ID_DESC'
  | 'FAVOURITES_MAX_LEVEL_ID_ASC'
  | 'FAVOURITES_MAX_LEVEL_ID_DESC'
  | 'FAVOURITES_MAX_USER_ID_ASC'
  | 'FAVOURITES_MAX_USER_ID_DESC'
  | 'FAVOURITES_MIN_ID_ASC'
  | 'FAVOURITES_MIN_ID_DESC'
  | 'FAVOURITES_MIN_LEVEL_ID_ASC'
  | 'FAVOURITES_MIN_LEVEL_ID_DESC'
  | 'FAVOURITES_MIN_USER_ID_ASC'
  | 'FAVOURITES_MIN_USER_ID_DESC'
  | 'FAVOURITES_STDDEV_POPULATION_ID_ASC'
  | 'FAVOURITES_STDDEV_POPULATION_ID_DESC'
  | 'FAVOURITES_STDDEV_POPULATION_LEVEL_ID_ASC'
  | 'FAVOURITES_STDDEV_POPULATION_LEVEL_ID_DESC'
  | 'FAVOURITES_STDDEV_POPULATION_USER_ID_ASC'
  | 'FAVOURITES_STDDEV_POPULATION_USER_ID_DESC'
  | 'FAVOURITES_STDDEV_SAMPLE_ID_ASC'
  | 'FAVOURITES_STDDEV_SAMPLE_ID_DESC'
  | 'FAVOURITES_STDDEV_SAMPLE_LEVEL_ID_ASC'
  | 'FAVOURITES_STDDEV_SAMPLE_LEVEL_ID_DESC'
  | 'FAVOURITES_STDDEV_SAMPLE_USER_ID_ASC'
  | 'FAVOURITES_STDDEV_SAMPLE_USER_ID_DESC'
  | 'FAVOURITES_SUM_ID_ASC'
  | 'FAVOURITES_SUM_ID_DESC'
  | 'FAVOURITES_SUM_LEVEL_ID_ASC'
  | 'FAVOURITES_SUM_LEVEL_ID_DESC'
  | 'FAVOURITES_SUM_USER_ID_ASC'
  | 'FAVOURITES_SUM_USER_ID_DESC'
  | 'FAVOURITES_VARIANCE_POPULATION_ID_ASC'
  | 'FAVOURITES_VARIANCE_POPULATION_ID_DESC'
  | 'FAVOURITES_VARIANCE_POPULATION_LEVEL_ID_ASC'
  | 'FAVOURITES_VARIANCE_POPULATION_LEVEL_ID_DESC'
  | 'FAVOURITES_VARIANCE_POPULATION_USER_ID_ASC'
  | 'FAVOURITES_VARIANCE_POPULATION_USER_ID_DESC'
  | 'FAVOURITES_VARIANCE_SAMPLE_ID_ASC'
  | 'FAVOURITES_VARIANCE_SAMPLE_ID_DESC'
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
  | 'LEVEL_POINTS_CUT_PENALTY_ASC'
  | 'LEVEL_POINTS_CUT_PENALTY_DESC'
  | 'LEVEL_POINTS_DATE_CREATED_ASC'
  | 'LEVEL_POINTS_DATE_CREATED_DESC'
  | 'LEVEL_POINTS_DATE_UPDATED_ASC'
  | 'LEVEL_POINTS_DATE_UPDATED_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_CUT_PENALTY_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_CUT_PENALTY_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_LEVEL_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_LEVEL_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_MODIFIER_COMPETITIVENESS_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_MODIFIER_COMPETITIVENESS_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_MODIFIER_POPULARITY_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_MODIFIER_POPULARITY_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_POINTS_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_POINTS_DESC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_AVERAGE_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_COUNT_ASC'
  | 'LEVEL_POINTS_HISTORIES_COUNT_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_CUT_PENALTY_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_CUT_PENALTY_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_DATE_CREATED_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_DATE_CREATED_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_DATE_UPDATED_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_DATE_UPDATED_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_LEVEL_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_LEVEL_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_MODIFIER_COMPETITIVENESS_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_MODIFIER_COMPETITIVENESS_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_MODIFIER_POPULARITY_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_MODIFIER_POPULARITY_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_POINTS_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_POINTS_DESC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_DISTINCT_COUNT_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_CUT_PENALTY_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_CUT_PENALTY_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_LEVEL_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_LEVEL_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_MODIFIER_COMPETITIVENESS_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_MODIFIER_COMPETITIVENESS_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_MODIFIER_POPULARITY_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_MODIFIER_POPULARITY_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_POINTS_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_POINTS_DESC'
  | 'LEVEL_POINTS_HISTORIES_MAX_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_MAX_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_CUT_PENALTY_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_CUT_PENALTY_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_LEVEL_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_LEVEL_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_MODIFIER_COMPETITIVENESS_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_MODIFIER_COMPETITIVENESS_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_MODIFIER_POPULARITY_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_MODIFIER_POPULARITY_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_POINTS_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_POINTS_DESC'
  | 'LEVEL_POINTS_HISTORIES_MIN_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_MIN_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_CUT_PENALTY_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_CUT_PENALTY_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_LEVEL_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_LEVEL_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_MODIFIER_COMPETITIVENESS_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_MODIFIER_COMPETITIVENESS_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_MODIFIER_POPULARITY_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_MODIFIER_POPULARITY_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_POINTS_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_POINTS_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_POPULATION_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_CUT_PENALTY_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_CUT_PENALTY_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_LEVEL_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_LEVEL_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_MODIFIER_COMPETITIVENESS_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_MODIFIER_COMPETITIVENESS_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_MODIFIER_POPULARITY_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_MODIFIER_POPULARITY_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_POINTS_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_POINTS_DESC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_STDDEV_SAMPLE_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_CUT_PENALTY_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_CUT_PENALTY_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_LEVEL_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_LEVEL_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_MODIFIER_COMPETITIVENESS_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_MODIFIER_COMPETITIVENESS_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_MODIFIER_POPULARITY_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_MODIFIER_POPULARITY_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_POINTS_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_POINTS_DESC'
  | 'LEVEL_POINTS_HISTORIES_SUM_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_SUM_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_CUT_PENALTY_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_CUT_PENALTY_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_LEVEL_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_LEVEL_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_MODIFIER_COMPETITIVENESS_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_MODIFIER_COMPETITIVENESS_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_MODIFIER_POPULARITY_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_MODIFIER_POPULARITY_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_POINTS_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_POINTS_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_POPULATION_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_CUT_PENALTY_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_CUT_PENALTY_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_LEVEL_ID_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_LEVEL_ID_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_MODIFIER_COMPETITIVENESS_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_MODIFIER_COMPETITIVENESS_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_MODIFIER_POPULARITY_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_MODIFIER_POPULARITY_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_POINTS_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_POINTS_DESC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_RATING_ASC'
  | 'LEVEL_POINTS_HISTORIES_VARIANCE_SAMPLE_RATING_DESC'
  | 'LEVEL_POINTS_ID_LEVEL_ASC'
  | 'LEVEL_POINTS_ID_LEVEL_DESC'
  | 'LEVEL_POINTS_MODIFIER_COMPETITIVENESS_ASC'
  | 'LEVEL_POINTS_MODIFIER_COMPETITIVENESS_DESC'
  | 'LEVEL_POINTS_MODIFIER_LENGTH_ASC'
  | 'LEVEL_POINTS_MODIFIER_LENGTH_DESC'
  | 'LEVEL_POINTS_MODIFIER_POPULARITY_ASC'
  | 'LEVEL_POINTS_MODIFIER_POPULARITY_DESC'
  | 'LEVEL_POINTS_MODIFIER_RATING_ASC'
  | 'LEVEL_POINTS_MODIFIER_RATING_DESC'
  | 'LEVEL_POINTS_POINTS_ASC'
  | 'LEVEL_POINTS_POINTS_DESC'
  | 'LEVEL_POINTS_RATING_ASC'
  | 'LEVEL_POINTS_RATING_DESC'
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
  /** Filter by the object’s `distanceOnIce` field. */
  distanceOnIce?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOnMetal` field. */
  distanceOnMetal?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOnMonorail` field. */
  distanceOnMonorail?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOnSand` field. */
  distanceOnSand?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOnSnow` field. */
  distanceOnSnow?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOnSoap` field. */
  distanceOnSoap?: FloatFilter | null | undefined;
  /** Filter by the object’s `distanceOnTarmac` field. */
  distanceOnTarmac?: FloatFilter | null | undefined;
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
  /** Filter by the object’s `frameCount` field. */
  frameCount?: IntFilter | null | undefined;
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
  /** Filter by the object’s `timeOnIce` field. */
  timeOnIce?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOnMetal` field. */
  timeOnMetal?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOnMonorail` field. */
  timeOnMonorail?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOnSand` field. */
  timeOnSand?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOnSnow` field. */
  timeOnSnow?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOnSoap` field. */
  timeOnSoap?: FloatFilter | null | undefined;
  /** Filter by the object’s `timeOnTarmac` field. */
  timeOnTarmac?: FloatFilter | null | undefined;
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
  /** Filter by the object’s `records` relation. */
  records?: UserToManyRecordFilter | null | undefined;
  /** Some related `records` exist. */
  recordsExist?: boolean | null | undefined;
  /** Filter by the object’s `steamId` field. */
  steamId?: BigIntFilter | null | undefined;
  /** Filter by the object’s `steamName` field. */
  steamName?: StringFilter | null | undefined;
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

export type Zc_DashboardLevelFragment = { id: number, xxHash: string, adventure: boolean, dateCreated: unknown, levelItems: { nodes: Array<{ name: string, imageUrl: string, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, author: { steamId: unknown, steamName: string | null } | null }> }, levelPoints: { points: number, rating: number, modifierPopularity: number } | null, records: { totalCount: number } };

export type Zc_DashboardRecordFragment = { id: number, time: number, dateCreated: unknown, levelId: number, userId: number, user: { steamId: unknown, steamName: string | null } | null, level: { xxHash: string, levelItems: { nodes: Array<{ name: string }> } } | null };

export type Zc_DashboardQueryVariables = Exact<{
  activeSince: unknown;
}>;


export type Zc_DashboardQuery = { popularLevels: { nodes: Array<{ id: number, xxHash: string, adventure: boolean, dateCreated: unknown, levelItems: { nodes: Array<{ name: string, imageUrl: string, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, author: { steamId: unknown, steamName: string | null } | null }> }, levelPoints: { points: number, rating: number, modifierPopularity: number } | null, records: { totalCount: number } }> } | null, latestLevels: { nodes: Array<{ id: number, xxHash: string, adventure: boolean, dateCreated: unknown, levelItems: { nodes: Array<{ name: string, imageUrl: string, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, author: { steamId: unknown, steamName: string | null } | null }> }, levelPoints: { points: number, rating: number, modifierPopularity: number } | null, records: { totalCount: number } }> } | null, records: { totalCount: number } | null, personalBestGlobals: { totalCount: number } | null, worldRecordGlobals: { totalCount: number } | null, levels: { totalCount: number } | null, votes: { totalCount: number } | null, activeRecords: { aggregates: { distinctCount: { userId: unknown } | null } | null } | null, recordStatistics: { aggregates: { sum: { distance: number, distanceInAir: number, distanceRagdoll: number, time: number, timeInAir: number, hornCount: unknown, brakeCount: unknown } | null } | null } | null, recentWorldRecords: { nodes: Array<{ record: { id: number, time: number, dateCreated: unknown, levelId: number, userId: number, user: { steamId: unknown, steamName: string | null } | null, level: { xxHash: string, levelItems: { nodes: Array<{ name: string }> } } | null } | null }> } | null, recentPersonalBests: { nodes: Array<{ record: { id: number, time: number, dateCreated: unknown, levelId: number, userId: number, user: { steamId: unknown, steamName: string | null } | null, level: { xxHash: string, levelItems: { nodes: Array<{ name: string }> } } | null } | null }> } | null };

export type Zc_DashboardViewerQueryVariables = Exact<{
  id: number;
}>;


export type Zc_DashboardViewerQuery = { user: { id: number, steamId: unknown, steamName: string | null, records: { totalCount: number, nodes: Array<{ id: number, time: number, dateCreated: unknown, levelId: number, userId: number, user: { steamId: unknown, steamName: string | null } | null, level: { xxHash: string, levelItems: { nodes: Array<{ name: string }> } } | null }> }, personalBestGlobals: { totalCount: number, nodes: Array<{ record: { id: number, time: number, dateCreated: unknown, levelId: number, userId: number, level: { xxHash: string, levelItems: { nodes: Array<{ name: string }> } } | null } | null }> }, worldRecordGlobals: { totalCount: number, nodes: Array<{ record: { id: number, time: number, dateCreated: unknown, levelId: number, userId: number, level: { xxHash: string, levelItems: { nodes: Array<{ name: string }> } } | null } | null }> }, levelItems: { nodes: Array<{ name: string, imageUrl: string, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, level: { id: number, xxHash: string, adventure: boolean, dateCreated: unknown, levelPoints: { points: number, rating: number, modifierPopularity: number } | null, records: { totalCount: number } } | null, author: { steamId: unknown, steamName: string | null } | null }> } } | null };

export type Zc_HomeStatsQueryVariables = Exact<{ [key: string]: never; }>;


export type Zc_HomeStatsQuery = { levels: { totalCount: number } | null, users: { totalCount: number } | null, records: { totalCount: number } | null };

export type Zc_LeaderboardsQueryVariables = Exact<{
  first?: number | null | undefined;
}>;


export type Zc_LeaderboardsQuery = { records: { totalCount: number, nodes: Array<{ id: number, levelId: number, userId: number, time: number, dateCreated: unknown }> } | null };

export type Zc_LevelDetailQueryVariables = Exact<{
  xxHash: string;
}>;


export type Zc_LevelDetailQuery = { levelByXxHash: { id: number, xxHash: string, hash: string, adventure: boolean, dateCreated: unknown, levelItems: { nodes: Array<{ name: string, imageUrl: string, workshopId: unknown, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, author: { id: number, steamId: unknown, steamName: string | null } | null }> }, levelPoints: { points: number, rating: number, modifierPopularity: number, modifierLength: number, modifierRating: number, modifierCompetitiveness: number } | null, records: { totalCount: number }, personalBestGlobals: { totalCount: number }, votes: { totalCount: number }, favourites: { totalCount: number }, worldRecordGlobal: { record: { id: number, time: number, dateCreated: unknown, levelId: number, userId: number } | null, user: { id: number, steamId: unknown, steamName: string | null } | null } | null } | null };

export type Zc_LevelRecordsQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: unknown;
  last?: number | null | undefined;
  before?: unknown;
  filter: RecordFilter;
  orderBy?: Array<RecordsOrderBy> | RecordsOrderBy | null | undefined;
}>;


export type Zc_LevelRecordsQuery = { records: { totalCount: number, edges: Array<{ cursor: unknown, node: { id: number, time: number, dateCreated: unknown, levelId: number, userId: number, user: { steamId: unknown, steamName: string | null } | null } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } } | null };

export type Zc_LevelStatisticsQueryVariables = Exact<{
  levelId: number;
}>;


export type Zc_LevelStatisticsQuery = { recordStatistics: { aggregates: { sum: { distance: number, time: number, timeInAir: number, distanceInAir: number, distanceRagdoll: number, distanceParaglider: number, hornCount: unknown, brakeCount: unknown } | null, average: { averageSpeed: number | null, averageGforce: number | null } | null, max: { maxSpeed: number | null, maxGforce: number | null } | null } | null } | null };

export type Zc_LevelViewerBestQueryVariables = Exact<{
  userId: number;
  levelId: number;
}>;


export type Zc_LevelViewerBestQuery = { personalBestGlobalByUserIdAndLevelId: { record: { id: number, time: number, dateCreated: unknown, levelId: number, userId: number, user: { steamId: unknown, steamName: string | null } | null } | null } | null };

export type Zc_LevelViewerRankQueryVariables = Exact<{
  levelId: number;
  time: number;
}>;


export type Zc_LevelViewerRankQuery = { records: { totalCount: number } | null };

export type Zc_LevelsQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: unknown;
  last?: number | null | undefined;
  before?: unknown;
  filter?: LevelFilter | null | undefined;
  orderBy?: Array<LevelsOrderBy> | LevelsOrderBy | null | undefined;
}>;


export type Zc_LevelsQuery = { levels: { totalCount: number, edges: Array<{ cursor: unknown, node: { id: number, xxHash: string, adventure: boolean, dateCreated: unknown, levelItems: { nodes: Array<{ name: string, imageUrl: string, validationTimeAuthor: number, validationTimeGold: number, validationTimeSilver: number, validationTimeBronze: number, author: { steamId: unknown, steamName: string | null } | null }> }, levelPoints: { points: number, rating: number, modifierPopularity: number } | null, records: { totalCount: number } } }>, pageInfo: { startCursor: unknown, endCursor: unknown, hasNextPage: boolean, hasPreviousPage: boolean } } | null };

export type Zc_PlayersQueryVariables = Exact<{
  first?: number | null | undefined;
}>;


export type Zc_PlayersQuery = { users: { totalCount: number, nodes: Array<{ id: number, steamId: unknown, steamName: string | null, banned: boolean, dateCreated: unknown }> } | null };

export type Zc_RecentPersonalBestsSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type Zc_RecentPersonalBestsSubscription = { personalBestGlobals: { nodes: Array<{ record: { id: number, time: number, dateCreated: unknown, levelId: number, userId: number, user: { steamId: unknown, steamName: string | null } | null, level: { xxHash: string, levelItems: { nodes: Array<{ name: string }> } } | null } | null }> } | null };

export type Zc_RecentWorldRecordsSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type Zc_RecentWorldRecordsSubscription = { worldRecordGlobals: { nodes: Array<{ record: { id: number, time: number, dateCreated: unknown, levelId: number, userId: number, user: { steamId: unknown, steamName: string | null } | null, level: { xxHash: string, levelItems: { nodes: Array<{ name: string }> } } | null } | null }> } | null };

export type Zc_RecordUpdatesSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type Zc_RecordUpdatesSubscription = { records: { nodes: Array<{ id: number, levelId: number, userId: number, time: number, dateCreated: unknown }> } | null };

export const Zc_DashboardLevelFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_DashboardLevel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeGold"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeSilver"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeBronze"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"modifierPopularity"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_DashboardLevelFragment, unknown>;
export const Zc_DashboardRecordFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_DashboardRecord"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Record"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DashboardRecordFragment, unknown>;
export const Zc_DashboardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_Dashboard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activeSince"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Datetime"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"popularLevels"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"8"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelPointExists"},"value":{"kind":"BooleanValue","value":true}},{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"LEVEL_POINTS_MODIFIER_POPULARITY_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_DashboardLevel"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"latestLevels"},"name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"8"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelItems"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"some"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_CREATED_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_DashboardLevel"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"activeRecords"},"name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"dateCreated"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThanOrEqualTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activeSince"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"distinctCount"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"recordStatistics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sum"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"distance"}},{"kind":"Field","name":{"kind":"Name","value":"distanceInAir"}},{"kind":"Field","name":{"kind":"Name","value":"distanceRagdoll"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"timeInAir"}},{"kind":"Field","name":{"kind":"Name","value":"hornCount"}},{"kind":"Field","name":{"kind":"Name","value":"brakeCount"}}]}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"recentWorldRecords"},"name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"10"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_UPDATED_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_DashboardRecord"}}]}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"recentPersonalBests"},"name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"10"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_UPDATED_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ZC_DashboardRecord"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_DashboardLevel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Level"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeGold"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeSilver"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeBronze"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"modifierPopularity"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ZC_DashboardRecord"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Record"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DashboardQuery, Zc_DashboardQueryVariables>;
export const Zc_DashboardViewerDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_DashboardViewer"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"user"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"5"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_CREATED_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"5"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_UPDATED_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"5"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_UPDATED_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"6"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"CREATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"modifierPopularity"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeGold"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeSilver"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeBronze"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_DashboardViewerQuery, Zc_DashboardViewerQueryVariables>;
export const Zc_HomeStatsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_HomeStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_HomeStatsQuery, Zc_HomeStatsQueryVariables>;
export const Zc_LeaderboardsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_Leaderboards"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"10"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_CREATED_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_LeaderboardsQuery, Zc_LeaderboardsQueryVariables>;
export const Zc_LevelDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_LevelDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"xxHash"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levelByXxHash"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"xxHash"},"value":{"kind":"Variable","name":{"kind":"Name","value":"xxHash"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"hash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"workshopId"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeGold"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeSilver"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeBronze"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"modifierPopularity"}},{"kind":"Field","name":{"kind":"Name","value":"modifierLength"}},{"kind":"Field","name":{"kind":"Name","value":"modifierRating"}},{"kind":"Field","name":{"kind":"Name","value":"modifierCompetitiveness"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"votes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"favourites"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_LevelDetailQuery, Zc_LevelDetailQueryVariables>;
export const Zc_LevelRecordsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_LevelRecords"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"last"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"before"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RecordFilter"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RecordsOrderBy"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"Variable","name":{"kind":"Name","value":"last"}}},{"kind":"Argument","name":{"kind":"Name","value":"before"},"value":{"kind":"Variable","name":{"kind":"Name","value":"before"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_LevelRecordsQuery, Zc_LevelRecordsQueryVariables>;
export const Zc_LevelStatisticsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_LevelStatistics"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordStatistics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"record"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}]}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sum"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"distance"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"timeInAir"}},{"kind":"Field","name":{"kind":"Name","value":"distanceInAir"}},{"kind":"Field","name":{"kind":"Name","value":"distanceRagdoll"}},{"kind":"Field","name":{"kind":"Name","value":"distanceParaglider"}},{"kind":"Field","name":{"kind":"Name","value":"hornCount"}},{"kind":"Field","name":{"kind":"Name","value":"brakeCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"average"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"averageSpeed"}},{"kind":"Field","name":{"kind":"Name","value":"averageGforce"}}]}},{"kind":"Field","name":{"kind":"Name","value":"max"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxSpeed"}},{"kind":"Field","name":{"kind":"Name","value":"maxGforce"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_LevelStatisticsQuery, Zc_LevelStatisticsQueryVariables>;
export const Zc_LevelViewerBestDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_LevelViewerBest"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobalByUserIdAndLevelId"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"Argument","name":{"kind":"Name","value":"levelId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_LevelViewerBestQuery, Zc_LevelViewerBestQueryVariables>;
export const Zc_LevelViewerRankDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_LevelViewerRank"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"time"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"levelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"Variable","name":{"kind":"Name","value":"levelId"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"personalBestGlobalsExist"},"value":{"kind":"BooleanValue","value":true}},{"kind":"ObjectField","name":{"kind":"Name","value":"time"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lessThan"},"value":{"kind":"Variable","name":{"kind":"Name","value":"time"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_LevelViewerRankQuery, Zc_LevelViewerRankQueryVariables>;
export const Zc_LevelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_Levels"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"last"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"before"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Cursor"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"LevelFilter"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LevelsOrderBy"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"levels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"Variable","name":{"kind":"Name","value":"last"}}},{"kind":"Argument","name":{"kind":"Name","value":"before"},"value":{"kind":"Variable","name":{"kind":"Name","value":"before"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"adventure"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeAuthor"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeGold"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeSilver"}},{"kind":"Field","name":{"kind":"Name","value":"validationTimeBronze"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"levelPoints"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"modifierPopularity"}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"0"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startCursor"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_LevelsQuery, Zc_LevelsQueryVariables>;
export const Zc_PlayersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ZC_Players"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"10"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"users"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_CREATED_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}},{"kind":"Field","name":{"kind":"Name","value":"banned"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<Zc_PlayersQuery, Zc_PlayersQueryVariables>;
export const Zc_RecentPersonalBestsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"ZC_RecentPersonalBests"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"personalBestGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"10"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_UPDATED_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_RecentPersonalBestsSubscription, Zc_RecentPersonalBestsSubscriptionVariables>;
export const Zc_RecentWorldRecordsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"ZC_RecentWorldRecords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"worldRecordGlobals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"10"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_UPDATED_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"record"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"steamId"}},{"kind":"Field","name":{"kind":"Name","value":"steamName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"level"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"xxHash"}},{"kind":"Field","name":{"kind":"Name","value":"levelItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"deleted"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"UPDATED_AT_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<Zc_RecentWorldRecordsSubscription, Zc_RecentWorldRecordsSubscriptionVariables>;
export const Zc_RecordUpdatesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"ZC_RecordUpdates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"records"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"DATE_CREATED_DESC"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"levelId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dateCreated"}}]}}]}}]}}]} as unknown as DocumentNode<Zc_RecordUpdatesSubscription, Zc_RecordUpdatesSubscriptionVariables>;