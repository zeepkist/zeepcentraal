UPDATE zc_jobs.job SET payload=$4 WHERE lane=$1 AND id=$2::bigint AND generation=$3::bigint AND running AND lease_until>clock_timestamp()
