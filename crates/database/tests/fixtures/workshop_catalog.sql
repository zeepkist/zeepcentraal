CREATE TABLE public.level (
    id integer PRIMARY KEY,
    adventure boolean NOT NULL DEFAULT false
);
CREATE TABLE public.workshop_item (workshop_id bigint PRIMARY KEY);
CREATE TABLE public.level_item (
    id integer PRIMARY KEY,
    id_level integer NOT NULL REFERENCES public.level,
    workshop_id bigint NOT NULL REFERENCES public.workshop_item,
    deleted boolean NOT NULL DEFAULT false,
    publicly_visible boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now(),
    date_updated timestamptz
);
CREATE TABLE public.level_points (
    id_level integer PRIMARY KEY REFERENCES public.level,
    points integer NOT NULL,
    rating real NOT NULL DEFAULT 0.5,
    modifier_length real NOT NULL DEFAULT 0,
    modifier_evidence real NOT NULL DEFAULT 0.2,
    modifier_quality real NOT NULL DEFAULT 0.55,
    modifier_rating real NOT NULL DEFAULT 1,
    complexity_confidence real,
    complexity_score real,
    field_strength real,
    quality_score real,
    skill_alignment real,
    skill_confidence real,
    skill_sample_size integer,
    skill_score real,
    skill_separation real,
    date_created timestamptz NOT NULL DEFAULT now(),
    date_updated timestamptz
);
CREATE TABLE public.user_point_contribution (
    id_user integer NOT NULL,
    id_level integer NOT NULL REFERENCES public.level,
    id_record integer NOT NULL,
    level_position integer NOT NULL,
    level_points integer NOT NULL,
    level_decayed_points real NOT NULL
);
CREATE TABLE public.personal_best_global (
    id_user integer NOT NULL,
    id_level integer NOT NULL REFERENCES public.level,
    id_record integer NOT NULL
);
CREATE TABLE public.record (id integer PRIMARY KEY, time real NOT NULL);
