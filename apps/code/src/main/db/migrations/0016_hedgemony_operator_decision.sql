CREATE TABLE `hedgemony_operator_decision` (
	`id` text PRIMARY KEY NOT NULL,
	`nest_id` text NOT NULL,
	`kind` text NOT NULL,
	`subject_key` text NOT NULL,
	`reason` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`nest_id`) REFERENCES `hedgemony_nest`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `hedgemony_operator_decision_nest_idx` ON `hedgemony_operator_decision` (`nest_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `hedgemony_operator_decision_subject_idx` ON `hedgemony_operator_decision` (`nest_id`,`kind`,`subject_key`);
