DELETE FROM zc_private.discord_oauth_link_state WHERE id_user=$1 OR expires_at<clock_timestamp()
