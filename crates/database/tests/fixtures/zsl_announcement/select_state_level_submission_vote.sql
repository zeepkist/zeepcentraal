SELECT c.state,c.current_playlist_id,c.archive_sha256,(SELECT count(*) FROM zc_private.level_submission_vote WHERE id_contest=c.id) FROM zc_private.level_submission_contest c WHERE id=9000
