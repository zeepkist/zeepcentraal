use anyhow::{Result, ensure};

#[tokio::test]
#[ignore = "requires disposable loopback PostgreSQL with lobby tables"]
async fn backfill_redacts_private_closures_and_preserves_other_names() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/zc_test",
        "Dedicated lobby test database required"
    );
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("Lobby test connection") });
    let tx = client.transaction().await?;
    tx.batch_execute(
        "INSERT INTO public.\"user\"(steam_id,steam_name,banned) \
         VALUES (76561198000000000,'Backfill Test Host',false);
         WITH rooms AS (
             INSERT INTO public.lobby(master_id,room_name,host_id,players,player_limit,is_public,
                 peak_players,peak_time,first_seen,last_seen,closed_at)
             SELECT master_id,room_name,76561198000000000,1,8,is_public,1,now(),now(),now(),closed_at
             FROM (VALUES ('backfill-removed','Private packet name',false,now()),
                          ('backfill-inferred','Inferred room',false,now()+interval '1 minute'),
                          ('backfill-active','Active room',false,NULL),
                          ('backfill-public','Public room',true,now()))
               AS sample(master_id,room_name,is_public,closed_at)
             RETURNING id,room_name,host_id,players,player_limit,is_public,closed_at
         )
         INSERT INTO public.lobby_history(lobby_id,host_id,change_type,room_name,players,
             player_limit,is_public,observed_at)
         SELECT id,host_id,change_type,room_name,players,player_limit,is_public,now()
         FROM rooms CROSS JOIN (VALUES ('opened'),('closed')) AS events(change_type)
         WHERE change_type='opened' OR closed_at IS NOT NULL;",
    )
    .await?;

    let up = include_str!("../migrations/20261119000000_redact_private_lobby_closures/up.sql");
    let down = include_str!("../migrations/20261119000000_redact_private_lobby_closures/down.sql");
    for sql in [up, up, down] {
        tx.batch_execute(sql).await?;
        let rows = tx
            .query(
                "SELECT l.room_name, array_agg(h.room_name ORDER BY h.change_type DESC) \
                 FROM public.lobby l JOIN public.lobby_history h ON h.lobby_id=l.id \
                 WHERE l.host_id=76561198000000000 GROUP BY l.id ORDER BY l.master_id",
                &[],
            )
            .await?;
        let names: Vec<_> = rows
            .iter()
            .map(|row| (row.get::<_, &str>(0), row.get::<_, Vec<&str>>(1)))
            .collect();
        assert_eq!(
            names,
            [
                ("Active room", vec!["Active room"]),
                ("Inferred room", vec!["Inferred room", "Private room"]),
                ("Public room", vec!["Public room", "Public room"]),
                ("Private room", vec!["Private packet name", "Private room"]),
            ]
        );
    }
    tx.rollback().await?;
    Ok(())
}
