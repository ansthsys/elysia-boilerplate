CREATE TABLE `mail_outbox` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`to` text(320) NOT NULL,
	`subject` text(255) NOT NULL,
	`text` text NOT NULL,
	`html` text,
	`status` text(7) NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`next_attempt_at` integer NOT NULL,
	`lock_id` text(36),
	`locked_until` integer,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mail_outbox_status_idx` ON `mail_outbox` (`status`,`next_attempt_at`);