const crypto = require('crypto');
const { format } = require('date-fns');

const topMemecoins = ['bonk', 'wuffi', 'mew', 'popcat', 'book-of-meme', 'floki', 'pepe', 'dogecoin', 'shiba-inu', 'samoyedcoin', 'raydium', 'orca', 'step-finance', 'kin', 'serum', 'bonfida', 'star-atlas', 'solanadream', 'helium', 'maps', 'cyclone', 'gram', 'dingo', 'gigachad', 'penguin', 'duel', 'dust', 'soup', 'tata', 'zebec'];
let trades = []; // Made global and exported
let dcaTrades = {};

function fetchSimulatedPrice() {
  return (Math.random() * 9.999 + 0.001).toFixed(4);
}

function generateRandomTrade() {
  const coin = topMemecoins[Math.floor(Math.random() * topMemecoins.length)];
  const entryPrice = parseFloat(fetchSimulatedPrice());
  const exitPrice = entryPrice * (1 + (Math.random() - 0.5) * 0.2); // ±10% variation
  const amount = (Math.random() * 1000).toFixed(2);
  const pnlUSD = ((exitPrice - entryPrice) * amount).toFixed(2);
  const pnlPercentage = (((exitPrice - entryPrice) / entryPrice) * 100).toFixed(2);
  
  return {
    id: crypto.randomUUID(),
    coin,
    entryPrice,
    exitPrice,
    amount: parseFloat(amount),
    pnlUSD: parseFloat(pnlUSD),
    pnlPercentage: parseFloat(pnlPercentage),
    timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
  };
}

function addTrade(trade) {
  trades.push(trade);
  if (trades.length > 50) trades.shift();

  if (trade.pnlUSD < 0 && !dcaTrades[trade.coin]) {
    const dcaLevel = 1;
    const dcaAmount = trade.amount * 0.5;
    const newEntry = (trade.entryPrice * trade.amount + (trade.entryPrice * 0.9) * dcaAmount) / (trade.amount + dcaAmount);
    dcaTrades[trade.coin] = { dcaLevel, avgEntry: newEntry, amount: trade.amount + dcaAmount };
    addTrade({ ...trade, entryPrice: newEntry, amount: trade.amount + dcaAmount, dcaLevel });
  } else if (dcaTrades[trade.coin] && dcaTrades[trade.coin].dcaLevel < 3 && trade.pnlUSD < dcaTrades[trade.coin].avgEntry * 0.9) {
    dcaTrades[trade.coin].dcaLevel++;
    const dcaAmount = trade.amount * 0.5;
    const newEntry = (dcaTrades[trade.coin].avgEntry * dcaTrades[trade.coin].amount + (trade.entryPrice * 0.9) * dcaAmount) / (dcaTrades[trade.coin].amount + dcaAmount);
    dcaTrades[trade.coin].avgEntry = newEntry;
    dcaTrades[trade.coin].amount += dcaAmount;
    addTrade({ ...trade, entryPrice: newEntry, amount: dcaTrades[trade.coin].amount, dcaLevel: dcaTrades[trade.coin].dcaLevel });
  }

  if (trade.pnlUSD < -20 * trade.amount) {
    console.log(`Stop Loss triggered for ${trade.coin} at $${trade.pnlUSD}`);
    delete dcaTrades[trade.coin];
  }
}

function getRandomTrade() {
  return generateRandomTrade();
}

function getTopGainer() {
  return trades.reduce((max, trade) => (trade.pnlUSD > max.pnlUSD ? trade : max), trades[0]) || generateRandomTrade();
}

function getTopLoser() {
  return trades.reduce((min, trade) => (trade.pnlUSD < min.pnlUSD ? trade : min), trades[0]) || generateRandomTrade();
}

function getLastTrades(limit) {
  return trades.slice(-limit);
}

function getTotalStats() {
  const totalPnl = trades.reduce((sum, t) => sum + t.pnlUSD, 0);
  const avgPnl = trades.length ? totalPnl / trades.length : 0;
  return { totalPnl: totalPnl.toFixed(2), avgPnl: avgPnl.toFixed(2) };
}

function getDCAStatus() {
  return Object.entries(dcaTrades).map(([coin, data]) => ({ coin, dcaLevel: data.dcaLevel, avgEntry: data.avgEntry }));
}

function getPortfolio() {
  const holdings = topMemecoins.map(coin => {
    const tradesForCoin = trades.filter(t => t.coin === coin && t.pnlUSD >= 0);
    const value = tradesForCoin.reduce((sum, t) => sum + t.amount * t.exitPrice, 0);
    return { coin, value: value.toFixed(2) };
  }).filter(h => h.value > 0);
  const totalValue = holdings.reduce((sum, h) => sum + parseFloat(h.value), 0);
  return { totalValue: totalValue.toFixed(2), holdings };
}

module.exports = { trades, getRandomTrade, getTopGainer, getTopLoser, addTrade, getLastTrades, getTotalStats, getDCAStatus, getPortfolio };