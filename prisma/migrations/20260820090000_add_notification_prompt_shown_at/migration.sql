-- 놀이 효과 화면의 앱 알림 권한 안내를 계정당 최초 1회만 노출한다.
ALTER TABLE "User"
ADD COLUMN "notificationPromptShownAt" TIMESTAMP(3);
