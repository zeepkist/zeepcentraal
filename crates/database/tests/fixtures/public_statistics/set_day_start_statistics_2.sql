UPDATE public.statistics SET day_start=(day_start AT TIME ZONE 'Europe/London'-interval '1 day') AT TIME ZONE 'Europe/London',records=81
