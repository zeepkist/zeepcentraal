{{prefix}} SELECT id_level AS id FROM eligible CROSS JOIN threshold
         WHERE eligible.points >= threshold.points ORDER BY id_level
