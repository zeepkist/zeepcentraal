use super::*;
use axum::{Json, Router, body::to_bytes, extract::Request, http::StatusCode};
use serde_json::{Value, json};
use serenity::http::HttpBuilder;
use std::sync::Mutex;

#[derive(Default)]
struct State {
    entries: i32,
    fail_edit: bool,
    messages: Vec<Value>,
    sends: Vec<(String, String, Value)>,
}

#[tokio::test]
async fn daily_feed_isolated_persisted_updated_and_retried() {
    let state = Arc::new(Mutex::new(State::default()));
    let captured = state.clone();
    let app = Router::new().fallback(move |request: Request| {
        let captured = captured.clone();
        async move {
            let path = request.uri().path().to_owned();
            let method = request.method().to_string();
            let bytes = to_bytes(request.into_body(), 64 * 1024).await.unwrap();
            let body: Value = if bytes.is_empty() { Value::Null } else { serde_json::from_slice(&bytes).unwrap() };
            let mut state = captured.lock().unwrap();
            let value = match path.as_str() {
                "/discord-bot/guild-feeds/enabled" => json!([
                    {"guildId":"1","kind":"totd","channelId":"10","enabled":true,"cursorEventId":"0"},
                    {"guildId":"1","kind":"totw","channelId":"11","enabled":true,"cursorEventId":"0"},
                    {"guildId":"1","kind":"totd","channelId":"12","enabled":false,"cursorEventId":"0"}
                ]),
                "/discord-bot/tournaments/current" => json!([{
                    "tournamentId":42,"tournamentType":2,"tournamentSlug":"2026-11-11",
                    "endAt":"2026-11-12T06:00:00Z","levelName":"Daily track","imageUrl":null,
                    "entries":state.entries,"standings":[]
                }]),
                "/discord-bot/watches/matches" => json!([]),
                "/discord-bot/guilds/1" => json!({"tournamentMessages":state.messages}),
                "/discord-bot/guilds/1/tournaments/42/message" => {
                    state.messages = vec![json!({"idTournament":42,"channelId":body["channelId"],"messageId":body["messageId"],"contentHash":body["contentHash"]})];
                    json!({})
                }
                "/api/v10/channels/10/messages" | "/api/v10/channels/10/messages/123" => {
                    if method == "PATCH" && state.fail_edit {
                        state.fail_edit = false;
                        return (StatusCode::FORBIDDEN, Json(json!({"code":50013,"message":"Missing Permissions"})));
                    }
                    state.sends.push((method,path,body));
                    json!({"id":"123","channel_id":"10","author":{"id":"999","username":"fixture","discriminator":"0","avatar":null},"content":"","timestamp":"2026-11-11T06:00:00Z","edited_timestamp":null,"tts":false,"mention_everyone":false,"mentions":[],"mention_roles":[],"attachments":[],"embeds":[],"pinned":false,"type":0})
                }
                _ => panic!("Unexpected fixture request: {method} {path}"),
            };
            (StatusCode::OK, Json(value))
        }
    });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let server = tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    let backend = Backend::new(url.parse().unwrap(), "fake-test-token".into()).unwrap();
    let http = HttpBuilder::without_token()
        .proxy(url)
        .ratelimiter_disabled(true)
        .build();
    let frontend = "https://zeepki.st".parse().unwrap();
    poll_tournaments(&http, &backend, &frontend).await.unwrap();
    poll_tournaments(&http, &backend, &frontend).await.unwrap();
    {
        let state = state.lock().unwrap();
        assert_eq!(state.sends.len(), 1, "unchanged event is sent only once");
        assert_eq!(state.sends[0].0, "POST");
        assert!(
            state.sends[0]
                .2
                .to_string()
                .contains("https://zeepki.st/totd/2026-11-11")
        );
        assert_eq!(state.messages[0]["messageId"], "123");
    }
    {
        let mut state = state.lock().unwrap();
        state.entries = 1;
        state.fail_edit = true;
    }
    poll_tournaments(&http, &backend, &frontend).await.unwrap();
    assert_eq!(
        state.lock().unwrap().sends.len(),
        1,
        "failed edit keeps previous state"
    );
    poll_tournaments(&http, &backend, &frontend).await.unwrap();
    poll_tournaments(&http, &backend, &frontend).await.unwrap();
    {
        let state = state.lock().unwrap();
        assert_eq!(
            state.sends.len(),
            2,
            "changed event updates existing message once"
        );
        assert_eq!(state.sends[1].0, "PATCH");
        assert_eq!(state.messages[0]["messageId"], "123");
    }
    server.abort();
}
