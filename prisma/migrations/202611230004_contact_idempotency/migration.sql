-- CreateTable
CREATE TABLE `contact_submission_receipts` (
    `key` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `inquiryId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `contact_submission_receipts_reference_key`(`reference`),
    UNIQUE INDEX `contact_submission_receipts_inquiryId_key`(`inquiryId`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `contact_submission_receipts` ADD CONSTRAINT `contact_submission_receipts_inquiryId_fkey` FOREIGN KEY (`inquiryId`) REFERENCES `contact_messages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
