SELECT is_live,snapshot->>'ended_at',snapshot ? 'category_stopped' FROM streamkist.streams WHERE message_id='9001'
