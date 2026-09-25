-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "slotStartsAt" TIMESTAMP(3);

-- Every call that is not cancelled holds its own start time.
UPDATE "Booking" SET "slotStartsAt" = "startsAt" WHERE "status" <> 'CANCELLED';

-- DropIndex
DROP INDEX "Booking_consultationTypeId_startsAt_key";

-- CreateIndex
CREATE UNIQUE INDEX "Booking_consultationTypeId_slotStartsAt_key" ON "Booking"("consultationTypeId", "slotStartsAt");
