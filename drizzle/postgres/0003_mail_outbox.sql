CREATE TABLE "mail_outbox" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"to" varchar(320) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"text" text NOT NULL,
	"html" text,
	"status" varchar(7) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp (3) with time zone NOT NULL,
	"lock_id" varchar(36),
	"locked_until" timestamp (3) with time zone,
	"sent_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "mail_outbox_status_idx" ON "mail_outbox" USING btree ("status","next_attempt_at");