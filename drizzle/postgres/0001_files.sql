CREATE TABLE "files" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"key" varchar(512) NOT NULL,
	"disk" varchar(5) NOT NULL,
	"mime" varchar(150) NOT NULL,
	"size" integer NOT NULL,
	"original_name" varchar(255),
	"visibility" varchar(7) NOT NULL,
	"owner_id" varchar(36),
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "files_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "files_owner_id_idx" ON "files" USING btree ("owner_id");