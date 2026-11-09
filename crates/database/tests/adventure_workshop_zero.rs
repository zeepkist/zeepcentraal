use anyhow::{Result, ensure};

const UP: &str = include_str!("../migrations/20261109010000_adventure_workshop_zero/up.sql");
const DOWN: &str = include_str!("../migrations/20261109010000_adventure_workshop_zero/down.sql");

#[tokio::test]
#[ignore = "requires disposable local adventure_workshop_zero_test database"]
async fn official_aliases_zero_foreign_keys_permissions_and_rollback() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/adventure_workshop_zero_test",
        "Dedicated local Adventure Workshop ID database required"
    );
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("Adventure Workshop ID connection") });
    let tx = client.transaction().await?;
    tx.batch_execute(
        r#"
        CREATE TABLE public.workshop_item (
            workshop_id bigint PRIMARY KEY, author_id bigint NOT NULL,
            name text NOT NULL, image_url text NOT NULL DEFAULT '',
            visibility smallint NOT NULL DEFAULT 0, publicly_visible boolean NOT NULL DEFAULT true,
            file_size integer NOT NULL DEFAULT 0,
            created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
            date_created timestamptz NOT NULL DEFAULT now(), date_updated timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE public.level(id integer PRIMARY KEY, adventure boolean NOT NULL);
        CREATE TABLE public.level_item(
            id integer PRIMARY KEY, id_level integer REFERENCES public.level,
            workshop_id bigint REFERENCES public.workshop_item, author_id bigint NOT NULL,
            file_uid text NOT NULL, deleted boolean NOT NULL DEFAULT false,
            publicly_visible boolean NOT NULL DEFAULT true
        );
        CREATE TABLE public.item_changes(id integer);
        CREATE FUNCTION public.capture_item_change() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN INSERT INTO public.item_changes VALUES(NEW.id); RETURN NEW; END $$;
        CREATE TRIGGER item_change AFTER UPDATE OF workshop_id ON public.level_item
            FOR EACH ROW EXECUTE FUNCTION public.capture_item_change();
        INSERT INTO public.workshop_item(workshop_id,author_id,name) VALUES
            (-1,76561198041027402,'Official Adventure'), (123,42,'Workshop upload');
        INSERT INTO public.level VALUES(1,true),(2,false);
        INSERT INTO public.level_item(id,id_level,workshop_id,author_id,file_uid,deleted) VALUES
            (1,1,-1,76561198041027402,'ea1',false),
            (2,1,-1,76561198041027402,'old-version',true),
            (3,1,123,42,'workshop-copy',false),
            (4,2,-1,76561198041027402,'non-adventure',false),
            (5,1,-1,42,'other-author',false);
        GRANT USAGE ON SCHEMA public TO zeepcentraal_graphql;
        GRANT SELECT ON public.level_item,public.workshop_item TO zeepcentraal_graphql;
        "#,
    )
    .await?;
    tx.batch_execute(UP).await?;
    tx.batch_execute("SET LOCAL ROLE zeepcentraal_graphql")
        .await?;
    let rows = tx
        .query(
            "SELECT workshop_id,file_uid FROM public.level_item ORDER BY id",
            &[],
        )
        .await?;
    assert_eq!(
        rows.iter().map(|r| r.get::<_, i64>(0)).collect::<Vec<_>>(),
        [0, 0, 123, -1, -1]
    );
    assert_eq!(rows[0].get::<_, String>(1), "ea1");
    assert_eq!(rows[1].get::<_, String>(1), "old-version");
    assert_eq!(
        tx.query_one(
            "SELECT name FROM public.workshop_item WHERE workshop_id=0",
            &[]
        )
        .await?
        .get::<_, String>(0),
        "Official Adventure"
    );
    tx.batch_execute("RESET ROLE").await?;
    assert_eq!(
        tx.query_one("SELECT count(*)::int FROM public.item_changes", &[])
            .await?
            .get::<_, i32>(0),
        2
    );
    tx.batch_execute(DOWN).await?;
    assert_eq!(
        tx.query_one("SELECT workshop_id FROM public.level_item WHERE id=1", &[])
            .await?
            .get::<_, i64>(0),
        -1
    );
    // Existing zero metadata and unrelated zero aliases survive both directions.
    tx.batch_execute("UPDATE public.workshop_item SET name='Existing zero' WHERE workshop_id=0; INSERT INTO public.level_item VALUES(6,2,0,42,'local',false,true)").await?;
    tx.batch_execute(UP).await?;
    tx.batch_execute(UP).await?;
    assert_eq!(
        tx.query_one(
            "SELECT name FROM public.workshop_item WHERE workshop_id=0",
            &[]
        )
        .await?
        .get::<_, String>(0),
        "Existing zero"
    );
    tx.batch_execute(DOWN).await?;
    assert_eq!(
        tx.query_one("SELECT workshop_id FROM public.level_item WHERE id=6", &[])
            .await?
            .get::<_, i64>(0),
        0
    );
    tx.rollback().await?;
    Ok(())
}
