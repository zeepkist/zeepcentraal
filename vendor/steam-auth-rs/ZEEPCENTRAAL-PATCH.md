# Steam TLS dependency patch

Source: published [`steam-auth-rs` 0.1.2](https://crates.io/crates/steam-auth-rs/0.1.2),
MIT license. `src/` is unchanged from that crate archive; README whitespace is normalized.
The published archive declares MIT but omits its LICENSE file; the MIT notice
included here is from the same author's vendored `steam-client-rs` crate.

`Cargo.toml` follows the published original manifest, with
`tokio-tungstenite` upgraded from 0.21 to 0.24. This removes rustls 0.22 and
rustls-webpki 0.102 from the dependency graph while retaining native certificate
roots and the existing Vec-based WebSocket message API. Local patch declarations
keep the sibling Steam dependencies consistent in standalone builds.

Keep this patch until published Steam dependencies use the patched TLS stack.
