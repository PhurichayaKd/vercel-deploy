import express from "express";
import { middleware, Client } from "@line/bot-sdk";
import dotenv from "dotenv";

dotenv.config();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config); // ✅ สร้าง client ไว้ครั้งเดียว ไม่ต้องสร้างใหม่ทุก event
const app = express();

// LINE middleware ใช้ตรวจสอบ signature + parse body
app.post("/webhook", middleware(config), async (req, res) => {
  console.log("🌐 [Webhook Event Received]");
  console.log(JSON.stringify(req.body, null, 2));

  try {
    await Promise.all(
      req.body.events.map(async (event) => {
        console.log("👉 Single event:", event);

        // ถ้าเป็นข้อความ text → ตอบกลับ
        if (event.type === "message" && event.message.type === "text") {
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: `คุณส่งข้อความว่า: ${event.message.text}`,
          });
        }

        // รองรับ follow event (ตอนผู้ใช้กด Add Friend)
        if (event.type === "follow") {
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: "ยินดีต้อนรับ! 🚍 คุณได้เพิ่ม Safety Bus แล้ว",
          });
        }
      })
    );

    res.status(200).end();
  } catch (err) {
    console.error("❌ Error handling event:", err);
    res.status(500).end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
