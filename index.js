// ============================================
// // ============================================
// 1X PARTNER BOT v6.0 (ULTIMATE SYSTEM)
// Admin Chat ID: 1018892094
// ============================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const app = express();
app.use(express.json());

// ============================================
// SECURITY (ANTI SPAM)
// ============================================
app.use(rateLimit({ windowMs: 60 * 1000, max: 60 }));

// ============================================
// ENV
// ============================================
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_CHAT_ID = '1018892094';

// ============================================
// DB
// ============================================
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Mongo Connected'))
  .catch(console.error);

// ============================================
// MODELS
// ============================================
const Session = mongoose.model('Session', new mongoose.Schema({ chatId: String, step: String, data: Object }));

const Agent = mongoose.model('Agent', new mongoose.Schema({
  agentCode: String,
  username: String,
  password: String,
  name: String,
  chatId: String,
  debt: { type: Number, default: 0 },
  creditLimit: { type: Number, default: 10000 },
  commission: { type: Number, default: 100 },
  role: { type: String, default: 'agent' }
}));

const Client = mongoose.model('Client', new mongoose.Schema({
  playerId: String,
  name: String,
  chatId: String,
  cashback: { type: Number, default: 0 },
  cashbackPercent: { type: Number, default: 7 },
  referredBy: String,
  referralEarnings: { type: Number, default: 0 },
  vip: { type: Boolean, default: false }
}));

const Charge = mongoose.model('Charge', new mongoose.Schema({
  chargeId: String,
  agentCode: String,
  agentName: String,
  playerId: String,
  amount: Number,
  commission: Number,
  total: Number,
  status: { type: String, default: 'pending' }
}));

const Contest = mongoose.model('Contest', new mongoose.Schema({
  title: String,
  prize: Number,
  active: Boolean
}));

const Log = mongoose.model('Log', new mongoose.Schema({
  action: String,
  by: String,
  at: { type: Date, default: Date.now }
}));

// ============================================
// HELPERS
// ============================================
async function send(chatId, text, keyboard = null) {
  const payload = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (keyboard) payload.reply_markup = keyboard;
  await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, payload);
}

async function log(action, by) {
  await Log.create({ action, by });
}

async function getSession(chatId) {
  let s = await Session.findOne({ chatId });
  if (!s) s = await Session.create({ chatId, step: null, data: {} });
  return s;
}

async function clearSession(chatId) {
  await Session.deleteOne({ chatId });
}

// ============================================
// KEYBOARDS
// ============================================
const adminKB = { keyboard: [[{ text: '➕ وكيل' }, { text: '📊 تقرير' }],[{ text: '🏆 مسابقة' }]], resize_keyboard: true };
const agentKB = { keyboard: [[{ text: '💳 شحن' }, { text: '👤 عميل' }],[{ text: '📈 حسابي' }, { text: '🚪 خروج' }]], resize_keyboard: true };

// ============================================
// MAIN LOGIC
// ============================================
async function processMessage(chatId, text) {

  if (text === '/start') {
    await clearSession(chatId);
    if (String(chatId) === ADMIN_CHAT_ID) return send(chatId, '👑 Admin Panel', adminKB);
    return send(chatId, '👋 مرحبا، دخول وكيل', { keyboard: [[{ text: '🔑 دخول وكيل' }]], resize_keyboard: true });
  }

  // ADMIN
  if (String(chatId) === ADMIN_CHAT_ID) {
    if (text === '📊 تقرير') {
      const a = await Agent.countDocuments();
      const c = await Client.countDocuments();
      return send(chatId, `📊 تقرير
وكلاء: ${a}
عملاء: ${c}`);
    }
    if (text === '🏆 مسابقة') {
      await Contest.create({ title: 'Lucky', prize: 5000, active: true });
      return send(chatId, '🏆 تم إنشاء مسابقة');
    }
  }

  // AGENT LOGIN
  if (text === '🔑 دخول وكيل') {
    await Session.findOneAndUpdate({ chatId }, { step: 'AG_USER' }, { upsert: true });
    return send(chatId, 'اسم المستخدم');
  }

  const session = await getSession(chatId);

  if (session.step === 'AG_USER') {
    session.data = { username: text };
    session.step = 'AG_PASS';
    await session.save();
    return send(chatId, 'كلمة المرور');
  }

  if (session.step === 'AG_PASS') {
    const ag = await Agent.findOne({ username: session.data.username, password: text });
    if (!ag) return send(chatId, '❌ خطأ');
    ag.chatId = chatId; await ag.save(); await clearSession(chatId);
    return send(chatId, `✅ مرحبا ${ag.name}`, agentKB);
  }

  // AGENT ACTIONS
  const agent = await Agent.findOne({ chatId });
  if (agent) {
    if (text === '📈 حسابي') return send(chatId, `💳 دين: ${agent.debt}`);
    if (text === '🚪 خروج') { agent.chatId = null; await agent.save(); return send(chatId, '👋'); }
  }

  return send(chatId, '❓ /start');
}

// ============================================
// WEBHOOK
// ============================================
app.post('/webhook', async (req, res) => {
  const u = req.body;
  if (u.message) await processMessage(u.message.chat.id, u.message.text || '');
  res.sendStatus(200);
});

app.get('/', (_, res) => res.send('BOT v7.0 FINAL ONLINE'));

app.listen(process.env.PORT || 3000, () => console.log('🚀 v6.0 READY'));
