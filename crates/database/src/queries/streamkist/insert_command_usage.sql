INSERT INTO streamkist.command_usage(command_name,usage_count) VALUES($1,1) ON CONFLICT(command_name) DO UPDATE SET usage_count=streamkist.command_usage.usage_count+1,last_used=now()
