# Build the benchmark Dockerfile's build target as zc-rust-benchmark:builder first.
FROM zc-rust-benchmark:builder AS build
COPY Cargo.toml Cargo.lock ./
COPY crates/discord-evaluation ./crates/discord-evaluation
RUN cargo build --locked --release -p zc-discord-evaluation
FROM debian:bookworm-slim
COPY --from=build /etc/ssl/certs /etc/ssl/certs
COPY --from=build /src/target/release/zc-discord-evaluation /app/discord
ENTRYPOINT ["/app/discord"]
