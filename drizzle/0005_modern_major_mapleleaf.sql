CREATE TABLE `testRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`analysisId` int NOT NULL,
	`userId` int NOT NULL,
	`runId` varchar(64) NOT NULL,
	`baseUrl` varchar(512) NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`totalTests` int DEFAULT 0,
	`passed` int DEFAULT 0,
	`failed` int DEFAULT 0,
	`errors` int DEFAULT 0,
	`passRate` int DEFAULT 0,
	`mutationScore` int DEFAULT 0,
	`resultsJson` json,
	`summary` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `testRuns_id` PRIMARY KEY(`id`)
);
