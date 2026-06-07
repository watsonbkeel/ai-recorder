-- AlterTable
ALTER TABLE `FamilyMember` ADD COLUMN `slotKey` VARCHAR(40) NULL;

-- AlterTable
ALTER TABLE `FamilyJoinRequest` ADD COLUMN `slotKey` VARCHAR(40) NULL;

-- CreateTable
CREATE TABLE `FamilyMessageSlotReceiver` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `messageId` INTEGER NOT NULL,
    `familyId` INTEGER NOT NULL,
    `slotKey` VARCHAR(40) NOT NULL,
    `status` ENUM('unread', 'read', 'replied') NOT NULL DEFAULT 'unread',
    `readAt` DATETIME(3) NULL,
    `repliedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FamilyMessageSlotReceiver_familyId_slotKey_status_idx`(`familyId`, `slotKey`, `status`),
    UNIQUE INDEX `FamilyMessageSlotReceiver_messageId_slotKey_key`(`messageId`, `slotKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `FamilyMember_familyId_slotKey_key` ON `FamilyMember`(`familyId`, `slotKey`);

-- CreateIndex
CREATE INDEX `FamilyJoinRequest_familyId_slotKey_idx` ON `FamilyJoinRequest`(`familyId`, `slotKey`);

-- AddForeignKey
ALTER TABLE `FamilyMessageSlotReceiver` ADD CONSTRAINT `FamilyMessageSlotReceiver_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `FamilyMessage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
