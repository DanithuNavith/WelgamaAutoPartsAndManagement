import React, { useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, X } from 'lucide-react';
import { askInventoryAssistant, createProduct, updateProduct } from '../services/api';
import { getInventoryChatIntent, getStockExtremeReply } from '../utils/inventoryChatIntents';
import { validateInventoryProduct } from '../utils/inventoryValidation';
import './InventoryChatbot.css';

const capabilitiesMessage = 'I can:\n• Find parts and show current quantity and selling price.\n• List inventory, find low/out-of-stock parts, and report the lowest or highest stock.\n• Add a part or update its quantity, selling price, cost price, or low-stock threshold. I’ll show the change and ask you to confirm before saving.\n\nTry “What is the lowest stock in inventory?” or “Do we have oil filters?”';
const initialMessage = `Hi there! I can help with inventory questions and guided updates. ${capabilitiesMessage}`;
const addSteps = [
  ['name', 'Great! What should I call this part?'],
  ['category', 'What category does it belong to?'],
  ['price', 'What is its selling price in LKR?'],
  ['costPrice', 'And what is its cost price in LKR?'],
  ['quantity', 'How many do you have in stock right now?'],
  ['lowStockThreshold', 'At what quantity would you like a low-stock alert?']
];
const updateFields = {
  quantity: { key: 'quantity', label: 'quantity', prompt: 'What should the new quantity be?' },
  stock: { key: 'quantity', label: 'quantity', prompt: 'What should the new quantity be?' },
  price: { key: 'price', label: 'selling price', prompt: 'What should the new selling price be in LKR?' },
  'selling price': { key: 'price', label: 'selling price', prompt: 'What should the new selling price be in LKR?' },
  'cost price': { key: 'costPrice', label: 'cost price', prompt: 'What should the new cost price be in LKR?' },
  'low stock threshold': { key: 'lowStockThreshold', label: 'low-stock threshold', prompt: 'What should the new low-stock threshold be?' },
  threshold: { key: 'lowStockThreshold', label: 'low-stock threshold', prompt: 'What should the new low-stock threshold be?' }
};
const getUpdateField = text => {
  if (updateFields[text]) return updateFields[text];
  if (/\b(cost price|purchase price)\b/.test(text)) return updateFields['cost price'];
  if (/\b(threshold|low stock|alert level)\b/.test(text)) return updateFields['low stock threshold'];
  if (/\b(selling price|price|amount)\b/.test(text)) return updateFields.price;
  if (/\b(quantity|stock|units|how many)\b/.test(text)) return updateFields.quantity;
  return null;
};
const money = value => `LKR ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const normalize = value => value.trim().toLowerCase().replace(/[?!.,]+$/g, '');
const singularize = word => word.length > 4 && word.endsWith('ies')
  ? `${word.slice(0, -3)}y`
  : word.length > 3 && word.endsWith('s') && !word.endsWith('ss')
    ? word.slice(0, -1)
    : word;
const quantityCondition = text => {
  const amount = text.match(/\b\d+(?:\.\d+)?\b/);
  if (!amount) return null;
  const value = Number(amount[0]);
  const above = /\b(above|over|more than|greater than|at least|or more|and above)\b|>|\d+\s*\+/.test(text);
  const below = /\b(below|under|lower than|less than|fewer than|at most|no more than|up to|or less|and below)\b|<|at or below/.test(text);
  if (above) {
    const inclusive = /\b(at least|or more|and above)\b|\d+\s*\+|>=/.test(text);
    return { value, matches: quantity => inclusive ? quantity >= value : quantity > value, description: `${inclusive ? 'at least' : 'more than'} ${value}` };
  }
  if (below) {
    const inclusive = /\b(at most|no more than|up to|or less|and below|at or below)\b|<=/.test(text);
    return { value, matches: quantity => inclusive ? quantity <= value : quantity < value, description: `${inclusive ? 'at most' : 'fewer than'} ${value}` };
  }
  return null;
};
const partSearchTerms = text => {
  const cleaned = text
    .replace(/^(?:(?:hi|hello|hey)[, ]+)?(?:can you |could you |please )?(?:tell me |show me |find |search for |do we have |what(?:'s| is| are)? |which |how many )*/i, '')
    .replace(/\b(?:do we have|do you have|we have|in stock|available|currently|please|the|a|an|parts?|products?|items?|stock|quantity|inventory|for|of|is|are|any|we|you|have|do|does|did|carry|sell|price|prices|cost|details?)\b/gi, ' ')
    .replace(/[?!.,]/g, ' ')
    .trim();
  return cleaned.split(/\s+/).filter(Boolean).map(singularize);
};

const InventoryChatbot = ({ products, onProductSaved }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', text: initialMessage }]);
  const [input, setInput] = useState('');
  const [flow, setFlow] = useState(null);
  const [busy, setBusy] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const say = text => setMessages(current => [...current, { role: 'assistant', text }]);
  const findMatches = query => {
    const terms = partSearchTerms(query);
    if (!terms.length) return [];
    return products.filter(product => {
      const searchableText = `${product.name} ${product.category}`.toLowerCase().split(/\s+/).map(singularize);
      return terms.every(term => searchableText.some(word => word.includes(term) || term.includes(word)));
    });
  };
  const startAdd = () => {
    const nextFlow = {
      type: 'add',
      step: addSteps[0][0],
      data: { name: '', category: '', price: '', costPrice: '', quantity: '', lowStockThreshold: 5, image: '' }
    };
    setFlow(nextFlow);
    say(addSteps[0][1]);
  };

  const processMessage = async rawMessage => {
    const text = rawMessage.trim();
    if (!text || busy) return;
    setMessages(current => [...current, { role: 'user', text }]);
    const normalizedText = normalize(text);

    if (normalizedText === 'cancel' || normalizedText === 'stop') {
      setFlow(null);
      say('Okay, I cancelled that inventory change.');
      return;
    }

    if (flow?.type === 'add' && flow.step !== 'confirm') {
      const currentIndex = addSteps.findIndex(([step]) => step === flow.step);
      const data = { ...flow.data, [flow.step]: text };
      const nextStep = addSteps[currentIndex + 1];
      if (nextStep) {
        setFlow({ ...flow, step: nextStep[0], data });
        say(nextStep[1]);
        return;
      }
      const product = {
        ...data,
        price: Number(data.price),
        costPrice: Number(data.costPrice),
        quantity: Number(data.quantity),
        lowStockThreshold: Number(data.lowStockThreshold)
      };
      const errors = validateInventoryProduct(product);
      if (Object.keys(errors).length) {
        const invalidStep = addSteps.find(([step]) => errors[step]);
        setFlow({ ...flow, data, step: invalidStep[0] });
        say(`${errors[invalidStep[0]]} ${invalidStep[1]}`);
        return;
      }
      setFlow({ type: 'add', step: 'confirm', product });
      say(`Here’s what I’m about to add: ${product.name} (${product.category}), ${product.quantity} in stock, selling price ${money(product.price)}, and cost price ${money(product.costPrice)}. Would you like me to save it? Reply “yes” to confirm or “cancel” to stop.`);
      return;
    }

    if (flow?.type === 'update') {
      if (flow.step === 'chooseProduct') {
        const matchIndex = Number(text) - 1;
        const product = Number.isInteger(matchIndex) && flow.matches[matchIndex]
          ? flow.matches[matchIndex]
          : flow.matches.find(item => item.name.toLowerCase() === normalizedText);
        if (!product) {
          say('Please enter one of the listed numbers or type a part name exactly as shown.');
          return;
        }
        setFlow({ type: 'update', step: 'chooseField', product });
        say(`What would you like to change for ${product.name}? Reply quantity, selling price, cost price, or low-stock threshold.`);
        return;
      }
      if (flow.step === 'chooseField') {
        const field = getUpdateField(normalizedText);
        if (!field) {
          say('No problem—would you like to change the stock quantity, selling price, cost price, or low-stock alert level?');
          return;
        }
        setFlow({ ...flow, step: 'value', field });
        say(field.prompt);
        return;
      }
      if (flow.step === 'value') {
        const value = Number(text);
        if (!text || !Number.isFinite(value)) {
          say('Enter a valid number for the new value.');
          return;
        }
        const product = { ...flow.product, [flow.field.key]: value };
        const errors = validateInventoryProduct(product);
        if (Object.keys(errors).length) {
          say(`I can't use that value: ${Object.values(errors).join(' ')}`);
          say(flow.field.prompt);
          return;
        }
        setFlow({ type: 'update', step: 'confirm', product });
        say(`Please confirm: change ${flow.field.label} for ${product.name} to ${flow.field.key === 'quantity' || flow.field.key === 'lowStockThreshold' ? value : money(value)}. Reply "yes" to save or "cancel".`);
        return;
      }
    }

    if (flow?.step === 'confirm') {
      if (!/^(yes|yes please|confirm|go ahead|save it|do it)$/.test(normalizedText)) {
        say('That’s fine—nothing has been changed yet. Say “yes” when you’re ready, or “cancel” to stop.');
        return;
      }
      setBusy('saving');
      try {
        const product = flow.type === 'add'
          ? await createProduct(flow.product)
          : await updateProduct(flow.product._id, flow.product);
        onProductSaved(product);
        setFlow(null);
        say(`${product.name} was ${flow.type === 'add' ? 'added to' : 'updated in'} inventory successfully.`);
      } catch (error) {
        say(`I couldn't save the inventory change: ${error.message || 'Please try again.'}`);
      } finally {
        setBusy('');
      }
      return;
    }

    const inventoryIntent = getInventoryChatIntent(normalizedText);
    if (inventoryIntent === 'capabilities') {
      say(capabilitiesMessage);
      return;
    }
    const quantityFilter = quantityCondition(normalizedText);
    const isLowStockQuestion = /\b(low stock|low inventory|stock alerts|running low|need restock)\b/.test(normalizedText);
    const isOutOfStockQuestion = /\b(no stock|out of stock|zero stock|stock is empty|none in stock)\b/.test(normalizedText);
    if (isOutOfStockQuestion) {
      const outOfStock = products.filter(product => Number(product.quantity) === 0);
      const lowStock = products.filter(product => Number(product.quantity) > 0 && Number(product.quantity) <= Number(product.lowStockThreshold ?? 5));
      const reply = [];
      reply.push(outOfStock.length
        ? `${outOfStock.length === 1 ? 'This part is' : `These ${outOfStock.length} parts are`} currently out of stock:\n${outOfStock.map(product => `• ${product.name}`).join('\n')}`
        : 'Good news—no parts are completely out of stock right now.');
      if (lowStock.length) {
        reply.push(`These parts are running low and may need restocking soon:\n${lowStock.map(product => `• ${product.name} — ${product.quantity} left (low-stock alert at ${product.lowStockThreshold ?? 5})`).join('\n')}`);
      } else {
        reply.push('There are no other parts below their low-stock alert level.');
      }
      say(reply.join('\n\n'));
      return;
    }
    if (inventoryIntent === 'lowest-stock' || inventoryIntent === 'highest-stock') {
      say(getStockExtremeReply(products, inventoryIntent));
      return;
    }
    if (quantityFilter && /\b(stock|parts?|products?|items?|inventory|quantity)\b/.test(normalizedText)) {
      const matches = products.filter(product => quantityFilter.matches(Number(product.quantity)));
      const lowStock = products.filter(product => Number(product.quantity) > 0 && Number(product.quantity) <= Number(product.lowStockThreshold ?? 5));
      say(matches.length
        ? `Sure! ${matches.length === 1 ? 'This part' : `These ${matches.length} parts`} ${matches.length === 1 ? 'has' : 'have'} ${quantityFilter.description} in stock:\n${matches.map(product => `• ${product.name} — ${product.quantity} in stock`).join('\n')}`
        : `There aren’t any parts with ${quantityFilter.description} in stock right now.${lowStock.length
          ? ` However, these parts are currently running low and may need restocking:\n${lowStock.map(product => `• ${product.name} — ${product.quantity} left (low-stock alert at ${product.lowStockThreshold ?? 5})`).join('\n')}`
          : ' There are no parts below their low-stock alert level either.'}`);
      return;
    }
    if (isLowStockQuestion) {
      const requestedLimit = normalizedText.match(/\b\d+(?:\.\d+)?\b/);
      const lowStock = products.filter(product => Number(product.quantity) <= Number(requestedLimit?.[0] ?? product.lowStockThreshold ?? 5));
      const limitDescription = requestedLimit ? `${requestedLimit[0]} or fewer` : 'at or below their low-stock alert level';
      say(lowStock.length
        ? `I found ${lowStock.length} part${lowStock.length === 1 ? '' : 's'} with ${limitDescription} in stock:\n${lowStock.map(product => `• ${product.name} — ${product.quantity} in stock${requestedLimit ? '' : ` (alert at ${product.lowStockThreshold ?? 5})`}`).join('\n')}`
        : `There aren’t any parts with ${limitDescription} in stock right now. Good news—no parts are currently at or below their low-stock alert level.`);
      return;
    }
    if (/\b(list parts|show (?:me )?(?:the )?(?:parts|inventory)|all parts|list inventory|what (?:parts|products|items) (?:do (?:we|you) have|are available|are in stock))\b/.test(normalizedText)) {
      say(products.length
        ? `Here’s what we have in inventory:\n${products.slice(0, 20).map(product => `• ${product.name} — ${product.quantity} in stock`).join('\n')}${products.length > 20 ? `\n…and ${products.length - 20} more. Ask me about a particular part to check it.` : ''}`
        : 'There aren’t any parts in inventory yet.');
      return;
    }
    if (/^(add|create)( a)? (part|product)$/.test(normalizedText)) {
      startAdd();
      return;
    }
    if (normalizedText === 'update' || normalizedText === 'update part') {
      if (!products.length) {
        say('I don’t see any parts in inventory to update yet. I can help you add one first.');
        return;
      }
      setFlow({ type: 'update', step: 'chooseProduct', matches: products });
      say(`Sure! Which part would you like to update?\n${products.slice(0, 8).map((product, index) => `${index + 1}. ${product.name} (${product.category})`).join('\n')}\nReply with the part name or its number.`);
      return;
    }
    const updateCommand = normalizedText.match(/^(?:update|edit|change)(?: the)?(?: part)?\s+(.+)$/);
    if (updateCommand) {
      const matches = findMatches(updateCommand[1]);
      if (!matches.length) {
        say(`I couldn’t find a part matching “${updateCommand[1]}”. Could you check the name, or say “show me all parts” and I’ll help you find it?`);
        return;
      }
      if (matches.length === 1) {
        setFlow({ type: 'update', step: 'chooseField', product: matches[0] });
        say(`What would you like to change for ${matches[0].name}? You can update its quantity, selling price, cost price, or low-stock alert level.`);
      } else {
        setFlow({ type: 'update', step: 'chooseProduct', matches });
        say(`I found a few matching parts. Which one did you mean?\n${matches.slice(0, 8).map((product, index) => `${index + 1}. ${product.name} (${product.category})`).join('\n')}\nReply with the part name or its number.`);
      }
      return;
    }
    if (/\b(add|create) (a )?(part|product)\b/.test(normalizedText)) {
      startAdd();
      return;
    }

    const query = normalizedText;
    const matches = findMatches(query);
    if (query && matches.length) {
      say(matches.length === 1
        ? `Yes, we have ${matches[0].name} in ${matches[0].category}. There ${Number(matches[0].quantity) === 1 ? 'is' : 'are'} ${matches[0].quantity} in stock, and the price is ${money(matches[0].price)}.`
        : `I found ${matches.length} matching parts:\n${matches.slice(0, 10).map(product => `• ${product.name} — ${product.quantity} in stock, ${money(product.price)} each`).join('\n')}`);
      return;
    }
    setBusy('thinking');
    try {
      const reply = await askInventoryAssistant(text, messages.slice(-8));
      say(reply);
    } catch (error) {
      say(error.message || 'Qwen is unavailable. Start Ollama with the qwen2.5:3b model, then try again.');
    } finally {
      setBusy('');
    }
  };

  const submitMessage = event => {
    event.preventDefault();
    const text = input;
    setInput('');
    processMessage(text);
  };

  return (
    <div className="inventory-chatbot">
      {open && (
        <section className="inventory-chat-panel" aria-label="Inventory assistant">
          <header className="inventory-chat-header">
            <span className="inventory-chat-avatar"><Bot size={18} /></span>
            <div><strong>Inventory assistant</strong><small>Qwen AI · stock lookup and updates</small></div>
            <button type="button" className="inventory-chat-close" aria-label="Close inventory assistant" onClick={() => setOpen(false)}><X size={18} /></button>
          </header>
          <div className="inventory-chat-messages" role="log" aria-live="polite">
            {messages.map((message, index) => <div key={index} className={`inventory-chat-message ${message.role}`}>{message.text}</div>)}
            {busy && <div className="inventory-chat-message assistant" role="status">{busy === 'saving' ? 'Saving inventory change...' : 'Qwen is thinking...'}</div>}
            <div ref={messagesEndRef} />
          </div>
          <div className="inventory-chat-suggestions">
            <button type="button" disabled={busy} onClick={() => processMessage('What is the lowest stock in inventory?')}>Lowest stock</button>
            <button type="button" disabled={busy} onClick={() => processMessage('low stock')}>Low stock</button>
            <button type="button" disabled={busy} onClick={() => processMessage('What can this bot do?')}>What can you do?</button>
            <button type="button" disabled={busy} onClick={() => processMessage('add part')}>Add part</button>
            <button type="button" disabled={busy} onClick={() => processMessage('update part')}>Update part</button>
          </div>
          <form className="inventory-chat-input" onSubmit={submitMessage}>
            <input aria-label="Message inventory assistant" value={input} onChange={event => setInput(event.target.value)} placeholder={flow?.step === 'confirm' ? 'Type yes to save...' : 'Ask about stock or make a change...'} disabled={busy} />
            <button type="submit" aria-label="Send message" disabled={busy || !input.trim()}><Send size={17} /></button>
          </form>
        </section>
      )}
      <button type="button" className={`inventory-chat-launcher${open ? ' open' : ''}`} aria-label={open ? 'Close inventory assistant' : 'Open inventory assistant'} onClick={() => setOpen(current => !current)}>
        {open ? <X size={22} /> : <><MessageCircle size={21} /><span>Inventory help</span></>}
      </button>
    </div>
  );
};

export default InventoryChatbot;
