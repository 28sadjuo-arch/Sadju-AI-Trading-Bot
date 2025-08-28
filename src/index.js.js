require('dotenv').config(); // Load .env file
const express = require('express');
const { setupBot } = require('./bot');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

const bot = setupBot(process.env.TELEGRAM_BOT_TOKEN, process.env.CHAT_ID);
bot.launch({
  webhook: {
    domain: `https://sadju-ai-bot.onrender.com`,
    port: process.env.PORT || 3000,
  },
}).then(() => {
  console.log('Bot launched with webhook!');
}).catch((err) => {
  console.error('Bot launch failed:', err);
  process.exit(1);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});