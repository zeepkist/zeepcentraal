/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "query ZC_HomeStats {\n  levels {\n    totalCount\n  }\n  users {\n    totalCount\n  }\n  records {\n    totalCount\n  }\n}": typeof types.Zc_HomeStatsDocument,
    "query ZC_Leaderboards($first: Int = 10) {\n  records(first: $first, orderBy: [DATE_CREATED_DESC]) {\n    nodes {\n      id\n      levelId\n      userId\n      time\n      dateCreated\n    }\n    totalCount\n  }\n}": typeof types.Zc_LeaderboardsDocument,
    "query ZC_Levels($first: Int = 10) {\n  levels(first: $first, orderBy: [DATE_CREATED_DESC]) {\n    nodes {\n      id\n      hash\n      xxHash\n      adventure\n      dateCreated\n    }\n    totalCount\n  }\n}": typeof types.Zc_LevelsDocument,
    "query ZC_Players($first: Int = 10) {\n  users(first: $first, orderBy: [DATE_CREATED_DESC]) {\n    nodes {\n      id\n      steamId\n      steamName\n      banned\n      dateCreated\n    }\n    totalCount\n  }\n}": typeof types.Zc_PlayersDocument,
    "subscription ZC_RecordUpdates {\n  records(first: 1, orderBy: [DATE_CREATED_DESC]) {\n    nodes {\n      id\n      levelId\n      userId\n      time\n      dateCreated\n    }\n  }\n}": typeof types.Zc_RecordUpdatesDocument,
};
const documents: Documents = {
    "query ZC_HomeStats {\n  levels {\n    totalCount\n  }\n  users {\n    totalCount\n  }\n  records {\n    totalCount\n  }\n}": types.Zc_HomeStatsDocument,
    "query ZC_Leaderboards($first: Int = 10) {\n  records(first: $first, orderBy: [DATE_CREATED_DESC]) {\n    nodes {\n      id\n      levelId\n      userId\n      time\n      dateCreated\n    }\n    totalCount\n  }\n}": types.Zc_LeaderboardsDocument,
    "query ZC_Levels($first: Int = 10) {\n  levels(first: $first, orderBy: [DATE_CREATED_DESC]) {\n    nodes {\n      id\n      hash\n      xxHash\n      adventure\n      dateCreated\n    }\n    totalCount\n  }\n}": types.Zc_LevelsDocument,
    "query ZC_Players($first: Int = 10) {\n  users(first: $first, orderBy: [DATE_CREATED_DESC]) {\n    nodes {\n      id\n      steamId\n      steamName\n      banned\n      dateCreated\n    }\n    totalCount\n  }\n}": types.Zc_PlayersDocument,
    "subscription ZC_RecordUpdates {\n  records(first: 1, orderBy: [DATE_CREATED_DESC]) {\n    nodes {\n      id\n      levelId\n      userId\n      time\n      dateCreated\n    }\n  }\n}": types.Zc_RecordUpdatesDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query ZC_HomeStats {\n  levels {\n    totalCount\n  }\n  users {\n    totalCount\n  }\n  records {\n    totalCount\n  }\n}"): (typeof documents)["query ZC_HomeStats {\n  levels {\n    totalCount\n  }\n  users {\n    totalCount\n  }\n  records {\n    totalCount\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query ZC_Leaderboards($first: Int = 10) {\n  records(first: $first, orderBy: [DATE_CREATED_DESC]) {\n    nodes {\n      id\n      levelId\n      userId\n      time\n      dateCreated\n    }\n    totalCount\n  }\n}"): (typeof documents)["query ZC_Leaderboards($first: Int = 10) {\n  records(first: $first, orderBy: [DATE_CREATED_DESC]) {\n    nodes {\n      id\n      levelId\n      userId\n      time\n      dateCreated\n    }\n    totalCount\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query ZC_Levels($first: Int = 10) {\n  levels(first: $first, orderBy: [DATE_CREATED_DESC]) {\n    nodes {\n      id\n      hash\n      xxHash\n      adventure\n      dateCreated\n    }\n    totalCount\n  }\n}"): (typeof documents)["query ZC_Levels($first: Int = 10) {\n  levels(first: $first, orderBy: [DATE_CREATED_DESC]) {\n    nodes {\n      id\n      hash\n      xxHash\n      adventure\n      dateCreated\n    }\n    totalCount\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query ZC_Players($first: Int = 10) {\n  users(first: $first, orderBy: [DATE_CREATED_DESC]) {\n    nodes {\n      id\n      steamId\n      steamName\n      banned\n      dateCreated\n    }\n    totalCount\n  }\n}"): (typeof documents)["query ZC_Players($first: Int = 10) {\n  users(first: $first, orderBy: [DATE_CREATED_DESC]) {\n    nodes {\n      id\n      steamId\n      steamName\n      banned\n      dateCreated\n    }\n    totalCount\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "subscription ZC_RecordUpdates {\n  records(first: 1, orderBy: [DATE_CREATED_DESC]) {\n    nodes {\n      id\n      levelId\n      userId\n      time\n      dateCreated\n    }\n  }\n}"): (typeof documents)["subscription ZC_RecordUpdates {\n  records(first: 1, orderBy: [DATE_CREATED_DESC]) {\n    nodes {\n      id\n      levelId\n      userId\n      time\n      dateCreated\n    }\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;