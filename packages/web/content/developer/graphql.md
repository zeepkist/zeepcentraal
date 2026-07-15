---
title: ZeepCentraal GraphQL API
description: Build reliable ZeepCentraal integrations with named queries, bounded pagination, query-cost awareness, and responsible caching.
---

## Start here

ZeepCentraal exposes a read-only GraphQL endpoint at `https://graphql.zeepki.st`. Send requests with HTTP `POST` and a JSON body containing `query`, `operationName`, and `variables`.

::content-alert{type="notice" title="Explore the schema first"}
Open the [Ruru Playground](https://graphql.zeepki.st) to inspect current fields, filters, ordering enums, relationships, and argument types before writing your integration.
::

## Identify every client and operation

Every operation should have a stable, unique, descriptive name. Prefixing the operation with your application name makes traffic and errors much easier to identify.

Prefer `MyApplication_LevelDirectory` over generic names such as `Levels` or anonymous operations. Always send the matching `operationName` in the request body.

Send one of these client headers with every request:

- `X-Client: my-application-name`
- `X-Client: my-application-name@1.0.0`

Use lowercase letters, numbers, dots, underscores, and hyphens for the application name. Keep the optional version after `@`. Never put account identifiers, access tokens, or other private data in this header.

::content-alert{type="important" title="Name and identify every request"}
Stable operation names and `X-Client` values let ZeepCentraal distinguish your application from unrelated traffic when diagnosing errors or excessive load.
::

## First query

This query requests exactly six high-value levels and includes cursor information for the next page.

```graphql
query MyApplication_LevelDirectory($first: Int!, $after: Cursor) {
  levels(
    first: $first
    after: $after
    orderBy: [LEVEL_POINTS_POINTS_DESC, ID_ASC]
  ) {
    edges {
      cursor
      node {
        xxHash
        levelItems(
          first: 1
          filter: { deleted: { equalTo: false } }
          orderBy: [UPDATED_AT_DESC]
        ) {
          nodes {
            name
            author {
              steamId
              steamName
            }
          }
        }
        levelPoints {
          points
          rating
        }
      }
    }
    pageInfo {
      endCursor
      hasNextPage
    }
    totalCount
  }
}
```

Variables:

```json
{
  "first": 6,
  "after": null
}
```

::content-code-group{title="Send a request" curl-label="Send with curl" typescript-label="Send with TypeScript"}
#curl

Save the operation and variables as `request.json`, then send it with explicit client identity:

```bash
curl https://graphql.zeepki.st \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'X-Client: my-application-name@1.0.0' \
  --data-binary @request.json
```

The request file must include the operation name:

```json
{
  "operationName": "MyApplication_LevelDirectory",
  "query": "query MyApplication_LevelDirectory($first: Int!, $after: Cursor) { levels(first: $first, after: $after, orderBy: [LEVEL_POINTS_POINTS_DESC, ID_ASC]) { edges { cursor node { xxHash } } pageInfo { endCursor hasNextPage } totalCount } }",
  "variables": {
    "first": 6,
    "after": null
  }
}
```

#typescript

```ts
const response = await fetch('https://graphql.zeepki.st', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Client': 'my-application-name@1.0.0',
  },
  body: JSON.stringify({
    operationName: 'MyApplication_LevelDirectory',
    query: `
      query MyApplication_LevelDirectory($first: Int!, $after: Cursor) {
        levels(first: $first, after: $after, orderBy: [LEVEL_POINTS_POINTS_DESC, ID_ASC]) {
          nodes { xxHash }
          pageInfo { endCursor hasNextPage }
          totalCount
        }
      }
    `,
    variables: { first: 6, after: null },
  }),
})

const payload = await response.json()
const queryCost = response.headers.get('X-Query-Cost')

if (!response.ok || payload.errors?.length) {
  // Record the operation name, status, query cost, and sanitized errors.
}
```
::

## Understand query patterns

### Direct lookups

Use a direct lookup when you already have a stable identifier. These return one object or `null`, rather than a paginated connection.

- `userBySteamId(steamId:)` finds a player from their Steam ID.
- `levelByXxHash(xxHash:)` finds a level from its canonical hash.
- `record(id:)` finds one submitted record.

```graphql
query MyApplication_PlayerProfile($steamId: BigInt!) {
  userBySteamId(steamId: $steamId) {
    steamId
    steamName
    userPoints {
      rank
      points
      totalPoints
      worldRecords
    }
  }
}
```

### Connections and relationships

Plural fields such as `levels`, `users`, and `records` return connections. Connections provide `nodes` or `edges`, `pageInfo`, and `totalCount`. Follow relationships inside each node instead of making one request per related object.

Use `condition` for straightforward equality matching. Use `filter` for comparisons, text searches, logical combinations, and relationship existence checks. Do not send an empty filter object.

Always choose an explicit `orderBy`. Add a unique field such as `ID_ASC` or `ID_DESC` after a non-unique sort so pagination remains deterministic.

```graphql
query MyApplication_RecentRecords(
  $first: Int!
  $after: Cursor
  $since: Datetime!
) {
  records(
    first: $first
    after: $after
    filter: { dateCreated: { greaterThanOrEqualTo: $since } }
    orderBy: [DATE_CREATED_DESC, ID_DESC]
  ) {
    nodes {
      id
      time
      dateCreated
      user {
        steamId
        steamName
      }
      level {
        xxHash
      }
    }
    pageInfo {
      endCursor
      hasNextPage
    }
  }
}
```

### Counts and aggregates

Connections can calculate `totalCount`, `aggregates`, and `groupedAggregates` across the full matching result set. Pagination arguments do not restrict aggregate input. Request `first: 0` when you only need counts or aggregates so no unused nodes are returned.

```graphql
query MyApplication_DrivingSummary($since: Datetime!) {
  recordStatistics(
    first: 0
    filter: { dateCreated: { greaterThanOrEqualTo: $since } }
  ) {
    totalCount
    aggregates {
      sum {
        distance
      }
      average {
        averageSpeed
      }
    }
    groupedAggregates(groupBy: [DATE_CREATED_TRUNCATED_TO_DAY]) {
      keys
      sum {
        distance
      }
    }
  }
}
```

### Domain-specific queries

- `hotLevelsSince` ranks levels by record activity since a supplied date.
- `recordStatistics` exposes driving telemetry and aggregate calculations.
- `zslSeasons`, `zslRounds`, `zslLevels`, and their result connections expose Super League standings.
- `personalBestGlobals` and `worldRecordGlobals` expose current best-record relationships.

Check Ruru for exact filters and ordering enums because the schema evolves with ZeepCentraal.

## Prefer cursor pagination

Cursor pagination remains stable when rows are inserted or removed between requests.

| Direction | Arguments | Cursor source |
| --- | --- | --- |
| First page | `first: 25` | None |
| Next page | `first: 25, after: endCursor` | Previous `pageInfo.endCursor` |
| Previous page | `last: 25, before: startCursor` | Current `pageInfo.startCursor` |
| Last page | `last: 25` | None |

Omitting both `first` and `last` defaults to 100 rows. The maximum accepted value is 1,000. Request the exact number your interface displays rather than relying on either boundary.

Offset pagination uses `offset` to skip rows. It can be useful for small, effectively static result sets, but concurrent inserts or deletions may cause duplicates or skipped rows. It also becomes less efficient for deep pages. `offset` cannot be combined with `last`.

::content-alert{type="important" title="Keep pagination deterministic"}
Cursor pagination still needs an explicit, stable ordering. Add an ID tie-breaker whenever the primary sort value can be shared by multiple rows.
::

## Stay within query cost

The current default query-cost ceiling is **5,000**. Collection size, nested collections, field depth, and broad selections increase estimated cost. Treat the ceiling as a safety limit, not a target.

Successful responses include `X-Query-Cost`. A request over the ceiling returns HTTP `400`, an error payload containing the estimated and maximum cost, and the same response header.

Reduce cost by:

- Requesting only fields you render or calculate with.
- Using smaller `first` or `last` values.
- Avoiding multiple large nested connections in one operation.
- Splitting independent screen sections into focused named operations.
- Using `first: 0` for count and aggregate-only work.

## Rate and cache responsibly

Use **60 requests per minute per running client instance** and **four concurrent requests** as cooperative maximums. These values are responsible-use guidance, not a guaranteed allowance.

If a response includes `Retry-After`, wait for that duration. Otherwise apply exponential backoff with jitter for HTTP `429` and temporary `5xx` responses. Do not automatically retry validation, query-cost, or other permanent client errors.

Suggested starting cache durations:

| Data | Starting cache duration |
| --- | --- |
| Latest records and active leaderboards | 15 seconds |
| Users, levels, points, and current standings | 5 minutes |
| Immutable record details and historical results | 1 hour |
| Schema metadata | 24 hours |

Deduplicate identical in-flight requests. Do not store failed responses as successful cached data. Refresh only when your interface needs fresher information.

## Fair use and attribution

- Do not repeatedly download the full dataset.
- Do not request fields or rows you do not use.
- Stop background work when nobody is viewing or using its result.
- Contact the community before launching a high-volume integration or bulk import.
- Keep credentials and private data outside browser bundles, logs, examples, and support messages.

Non-personal projects using ZeepCentraal data must display **Powered by ZeepCentraal** in visible product copy and link to [zeepki.st](https://zeepki.st).

::content-alert{type="reminder" title="Need implementation feedback?"}
Join the [Zeepkist Modding Discord](https://discord.gg/zeepkist-modding) for help writing mods, reviewing integration ideas, and getting feedback before a public release.
::
