CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_id` text,
	`ip` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_business` ON `audit` (`created_at`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`outlet_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'pending_payment' NOT NULL,
	`channel` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`subtotal` integer NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`paid` integer DEFAULT 0 NOT NULL,
	`dp` integer DEFAULT 0 NOT NULL,
	`expires_at` integer,
	`collateral` text DEFAULT 'none' NOT NULL,
	`collateral_type` text,
	`note` text,
	`idem` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bookings_constraint_0" CHECK(total>=0),
	CONSTRAINT "bookings_constraint_1" CHECK(paid>=0 AND paid<=total)
);
--> statement-breakpoint
CREATE INDEX `bookings_outlet_status` ON `bookings` (`outlet_id`,`status`,`start_at`);--> statement-breakpoint
CREATE INDEX `bookings_business` ON `bookings` (`status`,`start_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_bookings_idem` ON `bookings` (`idem`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_bookings_code` ON `bookings` (`code`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`address` text,
	`id_doc` text,
	`blacklisted` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`segment` text DEFAULT 'baru' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customers_business` ON `customers` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_customers_phone` ON `customers` (`phone`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`product_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`product_name` text NOT NULL,
	`price` integer NOT NULL,
	`days` integer NOT NULL,
	`total` integer NOT NULL,
	`returned_at` integer,
	`condition` text,
	`voided_at` integer,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `items_active` ON `items` (`booking_id`,`voided_at`);--> statement-breakpoint
CREATE INDEX `items_business` ON `items` (`booking_id`);--> statement-breakpoint
CREATE TABLE `ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text,
	`account` text NOT NULL,
	`direction` text NOT NULL,
	`amount` integer NOT NULL,
	`reference` text,
	`note` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "ledger_constraint_0" CHECK(direction IN('in','out')),
	CONSTRAINT "ledger_constraint_1" CHECK(amount>0)
);
--> statement-breakpoint
CREATE INDEX `ledger_business` ON `ledger` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_ledger_reference` ON `ledger` (`reference`);--> statement-breakpoint
CREATE TABLE `operation_keys` (
	`key` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`kind` text DEFAULT 'rental' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`proof` text,
	`idem` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payments_constraint_0" CHECK(amount>0)
);
--> statement-breakpoint
CREATE INDEX `payments_business` ON `payments` (`status`,`booking_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_payments_idem` ON `payments` (`idem`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`brand` text,
	`description` text,
	`price` integer NOT NULL,
	`image` text,
	`capacity` integer DEFAULT 1 NOT NULL,
	`buffer_hours` integer,
	`published` integer DEFAULT 1 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	CONSTRAINT "products_constraint_0" CHECK(price>=0)
);
--> statement-breakpoint
CREATE INDEX `products_business` ON `products` (`deleted_at`,`category`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `records_business` ON `records` (`kind`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`booking_id` text,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`kind` text DEFAULT 'booking' NOT NULL,
	`released_at` integer,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "reservations_constraint_0" CHECK(end_at>start_at)
);
--> statement-breakpoint
CREATE INDEX `reservations_business` ON `reservations` (`unit_id`,`start_at`,`end_at`) WHERE released_at IS NULL;--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`csrf_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_expiry` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_sessions_token_hash` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `status_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`status` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `logs_business` ON `status_logs` (`booking_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `store_profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'Radix Outdoor' NOT NULL,
	`timezone` text DEFAULT 'Asia/Jakarta' NOT NULL,
	`currency` text DEFAULT 'IDR' NOT NULL,
	`settings_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "store_profile_constraint_0" CHECK(currency='IDR'),
	CONSTRAINT "store_profile_singleton" CHECK("store_profile"."id"=1)
);
--> statement-breakpoint
CREATE TABLE `units` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`outlet_id` text NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`condition_note` text,
	`purchase_price` integer DEFAULT 0 NOT NULL,
	`partner_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `units_outlet_product` ON `units` (`outlet_id`,`product_id`,`status`);--> statement-breakpoint
CREATE INDEX `units_business` ON `units` (`product_id`,`outlet_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_units_code` ON `units` (`code`);--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`owner_token` text NOT NULL,
	`mime` text NOT NULL,
	`created_at` integer NOT NULL,
	`storage_key` text,
	`storage_bucket` text DEFAULT 'private' NOT NULL,
	CONSTRAINT "uploads_constraint_0" CHECK(storage_bucket IN('private','public'))
);
--> statement-breakpoint
CREATE INDEX `uploads_business` ON `uploads` (`kind`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`password_hash` text,
	`last_login_at` integer,
	`user_id` text,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`outlet_id` text,
	`partner_id` text,
	`active` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "users_constraint_0" CHECK(role IN('owner','admin','warehouse','partner'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_nocase` ON `users` (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX `ux_users_email` ON `users` (`email`);