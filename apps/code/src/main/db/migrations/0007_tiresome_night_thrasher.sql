CREATE TABLE `hedgemony_nest_message` (
	`id` text PRIMARY KEY NOT NULL,
	`nest_id` text NOT NULL,
	`kind` text NOT NULL,
	`visibility` text DEFAULT 'summary' NOT NULL,
	`source_task_id` text,
	`body` text NOT NULL,
	`payload_json` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`nest_id`) REFERENCES `hedgemony_nest`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `hedgemony_nest_message_nest_id_idx` ON `hedgemony_nest_message` (`nest_id`);--> statement-breakpoint
CREATE INDEX `hedgemony_nest_message_created_at_idx` ON `hedgemony_nest_message` (`created_at`);--> statement-breakpoint
ALTER TABLE `hedgemony_nest` ADD `definition_of_done` text;