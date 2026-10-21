-- Expression indexes are rendered manually; drizzle-kit metadata keeps the SQL expressions.
CREATE TABLE `settlement_entries` (
	`ledger_id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	FOREIGN KEY (`ledger_id`) REFERENCES `ledger`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `settlement_entries_parent` ON `settlement_entries` (`settlement_id`);--> statement-breakpoint
ALTER TABLE `payments` ADD `shift_id` text REFERENCES records(id);--> statement-breakpoint
CREATE INDEX `payments_shift` ON `payments` (`shift_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `shift_active_user` ON `records` (json_extract("data",'$.user')) WHERE kind='shift' AND deleted_at IS NULL AND json_extract(data,'$.closed_at') IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_idempotency` ON `records` (json_extract("data",'$.idempotency_key')) WHERE kind='settlement';