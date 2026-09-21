-- The pipeline panel in the admin records when the owner will act next
-- (docs/12-admin-dashboard.md, lead detail, "Pipeline"). Nullable: a lead nobody has
-- committed to a date for is the normal state, and is not the same as an overdue one.
-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "nextActionDate" TIMESTAMP(3);
