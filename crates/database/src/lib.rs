pub mod adoption;
pub mod catalog;
mod diesel_adapter;
pub mod history;
pub mod migrations;
pub mod schema;
pub mod services;
pub use diesel_adapter::Database;
