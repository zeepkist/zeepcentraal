FROM rust:1.98.1-bookworm AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
ENV CARGO_BUILD_JOBS=2
RUN cargo build --locked --release -p zc-http-benchmark && mkdir /binaries && cp target/release/zc-http-benchmark /binaries/diesel
FROM debian:bookworm-slim
COPY --from=build /binaries /app
ENTRYPOINT ["/app/diesel"]
