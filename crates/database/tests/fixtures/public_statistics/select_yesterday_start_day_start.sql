SELECT yesterday_start=$2::text::timestamptz,
          last_month_start=$3::text::timestamptz,
          extract(epoch FROM day_start-yesterday_start)::bigint/3600=$4::bigint
          FROM zc_private.compute_global_metrics($1::text::timestamptz)
