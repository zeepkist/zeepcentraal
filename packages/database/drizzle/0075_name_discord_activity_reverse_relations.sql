COMMENT ON CONSTRAINT "discord_activity_event_user_fkey" ON public.discord_activity_event IS E'@fieldName user\n@foreignFieldName discordActivityEvents';--> statement-breakpoint
COMMENT ON CONSTRAINT "discord_activity_event_previous_user_fkey" ON public.discord_activity_event IS E'@fieldName previousUser\n@foreignFieldName discordActivityEventsAsPreviousUser';--> statement-breakpoint
COMMENT ON CONSTRAINT "discord_activity_event_record_fkey" ON public.discord_activity_event IS E'@fieldName record\n@foreignFieldName discordActivityEvents';--> statement-breakpoint
COMMENT ON CONSTRAINT "discord_activity_event_previous_record_fkey" ON public.discord_activity_event IS E'@fieldName previousRecord\n@foreignFieldName discordActivityEventsAsPreviousRecord';
