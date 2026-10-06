ALTER TABLE public."user"
    ADD COLUMN role text NOT NULL DEFAULT 'user',
    ADD CONSTRAINT "CK_user_role" CHECK (role IN ('user', 'admin'));
COMMENT ON COLUMN public."user".role IS '@omit all';
REVOKE INSERT, UPDATE ON public."user" FROM PUBLIC;
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'zeepcentraal_graphql') THEN
        REVOKE INSERT, UPDATE ON public."user" FROM zeepcentraal_graphql;
    END IF;
END $$;
