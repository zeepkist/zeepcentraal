use anyhow::{Result, ensure};
use std::collections::BTreeMap;

const UP: &str = include_str!("../migrations/20261110010000_adventure_medal_times/up.sql");
const DOWN: &str = include_str!("../migrations/20261110010000_adventure_medal_times/down.sql");
// Exact serialized v18.2 scriptable asset values, independently readable without Unity exports.
const SOURCE: &str = include_str!("fixtures/adventure_medal_times.csv");

fn source_times() -> BTreeMap<&'static str, [f32; 4]> {
    let mut rows = BTreeMap::new();
    for line in SOURCE.lines().skip(1) {
        let fields: Vec<_> = line.split(',').collect();
        assert_eq!(fields.len(), 5);
        let times = std::array::from_fn(|i| fields[i + 1].parse::<f32>().unwrap());
        assert!(times.iter().all(|value| value.is_finite() && *value > 0.0));
        assert!(times.windows(2).all(|pair| pair[0] <= pair[1]));
        assert!(rows.insert(fields[0], times).is_none());
    }
    rows
}

#[test]
fn exact_source_values_cover_every_official_uid_in_both_directions() {
    let source = source_times();
    let map: BTreeMap<_, _> = include_str!("../../../data/adventureLevels/map.csv")
        .trim_start_matches('\u{feff}')
        .lines()
        .skip(1)
        .filter(|line| !line.is_empty())
        .map(|line| line.split_once(',').unwrap())
        .collect();
    assert_eq!(source.len(), 120);
    assert_eq!(
        source.keys().collect::<Vec<_>>(),
        map.keys().collect::<Vec<_>>()
    );
    assert_eq!(source["ea1"], [40.10766, 44.0, 48.0, 90.0]);
    assert_eq!(source["CL01"], [34.642, 38.1062, 41.5704, 46.7667]);
    for sql in [UP, DOWN] {
        let tuples: BTreeMap<_, _> = sql
            .lines()
            .filter_map(|line| {
                line.trim().strip_prefix("('").map(|row| {
                    let (uid, values) = row.split_once("', ").unwrap();
                    let fields: Vec<_> = values
                        .trim_end_matches(',')
                        .trim_end_matches(')')
                        .split(", ")
                        .collect();
                    assert_eq!(fields.len(), 4);
                    let times: [f32; 4] = std::array::from_fn(|i| {
                        fields[i].strip_suffix("::real").unwrap().parse().unwrap()
                    });
                    (uid, times)
                })
            })
            .collect();
        assert_eq!(
            sql.lines()
                .filter(|line| line.trim().starts_with("('"))
                .count(),
            120
        );
        assert_eq!(tuples, source);
    }
}

#[tokio::test]
#[ignore = "requires disposable local adventure_medal_times_test database"]
async fn exact_real_values_alias_scope_idempotency_and_rollback() -> Result<()> {
    let url = std::env::var("ZC_TEST_DATABASE_URL")?;
    let parsed = url::Url::parse(&url)?;
    ensure!(
        parsed.host_str() == Some("127.0.0.1") && parsed.path() == "/adventure_medal_times_test",
        "Dedicated local medal test database required"
    );
    let (mut client, connection) = tokio_postgres::connect(&url, tokio_postgres::NoTls).await?;
    tokio::spawn(async move { connection.await.expect("Adventure medal test connection") });
    let tx = client.transaction().await?;
    tx.batch_execute(r#"
        CREATE TABLE public.level(id integer PRIMARY KEY, adventure boolean NOT NULL, hash text NOT NULL);
        CREATE TABLE public.level_item(
            id integer PRIMARY KEY, id_level integer REFERENCES public.level,
            workshop_id bigint NOT NULL DEFAULT 0, author_id bigint NOT NULL DEFAULT 76561198041027402,
            file_uid text NOT NULL, deleted boolean NOT NULL DEFAULT false,
            validation_time_author real NOT NULL DEFAULT 0, validation_time_gold real NOT NULL DEFAULT 0,
            validation_time_silver real NOT NULL DEFAULT 0, validation_time_bronze real NOT NULL DEFAULT 0,
            updated_at timestamptz NOT NULL DEFAULT '2000-01-01', date_updated timestamptz
        );
        CREATE TABLE public.changes(id integer);
        CREATE FUNCTION public.capture_medal_change() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN INSERT INTO public.changes VALUES(NEW.id); RETURN NEW; END $$;
        CREATE TRIGGER medal_change AFTER UPDATE ON public.level_item
            FOR EACH ROW EXECUTE FUNCTION public.capture_medal_change();
        INSERT INTO public.level VALUES (1,true,'preserved'),(2,false,'non-adventure');
    "#).await?;
    let source = source_times();
    for (index, uid) in source.keys().enumerate() {
        tx.execute(
            "INSERT INTO public.level_item(id,id_level,file_uid) VALUES($1,1,$2)",
            &[&((index + 1) as i32), uid],
        )
        .await?;
    }
    tx.batch_execute(
        r#"
        INSERT INTO public.level_item(id,id_level,file_uid,deleted,validation_time_author,
            validation_time_gold,validation_time_silver,validation_time_bronze)
        VALUES(201,1,'ea1',true,1,2,3,4);
        INSERT INTO public.level_item(id,id_level,file_uid,workshop_id) VALUES(202,1,'ea1',123);
        INSERT INTO public.level_item(id,id_level,file_uid,author_id) VALUES(203,1,'ea1',42);
        INSERT INTO public.level_item(id,id_level,file_uid) VALUES(204,1,'unknown'),(205,2,'ea1');
        INSERT INTO public.level_item(id,id_level,file_uid,workshop_id) VALUES(206,1,'ea1',-1);
    "#,
    )
    .await?;
    tx.batch_execute(UP).await?;
    assert_eq!(
        tx.query_one("SELECT count(*)::int FROM public.changes", &[])
            .await?
            .get::<_, i32>(0),
        121
    );
    let rows = tx
        .query(
            "SELECT file_uid,validation_time_author,validation_time_gold,validation_time_silver,
        validation_time_bronze FROM public.level_item WHERE id<=201 ORDER BY id",
            &[],
        )
        .await?;
    for row in rows {
        let uid: String = row.get(0);
        assert_eq!(
            std::array::from_fn::<_, 4, _>(|i| row.get::<_, f32>(i + 1)),
            source[uid.as_str()]
        );
    }
    tx.batch_execute(UP).await?;
    assert_eq!(
        tx.query_one("SELECT count(*)::int FROM public.changes", &[])
            .await?
            .get::<_, i32>(0),
        121
    );
    assert_eq!(
        tx.query_one(
            "SELECT count(*)::int FROM public.level_item WHERE id>=202
        AND validation_time_author=0 AND validation_time_gold=0 AND validation_time_silver=0
        AND validation_time_bronze=0 AND updated_at='2000-01-01' AND date_updated IS NULL",
            &[]
        )
        .await?
        .get::<_, i32>(0),
        5
    );
    assert_eq!(
        tx.query_one(
            "SELECT count(*)::int FROM public.level_item WHERE id<=201
        AND updated_at>'2000-01-01' AND date_updated IS NOT NULL",
            &[]
        )
        .await?
        .get::<_, i32>(0),
        121
    );
    tx.batch_execute("UPDATE public.level_item SET validation_time_gold=999 WHERE id=201")
        .await?;
    // Excluded aliases must survive rollback even when their values match the imported tuple.
    tx.batch_execute(
        "UPDATE public.level_item SET validation_time_author=40.10766::real,
        validation_time_gold=44::real, validation_time_silver=48::real,
        validation_time_bronze=90::real WHERE id>=202",
    )
    .await?;
    tx.batch_execute(DOWN).await?;
    assert_eq!(
        tx.query_one(
            "SELECT count(*)::int FROM public.level_item WHERE id>=202
            AND validation_time_author=40.10766::real AND validation_time_gold=44::real
            AND validation_time_silver=48::real AND validation_time_bronze=90::real",
            &[]
        )
        .await?
        .get::<_, i32>(0),
        5
    );
    assert_eq!(
        tx.query_one(
            "SELECT count(*)::int FROM public.level_item WHERE id<=120
        AND validation_time_author=0 AND validation_time_gold=0 AND validation_time_silver=0
        AND validation_time_bronze=0",
            &[]
        )
        .await?
        .get::<_, i32>(0),
        120
    );
    assert_eq!(
        tx.query_one(
            "SELECT validation_time_gold FROM public.level_item WHERE id=201",
            &[]
        )
        .await?
        .get::<_, f32>(0),
        999.0
    );
    let count: i32 = tx
        .query_one("SELECT count(*)::int FROM public.changes", &[])
        .await?
        .get(0);
    tx.batch_execute(DOWN).await?;
    assert_eq!(
        tx.query_one("SELECT count(*)::int FROM public.changes", &[])
            .await?
            .get::<_, i32>(0),
        count
    );
    tx.batch_execute(UP).await?;
    assert_eq!(
        tx.query_one(
            "SELECT validation_time_gold FROM public.level_item WHERE id=201",
            &[]
        )
        .await?
        .get::<_, f32>(0),
        44.0
    );
    assert!(
        tx.query_one("SELECT deleted FROM public.level_item WHERE id=201", &[])
            .await?
            .get::<_, bool>(0)
    );
    assert_eq!(
        tx.query_one("SELECT hash FROM public.level WHERE id=1", &[])
            .await?
            .get::<_, String>(0),
        "preserved"
    );
    tx.rollback().await?;
    Ok(())
}
