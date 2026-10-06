#[path = "support/ghost_validation.rs"]
mod support;
use anyhow::{Result, ensure};
use async_trait::async_trait;
use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode},
};
use std::sync::Arc;
use tower::ServiceExt;
use zc_core::jwt::Provider;
use zc_core::object_storage::{DownloadConstraints, ObjectStorage};
struct NoStorage;
#[async_trait]
impl ObjectStorage for NoStorage {
    async fn upload(&self, _: &str, _: Vec<u8>, _: &str) -> Result<()> {
        anyhow::bail!("Role test does not use storage")
    }
    async fn download(&self, _: &str, _: DownloadConstraints<'_>) -> Result<Vec<u8>> {
        anyhow::bail!("Role test does not use storage")
    }
    async fn delete(&self, _: &str) -> Result<()> {
        anyhow::bail!("Role test does not use storage")
    }
}

async fn access(app: &Router, token: &str) -> Result<StatusCode> {
    Ok(app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/admin/ghost-validation")
                .header("Authorization", format!("Bearer {token}"))
                .body(Body::empty())?,
        )
        .await?
        .status())
}

#[tokio::test]
#[ignore = "requires empty isolated ghost_validation_admin_role_test database"]
async fn database_roles_control_access_and_migration_rolls_back() -> Result<()> {
    zc_core::environment::initialize()?;
    let url = zc_core::environment::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1")
            && parsed.path() == "/ghost_validation_admin_role_test",
        "Dedicated local role test DB required"
    );
    let (client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("role fixture connection") });
    client.batch_execute("CREATE TABLE public.\"user\"(id integer PRIMARY KEY,steam_id bigint,banned boolean NOT NULL DEFAULT false); INSERT INTO public.\"user\" VALUES(1,42,false); CREATE TABLE public.record(id integer,id_level integer,date_created timestamptz); CREATE SCHEMA zc_private; CREATE TABLE zc_private.record_validation(id bigint,id_record integer,id_level integer,status text); CREATE TABLE zc_private.level_version_lineage(id_level integer,workshop_id bigint); DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='zeepcentraal_graphql') THEN CREATE ROLE zeepcentraal_graphql; END IF; END $$; GRANT UPDATE ON public.\"user\" TO zeepcentraal_graphql;").await?;
    client
        .batch_execute(include_str!(
            "../../database/migrations/20261006223000_user_admin_role/up.sql"
        ))
        .await?;
    assert_eq!(
        client
            .query_one("SELECT role FROM public.\"user\" WHERE id=1", &[])
            .await?
            .get::<_, String>(0),
        "user"
    );
    assert!(!client.query_one("SELECT has_column_privilege('zeepcentraal_graphql','public.\"user\"','role','UPDATE')", &[]).await?.get::<_,bool>(0));
    assert_eq!(client.query_one("SELECT col_description('public.\"user\"'::regclass,attnum) FROM pg_attribute WHERE attrelid='public.\"user\"'::regclass AND attname='role'", &[]).await?.get::<_,String>(0), "@omit all");
    assert!(
        client
            .execute("UPDATE public.\"user\" SET role='owner'", &[])
            .await
            .is_err()
    );
    assert!(
        client
            .execute("UPDATE public.\"user\" SET role=NULL", &[])
            .await
            .is_err()
    );
    let storage = Arc::new(NoStorage);
    let state = support::state(&url, storage, false)?;
    let token = |provider, steam: &str| {
        state
            .config
            .jwt
            .issue(provider, steam, Some("123456789"))
            .map(|pair| pair.access_token)
    };
    let steam = token(Provider::Steam, "42")?;
    let gtr = token(Provider::Gtr, "42")?;
    let discord = token(Provider::Discord, "42")?;
    let missing = token(Provider::Steam, "999")?;
    let app = zc_server::app::router(state)?;
    assert_eq!(access(&app, &steam).await?, StatusCode::FORBIDDEN);
    assert_eq!(access(&app, &missing).await?, StatusCode::FORBIDDEN);
    client
        .execute("UPDATE public.\"user\" SET role='admin' WHERE id=1", &[])
        .await?;
    assert_eq!(access(&app, &steam).await?, StatusCode::OK);
    assert_eq!(access(&app, &gtr).await?, StatusCode::FORBIDDEN);
    assert_eq!(access(&app, &discord).await?, StatusCode::FORBIDDEN);
    assert_eq!(access(&app, "forged").await?, StatusCode::UNAUTHORIZED);
    client
        .execute("UPDATE public.\"user\" SET banned=true WHERE id=1", &[])
        .await?;
    assert_eq!(access(&app, &steam).await?, StatusCode::FORBIDDEN);
    client
        .execute(
            "UPDATE public.\"user\" SET banned=false,role='user' WHERE id=1",
            &[],
        )
        .await?;
    assert_eq!(access(&app, &steam).await?, StatusCode::FORBIDDEN);
    client
        .batch_execute(include_str!(
            "../../database/migrations/20261006223000_user_admin_role/down.sql"
        ))
        .await?;
    assert_eq!(client.query_one("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='user' AND column_name='role'", &[]).await?.get::<_,i64>(0), 0);
    Ok(())
}
