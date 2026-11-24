-- CreateTable
CREATE TABLE `store_products` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `data` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `store_products_slug_key`(`slug`),
    INDEX `store_products_status_deletedAt_sortOrder_idx`(`status`, `deletedAt`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_categories` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `data` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `store_categories_slug_key`(`slug`),
    INDEX `store_categories_status_deletedAt_sortOrder_idx`(`status`, `deletedAt`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_coupons` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `data` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `store_coupons_slug_key`(`slug`),
    INDEX `store_coupons_status_deletedAt_sortOrder_idx`(`status`, `deletedAt`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_product_files` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `version` VARCHAR(191) NOT NULL DEFAULT '1.0',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `store_product_files_storageKey_key`(`storageKey`),
    INDEX `store_product_files_productId_deletedAt_idx`(`productId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_carts` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `coupon` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `store_carts_tokenHash_key`(`tokenHash`),
    INDEX `store_carts_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_cart_items` (
    `id` VARCHAR(191) NOT NULL,
    `cartId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `package` VARCHAR(191) NOT NULL DEFAULT 'standard',
    `quantity` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `store_cart_items_cartId_productId_package_key`(`cartId`, `productId`, `package`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_customers` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `store_customers_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_orders` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `requestKey` VARCHAR(191) NOT NULL,
    `cartId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `accessHash` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `subtotal` INTEGER NOT NULL,
    `discount` INTEGER NOT NULL DEFAULT 0,
    `tax` INTEGER NOT NULL DEFAULT 0,
    `total` INTEGER NOT NULL,
    `coupon` VARCHAR(191) NULL,
    `paymentStatus` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `fulfillmentStatus` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `stripeSessionId` VARCHAR(191) NULL,
    `stripePaymentId` VARCHAR(191) NULL,
    `billing` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `store_orders_reference_key`(`reference`),
    UNIQUE INDEX `store_orders_requestKey_key`(`requestKey`),
    UNIQUE INDEX `store_orders_accessHash_key`(`accessHash`),
    UNIQUE INDEX `store_orders_stripeSessionId_key`(`stripeSessionId`),
    UNIQUE INDEX `store_orders_stripePaymentId_key`(`stripePaymentId`),
    INDEX `store_orders_paymentStatus_createdAt_idx`(`paymentStatus`, `createdAt`),
    INDEX `store_orders_customerId_createdAt_idx`(`customerId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_order_items` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `package` VARCHAR(191) NOT NULL,
    `unitAmount` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `snapshot` JSON NOT NULL,
    `serviceStatus` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `requirements` TEXT NULL,
    `notes` TEXT NULL,

    INDEX `store_order_items_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_download_entitlements` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `maximum` INTEGER NOT NULL DEFAULT 5,
    `used` INTEGER NOT NULL DEFAULT 0,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `store_download_entitlements_tokenHash_key`(`tokenHash`),
    INDEX `store_download_entitlements_expiresAt_idx`(`expiresAt`),
    UNIQUE INDEX `store_download_entitlements_itemId_fileId_key`(`itemId`, `fileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_download_events` (
    `id` VARCHAR(191) NOT NULL,
    `entitlementId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `store_download_events_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_order_events` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `store_order_events_orderId_createdAt_idx`(`orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_webhook_events` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_refunds` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `requestKey` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NULL,
    `amount` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `store_refunds_requestKey_key`(`requestKey`),
    UNIQUE INDEX `store_refunds_providerId_key`(`providerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `store_product_files` ADD CONSTRAINT `store_product_files_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `store_products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_cart_items` ADD CONSTRAINT `store_cart_items_cartId_fkey` FOREIGN KEY (`cartId`) REFERENCES `store_carts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_cart_items` ADD CONSTRAINT `store_cart_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `store_products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_orders` ADD CONSTRAINT `store_orders_cartId_fkey` FOREIGN KEY (`cartId`) REFERENCES `store_carts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_orders` ADD CONSTRAINT `store_orders_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `store_customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_order_items` ADD CONSTRAINT `store_order_items_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `store_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_order_items` ADD CONSTRAINT `store_order_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `store_products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_download_entitlements` ADD CONSTRAINT `store_download_entitlements_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `store_order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_download_entitlements` ADD CONSTRAINT `store_download_entitlements_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `store_product_files`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_download_events` ADD CONSTRAINT `store_download_events_entitlementId_fkey` FOREIGN KEY (`entitlementId`) REFERENCES `store_download_entitlements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_order_events` ADD CONSTRAINT `store_order_events_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `store_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_refunds` ADD CONSTRAINT `store_refunds_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `store_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
