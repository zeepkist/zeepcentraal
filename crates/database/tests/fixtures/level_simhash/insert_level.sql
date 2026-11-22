INSERT INTO public.level(hash,xx_hash) SELECT 'simhash-'||id,lpad(id::text,32,'0') FROM generate_series(1,110) id;
         INSERT INTO public.level_metadata(id_level,format,blocks) VALUES
         (1,0,'[{"Id":22},{"Id":22},{"Id":2}]'),
         (2,1,'[{"i":2,"p":{"x":100}},{"i":22},{"i":22}]'),
         (3,1,'[]'),(4,1,'[{"i":"bad"}]'),(5,9,'[{"i":22}]'),
         (6,1,'[{"i":2}]'),(6,1,'[{"i":22}]');
