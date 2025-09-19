// lib/line.js
import * as line from '@line/bot-sdk';
import dotenv from 'dotenv';

dotenv.config();

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const lineClient = new line.Client(lineConfig);

export { lineConfig, lineClient };
