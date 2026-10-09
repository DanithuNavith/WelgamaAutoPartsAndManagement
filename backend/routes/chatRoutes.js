const express = require('express');
const Product = require('../models/Product');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { generateInventoryChatReply } = require('../services/inventoryChat');

const router = express.Router();
const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_INVENTORY_PRODUCTS = 200;

router.use(authMiddleware, requireRole('Owner'));

router.post('/', async (req, res) => {
  const { message, history = [] } = req.body || {};
  if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Message must contain 1-${MAX_MESSAGE_LENGTH} characters.` });
  }
  if (!Array.isArray(history) || history.length > MAX_HISTORY_MESSAGES) {
    return res.status(400).json({ error: `Chat history must contain no more than ${MAX_HISTORY_MESSAGES} messages.` });
  }
  const safeHistory = [];
  for (const item of history) {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.text !== 'string' || item.text.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: 'Chat history contains an invalid message.' });
    }
    safeHistory.push({ role: item.role, text: item.text });
  }

  try {
    const products = await Product.find()
      .select('name category quantity price lowStockThreshold')
      .sort({ name: 1 })
      .limit(MAX_INVENTORY_PRODUCTS + 1)
      .lean();
    const truncated = products.length > MAX_INVENTORY_PRODUCTS;
    const inventory = products.slice(0, MAX_INVENTORY_PRODUCTS).map(({ name, category, quantity, price, lowStockThreshold }) => ({
      name,
      category,
      quantity,
      price,
      lowStockThreshold
    }));
    const reply = await generateInventoryChatReply({
      message: message.trim(),
      history: safeHistory,
      products: inventory,
      truncated
    });
    res.json({ reply });
  } catch (error) {
    console.error('Inventory chatbot request failed:', error.message);
    const isUnavailable = error.name === 'AbortError' || error.cause?.code === 'ECONNREFUSED' || error.message.includes('fetch failed');
    res.status(isUnavailable ? 503 : 502).json({
      error: isUnavailable
        ? 'Qwen is unavailable. Start Ollama with the qwen2.5:3b model, then try again.'
        : error.code === 'OLLAMA_HTTP_ERROR' && error.status === 404
          ? 'The Qwen model was not found. Run "ollama pull qwen2.5:3b", then try again.'
        : 'The inventory assistant could not generate a reply. Please try again.'
    });
  }
});

module.exports = router;
