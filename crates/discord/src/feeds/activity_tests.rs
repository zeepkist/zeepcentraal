use super::*;
use axum::{
    Json, Router,
    body::to_bytes,
    extract::Request,
    http::{Method, StatusCode},
};
use serde_json::{Value, json};
use serenity::http::HttpBuilder;
use std::{collections::BTreeSet, sync::Mutex};

#[derive(Default)]
struct State {
    feeds: Vec<Value>,
    events: Vec<Value>,
    worker: i64,
    deliveries: BTreeMap<(String, String), String>,
    watched: BTreeSet<i64>,
    player_watches: Vec<(i64, i64, u64)>,
    watch_requests: Vec<Value>,
    watch_keys: BTreeMap<i64, String>,
    dm_recipients: Vec<u64>,
    dm_channels: BTreeMap<u64, u64>,
    fail_sends: BTreeSet<(u64, i64)>,
    fail_cursors: BTreeSet<(String, i64)>,
    fail_watch_lookup: bool,
    fail_user_lookup: bool,
    fail_rank_flush: bool,
    flushes: usize,
    ping_world_record_loss: bool,
    sent: Vec<(u64, i64, Value)>,
    attempts: Vec<(u64, i64)>,
    queries: Vec<i64>,
    lookups: Vec<Vec<i32>>,
}

fn feed(guild: u64, kind: &str, channel: u64, cursor: i64) -> Value {
    json!({"guildId":guild.to_string(),"kind":kind,"channelId":channel.to_string(),
        "enabled":true,"cursorEventId":cursor.to_string()})
}

fn event(id: i64, kind: &str) -> Value {
    let name = format!("Event {id}");
    let mut value = json!({"id":id.to_string(),"kind":kind,"payload":{},
        "occurredAt":"2026-10-05T06:00:00Z", "userId":id,
        "user":{"id":id,"steamName":name},"record":{"time":49.332},
        "level":{"id":id,"xxHash":format!("hash{id}"),"levelItems":{"nodes":[{
            "name":name,"imageUrl":"https://example.com/track.jpg","workshopId":"1"}]},
            "levelPoints":{"points":1000},"personalBestGlobals":{"totalCount":1}}});
    if kind == "rank_batch" {
        value["payload"] = json!({"changes":[{"idUser":id,"previousRank":2,"rank":1}]});
        value["user"] = Value::Null;
        value["level"] = Value::Null;
    }
    value
}

#[tokio::test]
async fn level_events_render_thumbnail_relative_time_and_missing_image_fallback() {
    let frontend = "https://zeepki.st".parse().unwrap();
    for kind in ["workshop", "world_record"] {
        let value = event(1, kind);
        let activity: ActivityEvent = serde_json::from_value(value.clone()).unwrap();
        let message =
            serde_json::to_value(event_message(&activity, &frontend, None).await).unwrap();
        let header = &message["components"][0]["components"][0];
        assert_eq!(header["type"], 9);
        assert_eq!(header["accessory"]["type"], 11);
        assert_eq!(
            header["accessory"]["media"]["url"],
            "https://example.com/track.jpg"
        );
        assert_eq!(header["accessory"]["description"], "Event 1");
        let text = header["components"][0]["content"].as_str().unwrap();
        assert!(text.contains("<t:1791180000:R>"));
        if kind == "world_record" {
            assert!(text.contains("00:49.332"));
            assert!(text.contains("First record set on this level."));
        }
        assert_eq!(
            message["components"][0]["components"][1]["components"][0]["url"],
            "https://zeepki.st/level/hash1"
        );
        assert_eq!(message["flags"], 32768);
        assert_eq!(message["allowed_mentions"]["parse"], json!([]));
        for image in [
            "",
            "  ",
            "not a URL",
            "https://[invalid]/track.jpg",
            "file:///track.jpg",
        ] {
            let mut value = value.clone();
            value["level"]["levelItems"]["nodes"][0]["imageUrl"] = json!(image);
            value["occurredAt"] = json!("invalid timestamp");
            let activity = serde_json::from_value(value).unwrap();
            let message =
                serde_json::to_value(event_message(&activity, &frontend, None).await).unwrap();
            let header = &message["components"][0]["components"][0];
            assert_eq!(header["type"], 10);
            assert!(
                header["content"]
                    .as_str()
                    .unwrap()
                    .contains("invalid timestamp")
            );
        }
    }
}

#[tokio::test]
async fn level_events_resolve_stored_thumbnail_keys() {
    let frontend = "https://zeepki.st".parse().unwrap();
    for kind in ["workshop", "world_record"] {
        let mut value = event(1, kind);
        value["level"]["levelItems"]["nodes"][0]["imageUrl"] = json!("thumbnails/track.jpg");
        let activity = serde_json::from_value(value).unwrap();
        let message =
            serde_json::to_value(event_message(&activity, &frontend, None).await).unwrap();
        let header = &message["components"][0]["components"][0];
        assert_eq!(
            header["accessory"]["media"]["url"],
            "https://cdn.zeepki.st/thumbnails/track.jpg"
        );
        assert!(
            header["components"][0]["content"]
                .as_str()
                .unwrap()
                .contains("Event 1")
        );
    }
}

#[tokio::test]
async fn activity_footer_formats_reported_timestamp_with_optional_whitespace() {
    let frontend = "https://zeepki.st".parse().unwrap();
    for kind in ["workshop", "world_record"] {
        for timestamp in ["2026-10-02T13:55:36.700Z", " 2026-10-02T13:55:36.700Z\n"] {
            let mut value = event(1, kind);
            value["occurredAt"] = json!(timestamp);
            let activity = serde_json::from_value(value).unwrap();
            let message =
                serde_json::to_value(event_message(&activity, &frontend, None).await).unwrap();
            let text = message["components"][0]["components"][0]["components"][0]["content"]
                .as_str()
                .unwrap();
            assert!(text.contains("ZeepCentraal • <t:1790949336:R>"), "{text}");
            assert!(!text.contains("2026-10-02"));
        }
    }
}

#[tokio::test]
async fn activity_buttons_link_world_record_player_and_workshop_author() {
    let frontend = "https://zeepki.st".parse().unwrap();
    for (kind, steam_id) in [
        ("world_record", "76561198000000001"),
        ("workshop", "76561198000000002"),
    ] {
        let mut value = event(1, kind);
        value["user"]["steamId"] = json!("76561198000000001");
        value["level"]["levelItems"]["nodes"][0]["author"] =
            json!({"id":2,"steamId":"76561198000000002","steamName":"Level author"});
        if kind == "workshop" {
            value["user"] = Value::Null;
        }
        let activity = serde_json::from_value(value).unwrap();
        let message =
            serde_json::to_value(event_message(&activity, &frontend, None).await).unwrap();
        let buttons = &message["components"][0]["components"][1]["components"];
        assert_eq!(buttons[0]["label"], "Open level");
        assert_eq!(buttons[1]["label"], "View player");
        assert_eq!(
            buttons[1]["url"],
            format!("https://zeepki.st/user/{steam_id}")
        );
    }
}

#[tokio::test]
async fn sent_activity_messages_have_thumbnail_relative_timestamp_and_player_link() {
    for (kind, steam_id) in [
        ("world_record", "76561198000000001"),
        ("workshop", "76561198000000002"),
    ] {
        let mut value = event(1, kind);
        value["occurredAt"] = json!("2026-10-02T13:55:36.700Z");
        value["user"]["steamId"] = json!("76561198000000001");
        value["level"]["levelItems"]["nodes"][0]["imageUrl"] =
            json!("https://cdn.zeepki.st/thumbnails/fixture.jpg");
        value["level"]["levelItems"]["nodes"][0]["author"] =
            json!({"id":2,"steamId":"76561198000000002","steamName":"Level author"});
        let harness = Harness::new(State {
            feeds: vec![feed(1, kind, 20, 0)],
            events: vec![value],
            ..State::default()
        })
        .await;
        harness.poll().await;
        let state = harness.state.lock().unwrap();
        assert_eq!(state.sent.len(), 1);
        let message = &state.sent[0].2;
        let components = &message["components"][0]["components"];
        let header = &components[0];
        assert_eq!(header["type"], 9);
        assert_eq!(
            header["accessory"]["media"]["url"],
            "https://cdn.zeepki.st/thumbnails/fixture.jpg"
        );
        assert!(
            header["components"][0]["content"]
                .as_str()
                .unwrap()
                .contains("ZeepCentraal • <t:1790949336:R>")
        );
        assert_eq!(components[1]["components"][1]["label"], "View player");
        assert_eq!(
            components[1]["components"][1]["url"],
            format!("https://zeepki.st/user/{steam_id}")
        );
    }
}

#[tokio::test]
async fn activity_buttons_omit_missing_or_invalid_player_ids() {
    let frontend = "https://zeepki.st".parse().unwrap();
    for kind in ["workshop", "world_record"] {
        for steam_id in [Value::Null, json!(""), json!("0"), json!("invalid")] {
            let mut value = event(1, kind);
            value["user"]["steamId"] = steam_id.clone();
            value["level"]["levelItems"]["nodes"][0]["author"] = json!({"id":2,"steamId":steam_id});
            let activity = serde_json::from_value(value).unwrap();
            let message =
                serde_json::to_value(event_message(&activity, &frontend, None).await).unwrap();
            let buttons = message["components"][0]["components"][1]["components"]
                .as_array()
                .unwrap();
            assert_eq!(buttons.len(), 1);
            assert_eq!(buttons[0]["label"], "Open level");
        }
    }
}

#[tokio::test]
async fn rank_flush_failure_does_not_stall_other_feeds() {
    let harness = Harness::new(State {
        feeds: vec![feed(1, "world_record", 20, 0)],
        events: vec![event(1, "world_record")],
        fail_rank_flush: true,
        ..State::default()
    })
    .await;
    harness.poll().await;
    assert_eq!(harness.cursor("1", "world_record"), 1);
    let state = harness.state.lock().unwrap();
    assert_eq!(state.flushes, 1);
    assert_eq!(state.sent.len(), 1);
}

#[tokio::test]
async fn world_record_thumbnail_preserves_context_and_opt_in_loss_pings() {
    let frontend = "https://zeepki.st".parse().unwrap();
    let mut value = event(1, "world_record");
    value["previousUserId"] = json!(2);
    value["previousUser"] = json!({"id":2,"steamName":"Previous player","discordId":"456"});
    value["previousRecord"] = json!({"time":55.0});
    let mut activity: ActivityEvent = serde_json::from_value(value).unwrap();
    for enabled in [false, true] {
        let harness = Harness::new(State {
            ping_world_record_loss: enabled,
            ..State::default()
        })
        .await;
        let message =
            serde_json::to_value(event_message(&activity, &frontend, Some(&harness.backend)).await)
                .unwrap();
        let text = message["components"][0]["components"][0]["components"][0]["content"]
            .as_str()
            .unwrap();
        assert!(text.contains("Stolen from Previous player (00:55.000)"));
        assert_eq!(
            text.contains("<@456> your world record was beaten."),
            enabled
        );
        let mentions = message["allowed_mentions"]["users"].as_array().unwrap();
        assert_eq!(mentions.len(), usize::from(enabled));
        if enabled {
            assert_eq!(mentions[0], "456");
        }
        let direct = serde_json::to_value(event_message(&activity, &frontend, None).await).unwrap();
        assert!(
            direct["allowed_mentions"]["users"]
                .as_array()
                .unwrap()
                .is_empty()
        );
    }
    activity.previous_user_id = activity.user_id;
    let message = serde_json::to_value(event_message(&activity, &frontend, None).await).unwrap();
    assert!(
        message["components"][0]["components"][0]["components"][0]["content"]
            .as_str()
            .unwrap()
            .contains("Improved by 5.668s")
    );
}

struct Harness {
    state: Arc<Mutex<State>>,
    backend: Backend,
    http: Http,
    server: JoinHandle<()>,
}

impl Drop for Harness {
    fn drop(&mut self) {
        self.server.abort();
    }
}

impl Harness {
    async fn new(state: State) -> Self {
        let state = Arc::new(Mutex::new(state));
        let captured = state.clone();
        let app = Router::new().fallback(move |request: Request| {
            let captured = captured.clone();
            async move {
                let path = request.uri().path().to_owned();
                let query = request.uri().query().unwrap_or_default().to_owned();
                let method = request.method().clone();
                let bytes = to_bytes(request.into_body(), 64 * 1024).await.unwrap();
                let body = if bytes.is_empty() {
                    Value::Null
                } else {
                    serde_json::from_slice(&bytes).unwrap()
                };
                let mut state = captured.lock().unwrap();
                respond(&mut state, &path, &query, &method, body)
            }
        });
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let url = format!("http://{address}");
        let server = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        let backend = Backend::new(url.parse().unwrap(), "fake-test-token".into()).unwrap();
        let http = HttpBuilder::without_token()
            .proxy(url)
            .ratelimiter_disabled(true)
            .build();
        Self {
            state,
            backend,
            http,
            server,
        }
    }

    async fn poll(&self) {
        poll_activity(
            &self.http,
            &self.backend,
            &"https://zeepki.st".parse().unwrap(),
        )
        .await
        .unwrap();
    }

    fn cursor(&self, guild: &str, kind: &str) -> i64 {
        self.state
            .lock()
            .unwrap()
            .feeds
            .iter()
            .find(|feed| feed["guildId"] == guild && feed["kind"] == kind)
            .unwrap()["cursorEventId"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap()
    }
}

fn respond(
    state: &mut State,
    path: &str,
    query: &str,
    method: &Method,
    body: Value,
) -> (StatusCode, Json<Value>) {
    let parts = path.trim_matches('/').split('/').collect::<Vec<_>>();
    let fail = || {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"code":0,"message":"fixture failure"})),
        )
    };
    let value = if path == "/discord-bot/rank-batches/flush" {
        assert_eq!(method, Method::POST);
        assert!(body.is_null());
        state.flushes += 1;
        if state.fail_rank_flush {
            return fail();
        }
        json!({"emittedBatches":0})
    } else if path == "/discord-bot/guild-feeds/enabled" {
        json!(state.feeds)
    } else if path == "/discord-bot/workers/watch-events/cursor" {
        if method == Method::POST {
            let id = body["eventId"].as_str().unwrap().parse::<i64>().unwrap();
            if state.fail_cursors.contains(&("watch-events".into(), id)) {
                return fail();
            }
            state.worker = state.worker.max(id);
        }
        json!({"cursorEventId":state.worker.to_string()})
    } else if path == "/discord-bot/activity-events" {
        let params = reqwest::Url::parse(&format!("http://fixture/?{query}")).unwrap();
        let after = params
            .query_pairs()
            .find(|(key, _)| key == "after")
            .unwrap()
            .1
            .parse::<i64>()
            .unwrap();
        assert_eq!(
            params
                .query_pairs()
                .find(|(key, _)| key == "limit")
                .unwrap()
                .1,
            "500"
        );
        state.queries.push(after);
        json!(
            state
                .events
                .iter()
                .filter(|event| event["id"].as_str().unwrap().parse::<i64>().unwrap() > after)
                .take(500)
                .collect::<Vec<_>>()
        )
    } else if path == "/discord-bot/watches/matches" {
        if state.fail_watch_lookup {
            return fail();
        }
        let targets = body["targets"].as_array().unwrap();
        assert!(targets.len() <= 4);
        let mut players = BTreeSet::new();
        for target in targets {
            let ids = target["targetIds"].as_array().unwrap();
            assert!(ids.len() <= 50);
            for id in ids {
                let id = id.as_str().unwrap();
                assert!(!id.is_empty() && id.len() <= 128);
                if target["kind"] == "player"
                    && let Ok(id) = id.parse::<i64>()
                {
                    players.insert(id);
                }
            }
        }
        state.watch_requests.push(body);
        let mut watches = state
            .player_watches
            .iter()
            .filter(|(_, player, _)| players.contains(player))
            .map(|(id, _, owner)| json!({"id":id.to_string(),"discordId":owner.to_string(),"lastDeliveryKey":state.watch_keys.get(id)}))
            .collect::<Vec<_>>();
        watches.extend(players.intersection(&state.watched).map(|id| json!({"id":id.to_string(),"discordId":"123","lastDeliveryKey":state.watch_keys.get(id)})));
        json!(watches)
    } else if path == "/discord-bot/users/lookup" {
        if state.fail_user_lookup {
            return fail();
        }
        let ids = body["userIds"]
            .as_array()
            .unwrap()
            .iter()
            .map(|id| i32::try_from(id.as_i64().unwrap()).unwrap())
            .collect::<Vec<_>>();
        state.lookups.push(ids.clone());
        json!(ids.iter().map(|id|json!({"id":id,"steamName":format!("Event {id}"),"discordId":null,"points":123000})).collect::<Vec<_>>())
    } else if path == "/discord-bot/users/456" {
        json!({"linkedUser":null,"preference":{"pingOnWorldRecordLoss":state.ping_world_record_loss},"watches":[]})
    } else if parts.starts_with(&["discord-bot", "watches"]) && parts.last() == Some(&"delivery") {
        let id = parts[2].parse().unwrap();
        if let Some(key) = body["deliveryKey"].as_str() {
            state.watch_keys.insert(id, key.into());
        }
        json!({})
    } else if parts.starts_with(&["discord-bot", "guilds"]) && parts.get(3) == Some(&"deliveries") {
        let key = (parts[2].into(), parts[4].into());
        if method == Method::PUT {
            state
                .deliveries
                .insert(key.clone(), body["status"].as_str().unwrap().into());
        }
        state
            .deliveries
            .get(&key)
            .map_or(Value::Null, |status| json!({"status":status}))
    } else if parts.starts_with(&["discord-bot", "guilds"]) && parts.last() == Some(&"cursor") {
        let id = body["eventId"].as_str().unwrap().parse::<i64>().unwrap();
        if state
            .fail_cursors
            .contains(&(format!("{}/{}", parts[2], parts[4]), id))
        {
            return fail();
        }
        let feed = state
            .feeds
            .iter_mut()
            .find(|feed| feed["guildId"] == parts[2] && feed["kind"] == parts[4])
            .unwrap();
        let previous = feed["cursorEventId"]
            .as_str()
            .unwrap()
            .parse::<i64>()
            .unwrap();
        feed["cursorEventId"] = json!(previous.max(id).to_string());
        feed.clone()
    } else if path.ends_with("/users/@me/channels") {
        let recipient = body["recipient_id"]
            .as_str()
            .unwrap()
            .parse::<u64>()
            .unwrap();
        state.dm_recipients.push(recipient);
        let channel = state.dm_channels.get(&recipient).copied().unwrap_or(900);
        json!({"id":channel.to_string(),"type":1,"recipients":[{"id":recipient.to_string(),"username":"fixture","discriminator":"0","avatar":null}]})
    } else if path.ends_with("/messages") {
        let index = parts.iter().position(|part| *part == "channels").unwrap();
        let channel = parts[index + 1].parse::<u64>().unwrap();
        let content = body.to_string();
        let id = content
            .split("Event ")
            .nth(1)
            .unwrap()
            .chars()
            .take_while(char::is_ascii_digit)
            .collect::<String>()
            .parse::<i64>()
            .unwrap();
        state.attempts.push((channel, id));
        if state.fail_sends.contains(&(channel, id)) {
            return fail();
        }
        state.sent.push((channel, id, body));
        json!({"id":"123456789012345678","channel_id":channel.to_string(),
            "author":{"id":"999","username":"fixture","discriminator":"0","avatar":null},
            "content":"","timestamp":"2026-10-05T06:00:00Z","edited_timestamp":null,
            "tts":false,"mention_everyone":false,"mentions":[],"mention_roles":[],
            "attachments":[],"embeds":[],"pinned":false,"type":0})
    } else {
        panic!("Unexpected fixture request: {method} {path}: {body}");
    };
    (StatusCode::OK, Json(value))
}

#[tokio::test]
async fn player_watches_dm_owners_once_for_records_and_ranks_without_guild_feeds() {
    for kind in ["personal_best", "world_record", "rank_batch"] {
        let mut value = event(1, kind);
        if kind == "rank_batch" {
            value["payload"]["changes"] = json!([
                {"idUser":1,"previousRank":3,"rank":1},
                {"idUser":2,"previousRank":4,"rank":2}
            ]);
        } else {
            value["user"]["discordId"] = json!("456");
            value["user"]["steamName"] = json!("123"); // Numeric name is not another player ID.
            value["level"]["levelItems"]["nodes"][0]["name"] =
                json!(format!("Event 1 {}", "🦀".repeat(40)));
            if kind == "world_record" {
                value["previousUserId"] = json!(2);
                value["previousUser"] =
                    json!({"id":2,"steamName":"Previous player","discordId":"789"});
                value["previousRecord"] = json!({"time":55.0});
            }
        }
        let harness = Harness::new(State {
            events: vec![value],
            player_watches: vec![(11, 1, 123), (12, 1, 123), (13, 2, 321)],
            dm_channels: BTreeMap::from([(321, 901)]),
            ..State::default()
        })
        .await;
        harness.poll().await;
        harness.poll().await;
        let state = harness.state.lock().unwrap();
        let previous_matches = kind != "personal_best";
        assert_eq!(state.worker, 1);
        assert_eq!(state.sent.len(), if previous_matches { 2 } else { 1 });
        assert_eq!(
            state.dm_recipients,
            if previous_matches {
                vec![123, 321]
            } else {
                vec![123]
            }
        );
        assert_eq!(state.watch_keys.get(&11).unwrap(), "event:1");
        assert_eq!(state.watch_keys.get(&12).unwrap(), "event:1");
        assert_eq!(state.watch_keys.contains_key(&13), previous_matches);
        let players = state
            .watch_requests
            .iter()
            .flat_map(|request| request["targets"].as_array().unwrap())
            .filter(|target| target["kind"] == "player")
            .collect::<Vec<_>>();
        assert_eq!(players.len(), 1);
        assert!(
            !players[0]["targetIds"]
                .as_array()
                .unwrap()
                .contains(&json!("123"))
        );
    }
}

#[tokio::test]
async fn owner_dm_failure_retries_without_repeating_another_owners_success() {
    let harness = Harness::new(State {
        events: vec![event(1, "personal_best")],
        player_watches: vec![(11, 1, 123), (12, 1, 321)],
        dm_channels: BTreeMap::from([(321, 901)]),
        fail_sends: BTreeSet::from([(901, 1)]),
        ..State::default()
    })
    .await;
    harness.poll().await;
    {
        let mut state = harness.state.lock().unwrap();
        assert_eq!(state.worker, 0);
        assert_eq!(state.sent.len(), 1);
        assert_eq!(state.watch_keys.get(&11).unwrap(), "event:1");
        assert!(!state.watch_keys.contains_key(&12));
        state.fail_sends.clear();
    }
    harness.poll().await;
    let state = harness.state.lock().unwrap();
    assert_eq!(state.worker, 1);
    assert_eq!(state.sent.len(), 2);
    assert_eq!(state.dm_recipients, vec![123, 321, 321]);
    assert_eq!(state.watch_keys.get(&12).unwrap(), "event:1");
}

#[tokio::test]
async fn watch_target_requests_are_bounded_and_returned_watches_are_deduplicated() {
    let harness = Harness::new(State {
        player_watches: vec![(11, 1, 123), (11, 99, 123), (12, 101, 321)],
        ..State::default()
    })
    .await;
    let mut ids = (1..=101).map(|id| id.to_string()).collect::<Vec<_>>();
    ids.extend([" 1 ".into(), "".into(), " ".into(), "🦀".repeat(33)]);
    let watches = harness
        .backend
        .matching_watch_targets(json!([
            {"kind":"player","targetIds":ids},
            {"kind":"player","targetIds":["51"]}
        ]))
        .await
        .unwrap();
    assert_eq!(
        watches
            .iter()
            .map(|watch| watch.id.as_str())
            .collect::<Vec<_>>(),
        vec!["11", "12"]
    );
    let state = harness.state.lock().unwrap();
    assert_eq!(state.watch_requests.len(), 3);
    assert_eq!(
        state
            .watch_requests
            .iter()
            .map(|request| request["targets"][0]["targetIds"].as_array().unwrap().len())
            .sum::<usize>(),
        101
    );
}

#[tokio::test]
async fn drains_pages_with_tournaments_quiet_feeds_and_shared_rank_rendering() {
    let mut state = State {
        worker: 500,
        feeds: vec![
            feed(1, "totw", 10, 0),
            feed(1, "totm", 11, 0),
            feed(1, "world_record", 20, 0),
            feed(1, "workshop", 21, 0),
            feed(1, "rank", 22, 0),
            feed(2, "rank", 23, 500),
        ],
        ..State::default()
    };
    state.events = (1..=505)
        .map(|id| {
            event(
                id,
                match id {
                    501 => "world_record",
                    502 => "workshop",
                    503 => "rank_batch",
                    504 => "world_record",
                    505 => "workshop",
                    _ => "vote",
                },
            )
        })
        .collect();
    state.watched.extend([501, 502, 503, 504, 505]);
    let harness = Harness::new(state).await;
    harness.poll().await;
    assert_eq!(harness.cursor("1", "world_record"), 500);
    assert_eq!(harness.cursor("1", "totw"), 0);
    // Another consumer's newer page remains reachable despite older feed cursors.
    assert_eq!(harness.cursor("2", "rank"), 505);
    harness.poll().await;
    for kind in ["world_record", "workshop", "rank"] {
        assert_eq!(harness.cursor("1", kind), 505);
    }
    let state = harness.state.lock().unwrap();
    for (channel, expected) in [
        (20, vec![501, 504]),
        (21, vec![502, 505]),
        (22, vec![503]),
        (23, vec![503]),
        (900, vec![501, 502, 503, 504, 505]),
    ] {
        let delivered = state
            .sent
            .iter()
            .filter(|(target, _, _)| *target == channel)
            .map(|(_, id, _)| *id)
            .collect::<Vec<_>>();
        assert_eq!(delivered, expected, "channel {channel}");
    }
    let ranks = state
        .sent
        .iter()
        .filter(|(_, id, _)| *id == 503)
        .map(|(_, _, message)| message)
        .collect::<Vec<_>>();
    assert!(ranks.iter().all(|message| *message == ranks[0]));
    assert_eq!(state.lookups, vec![vec![503], vec![503]]); // Once per poll, across all consumers.
    assert!(state.queries.contains(&500));
}

#[tokio::test]
async fn failed_sends_preserve_order_and_retry_without_duplicates() {
    let mut state = State {
        feeds: vec![
            feed(1, "world_record", 20, 0),
            feed(2, "world_record", 21, 500),
        ],
        events: (1..=503)
            .map(|id| event(id, if id >= 501 { "world_record" } else { "vote" }))
            .collect(),
        ..State::default()
    };
    state.fail_sends.insert((20, 501));
    let harness = Harness::new(state).await;
    harness.poll().await;
    harness.poll().await;
    assert_eq!(harness.cursor("1", "world_record"), 500);
    assert_eq!(harness.cursor("2", "world_record"), 503);
    assert!(!harness.state.lock().unwrap().attempts.contains(&(20, 502)));
    harness.state.lock().unwrap().fail_sends.clear();
    harness.poll().await;
    harness.poll().await;
    let state = harness.state.lock().unwrap();
    for channel in [20, 21] {
        assert_eq!(
            state
                .sent
                .iter()
                .filter(|(target, _, _)| *target == channel)
                .map(|(_, id, _)| *id)
                .collect::<Vec<_>>(),
            vec![501, 502, 503]
        );
    }
}

#[tokio::test]
async fn cursor_write_failures_stop_only_affected_consumer_and_sent_ledger_prevents_replay() {
    let mut state = State {
        feeds: vec![
            feed(1, "world_record", 20, 0),
            feed(2, "world_record", 21, 0),
        ],
        events: vec![event(1, "world_record"), event(2, "world_record")],
        ..State::default()
    };
    state.watched.extend([1, 2]);
    state.fail_cursors.insert(("1/world_record".into(), 1));
    state.fail_cursors.insert(("watch-events".into(), 1));
    let harness = Harness::new(state).await;
    harness.poll().await;
    assert_eq!(harness.state.lock().unwrap().worker, 0);
    assert_eq!(harness.cursor("1", "world_record"), 0);
    assert!(
        !harness
            .state
            .lock()
            .unwrap()
            .attempts
            .iter()
            .any(|(channel, id)| matches!(channel, 20 | 900) && *id == 2)
    );
    harness.state.lock().unwrap().fail_cursors.clear();
    harness.poll().await;
    let state = harness.state.lock().unwrap();
    assert_eq!(state.worker, 2);
    for channel in [20, 21, 900] {
        assert_eq!(
            state
                .sent
                .iter()
                .filter(|(target, _, _)| *target == channel)
                .map(|(_, id, _)| *id)
                .collect::<Vec<_>>(),
            vec![1, 2]
        );
    }
}

#[tokio::test]
async fn watch_failure_does_not_block_feeds_and_saved_deliveries_are_skipped() {
    let mut state = State {
        feeds: vec![feed(1, "workshop", 20, 0)],
        events: vec![event(1, "workshop"), event(2, "workshop")],
        fail_watch_lookup: true,
        ..State::default()
    };
    state
        .deliveries
        .insert(("1".into(), "1".into()), "sent".into());
    let harness = Harness::new(state).await;
    harness.poll().await;
    assert_eq!(harness.cursor("1", "workshop"), 2);
    let state = harness.state.lock().unwrap();
    assert_eq!(state.worker, 0);
    assert_eq!(
        state.sent.iter().map(|(_, id, _)| *id).collect::<Vec<_>>(),
        vec![2]
    );
}

#[tokio::test]
async fn watch_sends_remain_ordered_across_pages_and_dm_failure_keeps_cursor() {
    let mut state = State {
        events: (1..=501)
            .map(|id| {
                event(
                    id,
                    match id {
                        499 => "personal_best",
                        500 => "workshop",
                        501 => "world_record",
                        _ => "vote",
                    },
                )
            })
            .collect(),
        ..State::default()
    };
    state.watched.extend([499, 500, 501]);
    state.fail_sends.insert((900, 499));
    let harness = Harness::new(state).await;
    harness.poll().await;
    assert_eq!(harness.state.lock().unwrap().worker, 498);
    assert!(!harness.state.lock().unwrap().attempts.contains(&(900, 500)));
    harness.state.lock().unwrap().fail_sends.clear();
    harness.poll().await;
    harness.poll().await;
    let state = harness.state.lock().unwrap();
    assert_eq!(state.worker, 501);
    assert_eq!(
        state.sent.iter().map(|(_, id, _)| *id).collect::<Vec<_>>(),
        vec![499, 500, 501]
    );
}

#[tokio::test]
async fn invalid_rank_batches_are_suppressed_and_lookup_errors_retry_without_stalling_other_feeds()
{
    let mut invalid = event(1, "rank_batch");
    invalid["payload"] = json!({"changes":[{"idUser":1,"previousRank":2,"rank":2}]});
    let state = State {
        feeds: vec![feed(1, "rank", 20, 0), feed(1, "world_record", 21, 0)],
        events: vec![invalid, event(2, "rank_batch"), event(3, "world_record")],
        fail_user_lookup: true,
        ..State::default()
    };
    let harness = Harness::new(state).await;
    harness.poll().await;
    assert_eq!(harness.cursor("1", "rank"), 1);
    assert_eq!(harness.cursor("1", "world_record"), 3);
    assert_eq!(
        harness
            .state
            .lock()
            .unwrap()
            .sent
            .iter()
            .map(|(_, id, _)| *id)
            .collect::<Vec<_>>(),
        vec![3]
    );
    harness.state.lock().unwrap().fail_user_lookup = false;
    harness.poll().await;
    assert_eq!(harness.cursor("1", "rank"), 3);
    assert_eq!(
        harness
            .state
            .lock()
            .unwrap()
            .sent
            .iter()
            .map(|(_, id, _)| *id)
            .collect::<Vec<_>>(),
        vec![3, 2]
    );
}
