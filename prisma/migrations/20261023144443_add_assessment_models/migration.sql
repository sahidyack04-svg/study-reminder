-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentProfileId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Question_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Test" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentProfileId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "scorePercent" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "Test_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Test_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testId" TEXT NOT NULL,
    "questionId" TEXT,
    "order" INTEGER NOT NULL,
    "promptSnapshot" TEXT NOT NULL,
    "optionsSnapshot" TEXT NOT NULL,
    "correctAnswerSnapshot" TEXT NOT NULL,
    "topicSnapshot" TEXT NOT NULL,
    "typeSnapshot" TEXT NOT NULL,
    "answerGiven" TEXT,
    "isCorrect" BOOLEAN,
    CONSTRAINT "TestAnswer_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Question_studentProfileId_subjectId_idx" ON "Question"("studentProfileId", "subjectId");

-- CreateIndex
CREATE INDEX "Test_studentProfileId_createdAt_idx" ON "Test"("studentProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "TestAnswer_testId_idx" ON "TestAnswer"("testId");
