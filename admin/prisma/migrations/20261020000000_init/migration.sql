CREATE TABLE "AdminUser" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'admin',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
CREATE TABLE "CampusMeta" (
  "slug" TEXT NOT NULL PRIMARY KEY,
  "displayName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "basedOn" TEXT,
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "Revision" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "campusSlug" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "dir" TEXT NOT NULL,
  "fileCount" INTEGER NOT NULL,
  "createdBy" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Revision_campusSlug_number_key" ON "Revision"("campusSlug", "number");
CREATE INDEX "Revision_campusSlug_createdAt_idx" ON "Revision"("campusSlug", "createdAt");
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "campusSlug" TEXT,
  "path" TEXT,
  "beforeHash" TEXT,
  "afterHash" TEXT,
  "detail" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditLog_campusSlug_createdAt_idx" ON "AuditLog"("campusSlug", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
