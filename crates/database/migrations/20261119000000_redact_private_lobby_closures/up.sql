UPDATE public.lobby_history
SET room_name = 'Private room'
WHERE change_type = 'closed'
  AND NOT is_public
  AND room_name <> 'Private room';

-- Removed packets set both timestamps. List reconciliation only sets closed_at.
UPDATE public.lobby
SET room_name = 'Private room'
WHERE NOT is_public
  AND last_seen = closed_at
  AND room_name <> 'Private room';
