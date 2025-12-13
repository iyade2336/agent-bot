// ============================================
// نظام إدارة الوكلاء والعملاء - Render Version
// مع MongoDB لتخزين البيانات
// ============================================

const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');

const app = express();
app.use(express.json());

// ============================================
// المتغيرات البيئية
// ============================================
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const MONGODB_URI = process.env.MONGODB_URI;

// ============================================
// نماذج البيانات (MongoDB Schemas)
// ============================================

// نموذج الوكيل
const agentSchema = new mongoose.Schema({
  chatId: { type: String, unique: true, required: true },
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  debt: { type: Number, default: 0 },
  interest: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const Agent = mongoose.model('Agent', agentSchema);

// نموذج العميل
const clientSchema = new mongoose.Schema({
  chatId: { type: String, unique: true, required: true },
  promoCode: { type: String, required: true },
  cashback: { type: Number, default: 0 },
  referredBy: { type: String, default: null },
  totalCharges: { type: Number, default: 0 },
  referralEarnings: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  lastUpdate: { type: Date, default: Date.now }
});

const Client = mongoose.model('Client', clientSchema);

// نموذج الشحن
const chargeSchema = new mongoose.Schema({
  chargeId: { type: String, unique: true, required: true },
  agentId: { type: String, required: true },
  clientId: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  approvedAt: { type: Date },
  approvedBy: { type: String },
  notes: { type: String }
});

const Charge = mongoose.model('Charge', chargeSchema);

// نموذج الجلسات (للخطوات)
const sessionSchema = new mongoose.Schema({
  chatId: { type: String, unique: true, required: true },
  step: { type: String },
  data: { type: mongoose.Schema.Types.Mixed },
  lastUpdate: { type: Date, default: Date.now }
});

const Session = mongoose.model('Session', sessionSchema);

// ============================================
// الاتصال بـ MongoDB
// ============================================
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ متصل بـ MongoDB');
}).catch(err => {
  console.error('❌ خطأ في الاتصال بـ MongoDB:', err);
});

// ============================================
// دوال إرسال رسائل Telegram
// ============================================
async function sendTelegram(chatId, text, keyboard = null) {
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    };
    
    if (keyboard) {
      payload.reply_markup = keyboard;
    }
    
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, payload);
  } catch (error) {
    console.error('خطأ في إرسال الرسالة:', error.message);
  }
}

// ============================================
// لوحات التحكم (Keyboards)
// ============================================
function getAdminKeyboard() {
  return {
    keyboard: [
      [{ text: "📊 إحصائيات" }, { text: "👥 الوكلاء" }],
      [{ text: "💰 العمليات المعلقة" }, { text: "👤 العملاء" }],
      [{ text: "➕ إضافة وكيل" }, { text: "📈 تقرير اليوم" }],
      [{ text: "⚙️ الإعدادات" }, { text: "🔄 تحديث" }]
    ],
    resize_keyboard: true
  };
}

function getAgentKeyboard() {
  return {
    keyboard: [
      [{ text: "💳 شحن عميل" }, { text: "📋 عملياتي" }],
      [{ text: "💰 حسابي" }, { text: "📊 إحصائياتي" }],
      [{ text: "❓ مساعدة" }, { text: "🚪 تسجيل خروج" }]
    ],
    resize_keyboard: true
  };
}

function getClientKeyboard() {
  return {
    keyboard: [
      [{ text: "💰 رصيدي" }, { text: "💳 شحن" }],
      [{ text: "👥 الإحالات" }, { text: "📊 إحصائياتي" }],
      [{ text: "🎁 كود الإحالة" }, { text: "❓ مساعدة" }]
    ],
    resize_keyboard: true
  };
}

// ============================================
// دوال الوكلاء
// ============================================
async function loginAgent(username, password, chatId) {
  try {
    const agent = await Agent.findOne({ username, password });
    if (agent) {
      agent.chatId = chatId;
      await agent.save();
      return { ok: true, agent };
    }
    return { ok: false };
  } catch (error) {
    console.error('خطأ في تسجيل الدخول:', error);
    return { ok: false };
  }
}

async function getAgentByChat(chatId) {
  return await Agent.findOne({ chatId, isActive: true });
}

// ============================================
// دوال الشحن
// ============================================
async function createCharge(agentId, clientId, amount) {
  const chargeId = 'CHG' + Date.now();
  const charge = new Charge({
    chargeId,
    agentId,
    clientId,
    amount
  });
  await charge.save();
  return chargeId;
}

async function approveCharge(chargeId) {
  try {
    const charge = await Charge.findOne({ chargeId, status: 'pending' });
    if (!charge) return { ok: false };
    
    const agent = await Agent.findOne({ chatId: charge.agentId });
    if (!agent) return { ok: false };
    
    // تحديث دين الوكيل
    const totalAmount = charge.amount + (charge.amount * agent.interest / 100);
    agent.debt += totalAmount;
    await agent.save();
    
    // إضافة Cashback للعميل
    await addCashback(charge.clientId, charge.amount);
    
    // تحديث حالة الشحن
    charge.status = 'approved';
    charge.approvedAt = new Date();
    charge.approvedBy = ADMIN_CHAT_ID;
    await charge.save();
    
    return { ok: true, amount: charge.amount };
  } catch (error) {
    console.error('خطأ في الموافقة:', error);
    return { ok: false };
  }
}

async function rejectCharge(chargeId, reason = '') {
  try {
    const charge = await Charge.findOne({ chargeId, status: 'pending' });
    if (!charge) return false;
    
    charge.status = 'rejected';
    charge.approvedAt = new Date();
    charge.approvedBy = ADMIN_CHAT_ID;
    charge.notes = reason;
    await charge.save();
    
    return true;
  } catch (error) {
    console.error('خطأ في الرفض:', error);
    return false;
  }
}

// ============================================
// دوال العملاء
// ============================================
async function registerClient(chatId, promoCode, referredBy = null) {
  try {
    const existing = await Client.findOne({ chatId });
    if (existing) return false;
    
    const client = new Client({
      chatId,
      promoCode,
      referredBy
    });
    await client.save();
    return true;
  } catch (error) {
    console.error('خطأ في التسجيل:', error);
    return false;
  }
}

async function getClientData(chatId) {
  return await Client.findOne({ chatId });
}

async function addCashback(chatId, amount) {
  try {
    const client = await Client.findOne({ chatId });
    if (!client) return false;
    
    const cashbackPercent = 7;
    const cashbackAmount = amount * cashbackPercent / 100;
    
    client.cashback += cashbackAmount;
    client.totalCharges += amount;
    client.lastUpdate = new Date();
    await client.save();
    
    // إرسال إشعار
    await sendTelegram(chatId, 
      `✅ تم إضافة <b>${cashbackAmount.toFixed(2)} دج</b> إلى رصيدك\n` +
      `💰 رصيدك الحالي: <b>${client.cashback.toFixed(2)} دج</b>`
    );
    
    // إضافة Referral
    if (client.referredBy) {
      await addReferralCashback(client.referredBy, amount);
    }
    
    return true;
  } catch (error) {
    console.error('خطأ في إضافة Cashback:', error);
    return false;
  }
}

async function addReferralCashback(chatId, amount) {
  try {
    const client = await Client.findOne({ chatId });
    if (!client) return false;
    
    const referralPercent = 1;
    const referralAmount = amount * referralPercent / 100;
    
    client.cashback += referralAmount;
    client.referralEarnings += referralAmount;
    client.lastUpdate = new Date();
    await client.save();
    
    await sendTelegram(chatId,
      `🎁 مكافأة إحالة: <b>${referralAmount.toFixed(2)} دج</b>\n` +
      `💰 رصيدك الحالي: <b>${client.cashback.toFixed(2)} دج</b>`
    );
    
    return true;
  } catch (error) {
    console.error('خطأ في Referral:', error);
    return false;
  }
}

// ============================================
// إحصائيات
// ============================================
async function getAdminStats() {
  const agentsCount = await Agent.countDocuments({ isActive: true });
  const clientsCount = await Client.countDocuments();
  const pendingCount = await Charge.countDocuments({ status: 'pending' });
  
  const agents = await Agent.find({ isActive: true });
  const totalDebt = agents.reduce((sum, a) => sum + a.debt, 0);
  
  const clients = await Client.find();
  const totalCashback = clients.reduce((sum, c) => sum + c.cashback, 0);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const approvedToday = await Charge.countDocuments({
    status: 'approved',
    approvedAt: { $gte: today }
  });
  
  const todayCharges = await Charge.find({
    status: 'approved',
    approvedAt: { $gte: today }
  });
  const totalToday = todayCharges.reduce((sum, c) => sum + c.amount, 0);
  
  return `📊 <b>إحصائيات النظام</b>\n\n` +
         `👥 عدد الوكلاء: <b>${agentsCount}</b>\n` +
         `👤 عدد العملاء: <b>${clientsCount}</b>\n` +
         `💰 إجمالي الديون: <b>${totalDebt.toFixed(2)} دج</b>\n` +
         `💳 إجمالي Cashback: <b>${totalCashback.toFixed(2)} دج</b>\n\n` +
         `⏳ عمليات معلقة: <b>${pendingCount}</b>\n` +
         `✅ عمليات اليوم: <b>${approvedToday}</b>\n` +
         `💵 مبلغ اليوم: <b>${totalToday.toFixed(2)} دج</b>`;
}

async function getPendingCharges() {
  const pending = await Charge.find({ status: 'pending' }).sort({ createdAt: -1 });
  
  if (pending.length === 0) return "✅ لا توجد عمليات معلقة";
  
  let msg = `💰 <b>العمليات المعلقة (${pending.length})</b>\n\n`;
  
  for (const c of pending) {
    msg += `🆔 ${c.chargeId}\n`;
    msg += `👤 عميل: ${c.clientId}\n`;
    msg += `💵 مبلغ: ${c.amount} دج\n`;
    msg += `⏰ ${c.createdAt.toLocaleString('ar-DZ')}\n`;
    msg += `/approve_${c.chargeId} | /reject_${c.chargeId}\n\n`;
  }
  
  return msg;
}

// ============================================
// إدارة الجلسات
// ============================================
async function getSession(chatId) {
  let session = await Session.findOne({ chatId });
  if (!session) {
    session = new Session({ chatId });
    await session.save();
  }
  return session;
}

async function updateSession(chatId, step, data = {}) {
  await Session.findOneAndUpdate(
    { chatId },
    { step, data, lastUpdate: new Date() },
    { upsert: true }
  );
}

async function clearSession(chatId) {
  await Session.findOneAndDelete({ chatId });
}

// ============================================
// معالجة الرسائل
// ============================================
async function processMessage(chatId, text) {
  const session = await getSession(chatId);
  const step = session.step;
  const isAdmin = String(chatId) === String(ADMIN_CHAT_ID);
  
  // /start
  if (text === '/start') {
    await clearSession(chatId);
    
    if (isAdmin) {
      await sendTelegram(chatId, 
        "👋 مرحباً أدمن\n\n🎛 لوحة التحكم جاهزة\nاستخدم الأزرار أدناه", 
        getAdminKeyboard()
      );
      return;
    }
    
    const agent = await getAgentByChat(chatId);
    const client = await getClientData(chatId);
    
    if (agent) {
      await sendTelegram(chatId,
        `👋 مرحباً ${agent.name}\n\n💰 ديونك: ${agent.debt} دج`,
        getAgentKeyboard()
      );
    } else if (client) {
      await sendTelegram(chatId,
        `👋 مرحباً بعودتك\n\n💰 رصيدك: ${client.cashback} دج\n🎁 كودك: ${client.promoCode}`,
        getClientKeyboard()
      );
    } else {
      await sendTelegram(chatId,
        "👋 مرحباً بك في نظام الوكلاء\n\n🔐 للوكلاء: /login\n📝 للعملاء: /register PROMO_CODE"
      );
    }
    return;
  }
  
  // أوامر الأدمن
  if (isAdmin) {
    await handleAdminCommands(chatId, text);
    return;
  }
  
  // تسجيل دخول
  if (text === '/login') {
    await sendTelegram(chatId, "✍️ أرسل اسم المستخدم:");
    await updateSession(chatId, 'USERNAME');
    return;
  }
  
  if (step === 'USERNAME') {
    await updateSession(chatId, 'PASSWORD', { username: text });
    await sendTelegram(chatId, "🔑 أرسل كلمة السر:");
    return;
  }
  
  if (step === 'PASSWORD') {
    const username = session.data.username;
    const res = await loginAgent(username, text, chatId);
    
    if (res.ok) {
      await sendTelegram(chatId,
        `✅ مرحباً <b>${res.agent.name}</b>\n\nتم تسجيل دخولك بنجاح`,
        getAgentKeyboard()
      );
    } else {
      await sendTelegram(chatId, "❌ اسم المستخدم أو كلمة السر غير صحيحة");
    }
    
    await clearSession(chatId);
    return;
  }
  
  // أوامر الوكيل
  const agent = await getAgentByChat(chatId);
  if (agent) {
    await handleAgentCommands(chatId, text, agent, step);
    return;
  }
  
  // أوامر العميل
  const client = await getClientData(chatId);
  if (client) {
    await handleClientCommands(chatId, text, client, step);
    return;
  }
  
  // تسجيل عميل جديد
  if (text.startsWith('/register')) {
    const parts = text.split(' ');
    if (parts.length < 2) {
      await sendTelegram(chatId, "❌ الصيغة: /register PROMO_CODE [REFERRED_BY]");
      return;
    }
    
    const promoCode = parts[1];
    const referredBy = parts.length >= 3 ? parts[2] : null;
    
    if (await registerClient(chatId, promoCode, referredBy)) {
      await sendTelegram(chatId,
        `✅ تم تسجيلك بنجاح\n\n🎁 كودك: <b>${promoCode}</b>\n` +
        `💰 Cashback: 7% من كل شحن\n👥 إحالة: 1% عن كل صديق`,
        getClientKeyboard()
      );
    } else {
      await sendTelegram(chatId, "❌ أنت مسجل مسبقاً");
    }
    return;
  }
  
  await sendTelegram(chatId, "❓ أمر غير معروف\n\n🔐 /login للوكلاء\n📝 /register للعملاء");
}

// ============================================
// معالجة أوامر الأدمن
// ============================================
async function handleAdminCommands(chatId, text) {
  if (text === "📊 إحصائيات") {
    await sendTelegram(chatId, await getAdminStats());
    return;
  }
  
  if (text === "💰 العمليات المعلقة") {
    await sendTelegram(chatId, await getPendingCharges());
    return;
  }
  
  if (text.startsWith('/approve_')) {
    const id = text.replace('/approve_', '');
    const res = await approveCharge(id);
    if (res.ok) {
      await sendTelegram(chatId, `✅ تمت الموافقة على العملية\n💰 المبلغ: ${res.amount} دج`);
    } else {
      await sendTelegram(chatId, "❌ لم يتم العثور على العملية");
    }
    return;
  }
  
  if (text.startsWith('/reject_')) {
    const id = text.replace('/reject_', '');
    if (await rejectCharge(id)) {
      await sendTelegram(chatId, `❌ تم رفض العملية ${id}`);
    } else {
      await sendTelegram(chatId, "❌ لم يتم العثور على العملية");
    }
    return;
  }
}

// ============================================
// معالجة أوامر الوكيل
// ============================================
async function handleAgentCommands(chatId, text, agent, step) {
  if (text === "💰 حسابي") {
    await sendTelegram(chatId,
      `👤 <b>${agent.name}</b>\n\n` +
      `💳 الدين الحالي: <b>${agent.debt} دج</b>\n` +
      `📈 الفائدة: <b>${agent.interest}%</b>`
    );
    return;
  }
  
  if (text === "💳 شحن عميل") {
    await sendTelegram(chatId, "أرسل رقم العميل:");
    await updateSession(chatId, 'CHARGE_CLIENT');
    return;
  }
  
  if (step === 'CHARGE_CLIENT') {
    await updateSession(chatId, 'CHARGE_AMOUNT', { clientId: text });
    await sendTelegram(chatId, "أرسل المبلغ:");
    return;
  }
  
  if (step === 'CHARGE_AMOUNT') {
    const session = await getSession(chatId);
    const clientId = session.data.clientId;
    const amount = Number(text);
    
    if (isNaN(amount) || amount <= 0) {
      await sendTelegram(chatId, "❌ مبلغ غير صالح");
      await clearSession(chatId);
      return;
    }
    
    const chargeId = await createCharge(chatId, clientId, amount);
    await sendTelegram(chatId, `✅ تم إرسال الطلب\n🆔 ${chargeId}\n💰 ${amount} دج`);
    await sendTelegram(ADMIN_CHAT_ID,
      `🔔 <b>عملية جديدة</b>\n\n🆔 ${chargeId}\n` +
      `👤 وكيل: ${agent.name}\n💳 عميل: ${clientId}\n💰 مبلغ: ${amount} دج\n\n` +
      `/approve_${chargeId} | /reject_${chargeId}`
    );
    
    await clearSession(chatId);
    return;
  }
  
  if (text === "🚪 تسجيل خروج") {
    agent.chatId = null;
    await agent.save();
    await sendTelegram(chatId, "👋 تم تسجيل الخروج");
    await clearSession(chatId);
    return;
  }
}

// ============================================
// معالجة أوامر العميل
// ============================================
async function handleClientCommands(chatId, text, client, step) {
  if (text === "💰 رصيدي") {
    await sendTelegram(chatId,
      `💰 <b>رصيدك الحالي</b>\n\n` +
      `💳 Cashback: <b>${client.cashback} دج</b>\n` +
      `🎁 كودك: <b>${client.promoCode}</b>`
    );
    return;
  }
  
  if (text === "💳 شحن") {
    await sendTelegram(chatId, "أرسل المبلغ:");
    await updateSession(chatId, 'CLIENT_CHARGE');
    return;
  }
  
  if (step === 'CLIENT_CHARGE') {
    const amount = Number(text);
    if (isNaN(amount) || amount <= 0) {
      await sendTelegram(chatId, "❌ مبلغ غير صالح");
      await clearSession(chatId);
      return;
    }
    
    await addCashback(chatId, amount);
    await clearSession(chatId);
    return;
  }
  
  if (text === "🎁 كود الإحالة") {
    await sendTelegram(chatId,
      `🎁 <b>كود الإحالة الخاص بك</b>\n\n` +
      `<code>${client.promoCode}</code>\n\n` +
      `شارك هذا الكود مع أصدقائك\nواحصل على 1% من كل شحن يقومون به!`
    );
    return;
  }
}

// ============================================
// Webhook Endpoint
// ============================================
app.post('/webhook', async (req, res) => {
  try {
    const update = req.body;
    
    if (!update.message) {
      return res.sendStatus(200);
    }
    
    const chatId = update.message.chat.id;
    const text = (update.message.text || '').trim();
    
    // معالجة الرسالة بشكل غير متزامن
    processMessage(chatId, text).catch(err => {
      console.error('خطأ في معالجة الرسالة:', err);
    });
    
    res.sendStatus(200);
  } catch (error) {
    console.error('خطأ في webhook:', error);
    res.sendStatus(500);
  }
});

// ============================================
// الصفحة الرئيسية
// ============================================
app.get('/', (req, res) => {
  res.send('✅ Bot is running - Render Version v1.0');
});

// ============================================
// تشغيل السيرفر
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
});