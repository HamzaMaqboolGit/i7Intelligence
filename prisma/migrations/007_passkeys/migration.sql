-- CreateTable
CREATE TABLE `passkeys` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NULL,
    `publicKey` TEXT NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `credentialID` VARCHAR(512) NOT NULL,
    `counter` INTEGER NOT NULL,
    `deviceType` VARCHAR(191) NOT NULL,
    `backedUp` BOOLEAN NOT NULL,
    `transports` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NULL,
    `aaguid` VARCHAR(191) NULL,

    UNIQUE INDEX `passkeys_credentialID_key`(`credentialID`),
    INDEX `passkeys_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `passkeys` ADD CONSTRAINT `passkeys_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
