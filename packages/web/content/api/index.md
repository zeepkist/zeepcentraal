---
title: ZeepCentraal GraphQL API
description: Query ZeepCentraal records, levels, users, statistics, and tournaments.
---

# GraphQL API

ZeepCentraal exposes one GraphQL endpoint at `https://graphql.zeepki.st`. Explore schema and execute queries in the [Ruru Playground](https://graphql.zeepki.st).

## First query

```graphql
query ZC_ExampleLevels($first: Int!, $after: Cursor) {
  levels(first: $first, after: $after, orderBy: [DATE_CREATED_DESC]) {
    nodes { xxHash adventure }
    pageInfo { endCursor hasNextPage }
  }
}
```

Send JSON with `query` and `variables` fields using HTTP POST. Use `wss://graphql.zeepki.st` for subscriptions.

## Cursor pagination

Request only rows your interface displays. Pass `first` and `after` when moving forward; pass `last` and `before` when moving backward. Omitted limits default to 100. Maximum limit is 1,000. Aggregate-only connections should request `first: 0`.

## Fair and acceptable use

Cache stable responses, avoid polling when subscriptions exist, stop requests when users leave a page, and never scrape the full dataset repeatedly. Rate limits protect shared infrastructure and may change as traffic grows. Clients receiving a rate-limit response must back off before retrying.

## Attribution

Non-personal projects using ZeepCentraal data must display **Powered by ZeepCentraal** in visible product copy and link to [zeepki.st](https://zeepki.st).

## Integration checklist

- Name every operation.
- Request only required fields and exact result counts.
- Handle partial GraphQL responses and `errors`.
- Keep secrets outside browser bundles.
- Route unrelated third-party APIs through your own server.
