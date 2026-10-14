-- FR-30: audit log entries are immutable. Any UPDATE or DELETE is rejected at the
-- database level, so immutability holds even for code paths that bypass the app.

CREATE FUNCTION "audit_logs_reject_mutation"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only: % is not allowed', TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_immutable"
    BEFORE UPDATE OR DELETE ON "audit_logs"
    FOR EACH ROW EXECUTE FUNCTION "audit_logs_reject_mutation"();

-- TRUNCATE bypasses row-level triggers, so it needs its own statement-level trigger.
CREATE TRIGGER "audit_logs_no_truncate"
    BEFORE TRUNCATE ON "audit_logs"
    FOR EACH STATEMENT EXECUTE FUNCTION "audit_logs_reject_mutation"();
