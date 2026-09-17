FROM rust:1.98.1-bookworm AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
ENV CARGO_BUILD_JOBS=2
RUN cargo build --locked --release -p zc-server -p zc-migrate --no-default-features --features db-sqlx && mkdir /binaries && cp target/release/zc-server /binaries/sqlx && cp target/release/zc-migrate /binaries/migrate
RUN cargo build --locked --release -p zc-server --no-default-features --features db-diesel && cp target/release/zc-server /binaries/diesel
FROM debian:bookworm-slim
COPY --from=build /binaries /app
ENTRYPOINT ["/app/sqlx"]
