const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs').promises;
const { format } = require('date-fns');

async function generateTradeCard(trade) {
  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext('2d');

  const isProfit = trade.pnlUSD >= 0;
  const folder = isProfit ? 'profit' : 'loss';
  const images = await fs.readdir(path.join(__dirname, `../images/${folder}`));
  const randomImage = images[Math.floor(Math.random() * images.length)];
  const background = await loadImage(path.join(__dirname, `../images/${folder}`, randomImage));

  ctx.drawImage(background, 0, 0, 800, 400);

  // Gradient border
  const gradient = ctx.createLinearGradient(0, 0, 800, 400);
  gradient.addColorStop(0, '#1a1a1a');
  gradient.addColorStop(1, '#4a90e2');
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 790, 390);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(50, 50, 700, 300);

  ctx.font = 'bold 30px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Sadju AI Trading Bot', 70, 90);

  ctx.font = '24px Arial';
  ctx.fillText(`Coin: ${trade.coin}`, 70, 140);
  ctx.fillStyle = '#00ff00';
  ctx.fillText(`Entry: $${trade.entryPrice}`, 70, 180);
  ctx.fillStyle = '#ff0000';
  ctx.fillText(`Exit: $${trade.exitPrice}`, 70, 220);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`PnL: $${Math.abs(trade.pnlUSD)} (${Math.abs(trade.pnlPercentage)}%)`, 70, 260);

  // Profit/Loss Bar
  ctx.fillStyle = isProfit ? '#00ff00' : '#ff0000';
  const barWidth = Math.min(Math.abs(trade.pnlUSD) / 10, 600); // Scale to 600px max
  ctx.fillRect(70, 300, barWidth, 20);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`Time: ${trade.timestamp} (CAT)`, 70, 340);

  return canvas.toBuffer('image/png');
}

module.exports = { generateTradeCard };