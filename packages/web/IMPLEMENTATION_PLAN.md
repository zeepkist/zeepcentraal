# ZeepCentraal Nuxt 4 implementation plan

## Foundation

- [ ] Keep pages/composables responsible for requests; components receive typed data only.
- [ ] Use generated GraphQL documents from `app/graphql/queries` and `app/graphql/subscriptions`.
- [ ] Use cursor pagination with exact `first`/`last` values; never use `offset`.
- [ ] Seed live panels through SSR, then subscribe after hydration.
- [ ] Keep all interface copy in `i18n/locales/en.json`.
- [ ] Route non-GraphQL external requests through Nitro server routes.
- [ ] Add reusable loading, empty, error, metric, level, record, user and pagination components.

## Dashboard

- [ ] Show eight popular and eight latest levels.
- [ ] Show ten recent world records and personal bests through SSR-backed subscriptions.
- [ ] Show live record, PB, WR, level, vote and rolling 24-hour active-player totals.
- [ ] Show aggregate distance, airtime, terrain and control statistics with charts.
- [ ] Proxy and cache five Zeepkist Steam announcements.
- [ ] Switch hero content for anonymous, new and active logged-in users.

## Levels and users

- [ ] Add searchable/filterable level explorer with 24-item cursor pages.
- [ ] Add level detail with medals, WR, aggregate stats, records and PB rank handling.
- [ ] Add `userPoints` leaderboard with 50-item cursor pages.
- [ ] Add user totals, driving statistics, valuable/recent WRs and PBs, and recent records.

## Adventure, wiki, developer and ZSL

- [ ] Group all `adventure: true` levels into name-derived series.
- [ ] Add multi-page Nuxt Content wiki and GraphQL developer portal.
- [ ] Add ZSL season, round and level result routes with cursor pagination.

## Auth, server, SEO and verification

- [ ] Persist normalised Pinia session state and refresh HttpOnly-cookie access before expiry.
- [ ] Proxy Steam news; add same-origin API checks and GraphQL-backed sitemaps.
- [ ] Add Nuxt Image, Schema.org, OG images, Nuxt Charts and reduced-motion support.
- [ ] Validate documents, cursor limits, components, auth, E2E routes and production build.

## Pagination limits

- [ ] Always specify exact `first`/`last`; omitted limit defaults to 100.
- [ ] Use `first: 0` for aggregate-only connections.
- [ ] Keep every page/chunk at or below 1,000 items.
