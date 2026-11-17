CREATE TABLE `accounts` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`account_id` text(255) NOT NULL,
	`provider_id` text(255) NOT NULL,
	`user_id` text(36) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_user_id_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`name` text(100) NOT NULL,
	`slug` text(120) NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`title` text(200) NOT NULL,
	`content` text NOT NULL,
	`category_id` text(36) NOT NULL,
	`author_id` text(36) NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `posts_category_id_idx` ON `posts` (`category_id`);--> statement-breakpoint
CREATE INDEX `posts_author_id_idx` ON `posts` (`author_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`token` text(255) NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`impersonated_by` text(36),
	`user_id` text(36) NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL,
	`email` text(255) NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text(100),
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`identifier` text(255) NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);