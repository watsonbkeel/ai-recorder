-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `accountName` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(255) NULL,
    `wechatOpenid` VARCHAR(191) NULL,
    `nickname` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(500) NULL,
    `isGlobalAdmin` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_accountName_key`(`accountName`),
    UNIQUE INDEX `User_wechatOpenid_key`(`wechatOpenid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
    `relationship` ENUM('father', 'mother', 'son', 'daughter', 'child', 'grandfather', 'grandmother', 'grandparent', 'partner', 'sibling', 'other') NOT NULL DEFAULT 'other',
    `gender` ENUM('male', 'female', 'unspecified') NOT NULL DEFAULT 'unspecified',
    `childOrder` INTEGER NULL,
    `birthYear` INTEGER NULL,
    `familyNickname` VARCHAR(191) NULL,
    `preferredTitle` VARCHAR(191) NULL,
    `identityNote` VARCHAR(500) NULL,
    `isMuted` BOOLEAN NOT NULL DEFAULT false,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FamilyMember_userId_idx`(`userId`),
    INDEX `FamilyMember_familyId_role_idx`(`familyId`, `role`),
    INDEX `FamilyMember_familyId_relationship_childOrder_idx`(`familyId`, `relationship`, `childOrder`),
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
    `relationship` ENUM('father', 'mother', 'son', 'daughter', 'child', 'grandfather', 'grandmother', 'grandparent', 'partner', 'sibling', 'other') NOT NULL DEFAULT 'other',
    `gender` ENUM('male', 'female', 'unspecified') NOT NULL DEFAULT 'unspecified',
    `childOrder` INTEGER NULL,
    `birthYear` INTEGER NULL,
    `familyNickname` VARCHAR(191) NULL,
    `preferredTitle` VARCHAR(191) NULL,
    `identityNote` VARCHAR(500) NULL,
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

-- CreateTable
CREATE TABLE `Notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `actorId` INTEGER NULL,
    `familyId` INTEGER NULL,
    `type` ENUM('family_join_requested', 'join_request_approved', 'join_request_rejected', 'message_received', 'message_replied') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `messageId` INTEGER NULL,
    `replyId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_isRead_createdAt_idx`(`userId`, `isRead`, `createdAt`),
    INDEX `Notification_familyId_idx`(`familyId`),
    INDEX `Notification_messageId_idx`(`messageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FamilyAdminLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `familyId` INTEGER NOT NULL,
    `adminId` INTEGER NOT NULL,
    `targetType` ENUM('join_request', 'message', 'reply', 'member') NOT NULL,
    `targetId` INTEGER NOT NULL,
    `action` ENUM('approve_join_request', 'reject_join_request', 'hide_message', 'hide_reply', 'mute_member', 'unmute_member', 'remove_member', 'set_admin', 'unset_admin', 'update_member_identity') NOT NULL,
    `reason` TEXT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FamilyAdminLog_familyId_createdAt_idx`(`familyId`, `createdAt`),
    INDEX `FamilyAdminLog_targetType_targetId_idx`(`targetType`, `targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FamilyMemory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `familyId` INTEGER NOT NULL,
    `scope` ENUM('family', 'member', 'pair') NOT NULL,
    `scopeKey` VARCHAR(191) NOT NULL,
    `memberId` INTEGER NULL,
    `relatedMemberId` INTEGER NULL,
    `summary` TEXT NOT NULL,
    `avoidPhrases` JSON NULL,
    `effectivePhrases` JSON NULL,
    `sensitiveTopics` JSON NULL,
    `status` ENUM('active', 'stale') NOT NULL DEFAULT 'active',
    `version` INTEGER NOT NULL DEFAULT 1,
    `sourceMessageCount` INTEGER NOT NULL DEFAULT 0,
    `sourceReplyCount` INTEGER NOT NULL DEFAULT 0,
    `sourceMessageId` INTEGER NULL,
    `sourceReplyId` INTEGER NULL,
    `lastRefreshedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FamilyMemory_familyId_scopeKey_key`(`familyId`, `scopeKey`),
    INDEX `FamilyMemory_familyId_scope_status_idx`(`familyId`, `scope`, `status`),
    INDEX `FamilyMemory_memberId_idx`(`memberId`),
    INDEX `FamilyMemory_relatedMemberId_idx`(`relatedMemberId`),
    INDEX `FamilyMemory_sourceMessageId_idx`(`sourceMessageId`),
    INDEX `FamilyMemory_sourceReplyId_idx`(`sourceReplyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Family` ADD CONSTRAINT `Family_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyMember` ADD CONSTRAINT `FamilyMember_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyMember` ADD CONSTRAINT `FamilyMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyJoinRequest` ADD CONSTRAINT `FamilyJoinRequest_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyJoinRequest` ADD CONSTRAINT `FamilyJoinRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyJoinRequest` ADD CONSTRAINT `FamilyJoinRequest_handledById_fkey` FOREIGN KEY (`handledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyMessage` ADD CONSTRAINT `FamilyMessage_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyMessage` ADD CONSTRAINT `FamilyMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyMessageReceiver` ADD CONSTRAINT `FamilyMessageReceiver_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `FamilyMessage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyMessageReceiver` ADD CONSTRAINT `FamilyMessageReceiver_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyReply` ADD CONSTRAINT `FamilyReply_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyReply` ADD CONSTRAINT `FamilyReply_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `FamilyMessage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyReply` ADD CONSTRAINT `FamilyReply_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `FamilyMessage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_replyId_fkey` FOREIGN KEY (`replyId`) REFERENCES `FamilyReply`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyAdminLog` ADD CONSTRAINT `FamilyAdminLog_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyAdminLog` ADD CONSTRAINT `FamilyAdminLog_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyMemory` ADD CONSTRAINT `FamilyMemory_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyMemory` ADD CONSTRAINT `FamilyMemory_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `FamilyMember`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyMemory` ADD CONSTRAINT `FamilyMemory_relatedMemberId_fkey` FOREIGN KEY (`relatedMemberId`) REFERENCES `FamilyMember`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyMemory` ADD CONSTRAINT `FamilyMemory_sourceMessageId_fkey` FOREIGN KEY (`sourceMessageId`) REFERENCES `FamilyMessage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyMemory` ADD CONSTRAINT `FamilyMemory_sourceReplyId_fkey` FOREIGN KEY (`sourceReplyId`) REFERENCES `FamilyReply`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
