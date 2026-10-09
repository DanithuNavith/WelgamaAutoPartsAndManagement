const test = require('node:test');
const assert = require('node:assert/strict');
const { generateInventoryChatReply } = require('./inventoryChat');

test('sends Qwen the recent chat and a read-only inventory context', async () => {
  let request;
  const reply = await generateInventoryChatReply({
    message: 'Can you explain which needs restocking?',
    history: [{ role: 'user', text: 'Hello' }],
    products: [{ name: 'Oil filter', quantity: 2, price: 1500 }],
    fetchImpl: async (url, options) => {
      request = { url, body: JSON.parse(options.body) };
      return { ok: true, json: async () => ({ message: { content: 'The oil filter has 2 in stock.' } }) };
    }
  });

  assert.equal(reply, 'The oil filter has 2 in stock.');
  assert.equal(request.url, 'http://127.0.0.1:11434/api/chat');
  assert.equal(request.body.model, 'qwen2.5:3b');
  assert.equal(request.body.stream, false);
  assert.equal(request.body.messages.at(-1).content, 'Can you explain which needs restocking?');
  assert.match(request.body.messages[0].content, /read-only inventory assistant/);
  assert.match(request.body.messages[0].content, /"Oil filter"/);
  assert.doesNotMatch(request.body.messages[0].content, /costPrice/);
});

test('identifies a missing Ollama model response', async () => {
  await assert.rejects(
    generateInventoryChatReply({
      message: 'Hello',
      fetchImpl: async () => ({ ok: false, status: 404 })
    }),
    error => error.code === 'OLLAMA_HTTP_ERROR' && error.status === 404
  );
});

test('rejects empty model replies', async () => {
  await assert.rejects(
    generateInventoryChatReply({
      message: 'Hello',
      fetchImpl: async () => ({ ok: true, json: async () => ({ message: { content: '  ' } }) })
    }),
    /empty reply/
  );
});
