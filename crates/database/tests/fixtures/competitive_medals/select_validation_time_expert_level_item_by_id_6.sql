SELECT validation_time_expert>$1 AND medal_calculated_at IS NOT NULL AND medal_due_at IS NULL AND medal_calculation_version=1 FROM public.level_item WHERE id=6
