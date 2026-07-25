ALTER TABLE "profile" ADD COLUMN "customTheme" jsonb;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "cardUsesCustomTheme" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "themeShared" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "customThemeUpdatedAt" timestamp;