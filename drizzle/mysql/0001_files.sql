CREATE TABLE `files` (
	`id` varchar(36) NOT NULL,
	`key` varchar(512) NOT NULL,
	`disk` varchar(5) NOT NULL,
	`mime` varchar(150) NOT NULL,
	`size` int NOT NULL,
	`original_name` varchar(255),
	`visibility` varchar(7) NOT NULL,
	`owner_id` varchar(36),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `files_id` PRIMARY KEY(`id`),
	CONSTRAINT `files_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
ALTER TABLE `files` ADD CONSTRAINT `files_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `files_owner_id_idx` ON `files` (`owner_id`);