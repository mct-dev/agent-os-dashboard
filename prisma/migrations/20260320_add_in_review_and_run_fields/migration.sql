-- AlterEnum: Add IN_REVIEW to Status
ALTER TYPE "Status" ADD VALUE 'IN_REVIEW';

-- AlterTable: Add bridgeRunId and prompt to AgentRun
ALTER TABLE "AgentRun" ADD COLUMN "bridgeRunId" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "prompt" TEXT;

-- Update foreign key to cascade on delete
ALTER TABLE "AgentRun" DROP CONSTRAINT "AgentRun_taskId_fkey";
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
