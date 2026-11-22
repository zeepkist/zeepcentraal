SELECT next_inspection_at>now()+interval '50 seconds' AND next_inspection_at<=now()+interval '60 seconds' FROM zc_private.level_submissions WHERE id=$1
