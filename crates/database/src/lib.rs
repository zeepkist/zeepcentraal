pub mod adoption;
pub mod catalog;
mod diesel_adapter;
pub mod history;
pub mod migrations;
pub mod pool;
pub mod schema;
pub mod services;
pub use diesel_adapter::Database;
pub use pool::{
    DatabasePool, PoolAcquireError, PoolBudget, PoolConnection, PoolPartition, PoolSettings,
    PoolSnapshot,
};

pub fn is_unavailable_error(error: &(dyn std::error::Error + 'static)) -> bool {
    if error.is::<PoolAcquireError>() || error.is::<diesel::ConnectionError>() {
        return true;
    }
    error
        .downcast_ref::<diesel::result::Error>()
        .is_some_and(|error| {
            matches!(
                error,
                diesel::result::Error::DatabaseError(
                    diesel::result::DatabaseErrorKind::ClosedConnection
                        | diesel::result::DatabaseErrorKind::UnableToSendCommand,
                    _,
                )
            )
        })
}
