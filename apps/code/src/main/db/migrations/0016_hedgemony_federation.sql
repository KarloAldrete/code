CREATE TABLE `hedgemony_builder_state` (
	`id` text PRIMARY KEY NOT NULL,
	`last_tick_at` text,
	`config_json` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hedgemony_overlap` (
	`id` text PRIMARY KEY NOT NULL,
	`nest_a_id` text NOT NULL,
	`nest_b_id` text NOT NULL,
	`kind` text NOT NULL,
	`score` real NOT NULL,
	`evidence_json` text NOT NULL,
	`first_seen_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_seen_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`nest_a_id`) REFERENCES `hedgemony_nest`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`nest_b_id`) REFERENCES `hedgemony_nest`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `hedgemony_overlap_pair_idx` ON `hedgemony_overlap` (`nest_a_id`,`nest_b_id`);--> statement-breakpoint
CREATE INDEX `hedgemony_overlap_open_idx` ON `hedgemony_overlap` (`resolved_at`);--> statement-breakpoint
CREATE TABLE `hedgemony_builder_proposal` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`primary_nest_id` text,
	`secondary_nest_id` text,
	`hoglet_id` text,
	`signal_report_id` text,
	`evidence_json` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE INDEX `hedgemony_builder_proposal_open_idx` ON `hedgemony_builder_proposal` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `hedgemony_nest_bridge` (
	`id` text PRIMARY KEY NOT NULL,
	`nest_a_id` text NOT NULL,
	`nest_b_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`removed_at` text,
	FOREIGN KEY (`nest_a_id`) REFERENCES `hedgemony_nest`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`nest_b_id`) REFERENCES `hedgemony_nest`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `hedgemony_nest_bridge_pair_idx` ON `hedgemony_nest_bridge` (`nest_a_id`,`nest_b_id`);
