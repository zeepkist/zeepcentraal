SELECT EXISTS(SELECT 1 FROM zc_jobs.job WHERE lane='bulk' AND id=$1 AND generation=$2 AND running AND lease_until>clock_timestamp()) AS ok
