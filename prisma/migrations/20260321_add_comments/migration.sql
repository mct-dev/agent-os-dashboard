-- Make AgentRun.taskId nullable
ALTER TABLE "AgentRun" ALTER COLUMN "taskId" DROP NOT NULL;

-- Add trigger comment link and agent identity to AgentRun
ALTER TABLE "AgentRun" ADD COLUMN "triggerCommentId" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "agentConfigId" TEXT;

-- Add unique constraint on AgentConfig.name
ALTER TABLE "AgentConfig" ADD CONSTRAINT "AgentConfig_name_key" UNIQUE ("name");

-- Create Comment table
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "taskId" TEXT,
    "projectId" TEXT,
    "agentRunId" TEXT,
    "userId" TEXT,
    "agentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Comment_taskId_idx" ON "Comment"("taskId");
CREATE INDEX "Comment_projectId_idx" ON "Comment"("projectId");
CREATE INDEX "Comment_agentRunId_idx" ON "Comment"("agentRunId");

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_agentRunId_fkey"
    FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_triggerCommentId_fkey"
    FOREIGN KEY ("triggerCommentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Comment" ADD CONSTRAINT "comment_exactly_one_parent"
    CHECK (num_nonnulls("taskId", "projectId", "agentRunId") = 1);
ALTER TABLE "Comment" ADD CONSTRAINT "comment_exactly_one_author"
    CHECK (num_nonnulls("userId", "agentId") = 1);
