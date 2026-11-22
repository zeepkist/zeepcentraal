SELECT {{message_columns}} FROM streamkist.streams WHERE canonical AND tracking_state='finished' AND stream_id=ANY($1)
