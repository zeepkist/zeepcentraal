//! Shared domain, configuration, and wire primitives for Rust services.
pub mod binary;
pub mod config;
pub mod cookies;
pub mod discord;
pub mod identifiers;
pub mod jwt;
pub mod score;
pub mod steam;
pub mod version;

pub use config::{DatabaseConfig, RuntimeConfig};
pub use identifiers::{generate_uid, xxh128_hex};
