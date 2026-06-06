-- AlterTable
ALTER TABLE `Report` MODIFY `targetType` ENUM('diary', 'comment', 'message', 'reply') NOT NULL;

-- AlterTable
ALTER TABLE `Notification` ADD COLUMN `familyId` INTEGER NULL,
    ADD COLUMN `messageId` INTEGER NULL,
    ADD COLUMN `replyId` INTEGER NULL,
    MODIFY `type` ENUM('diary_liked', 'comment_liked', 'diary_commented', 'comment_replied', 'message_received', 'message_replied', 'report_handled', 'join_request_approved', 'join_request_rejected') NOT NULL;

-- AlterTable
ALTER TABLE `ModerationLog` MODIFY `targetType` ENUM('join_request', 'diary', 'comment', 'message', 'reply', 'member', 'report') NOT NULL,
    MODIFY `action` ENUM('approve_join_request', 'reject_join_request', 'hide_diary', 'hide_comment', 'hide_message', 'hide_reply', 'mute_member', 'unmute_member', 'remove_member', 'set_admin', 'unset_admin', 'resolve_report', 'reject_report') NOT NULL;

-- CreateTable
CREATE TABLE `Family` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `inviteCode` VARCHAR(20) NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Family_inviteCode_key`(`inviteCode`),
    INDEX `Family_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FamilyMember` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `familyId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `role` ENUM('member', 'admin') NOT NULL DEFAULT 'member',
    `relationship` ENUM('father', 'mother', 'son', 'daughter', 'grandparent', 'partner', 'sibling', 'other') NOT NULL DEFAULT 'other',
    `familyNickname` VARCHAR(191) NULL,
    `isMuted` BOOLEAN NOT NULL DEFAULT false,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FamilyMember_userId_idx`(`userId`),
    INDEX `FamilyMember_familyId_role_idx`(`familyId`, `role`),
    UNIQUE INDEX `FamilyMember_familyId_userId_key`(`familyId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FamilyJoinRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `familyId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `message` TEXT NULL,
    `handledById` INTEGER NULL,
    `handledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FamilyJoinRequest_familyId_status_idx`(`familyId`, `status`),
    INDEX `FamilyJoinRequest_userId_status_idx`(`userId`, `status`),
    INDEX `FamilyJoinRequest_familyId_userId_idx`(`familyId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FamilyMessage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `familyId` INTEGER NOT NULL,
    `senderId` INTEGER NOT NULL,
    `visibility` ENUM('private', 'family', 'self') NOT NULL DEFAULT 'private',
    `messageType` ENUM('thanks', 'apology', 'grievance', 'request', 'explain', 'stress', 'repair', 'encouragement', 'general') NOT NULL DEFAULT 'general',
    `originalText` TEXT NULL,
    `originalAudioUrl` VARCHAR(500) NULL,
    `audioDurationSec` INTEGER NULL,
    `optimizedText` TEXT NOT NULL,
    `emotionTags` JSON NULL,
    `coreNeed` TEXT NULL,
    `aiAdvice` TEXT NULL,
    `riskLevel` ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'low',
    `attackWarning` TEXT NULL,
    `allowOriginalTextView` BOOLEAN NOT NULL DEFAULT false,
    `allowOriginalAudioPlay` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('visible', 'hidden', 'deleted') NOT NULL DEFAULT 'visible',
    `replyCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FamilyMessage_familyId_status_createdAt_idx`(`familyId`, `status`, `createdAt`),
    INDEX `FamilyMessage_senderId_status_idx`(`senderId`, `status`),
    INDEX `FamilyMessage_riskLevel_createdAt_idx`(`riskLevel`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FamilyMessageReceiver` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `messageId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `status` ENUM('unread', 'read', 'replied') NOT NULL DEFAULT 'unread',
    `readAt` DATETIME(3) NULL,
    `repliedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FamilyMessageReceiver_userId_status_idx`(`userId`, `status`),
    UNIQUE INDEX `FamilyMessageReceiver_messageId_userId_key`(`messageId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FamilyReply` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `familyId` INTEGER NOT NULL,
    `messageId` INTEGER NOT NULL,
    `senderId` INTEGER NOT NULL,
    `originalText` TEXT NOT NULL,
    `optimizedText` TEXT NOT NULL,
    `emotionTags` JSON NULL,
    `aiAdvice` TEXT NULL,
    `riskLevel` ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'low',
    `attackWarning` TEXT NULL,
    `status` ENUM('visible', 'hidden', 'deleted') NOT NULL DEFAULT 'visible',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FamilyReply_messageId_status_createdAt_idx`(`messageId`, `status`, `createdAt`),
    INDEX `FamilyReply_familyId_status_idx`(`familyId`, `status`),
    INDEX `FamilyReply_senderId_status_idx`(`senderId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Notification_familyId_idx` ON `Notification`(`familyId`);

-- AddForeignKey
ALTER TABLE `Family` ADD CONSTRAINT `Family_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyMember` ADD CONSTRAINT `FamilyMember_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyMember` ADD CONSTRAINT `FamilyMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyJoinRequest` ADD CONSTRAINT `FamilyJoinRequest_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyJoinRequest` ADD CONSTRAINT `FamilyJoinRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyJoinRequest` ADD CONSTRAINT `FamilyJoinRequest_handledById_fkey` FOREIGN KEY (`handledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyMessage` ADD CONSTRAINT `FamilyMessage_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyMessage` ADD CONSTRAINT `FamilyMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyMessageReceiver` ADD CONSTRAINT `FamilyMessageReceiver_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `FamilyMessage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyMessageReceiver` ADD CONSTRAINT `FamilyMessageReceiver_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyReply` ADD CONSTRAINT `FamilyReply_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyReply` ADD CONSTRAINT `FamilyReply_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `FamilyMessage`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyReply` ADD CONSTRAINT `FamilyReply_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `FamilyMessage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_replyId_fkey` FOREIGN KEY (`replyId`) REFERENCES `FamilyReply`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

