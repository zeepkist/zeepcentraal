# Steam client patch

Source: [`steam-client-rs` 0.2.0](https://github.com/lengoclongk59/steam-client-rs/tree/v0.2.0), MIT license in `LICENSE`.

The published client waits on a tracked request's response channel without
reading its connection. The response channel is completed only by
`SteamClient::poll_event`, so `create_encrypted_app_ticket` cannot finish.

`src/client/steam_client.rs` now polls the connection while waiting for a
tracked protobuf response. Other events remain available to the caller in
their original order and are not processed twice. A disconnected connection
returns `NotConnected` instead of waiting for a response that cannot arrive.

The crate remains version 0.2.0 and is patched locally in the root Cargo
manifest. Remove this vendor copy once an upstream release fixes the request
polling path and the lobby collector passes the same mock tests.
