import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getInventoryChatIntent, getInventoryFallbackReply, getStockExtremeReply } from './inventoryChatIntents.js';

test('recognizes natural questions about the lowest inventory stock', () => {
  assert.equal(getInventoryChatIntent('what is the lowest stock in inventory'), 'lowest-stock');
  assert.equal(getInventoryChatIntent('Which part has the fewest items?'), 'lowest-stock');
});

test('recognizes natural questions about the highest inventory stock', () => {
  assert.equal(getInventoryChatIntent('Which product has the most stock?'), 'highest-stock');
  assert.equal(getInventoryChatIntent('What is the maximum quantity?'), 'highest-stock');
});

test('recognizes questions about chatbot capabilities', () => {
  assert.equal(getInventoryChatIntent('what things can this bot do'), 'capabilities');
  assert.equal(getInventoryChatIntent('help'), 'capabilities');
});

test('recognizes greetings without requiring the AI service', () => {
  assert.equal(getInventoryChatIntent('hi'), 'greeting');
  assert.equal(getInventoryChatIntent('hi there'), 'greeting');
  assert.equal(getInventoryChatIntent('good morning'), 'greeting');
});

test('provides useful local replies when no product matches or a question is out of scope', () => {
  assert.match(getInventoryFallbackReply('do we have toyota aqua rear door'), /couldn’t find a matching part/i);
  assert.match(getInventoryFallbackReply('tell me a joke'), /help with parts, current stock/i);
});

test('reports all parts tied for an inventory stock extreme', () => {
  const products = [
    { name: 'Oil filter', quantity: 2 },
    { name: 'Air filter', quantity: 2 },
    { name: 'Brake pad', quantity: 12 }
  ];

  assert.equal(
    getStockExtremeReply(products, 'lowest-stock'),
    'The lowest stock level is tied between Oil filter (2 in stock), Air filter (2 in stock).'
  );
  assert.equal(
    getStockExtremeReply(products, 'highest-stock'),
    'The highest stock level is Brake pad (12 in stock).'
  );
});

test('explains when inventory has no stock records', () => {
  assert.match(getStockExtremeReply([], 'lowest-stock'), /no parts in inventory/i);
  assert.match(getStockExtremeReply([{ name: 'Unknown', quantity: 'n/a' }], 'lowest-stock'), /couldn’t read/i);
});
