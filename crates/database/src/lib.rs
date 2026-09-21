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
    DatabasePool, PoolAcquireError, PoolBudget, PoolConnection, PoolFailureCategory,
    PoolFailureStage, PoolPartition, PoolSettings, PoolSnapshot,
};

pub fn is_unavailable_error(error: &(dyn std::error::Error + 'static)) -> bool {
    if error.is::<PoolAcquireError>() || error.is::<diesel::ConnectionError>() {
        return true;
    }
    error
        .downcast_ref::<diesel::result::Error>()
        .is_some_and(is_unavailable_diesel_error)
}

fn is_unavailable_diesel_error(error: &diesel::result::Error) -> bool {
    match error {
        diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::ClosedConnection
            | diesel::result::DatabaseErrorKind::UnableToSendCommand,
            _,
        )
        | diesel::result::Error::BrokenTransactionManager => true,
        diesel::result::Error::RollbackErrorOnCommit {
            rollback_error,
            commit_error,
        } => {
            is_unavailable_diesel_error(rollback_error) || is_unavailable_diesel_error(commit_error)
        }
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn broken_connections_are_retryable_but_query_errors_are_not() {
        assert!(is_unavailable_error(
            &diesel::result::Error::BrokenTransactionManager
        ));
        assert!(!is_unavailable_error(&diesel::result::Error::NotFound));
    }
}
