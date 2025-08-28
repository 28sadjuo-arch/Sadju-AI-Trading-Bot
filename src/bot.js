const { Telegraf, Markup } = require('telegraf');
const { trades, getRandomTrade, getTopGainer, getTopLoser, addTrade, getLastTrades, getTotalStats, getDCAStatus, getPortfolio, getSolanaPrice, analyzeMarket } = require('./tradedata');
const { generateTradeCard } = require('./tradecard');
const { format } = require('date-fns');
const fs = require('fs').promises;
const { createCanvas } = require('@napi-rs/canvas');

function setupBot(botToken, chatId) {
  const bot = new Telegraf(botToken);
  let liveMode = false;
  let priceAlerts = {};
  const maxLossLimit = parseFloat(process.env.MAX_LOSS_LIMIT) || -200;
  const slippageTolerance = parseFloat(process.env.SLIPPAGE_TOLERANCE) || 0.05;
  let lastAlertTime = 0;
  let profitTarget = 20;
  const insiderUsernames = ['cryptoyeezuscalls', 'GeppettoDegen', 'Zinsgamble', 'YodaCallss', 'GabbensCalls']; // Replace with real usernames
  const insiderTrades = new Map();

  async function initializeBot() {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await bot.telegram.getMe();
        console.log('Bot initialized successfully.');
        return true;
      } catch (err) {
        console.error(`Initialization attempt ${attempt + 1} failed:`, err);
        if (attempt === 2) throw err;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  initializeBot().catch(err => {
    console.error('Failed to initialize bot after retries:', err);
    process.exit(1);
  });

  bot.catch((err, ctx) => {
    console.error(`Telegraf error for ${ctx?.update?.message?.chat?.id}:`, err);
  });

  bot.launch({
    allowedUpdates: ['message'],
  }).then(() => {
    console.log('Bot launched successfully!');
  }).catch((err) => {
    console.error('Bot launch failed:', err);
    process.exit(1);
  });

  // Restart on unhandled errors
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    bot.stop('Uncaught Exception');
    setTimeout(() => bot.launch(), 5000);
  });

  bot.start((ctx) => {
    if (ctx.chat.id.toString() !== chatId) return ctx.reply('Unauthorized 🚫');
    ctx.reply('*Welcome to Sadju AI Trading Bot v1.4! 🚀💼*\nEnhanced with daily reports, insider trades, and market analysis. Use /help for commands.', { parse_mode: 'Markdown' });
  });

  bot.command('help', (ctx) => {
    if (ctx.chat.id.toString() !== chatId) return ctx.reply('Unauthorized 🚫');
    ctx.reply('*Commands: 🚀*\n/start - Welcome 🎉\n/help - This help 📋\n/randomtrade - Trade card 📊\n/topgainer - Best trade 🥇\n/toploser - Worst trade 🥉\n/history - Last 5 trades ⏳\n/setalert <coin> <price> - Set price alert 🔔\n/settings - Adjust settings ⚙️\n/stats - PnL stats 💹\n/trend - Trend score 📈\n/risk - Risk level ⚠️\n/log - Last 10 logs 📝\n/livetoggle - Switch mode 🔄\n/dca - DCA status 📉\n/portfolio - Holdings 💰\n/chart - PnL chart 📉\n/dailyrpt - Resend latest daily report 📅', { parse_mode: 'Markdown' });
  });

  bot.command('randomtrade', async (ctx) => {
    if (ctx.chat.id.toString() !== chatId) return ctx.reply('Unauthorized 🚫');
    const trade = getRandomTrade();
    addTrade(trade);
    const cardBuffer = await generateTradeCard(trade);
    ctx.replyWithPhoto({ source: cardBuffer }, Markup.inlineKeyboard([
      [Markup.button.callback('Download PNG 📥', `download_${trade.id}`)]
    ]));
  });

  bot.command('topgainer', async (ctx) => {
    if (ctx.chat.id.toString() !== chatId) return ctx.reply('Unauthorized 🚫');
    const trade = getTopGainer();
    const cardBuffer = await generateTradeCard(trade);
    ctx.replyWithPhoto({ source: cardBuffer });
  });

  bot.command('toploser', async (ctx) => {
    if (ctx.chat.id.toString() !== chatId) return ctx.reply('Unauthorized 🚫');
    const trade = getTopLoser();
    const cardBuffer = await generateTradeCard(trade);
    ctx.replyWithPhoto({ source: cardBuffer });
  });

  bot.command('history', (ctx) => {
    if (ctx.chat.id.toString() !== chatId) return ctx.reply('Unauthorized 🚫');
    const lastTrades = getLastTrades(5);
    const message = lastTrades.map(t => `*${t.coin}* - PnL: $${t.pnlUSD} (${t.pnlPercentage}%) - *Time:* ${t.timestamp} ⏳`).join('\n');
    ctx.reply(`*Last 5 Trades: 📜*\n${message || 'No trades yet.'}`, { parse_mode: 'Markdown' });
  });

  bot.command('setalert', (ctx) => {
    if (ctx.chat.id.toString() !== chatId) return ctx.reply('Unauthorized 🚫');
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length !== 2) return ctx.reply('Usage: /setalert <coin> <price> 🔔');
    const [coin, price] = args;
    priceAlerts[coin] = parseFloat(price);
    ctx.reply(`*Price alert set for ${coin} at $${price}* 🔔💰`, { parse_mode: 'Markdown' });
  });

  bot.command('settings', (ctx) => {
    if (ctx.chat.id.toString() !== chatId) return ctx.reply('Unauthorized 🚫');
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(`Max Loss: $${maxLossLimit} ⚠️`, `set_max_loss`)],
      [Markup.button.callback(`Slippage: ${slippageTolerance * 100}% ⚙️`, `set_slippage`)],
      [Markup.button.callback(`Profit Target: ${profitTarget}% 💸`, `set_profit_target`)],
      [Markup.button.callback(`Toggle Alerts: On 🔊`, `toggle_alerts`)],
    ]);
    ctx.reply('*Settings: ⚙️*\nAdjust below:', { parse_mode: 'Markdown', ...keyboard });
  });

  bot.action(/set_max_loss/, (ctx) => {
    ctx.editMessageText('*Set Max Loss Limit:* ⚠️\nReply with new value (e.g., -300)', { parse_mode: 'Markdown' });
    bot.once('text', (msg) => {
      const newLimit = parseFloat(msg.text);
      if (newLimit) process.env.MAX_LOSS_LIMIT = maxLossLimit = newLimit;
      ctx.reply(`*Max Loss Limit set to: $${maxLossLimit}* ✅`, { parse_mode: 'Markdown' });
    });
  });

  bot.action(/set_slippage/, (ctx) => {
    ctx.editMessageText('*Set Slippage Tolerance:* ⚙️\nReply with new value (e.g., 0.1 for 10%)', { parse_mode: 'Markdown' });
    bot.once('text', (msg) => {
      const newSlippage = parseFloat(msg.text);
      if (newSlippage) process.env.SLIPPAGE_TOLERANCE = slippageTolerance = newSlippage;
      ctx.reply(`*Slippage Tolerance set to: ${slippageTolerance * 100}%* ✅`, { parse_mode: 'Markdown' });
    });
  });

  bot.action(/set_profit_target/, (ctx) => {
    ctx.editMessageText('*Set Profit Target:* 💸\nReply with new value (e.g., 25 for 25%)', { parse_mode: 'Markdown' });
    bot.once('text', (msg) => {
      const newTarget = parseFloat(msg.text);
      if (newTarget) profitTarget = newTarget;
      ctx.reply(`*Profit Target set to: ${profitTarget}%* ✅`, { parse_mode: 'Markdown' });
    });
  });

  bot.action(/toggle_alerts/, (ctx) => {
    ctx.editMessageText('*Alerts toggled! 🔊*\nCurrently: On (Add state management for off)', { parse_mode: 'Markdown' });
  });

  bot.action(/download_(.+)/, async (ctx) => {
    try {
      const tradeId = ctx.match[1];
      const trade = trades.find(t => t.id === tradeId) || insiderTrades.get(tradeId);
      if (trade) {
        const cardBuffer = await generateTradeCard(trade);
        ctx.replyWithPhoto({ source: cardBuffer }, { caption: `Download: ${trade.coin} PnL 📥` });
      } else {
        ctx.answerCbQuery('Trade not found. ⚠️');
      }
    } catch (err) {
      console.error('Download failed:', err);
      ctx.answerCbQuery('Error downloading trade. ⚠️');
    }
  });

  bot.command('stats', (ctx) => {
    if (ctx.chat.id.toString() !== chatId) return ctx.reply('Unauthorized 🚫');
    const stats = getTotalStats();
    ctx.reply(`*Stats: 💹*\nTotal PnL: $${stats.totalPnl}\nAverage PnL: $${stats.avgPnl}`, { parse_mode: 'Markdown' });
  });

  bot.command('trend', (ctx) => {
    if (ctx.chat.id.toString() !== chatId) return ctx.reply('Unauthorized 🚫');
    const { trendScore, recommendation } = analyzeMarket();
    ctx.reply(`*Trend Score: ${trendScore}/100* 📈🔍\n${recommendation}`, { parse_mode: 'Markdown' });
  });

  bot.command('risk', (ctx) => {
    if (ctx.chat.id.toString() !== chatId) return ctx.reply('Unauthorized 🚫');
    const totalPnl = getTotalStats().totalPnl;
    const riskLevel = totalPnl < maxLossLimit ? 'High ⚠️' : totalPnl < 0 ? 'Medium 📛' : 'Low ✅';
    ctx.reply(`*Risk Level: ${riskLevel}*\nMax Loss Limit: $${maxLossLimit}\nCurrent PnL: $${totalPnl}`, { parse_mode: 'Markdown' });
  });

  bot.command('log', async (ctx) => {
    if (ctx.chat.id.toString() !== chatId) return ctx.reply('Unauthorized 🚫');
    try {
      const logContent = await fs.readFile('trades.log', 'utf8');
      const lines = logContent.split('\n').slice(-10).join('\n');
      ctx.reply(`*Last 10 Log Entries: 📝*\n\`\`\`${lines}\`\`\``, { parse_mode: 'Markdown' });
    } catch (error) {
      ctx.reply('Error reading log file. 📛');
    }
  });

  bot.command('livetoggle', (ctx) => {
    if (ctx.chat.id.toString() !== chatId) return ctx.reply('Unauthorized 🚫');
    liveMode = !liveMode;
    ctx.reply(`*Mode switched to: ${liveMode ? 'Live 🔴' : 'Demo 🔵'}* 🔄\nNote: Provide live trade data for integration.`, { parse_mode: 'Markdown' });
  });

  bot.command('dca', (ctx) => {
    if (ctx.chat.id.toString() !== chatId) return ctx.reply('Unauthorized 🚫');
    const dcaStatus = getDCAStatus();
    ctx.reply(`*DCA Status: 📉*\n${dcaStatus.map(t => `${t.coin}: Level ${t.dcaLevel} - Avg Entry: $${t.avgEntry}`).join('\n') || 'No active DCA trades. ✅'}`, { parse_mode: 'Markdown' });
  });

  bot.command('portfolio', (ctx) => {
    if (ctx.chat.id.toString() !== chatId) return ctx.reply('Unauthorized 🚫');
    const portfolio = getPortfolio();
    ctx.reply(`*Portfolio: 💰*\nTotal Value: $${portfolio.totalValue}\nHoldings: ${portfolio.holdings.map(h => `${h.coin}: $${h.value}`).join(', ')}`, { parse_mode: 'Markdown' });
  });

  bot.command('chart', async (ctx) => {
    if (ctx.chat.id.toString() !== chatId) return ctx.reply('Unauthorized 🚫');
    const lastTrades = getLastTrades(5);
    const canvas = createCanvas(400, 200);
    const chartCtx = canvas.getContext('2d');
    chartCtx.fillStyle = '#000';
    chartCtx.fillRect(0, 0, 400, 200);
    chartCtx.fillStyle = '#0f0';
    lastTrades.forEach((t, i) => {
      chartCtx.fillRect(i * 80, 200 - (t.pnlUSD + 100), 50, 5);
    });
    ctx.replyWithPhoto({ source: canvas.toBuffer('image/png') }, { caption: '*PnL Chart: 📉* Last 5 trades' });
  });

  bot.command('dailyrpt', (ctx) => {
    if (ctx.chat.id.toString() !== chatId) return ctx.reply('Unauthorized 🚫');
    const now = new Date();
    const dailyTrades = trades.filter(t => {
      const tradeDate = new Date(t.timestamp);
      return tradeDate.getUTCDate() === now.getUTCDate() && tradeDate.getUTCMonth() === now.getUTCMonth() && tradeDate.getUTCFullYear() === now.getUTCFullYear();
    });
    const totalDailyPnl = dailyTrades.reduce((sum, t) => sum + t.pnlUSD, 0);
    const tradeSummary = dailyTrades.map(t => `*${t.coin}* - PnL: $${t.pnlUSD.toFixed(2)} (${t.pnlPercentage.toFixed(2)}%) 💸`).join('\n') || 'No trades today. 🌱';
    const report = `*Hello Sadju! 🌟 Here’s what I did today: 📅*\n${tradeSummary}\n*Total Daily PnL: $${totalDailyPnl.toFixed(2)} 💰*\n*By Sadju AI Bot ✨🚀*`;
    ctx.reply(report, { parse_mode: 'Markdown' });
  });

  async function sendTradeAlert(chatId, telegram, trade, action) {
    const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss z');
    const emoji = trade.pnlUSD >= 0 ? '💰📈🔥🎉' : '📉⚠️💧';
    const actionText = action === 'Buy' ? 'BUY 🚀' : action === 'Sell' ? 'SELL 💸' : 'HOLD 🌱';
    const message = `*${actionText} Alert* ${emoji} (Demo Mode - Simulated)\n*Coin:* ${trade.coin || 'N/A'} 🪙\n*Entry:* $${trade.entryPrice?.toFixed(4) || 'N/A'} 📥 | *Exit:* $${trade.exitPrice?.toFixed(4) || 'N/A'} 📤\n*PnL:* $${trade.pnlUSD?.toFixed(2) || 'N/A'} (${trade.pnlPercentage?.toFixed(2) || 'N/A'}%) 💹\n*Time:* ${now} (CAT) ⏰`;
    try {
      const cardBuffer = await generateTradeCard(trade);
      await telegram.sendPhoto(chatId, { source: cardBuffer }, Markup.inlineKeyboard([
        [Markup.button.callback('Download PNG 📥', `download_${trade.id}`)]
      ]));
      await telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Alert or card failed:', err);
      await telegram.sendMessage(chatId, `${message}\n*Error:* Photo failed, text-only alert. ⚠️`, { parse_mode: 'Markdown' });
    }
  }

  setInterval(() => {
    const now = new Date();
    if (now.getUTCHours() === 21 && now.getUTCMinutes() === 59) { // 23:59 CAT = 21:59 UTC
      const dailyTrades = trades.filter(t => {
        const tradeDate = new Date(t.timestamp);
        return tradeDate.getUTCDate() === now.getUTCDate() && tradeDate.getUTCMonth() === now.getUTCMonth() && tradeDate.getUTCFullYear() === now.getUTCFullYear();
      });
      const totalDailyPnl = dailyTrades.reduce((sum, t) => sum + t.pnlUSD, 0);
      const tradeSummary = dailyTrades.map(t => `*${t.coin}* - PnL: $${t.pnlUSD.toFixed(2)} (${t.pnlPercentage.toFixed(2)}%) 💸`).join('\n') || 'No trades today. 🌱';
      const report = `*Hello Sadju! 🌟 Here’s what I did today: 📅*\n${tradeSummary}\n*Total Daily PnL: $${totalDailyPnl.toFixed(2)} 💰*\n*By Sadju AI Bot ✨🚀*`;
      bot.telegram.sendMessage(chatId, report, { parse_mode: 'Markdown' });
    }
  }, 60000);

  bot.on('message', async (ctx) => {
    if (ctx.chat.id.toString() !== chatId) return; // Restrict to authorized chat
    const messageText = ctx.message.text || '';
    const username = ctx.from.username;
    if (insiderUsernames.includes(username)) {
      // Detect Solana-style CA (e.g., 44 characters, base58)
      const solanaCARegex = /[1-9A-HJ-NP-Za-km-z]{43,44}/;
      const match = messageText.match(solanaCARegex);
      if (match) {
        const coinCA = match[0];
        const coin = `SOL_${coinCA.slice(0, 5)}`; // Shorten for display
        const entryPrice = getSolanaPrice();
        const trade = { id: Date.now().toString(), coin, entryPrice, exitPrice: null, pnlUSD: 0, pnlPercentage: 0, timestamp: new Date().toISOString() };
        insiderTrades.set(trade.id, trade);
        addTrade(trade);
        ctx.reply(`*Insider Buy Alert! 🚨*\nCoin: ${coin} 🪙\nEntry: $${entryPrice.toFixed(4)} 📥\nTP: $${(entryPrice * 3).toFixed(4)} (3x) 🎯\nSL: $${(entryPrice * 0.9).toFixed(4)} (-10%) ⚠️`, { parse_mode: 'Markdown' });

        setTimeout(() => {
          const currentPrice = getSolanaPrice();
          if (currentPrice >= entryPrice * 3) {
            trade.exitPrice = currentPrice;
            trade.pnlUSD = (currentPrice - entryPrice) * 100;
            trade.pnlPercentage = ((currentPrice - entryPrice) / entryPrice) * 100;
            sendTradeAlert(chatId, bot.telegram, trade, 'Sell');
            insiderTrades.delete(trade.id);
          } else if (currentPrice <= entryPrice * 0.9) {
            trade.exitPrice = currentPrice;
            trade.pnlUSD = (currentPrice - entryPrice) * 100;
            trade.pnlPercentage = ((currentPrice - entryPrice) / entryPrice) * 100;
            sendTradeAlert(chatId, bot.telegram, trade, 'Sell');
            insiderTrades.delete(trade.id);
          }
        }, 30000);
      }
    }
  });

  setInterval(() => {
    const now = Date.now();
    if (now - lastAlertTime >= 30000) {
      try {
        const trade = getRandomTrade();
        addTrade(trade);
        const action = Math.random() > 0.66 ? 'Buy' : Math.random() > 0.33 ? 'Sell' : 'Hold';
        const { recommendation } = analyzeMarket();
        sendTradeAlert(chatId, bot.telegram, trade, action);
        fs.appendFile('trades.log', `${format(new Date(), 'yyyy-MM-dd HH:mm:ss')} - ${trade.coin} - ${action} - PnL: $${trade.pnlUSD}\n`, (err) => {
          if (err) console.error('Log write failed:', err);
        });

        for (const [coin, targetPrice] of Object.entries(priceAlerts)) {
          const currentPrice = trade.entryPrice || getSolanaPrice();
          if (currentPrice >= targetPrice) {
            bot.telegram.sendMessage(chatId, `*Price Alert! 🔔*\n${coin} reached $${currentPrice} (Target: $${targetPrice}) 💡`, { parse_mode: 'Markdown' });
            delete priceAlerts[coin];
          }
        }

        lastAlertTime = now;
      } catch (err) {
        console.error('Interval error:', err);
      }
    }
  }, 1000);

  return bot;
}

module.exports = { setupBot };