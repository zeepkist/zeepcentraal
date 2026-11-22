SELECT zc_private.refresh_global_metrics();
      UPDATE public.statistics SET records_yesterday=71,records_last_month=72,
       as_of=statement_timestamp()-interval '10 minutes',records=-1;
