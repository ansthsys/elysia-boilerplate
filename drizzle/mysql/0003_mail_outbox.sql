CREATE TABLE `mail_outbox` (
	`id` varchar(36) NOT NULL,
	`to` varchar(320) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`text` text NOT NULL,
	`html` text,
	`status` varchar(7) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`last_error` text,
	`next_attempt_at` datetime(3) NOT NULL,
	`lock_id` varchar(36),
	`locked_until` datetime(3),
	`sent_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `mail_outbox_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `mail_outbox_status_idx` ON `mail_outbox` (`status`,`next_attempt_at`);