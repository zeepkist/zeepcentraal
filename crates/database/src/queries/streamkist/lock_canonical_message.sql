SELECT {{message_columns}} FROM streamkist.streams WHERE guild_id=$1 AND channel_id=$2 AND stream_id=$3 AND canonical FOR UPDATE
