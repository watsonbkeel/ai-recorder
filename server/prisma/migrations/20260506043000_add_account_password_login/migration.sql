-- AlterTable
ALTER TABLE `User` ADD COLUMN `accountName` VARCHAR(191) NULL,
    ADD COLUMN `passwordHash` VARCHAR(255) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_accountName_key` ON `User`(`accountName`);
