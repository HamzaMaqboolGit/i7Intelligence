-- CreateTable
CREATE TABLE `email_settings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'smtp',
    `data` JSON NOT NULL,
    `secret` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_templates` (
    `key` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inquiry_conversations` (
    `id` VARCHAR(191) NOT NULL,
    `inquiryId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'reply',
    `authorId` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inquiry_conversations_messageId_key`(`messageId`),
    INDEX `inquiry_conversations_inquiryId_createdAt_idx`(`inquiryId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_outbox` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NULL,
    `recipient` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `html` TEXT NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `inReplyTo` VARCHAR(191) NULL,
    `referenceHeaders` TEXT NULL,
    `template` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastError` VARCHAR(191) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `email_outbox_key_key`(`key`),
    UNIQUE INDEX `email_outbox_conversationId_key`(`conversationId`),
    UNIQUE INDEX `email_outbox_messageId_key`(`messageId`),
    INDEX `email_outbox_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_delivery_logs` (
    `id` VARCHAR(191) NOT NULL,
    `outboxId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `detail` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `email_delivery_logs_outboxId_createdAt_idx`(`outboxId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `inquiry_conversations` ADD CONSTRAINT `inquiry_conversations_inquiryId_fkey` FOREIGN KEY (`inquiryId`) REFERENCES `contact_messages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_outbox` ADD CONSTRAINT `email_outbox_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `inquiry_conversations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_delivery_logs` ADD CONSTRAINT `email_delivery_logs_outboxId_fkey` FOREIGN KEY (`outboxId`) REFERENCES `email_outbox`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
