-- AlterTable: Add linearApiKey to UserSettings
ALTER TABLE "UserSettings" ADD COLUMN "linearApiKey" TEXT;

-- CreateTable: LinearLink
CREATE TABLE "LinearLink" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "linearIssueId" TEXT NOT NULL,
    "linearIssueUrl" TEXT NOT NULL,
    "linearTeamKey" TEXT NOT NULL,
    "linearIssueNumber" INTEGER NOT NULL,
    "linearTitle" TEXT NOT NULL,
    "linearStatus" TEXT,
    "linearPriority" INTEGER,
    "linearAssignee" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinearLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique constraint on taskId + linearIssueId
CREATE UNIQUE INDEX "LinearLink_taskId_linearIssueId_key" ON "LinearLink"("taskId", "linearIssueId");

-- AddForeignKey
ALTER TABLE "LinearLink" ADD CONSTRAINT "LinearLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
