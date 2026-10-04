DROP FUNCTION public.similar_levels(text, integer);
DROP INDEX public."IX_level_missing_simhash";
DROP INDEX public."IX_level_public_simhash";
ALTER TABLE public.level DROP COLUMN simhash;
