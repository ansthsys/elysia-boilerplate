CREATE TABLE `files` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`key` text(512) NOT NULL,
	`disk` text(5) NOT NULL,
	`mime` text(150) NOT NULL,
	`size` integer NOT NULL,
	`original_name` text(255),
	`visibility` text(7) NOT NULL,
	`owner_id` text(36),
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_key_unique` ON `files` (`key`);--> statement-breakpoint
CREATE INDEX `files_owner_id_idx` ON `files` (`owner_id`);