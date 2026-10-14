-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environments" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sdk_key_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "environments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "environment_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "percentage_rollout" INTEGER NOT NULL DEFAULT 0,
    "targeting_rules" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "environment_id" UUID NOT NULL,
    "flag_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "previous_state" JSONB,
    "new_state" JSONB NOT NULL,
    "performed_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "environments_sdk_key_hash_key" ON "environments"("sdk_key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "environments_workspace_id_name_key" ON "environments"("workspace_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_environment_id_key_key" ON "feature_flags"("environment_id", "key");

-- CreateIndex
CREATE INDEX "audit_logs_environment_id_performed_at_idx" ON "audit_logs"("environment_id", "performed_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_flag_id_idx" ON "audit_logs"("flag_id");

-- AddForeignKey
ALTER TABLE "environments" ADD CONSTRAINT "environments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "feature_flags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Constraints not expressible in the Prisma schema.

-- FR-10: percentage rollout is an integer in [0, 100].
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_percentage_rollout_range"
    CHECK ("percentage_rollout" BETWEEN 0 AND 100);

-- FR-10: flag key slug.
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_key_format"
    CHECK ("key" ~ '^[a-z0-9_-]{3,64}$');

-- FR-30: audit actions match the flag lifecycle (SRS §4.5).
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_action_valid"
    CHECK ("action" IN ('CREATED', 'UPDATED', 'ARCHIVED'));
