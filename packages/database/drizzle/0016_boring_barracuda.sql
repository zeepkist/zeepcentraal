CREATE TABLE IF NOT EXISTS "zsl_level" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zsl_level_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_round" integer NOT NULL,
	"id_level" integer NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zsl_level_result" (
	"id_level" integer NOT NULL,
	"id_user" integer NOT NULL,
	"id_record" integer,
	"position" integer NOT NULL,
	"points" integer NOT NULL,
	"time" real NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone,
	CONSTRAINT "zsl_level_result_id_level_id_user_pk" PRIMARY KEY("id_level","id_user")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zsl_points_structure" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zsl_points_structure_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"points" integer[] NOT NULL,
	"minimum_points" integer NOT NULL,
	"best_of" integer NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zsl_round" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zsl_round_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_season" integer NOT NULL,
	"name" text NOT NULL,
	"round" integer NOT NULL,
	"workshop_id" bigint NOT NULL,
	"event_date" timestamp with time zone NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone,
	CONSTRAINT "UQ_zsl_round_season_round" UNIQUE("id_season","round")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zsl_round_result" (
	"id_round" integer NOT NULL,
	"id_user" integer NOT NULL,
	"position" integer NOT NULL,
	"points" integer NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone,
	CONSTRAINT "zsl_round_result_id_round_id_user_pk" PRIMARY KEY("id_round","id_user")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zsl_season" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zsl_season_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_points_structure" integer NOT NULL,
	"name" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zsl_season_result" (
	"id_season" integer NOT NULL,
	"id_user" integer NOT NULL,
	"position" integer NOT NULL,
	"points" integer NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone,
	CONSTRAINT "zsl_season_result_id_season_id_user_pk" PRIMARY KEY("id_season","id_user")
);
--> statement-breakpoint
ALTER TABLE "auth" ALTER COLUMN "date_created" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "favourite" ALTER COLUMN "date_created" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "level" ALTER COLUMN "date_created" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "level_item" ALTER COLUMN "date_created" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "level_metadata" ALTER COLUMN "date_created" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "level_points" ALTER COLUMN "date_created" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "level_points_history" ALTER COLUMN "date_created" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "level_request" ALTER COLUMN "date_created" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "personal_best_global" ALTER COLUMN "date_created" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "record" ALTER COLUMN "date_created" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "record_media" ALTER COLUMN "date_created" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "date_created" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user_points" ALTER COLUMN "date_created" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user_points_history" ALTER COLUMN "date_created" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "version" ALTER COLUMN "date_created" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "vote" ALTER COLUMN "date_created" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "world_record_global" ALTER COLUMN "date_created" SET DEFAULT now();--> statement-breakpoint

-- Add column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'level_points_history' AND column_name = 'date_updated'
  ) THEN
    ALTER TABLE "level_points_history" ADD COLUMN "date_updated" timestamp with time zone;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_points_history' AND column_name = 'date_updated'
  ) THEN
    ALTER TABLE "user_points_history" ADD COLUMN "date_updated" timestamp with time zone;
  END IF;
END
$$;

-- Add constraints only if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'zsl_level_round_fkey'
  ) THEN
    ALTER TABLE "zsl_level" ADD CONSTRAINT "zsl_level_round_fkey"
    FOREIGN KEY ("id_round") REFERENCES "public"."zsl_round"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'zsl_level_level_fkey'
  ) THEN
    ALTER TABLE "zsl_level" ADD CONSTRAINT "zsl_level_level_fkey"
    FOREIGN KEY ("id_level") REFERENCES "public"."level"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'zsl_level_result_level_fkey'
  ) THEN
    ALTER TABLE "zsl_level_result" ADD CONSTRAINT "zsl_level_result_level_fkey"
    FOREIGN KEY ("id_level") REFERENCES "public"."zsl_level"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'zsl_level_result_user_fkey'
  ) THEN
    ALTER TABLE "zsl_level_result" ADD CONSTRAINT "zsl_level_result_user_fkey"
    FOREIGN KEY ("id_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'zsl_level_result_record_fkey'
  ) THEN
    ALTER TABLE "zsl_level_result" ADD CONSTRAINT "zsl_level_result_record_fkey"
    FOREIGN KEY ("id_record") REFERENCES "public"."record"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'zsl_round_season_fkey'
  ) THEN
    ALTER TABLE "zsl_round" ADD CONSTRAINT "zsl_round_season_fkey"
    FOREIGN KEY ("id_season") REFERENCES "public"."zsl_season"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'zsl_round_result_round_fkey'
  ) THEN
    ALTER TABLE "zsl_round_result" ADD CONSTRAINT "zsl_round_result_round_fkey"
    FOREIGN KEY ("id_round") REFERENCES "public"."zsl_round"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'zsl_round_result_user_fkey'
  ) THEN
    ALTER TABLE "zsl_round_result" ADD CONSTRAINT "zsl_round_result_user_fkey"
    FOREIGN KEY ("id_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'zsl_season_points_structure_fkey'
  ) THEN
    ALTER TABLE "zsl_season" ADD CONSTRAINT "zsl_season_points_structure_fkey"
    FOREIGN KEY ("id_points_structure") REFERENCES "public"."zsl_points_structure"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'zsl_season_result_season_fkey'
  ) THEN
    ALTER TABLE "zsl_season_result" ADD CONSTRAINT "zsl_season_result_season_fkey"
    FOREIGN KEY ("id_season") REFERENCES "public"."zsl_season"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'zsl_season_result_user_fkey'
  ) THEN
    ALTER TABLE "zsl_season_result" ADD CONSTRAINT "zsl_season_result_user_fkey"
    FOREIGN KEY ("id_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;
