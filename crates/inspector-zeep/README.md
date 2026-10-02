# First-party Super League submissions

Inspector version 2 reads durable private submission rows. Discord is an output feed only. Copy `inspector.example.json` into the mounted inspector config and configure public round IDs and rules before opening a contest. Existing frozen contests are immutable and never rescanned or backfilled.

`--watch` polls pending work every five seconds. Successful inspections schedule workshop metadata checks 30 minutes later; transient failures retry after 60 seconds. A metadata cache hit reschedules without creating a validation or notification. At submission close, every selected row gets a final uncached inspection. The service freezes only after its immutable playlist and combined archive upload and digest verification succeed. Pending Discord delivery continues independently after freezing.

Each author may belong to one selected submission per contest. Any listed author can edit or withdraw it during the database submission window. An edit increments its revision and clears the active validation. Validation and playlist publication reject stale revisions. Workshop ownership is checked asynchronously and reported as validation failure if the workshop owner is absent from the authors array.

Missing author accounts are created as placeholder user rows within the submission transaction, using the same helper as Steam sign-in. Existing profiles and bans are preserved. The collaborator picker accepts a valid Steam ID even when no account exists yet; name search still returns registered profiles.

Notification delivery uses Components V2 and disabled mentions, with one message per submission and a stable marker and nonce. Successful unchanged validations skip edits; missing messages are recreated. Transient errors and rate limits retry through the durable outbox. Uncertain creates search up to 1,000 recent channel messages; recovery beyond that bound defers for operator review instead of risking duplicate posts. Withdrawal updates an existing message and does not create a withdrawal-only message.

## Coordinated rollout

1. Stop the old inspector before applying the destructive migration. Keep website mutations disabled until all services are compatible.
2. Back up the database. Verify all contests have unique round links and every submission has 1–3 distinct Steam IDs. The migration refuses incomplete ownership or mapping data.
3. Run `cargo run -p zc-migrate -- adopt` (see migrate crate CLI for connection/environment setup). New DDL remains in Diesel migrations; Drizzle history and generated baseline stay frozen.
4. Deploy compatible server, inspector/config version 2, web and lobby builds together. Keep the database backup until smoke checks pass.
5. Verify current frozen contest, candidates, archive and existing ballots. Use a disposable contest to verify website create/edit/withdraw, author privacy, Discord create/edit, S3 publication and finalization, and lobby counter/announcement.

The column-removal migration deliberately refuses rollback. Restore the pre-migration backup to recover removed Discord source data. Do not run a live inspector against a local restored production contest.

Local automated tests mock Steam, Discord and object storage. They do not establish production acceptance; the production smoke checks above still need a real new submission and live lobby observation.

## Verification commands

```sh
cargo fmt --all --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
cargo build --workspace --bins --locked
```

For database acceptance, set `ZC_TEST_DATABASE_URL` to a **disposable local database named `zsl_migration_test`**, cloned with the adopted baseline schema and migration ledgers, before applying the first-party migration. Run these tests in order; they create fake contest, account and vote fixtures. Steam, Discord and S3 dependencies are mocked in inspector acceptance. They never start the live inspector.

```sh
cargo test -p zc-database --test contest_migration -- --ignored
cargo test -p zc-database --test inspector_services -- --ignored
cargo test -p zc-inspector-zeep --test first_party -- --ignored
cargo test -p zc-server --test submissions -- --ignored
```

Web gates use the existing Windows Bun installation when invoked from WSL:

```sh
bun.exe run test:web
bun.exe run typecheck:web
bun.exe x --no-install biome check packages/web
bun.exe run build:web
```
