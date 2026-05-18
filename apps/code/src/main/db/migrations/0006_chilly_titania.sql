ALTER TABLE `workspaces` ADD `last_user_message_at` text;
--> statement-breakpoint
UPDATE `workspaces` SET `last_user_message_at` = `last_activity_at` WHERE `last_activity_at` IS NOT NULL;