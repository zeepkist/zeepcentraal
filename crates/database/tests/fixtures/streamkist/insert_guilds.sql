INSERT INTO streamkist.guilds(guild_id) VALUES('1'),('2');
         INSERT INTO streamkist.twitch_categories(game_id,name) VALUES('9','Game'),('8','Other'),('7','Old');
         INSERT INTO streamkist.channels(guild_id,channel_id,game_id) VALUES('1','10','9'),('1','11','8'),('2','20','9');
         INSERT INTO streamkist.streams(watch_id,policy_watch_id,guild_id,channel_id,stream_id,user_id,snapshot,is_live,tracking_state)
             SELECT id,id,guild_id,channel_id,'first','user-1','{}',false,'finished' FROM streamkist.channels;
         INSERT INTO streamkist.streams(watch_id,policy_watch_id,guild_id,channel_id,stream_id,user_id,snapshot)
             SELECT id,id,guild_id,channel_id,'second','user-1','{}' FROM streamkist.channels WHERE channel_id='11';
         INSERT INTO streamkist.streams(watch_id,policy_watch_id,guild_id,channel_id,stream_id,user_id,snapshot)
             SELECT id,id,guild_id,channel_id,'third','user-2','{}' FROM streamkist.channels WHERE channel_id='20';
