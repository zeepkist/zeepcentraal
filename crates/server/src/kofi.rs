use crate::{AppState, problem::Problem};
use axum::{Form, extract::State, http::StatusCode};
use serde::Deserialize;
use std::{future::Future, sync::Arc};
use subtle::ConstantTimeEq;
use utoipa::ToSchema;
use zc_database::services::donations::DonationInput;

#[derive(Deserialize, ToSchema)]
pub struct KofiForm {
    /// Ko-fi payment JSON encoded inside the form's data field.
    data: String,
}

#[derive(Deserialize)]
struct Verification {
    verification_token: String,
}

#[derive(Deserialize)]
struct Payment {
    message_id: uuid::Uuid,
    timestamp: jiff::Timestamp,
    #[serde(rename = "type")]
    payment_type: String,
    is_public: bool,
    url: String,
    is_subscription_payment: bool,
    is_first_subscription_payment: bool,
    kofi_transaction_id: uuid::Uuid,
    tier_name: Option<String>,
    discord_userid: Option<String>,
}

fn problem(status: StatusCode, detail: &str) -> Problem {
    Problem {
        status,
        detail: detail.into(),
        error_code: None,
    }
}

fn parse_payment(data: &str, expected: &str) -> Result<DonationInput, Problem> {
    let verification: Verification = serde_json::from_str(data)
        .map_err(|_| problem(StatusCode::BAD_REQUEST, "Invalid Ko-fi payment"))?;
    if !bool::from(
        verification
            .verification_token
            .as_bytes()
            .ct_eq(expected.as_bytes()),
    ) {
        return Err(problem(
            StatusCode::UNAUTHORIZED,
            "Invalid Ko-fi verification token",
        ));
    }
    // Deserialize only retained fields; do not keep token, amount, name, email, or message.
    let payment: Payment = serde_json::from_str(data)
        .map_err(|_| problem(StatusCode::BAD_REQUEST, "Invalid Ko-fi payment"))?;
    if !matches!(
        payment.payment_type.as_str(),
        "Tip" | "Donation" | "Subscription" | "Commission" | "Shop Order"
    ) {
        return Err(problem(
            StatusCode::BAD_REQUEST,
            "Unsupported Ko-fi payment type",
        ));
    }
    let discord_userid = payment
        .discord_userid
        .filter(|id| !id.is_empty())
        .map(|id| {
            id.parse::<i64>()
                .ok()
                .filter(|id| *id > 0)
                .ok_or_else(|| problem(StatusCode::BAD_REQUEST, "Invalid Ko-fi Discord ID"))
        })
        .transpose()?;
    Ok(DonationInput {
        message_id: payment.message_id.to_string(),
        timestamp: payment.timestamp.to_string(),
        payment_type: payment.payment_type,
        is_public: payment.is_public,
        url: payment.url,
        is_subscription_payment: payment.is_subscription_payment,
        is_first_subscription_payment: payment.is_first_subscription_payment,
        kofi_transaction_id: payment.kofi_transaction_id.to_string(),
        tier_name: payment.tier_name.and_then(|tier| {
            let tier = tier.trim();
            (!tier.is_empty()).then(|| tier.to_owned())
        }),
        discord_userid,
    })
}

async fn receive<F, Fut>(data: &str, token: Option<&str>, persist: F) -> Result<StatusCode, Problem>
where
    F: FnOnce(DonationInput) -> Fut,
    Fut: Future<Output = anyhow::Result<bool>>,
{
    let token = token
        .filter(|token| !token.trim().is_empty())
        .ok_or_else(|| {
            problem(
                StatusCode::SERVICE_UNAVAILABLE,
                "Ko-fi webhook is not configured",
            )
        })?;
    let payment = parse_payment(data, token)?;
    persist(payment).await.map_err(|error| {
        // Database errors can contain rejected row values. Never log them here.
        if error.chain().any(zc_database::is_unavailable_error) {
            problem(StatusCode::SERVICE_UNAVAILABLE, "Ko-fi storage unavailable")
        } else {
            tracing::error!("Ko-fi payment persistence failed");
            problem(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Ko-fi payment persistence failed",
            )
        }
    })?;
    Ok(StatusCode::OK)
}

#[utoipa::path(
    post, path = "/kofi/webhook",
    request_body(content = KofiForm, content_type = "application/x-www-form-urlencoded"),
    responses(
        (status = 200, description = "Payment stored or previously received"),
        (status = 400, description = "Invalid Ko-fi payment"),
        (status = 401, description = "Invalid verification token"),
        (status = 500, description = "Payment persistence failed; retry"),
        (status = 503, description = "Webhook or database unavailable; retry")
    ),
    tag = "Ko-fi"
)]
pub async fn webhook(
    State(state): State<Arc<AppState>>,
    Form(form): Form<KofiForm>,
) -> Result<StatusCode, Problem> {
    let database = state.database.clone();
    receive(
        &form.data,
        state.config.kofi_verification_token.as_deref(),
        |payment| async move { database.record_kofi_donation(&payment).await },
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{Router, body::Body, extract::DefaultBodyLimit, http::Request, routing::post};
    use serde_json::{Value, json};
    use tower::ServiceExt;

    fn payload() -> Value {
        json!({
            "verification_token": "fake-kofi-secret",
            "message_id": "00000000-0000-4000-8000-000000000001",
            "timestamp": "2026-09-28T00:34:56Z", "type": "Donation", "is_public": true,
            "url": "https://example.com/payment", "is_subscription_payment": false,
            "is_first_subscription_payment": false,
            "kofi_transaction_id": "00000000-0000-4000-8000-000000000002",
            "tier_name": null, "discord_userid": "012345678901234567",
            "email": "fake@example.com", "message": "Ignored", "amount": "3.00"
        })
    }

    #[test]
    fn parses_all_payment_types_and_retains_only_metadata() {
        for kind in [
            "Tip",
            "Donation",
            "Subscription",
            "Commission",
            "Shop Order",
        ] {
            let mut data = payload();
            data["type"] = kind.into();
            data["tier_name"] = " Bronze ".into();
            data["is_subscription_payment"] = true.into();
            data["is_first_subscription_payment"] = true.into();
            let payment = parse_payment(&data.to_string(), "fake-kofi-secret").unwrap();
            assert_eq!(payment.payment_type, kind);
            assert_eq!(payment.discord_userid, Some(12345678901234567));
            assert_eq!(payment.tier_name.as_deref(), Some("Bronze"));
            assert!(payment.is_subscription_payment && payment.is_first_subscription_payment);
        }
    }

    #[test]
    fn private_and_unlinked_payments_are_accepted() {
        let mut data = payload();
        data["is_public"] = false.into();
        data["discord_userid"] = Value::Null;
        let payment = parse_payment(&data.to_string(), "fake-kofi-secret").unwrap();
        assert!(!payment.is_public);
        assert!(payment.discord_userid.is_none());
        data.as_object_mut().unwrap().remove("discord_userid");
        assert!(parse_payment(&data.to_string(), "fake-kofi-secret").is_ok());
    }

    #[test]
    fn rejects_invalid_token_and_payment_fields() {
        assert_eq!(
            parse_payment(&payload().to_string(), "wrong")
                .err()
                .unwrap()
                .status,
            StatusCode::UNAUTHORIZED
        );
        for (key, value) in [
            ("message_id", "bad"),
            ("timestamp", "bad"),
            ("type", "Unknown"),
            ("discord_userid", "-1"),
            ("discord_userid", "9223372036854775808"),
        ] {
            let mut data = payload();
            data[key] = value.into();
            assert_eq!(
                parse_payment(&data.to_string(), "fake-kofi-secret")
                    .err()
                    .unwrap()
                    .status,
                StatusCode::BAD_REQUEST
            );
        }
    }

    #[tokio::test]
    async fn acknowledgements_follow_persistence_and_duplicates_are_successful() {
        for inserted in [true, false] {
            assert_eq!(
                receive(
                    &payload().to_string(),
                    Some("fake-kofi-secret"),
                    |_| async move { Ok(inserted) }
                )
                .await
                .unwrap(),
                StatusCode::OK
            );
        }
        assert_eq!(
            receive(&payload().to_string(), None, |_| async {
                panic!("must not persist")
            })
            .await
            .err()
            .unwrap()
            .status,
            StatusCode::SERVICE_UNAVAILABLE
        );
        assert_eq!(
            receive(&payload().to_string(), Some("wrong"), |_| async {
                panic!("must not persist")
            })
            .await
            .err()
            .unwrap()
            .status,
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            receive(
                &payload().to_string(),
                Some("fake-kofi-secret"),
                |_| async { Err(anyhow::anyhow!("fake database failure")) }
            )
            .await
            .err()
            .unwrap()
            .status,
            StatusCode::INTERNAL_SERVER_ERROR
        );
        assert_eq!(
            receive(
                &payload().to_string(),
                Some("fake-kofi-secret"),
                |_| async { Err(diesel_error()) }
            )
            .await
            .err()
            .unwrap()
            .status,
            StatusCode::SERVICE_UNAVAILABLE
        );
    }

    fn diesel_error() -> anyhow::Error {
        zc_database::PoolAcquireError::from_snapshot(
            "application",
            std::time::Duration::from_secs(1),
            zc_database::PoolSnapshot {
                physical_limit: 1,
                physical_connections: 0,
                idle_connections: 0,
                partition_limit: 1,
                partition_available: 0,
                waiting_acquisitions: 1,
                pending_gets: 0,
                connections_created: 0,
                connection_failures: 1,
                acquisition_timeouts: 1,
                last_connection_failure: None,
                last_failure_category: None,
            },
            None,
        )
        .into()
    }

    #[tokio::test]
    async fn decodes_form_json_and_applies_body_limit() {
        async fn listener(Form(form): Form<KofiForm>) -> Result<StatusCode, Problem> {
            receive(&form.data, Some("fake-kofi-secret"), |_| async { Ok(true) }).await
        }
        let router = Router::new()
            .route("/kofi/webhook", post(listener))
            .layer(DefaultBodyLimit::max(64 * 1024));
        let encoded: String = url::form_urlencoded::Serializer::new(String::new())
            .append_pair("data", &payload().to_string())
            .finish();
        let request = |body: String| {
            Request::post("/kofi/webhook")
                .header("content-type", "application/x-www-form-urlencoded")
                .body(Body::from(body))
                .unwrap()
        };
        assert_eq!(
            router
                .clone()
                .oneshot(request(encoded))
                .await
                .unwrap()
                .status(),
            StatusCode::OK
        );
        assert_eq!(
            router
                .clone()
                .oneshot(request("data=not-json".into()))
                .await
                .unwrap()
                .status(),
            StatusCode::BAD_REQUEST
        );
        assert_eq!(
            router
                .oneshot(request("data=".to_owned() + &"x".repeat(65536)))
                .await
                .unwrap()
                .status(),
            StatusCode::PAYLOAD_TOO_LARGE
        );
    }
}
