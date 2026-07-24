CREATE TABLE "progress_history" (
	"userId" text NOT NULL,
	"day" text NOT NULL,
	"mastered" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "progress_history_userId_day_pk" PRIMARY KEY("userId","day")
);
--> statement-breakpoint
ALTER TABLE "progress_history" ADD CONSTRAINT "progress_history_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;