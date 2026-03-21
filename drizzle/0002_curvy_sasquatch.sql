ALTER TABLE `analyses` ADD `progressLayer` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `analyses` ADD `progressMessage` varchar(512);--> statement-breakpoint
ALTER TABLE `analyses` ADD `layer1Json` json;--> statement-breakpoint
ALTER TABLE `analyses` ADD `layer2Json` json;