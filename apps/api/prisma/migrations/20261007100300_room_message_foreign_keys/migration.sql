ALTER TABLE "RoomTextMessage" DROP CONSTRAINT "RoomTextMessage_roomId_fkey", DROP CONSTRAINT "RoomTextMessage_senderUserId_fkey";
ALTER TABLE "RoomTextMessage" ADD CONSTRAINT "RoomTextMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomTextMessage" ADD CONSTRAINT "RoomTextMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
