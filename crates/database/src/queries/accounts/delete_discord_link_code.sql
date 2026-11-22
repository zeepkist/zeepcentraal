DELETE FROM zc_private.discord_link_code WHERE id_user=$1 OR expires_at<clock_timestamp()
