SELECT EXISTS(SELECT 1 FROM zc_jobs.job WHERE lane=$1 AND id=$2::bigint AND generation=$3::bigint AND running AND lease_until>clock_timestamp()) AS ok
