UPDATE public.statistics SET day_start=date_trunc('day',statement_timestamp(),'Europe/London'),month_start=date_trunc('month',statement_timestamp(),'Europe/London')
