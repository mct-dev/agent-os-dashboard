-- CreateTable
CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agentConfigId" TEXT,
    "tool" TEXT NOT NULL DEFAULT 'claude-code',
    "model" TEXT NOT NULL DEFAULT 'anthropic/claude-sonnet-4-6',
    "prompt" TEXT NOT NULL,
    "preset" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "hour" INTEGER,
    "minute" INTEGER,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "taskMode" TEXT NOT NULL DEFAULT 'create',
    "taskId" TEXT,
    "projectId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pendingApproval" BOOLEAN NOT NULL DEFAULT false,
    "missedRunCount" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN "scheduledJobId" TEXT;

-- AlterTable
ALTER TABLE "InboxItem" ADD COLUMN "scheduledJobId" TEXT,
                        ADD COLUMN "action" TEXT;

-- CreateIndex
CREATE INDEX "ScheduledJob_nextRunAt_enabled_idx" ON "ScheduledJob"("nextRunAt", "enabled");

-- CreateIndex
CREATE INDEX "ScheduledJob_userId_idx" ON "ScheduledJob"("userId");

-- AddForeignKey
ALTER TABLE "ScheduledJob" ADD CONSTRAINT "ScheduledJob_agentConfigId_fkey" FOREIGN KEY ("agentConfigId") REFERENCES "AgentConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledJob" ADD CONSTRAINT "ScheduledJob_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledJob" ADD CONSTRAINT "ScheduledJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
