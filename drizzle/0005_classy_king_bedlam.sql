CREATE TABLE "event" (
	"id" text PRIMARY KEY NOT NULL,
	"ts" timestamp DEFAULT now() NOT NULL,
	"userId" text,
	"anonId" text,
	"name" text NOT NULL,
	"slug" text,
	"props" jsonb
);
--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_name_ts_idx" ON "event" USING btree ("name","ts");--> statement-breakpoint
CREATE INDEX "event_user_ts_idx" ON "event" USING btree ("userId","ts");--> statement-breakpoint
CREATE INDEX "event_anon_ts_idx" ON "event" USING btree ("anonId","ts");