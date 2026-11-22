INSERT INTO streamkist.twitch_categories(game_id,name) VALUES($1,$2) ON CONFLICT(game_id) DO UPDATE SET name=EXCLUDED.name,updated_at=now()
