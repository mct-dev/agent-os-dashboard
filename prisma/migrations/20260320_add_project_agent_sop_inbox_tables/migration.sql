-- Migration: Add Project, Sop, SopStage, AgentConfig, InboxItem tables
-- Also migrates Task.project enum to Task.projectId FK

-- 1. Add projectId column to Task (nullable initially)
ALTER TABLE "Task" ADD COLUMN "projectId" TEXT;

-- 2. Backfill projectId from the enum column
UPDATE "Task" SET "projectId" = LOWER("project"::TEXT);

-- 3. Drop the old enum column and type (must drop before creating table with same name)
ALTER TABLE "Task" DROP COLUMN "project";
DROP TYPE IF EXISTS "Project";

-- 4. Create Project table
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "emoji" TEXT NOT NULL DEFAULT '📦',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- 5. Seed default projects (IDs match lowercase enum values for backfill)
INSERT INTO "Project" ("id", "name", "color", "emoji", "sortOrder", "createdAt", "updatedAt") VALUES
    ('laurel',   'Laurel',         '#3b82f6', '🔵', 0, NOW(), NOW()),
    ('personal', 'Personal',       '#22c55e', '🟢', 1, NOW(), NOW()),
    ('side',     'Side Projects',  '#eab308', '🟡', 2, NOW(), NOW()),
    ('life',     'Life',           '#94a3b8', '⚪', 3, NOW(), NOW());

-- 6. Add FK constraint and index
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- 7. Create Sop table
CREATE TABLE "Sop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sop_pkey" PRIMARY KEY ("id")
);

-- 8. Create SopStage table
CREATE TABLE "SopStage" (
    "id" TEXT NOT NULL,
    "sopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SopStage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SopStage" ADD CONSTRAINT "SopStage_sopId_fkey"
    FOREIGN KEY ("sopId") REFERENCES "Sop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "SopStage_sopId_idx" ON "SopStage"("sopId");

-- 9. Seed default SOPs
INSERT INTO "Sop" ("id", "name", "description", "createdAt", "updatedAt") VALUES
    ('bmad-full',   'BMAD Full Pipeline', 'Business Analyst → PM → Architect → Developer → QA → Code Review', NOW(), NOW()),
    ('bmad-dev',    'Dev + QA',           'Developer → QA → Code Review',                                     NOW(), NOW()),
    ('quick-think', 'Quick Think',        'PM → Architect only — plan without building',                       NOW(), NOW());

INSERT INTO "SopStage" ("id", "sopId", "name", "role", "prompt", "sortOrder") VALUES
    ('bmad-full-ba',   'bmad-full',   'Business Analysis',  'Business Analyst',   'Analyze the business requirements for this task. Define success criteria, stakeholders, and constraints.', 0),
    ('bmad-full-pm',   'bmad-full',   'Product Management', 'Product Manager',    'Define the product spec: user stories, acceptance criteria, scope boundaries, and priority.', 1),
    ('bmad-full-arch', 'bmad-full',   'Architecture',       'Software Architect', 'Design the technical architecture. Define components, interfaces, data models, and tradeoffs.', 2),
    ('bmad-full-dev',  'bmad-full',   'Development',        'Senior Developer',   'Implement the solution. Write clean, tested, production-ready code.', 3),
    ('bmad-full-qa',   'bmad-full',   'QA Review',          'QA Engineer',        'Review for bugs, edge cases, test coverage, and quality issues.', 4),
    ('bmad-full-cr',   'bmad-full',   'Code Review',        'Tech Lead',          'Review code for standards, security, performance, and maintainability.', 5),
    ('bmad-dev-dev',   'bmad-dev',    'Development',        'Senior Developer',   'Implement the solution. Write clean, production-ready code.', 0),
    ('bmad-dev-qa',    'bmad-dev',    'QA Review',          'QA Engineer',        'Review for bugs, edge cases, test coverage.', 1),
    ('bmad-dev-cr',    'bmad-dev',    'Code Review',        'Tech Lead',          'Review for standards, security, maintainability.', 2),
    ('qt-pm',          'quick-think', 'Product Management', 'Product Manager',    'Define the product spec: user stories, acceptance criteria, scope boundaries.', 0),
    ('qt-arch',        'quick-think', 'Architecture',       'Software Architect', 'Design the technical approach. Keep it concise and decision-focused.', 1);

-- 10. Create AgentConfig table
CREATE TABLE "AgentConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'anthropic/claude-opus-4-6',
    "description" TEXT NOT NULL DEFAULT '',
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "defaultSopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentConfig_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AgentConfig" ADD CONSTRAINT "AgentConfig_defaultSopId_fkey"
    FOREIGN KEY ("defaultSopId") REFERENCES "Sop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 11. Seed default agents
INSERT INTO "AgentConfig" ("id", "name", "model", "description", "systemPrompt", "defaultSopId", "createdAt", "updatedAt") VALUES
    ('bmad-full',   'BMAD Full',   'anthropic/claude-opus-4-6',     'Full pipeline: BA → PM → Arch → Dev → QA → CR',  'You are a full-stack development pipeline agent. Follow the BMAD methodology through all stages.', 'bmad-full',   NOW(), NOW()),
    ('dev-qa',      'Dev + QA',    'anthropic/claude-sonnet-4-6',   'Streamlined: Dev → QA → Code Review',             'You are a development agent focused on implementation and quality assurance.',                      'bmad-dev',    NOW(), NOW()),
    ('quick-think', 'Quick Think', 'google/gemini-3-flash-preview', 'Fast planning: PM → Architect only',              'You are a rapid planning agent. Produce concise specs and architecture decisions.',                 'quick-think', NOW(), NOW());

-- 12. Create InboxItem table
CREATE TABLE "InboxItem" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT,
    "taskId" TEXT,
    "agentName" TEXT NOT NULL,
    "taskTitle" TEXT NOT NULL DEFAULT '',
    "question" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "snoozedUntil" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "replyText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_agentRunId_fkey"
    FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "InboxItem_taskId_idx" ON "InboxItem"("taskId");
CREATE INDEX "InboxItem_read_idx" ON "InboxItem"("read");
CREATE INDEX "InboxItem_agentRunId_idx" ON "InboxItem"("agentRunId");
