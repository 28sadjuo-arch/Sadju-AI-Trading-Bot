const trades = [];

function getRandomTrade() {
  const coins = ['SOL', 'BTC', 'ETH', 'DOGE', 'SHIB'];
  const coin = coins[Math.floor(Math.random() * coins.length)];
  const entryPrice = Math.random() * 200;
  const exitPrice = entryPrice * (1 + (Math.random() - 0.5) * 0.2); // Random PnL
  const pnlUSD = (exitPrice - entryPrice) * 100; // Assume 100 units
  const pnlPercentage = ((exitPrice - entryPrice) / entryPrice) * 100;
  return {
    id: Date.now().toString(),
    coin,
    entryPrice,
    exitPrice,
    pnlUSD,
    pnlPercentage,
    timestamp: new Date().toISOString()
  };
}

function getTopGainer() {
  return trades.reduce((max, t) => (max.pnlUSD > t.pnlUSD ? max : t), trades[0] || getRandomTrade());
}

function getTopLoser() {
  return trades.reduce((min, t) => (min.pnlUSD < t.pnlUSD ? min : t), trades[0] || getRandomTrade());
}

function addTrade(trade) {
  trades.push(trade);
  if (trades.length > 50) trades.shift(); // Limit to 50 trades
}

function getLastTrades(count) {
  return trades.slice(-count);
}

function getTotalStats() {
  const totalPnl = trades.reduce((sum, t) => sum + t.pnlUSD, 0);
  const avgPnl = trades.length ? totalPnl / trades.length : 0;
  return { totalPnl, avgPnl };
}

function getDCAStatus() {
  return trades.filter(t => t.pnlUSD < 0).map(t => ({ coin: t.coin, dcaLevel: 1, avgEntry: t.entryPrice }));
}

function getPortfolio() {
  const holdings = [...new Set(trades.map(t => t.coin))].map(coin => ({
    coin,
    value: trades.filter(t => t.coin === coin).reduce((sum, t) => sum + t.pnlUSD, 0)
  }));
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
  return { holdings, totalValue };
}

function getSolanaPrice() {
  return Math.random() * 200; // Simulated price
}

function analyzeMarket() {
  // Simulated market analysis using Grok's web/X search capability
  const trendScore = Math.floor(Math.random() * 101); // Placeholder; refine with real data later
  return {
    trendScore,
    recommendation: trendScore > 70 ? 'Bullish - Increase trades' : trendScore > 40 ? 'Neutral - Maintain' : 'Bearish - Reduce risk'
  };
}

module.exports = { trades, getRandomTrade, getTopGainer, getTopLoser, addTrade, getLastTrades, getTotalStats, getDCAStatus, getPortfolio, getSolanaPrice, analyzeMarket };