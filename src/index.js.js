require('dotenv').config();
console.log('Loading dotenv...');

const { setupBot } = require('./bot');
console.log('Bot module loaded...');

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.CHAT_ID;
console.log('Env variables loaded:', { botToken: !!botToken, chatId: !!chatId });

if (!botToken || !chatId) {
  console.error('Missing TELEGRAM_BOT_TOKEN or CHAT_ID in .env file');
  process.exit(1);
}

const bot = setupBot(botToken, chatId);
console.log('Bot setup completed...');

bot.launch()
  .then(() => console.log('Sadju AI Trading Bot v1.3 is running...'))
  .catch(err => {
    console.error('Launch failed, retrying in 5 seconds:', err);
    setTimeout(() => bot.launch(), 5000);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));