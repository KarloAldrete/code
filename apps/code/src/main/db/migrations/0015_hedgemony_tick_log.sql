CREATE TABLE `hedgemony_tick_log` (
	`id` text PRIMARY KEY NOT NULL,
	`nest_id` text NOT NULL,
	`ticked_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`outcome` text NOT NULL,
	FOREIGN KEY (`nest_id`) REFERENCES `hedgemony_nest`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `hedgemony_tick_log_window_idx` ON `hedgemony_tick_log` (`nest_id`,`ticked_at`);
