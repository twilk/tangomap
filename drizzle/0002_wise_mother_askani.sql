ALTER TABLE "profile" ADD COLUMN "cardSerial" integer;--> statement-breakpoint
UPDATE "profile" SET "cardSerial" = s.rn FROM (SELECT "userId", row_number() OVER (ORDER BY "createdAt", "userId") AS rn FROM "profile") s WHERE "profile"."userId" = s."userId";--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "profile_card_serial_seq";--> statement-breakpoint
SELECT setval('profile_card_serial_seq', COALESCE((SELECT MAX("cardSerial") FROM "profile"), 0) + 1, false);--> statement-breakpoint
ALTER TABLE "profile" ALTER COLUMN "cardSerial" SET DEFAULT nextval('profile_card_serial_seq');--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_cardSerial_unique" UNIQUE("cardSerial");
