CREATE TABLE `board` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`row` text NOT NULL,
	`raw` text NOT NULL,
	`locked` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_date_unique` ON `daily` (`date`);