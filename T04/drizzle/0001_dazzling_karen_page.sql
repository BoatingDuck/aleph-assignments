CREATE TABLE `board_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`row` text NOT NULL,
	`raw` text NOT NULL,
	`locked` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_observations_date_unique` ON `daily_observations` (`date`);