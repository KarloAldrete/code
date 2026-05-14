-- Collapse any duplicate (nest_id, parent_task_id, child_task_id) rows down to
-- the earliest by created_at before enforcing the UNIQUE index, so the index
-- create cannot fail on existing data.
DELETE FROM `hedgemony_pr_dependency`
WHERE `id` NOT IN (
	SELECT `id` FROM `hedgemony_pr_dependency` AS d
	WHERE `id` = (
		SELECT `id` FROM `hedgemony_pr_dependency`
		WHERE `nest_id` = d.`nest_id`
		  AND `parent_task_id` = d.`parent_task_id`
		  AND `child_task_id` = d.`child_task_id`
		ORDER BY `created_at` ASC, `id` ASC
		LIMIT 1
	)
);--> statement-breakpoint
CREATE UNIQUE INDEX `hedgemony_pr_dependency_triple_idx` ON `hedgemony_pr_dependency` (`nest_id`,`parent_task_id`,`child_task_id`);
