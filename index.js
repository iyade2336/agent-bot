// ============================================
// نظام إدارة 1xbet/Melbet/Linebet - نظام احترافي متكامل
// نظام هرمي + مسابقات + حد ائتماني للوكلاء
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
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '1018892094';
const MONGODB_URI = process.env.MONGODB_URI;

// ============================================
// نماذج البيانات
// ============================================

// الإعدادات العامة
const settingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  value: { type: mongoose.Schema.Types.Mixed },
  description: { type: String },
  updatedAt: { type: Date, default: Date.now }
});
const Settings = mongoose.model('Settings', settingsSchema);

// الوكلاء
const agentSchema = new mongoose.Schema({
  agentCode: { type: String, unique: true, required: true },
  chatId: { type: String, unique: true, sparse: true },
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String },
  debt: { type: Number, default: 0 },
  creditLimit: { type: Number, default: 10000 },
  commission: { type: Number, default: 100 },
  totalCharges: { type: Number, default: 0 },
  totalProfit: { type: Number, default: 0 },
  clientsRegistered: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  canCreateContests: { type: Boolean, default: true },
  createdBy: { type: String },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date }
});
const Agent = mongoose.model('Agent', agentSchema);

// العملاء
const clientSchema = new mongoose.Schema({
  chatId: { type: String, unique: true, sparse: true },
  playerId: { type: String, unique: true, required: true },
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String },
  inviteLink: { type: String },
  platform: { type: String, enum: ['1xbet', 'melbet', 'linebet'], default: '1xbet' },
  cashback: { type: Number, default: 0 },
  cashbackPercent: { type: Number, default: 7 },
  referredBy: { type: String, default: null },
  referralCode: { type: String, unique: true },
  referralEarnings: { type: Number, default: 0 },
  referralPercent: { type: Number, default: 1 },
  downlineCount: { type: Number, default: 0 },
  totalDeposits: { type: Number, default: 0 },
  depositCount: { type: Number, default: 0 },
  isVIP: { type: Boolean, default: false },
  registeredBy: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  lastUpdate: { type: Date, default: Date.now }
});
const Client = mongoose.model('Client', clientSchema);

// عمليات الشحن
const chargeSchema = new mongoose.Schema({
  chargeId: { type: String, unique: true, required: true },
  agentId: { type: String, required: true },
  agentName: { type: String },
  agentCode: { type: String },
  playerId: { type: String, required: true },
  clientName: { type: String },
  amount: { type: Number, required: true },
  commission: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  screenshot: { type: String },
  createdAt: { type: Date, default: Date.now },
  approvedAt: { type: Date },
  approvedBy: { type: String },
  rejectedReason: { type: String }
});
const Charge = mongoose.model('Charge', chargeSchema);

// دفعات الوكلاء
const paymentSchema = new mongoose.Schema({
  paymentId: { type: String, unique: true, required: true },
  agentId: { type: String, required: true },
  agentName: { type: String },
  agentCode: { type: String },
  amount: { type: Number, required: true },
  method: { type: String },
  screenshot: { type: String },
  notes: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  approvedAt: { type: Date },
  approvedBy: { type: String }
});
const Payment = mongoose.model('Payment', paymentSchema);

// المسابقات
const contestSchema = new mongoose.Schema({
  contestId: { type: String, unique: true, required: true },
  title: { type: String, required: true },
  description: { type: String },
  prize: { type: Number, required: true },
  prizeType: { type: String, enum: ['cashback', 'bonus', 'gift'], default: 'cashback' },
  type: { type: String, enum: ['deposit', 'referral', 'lucky'], default: 'deposit' },
  minDeposit: { type: Number, default: 0 },
  minReferrals: { type: Number, default: 0 },
  participants: [{
    playerId: String,
    name: String,
    score: Number,
    rank: Number
  }],
  winners: [{
    playerId: String,
    name: String,
    prize: Number,
    rank: Number
  }],
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  isFinished: { type: Boolean, default: false },
  createdBy: { type: String },
  creatorType: { type: String, enum: ['admin', 'agent'] },
  createdAt: { type: Date, default: Date.now }
});
const Contest = mongoose.model('Contest', contestSchema);

// سجل النشاطات
const activitySchema = new mongoose.Schema({
  type: { type: String, required: true },
  userId: { type: String, required: true },
  userType: { type: String, enum: ['admin', 'agent', 'client'] },
  action: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});
const Activity = mongoose.model('Activity', activitySchema);

// الجلسات
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
}).then(async () => {
  console.log('✅ متصل بـ MongoDB');
  await initializeSettings();
}).catch(err => {
  console.error('❌ خطأ في الاتصال:', err);
});

// تهيئة الإعدادات الافتراضية
async function initializeSettings() {
  const defaults = [
    { key: 'cashback_percent', value: 7, description: 'نسبة الكاش باك الافتراضية' },
    { key: 'referral_percent', value: 1, description: 'نسبة الإحالة الافتراضية' },
    { key: 'agent_commission', value: 100, description: 'عمولة الوكيل لكل 1000 دج' },
    { key: 'min_charge', value: 500, description: 'الحد الأدنى للشحن' },
    { key: 'vip_threshold', value: 10000, description: 'مبلغ الترقية لـ VIP' },
    { key: 'vip_cashback', value: 10, description: 'نسبة كاش باك VIP' },
    { key: 'default_credit_limit', value: 10000, description: 'الحد الائتماني الافتراضي' }
  ];
  
  for (const setting of defaults) {
    await Settings.findOneAndUpdate(
      { key: setting.key },
      setting,
      { upsert: true }
    );
  }
}

async function getSetting(key, defaultValue = null) {
  const setting = await Settings.findOne({ key });
  return setting ? setting.value : defaultValue;
}

// ============================================
// دوال Telegram
// ============================================
async function sendTelegram(chatId, text, keyboard = null, parseMode = 'HTML') {
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: parseMode
    };
    
    if (keyboard) payload.reply_markup = keyboard;
    
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, payload);
  } catch (error) {
    console.error('خطأ في إرسال الرسالة:', error.message);
  }
}

async function broadcastMessage(text, audience = 'all', image = null) {
  let users = [];
  
  if (audience === 'agents' || audience === 'all') {
    const agents = await Agent.find({ isActive: true, chatId: { $exists: true, $ne: null } });
    users = users.concat(agents.map(a => a.chatId));
  }
  
  if (audience === 'clients' || audience === 'all') {
    const clients = await Client.find({ chatId: { $exists: true, $ne: null } });
    users = users.concat(clients.map(c => c.chatId));
  }
  
  for (const chatId of users) {
    try {
      await sendTelegram(chatId, text);
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`فشل الإرسال لـ ${chatId}`);
    }
  }
}

async function logActivity(userId, userType, action, details = {}) {
  try {
    await Activity.create({
      type: action.split('_')[0],
      userId,
      userType,
      action,
      details
    });
  } catch (error) {
    console.error('خطأ في تسجيل النشاط:', error);
  }
}

// ============================================
// لوحات التحكم
// ============================================
function getAdminKeyboard() {
  return {
    keyboard: [
      [{ text: "📊 إحصائيات شاملة" }, { text: "💰 العمليات المعلقة" }],
      [{ text: "👥 إدارة الوكلاء" }, { text: "👤 إدارة العملاء" }],
      [{ text: "➕ إضافة وكيل" }, { text: "💳 دفعات الوكلاء" }],
      [{ text: "🏆 إدارة المسابقات" }, { text: "🔍 البحث" }],
      [{ text: "📢 إرسال إعلان" }, { text: "⚙️ الإعدادات" }]
    ],
    resize_keyboard: true
  };
}

function getAgentKeyboard() {
  return {
    keyboard: [
      [{ text: "💳 شحن عميل" }, { text: "➕ تسجيل عميل" }],
      [{ text: "📋 عملياتي" }, { text: "👥 عملائي" }],
      [{ text: "💰 حسابي وديوني" }, { text: "💵 دفع ديون" }],
      [{ text: "📊 إحصائياتي" }, { text: "🚪 تسجيل خروج" }]
    ],
    resize_keyboard: true
  };
}

function getClientKeyboard() {
  return {
    keyboard: [
      [{ text: "💰 رصيدي" }, { text: "📊 إحصائياتي" }],
      [{ text: "👥 شبكتي" }, { text: "🔗 رابط الإحالة" }],
      [{ text: "🏆 المسابقات" }, { text: "📞 الدعم" }]
    ],
    resize_keyboard: true
  };
}

// ============================================
// دوال الوكلاء
// ============================================
function generateAgentCode() {
  return 'AG' + Math.random().toString(36).substr(2, 8).toUpperCase();
}

async function createAgent(data, createdBy) {
  const agentCode = generateAgentCode();
  const creditLimit = await getSetting('default_credit_limit', 10000);
  
  const agent = new Agent({
    agentCode,
    chatId: data.chatId || null,
    username: data.username,
    password: data.password,
    name: data.name,
    phone: data.phone,
    commission: data.commission || 100,
    creditLimit: data.creditLimit || creditLimit,
    createdBy
  });
  
  await agent.save();
  await logActivity(createdBy, 'admin', 'CREATE_AGENT', { agentCode, name: data.name });
  
  return agent;
}

async function loginAgent(username, password, chatId) {
  const agent = await Agent.findOne({ username, password, isActive: true });
  if (agent) {
    agent.chatId = chatId;
    agent.lastLogin = new Date();
    await agent.save();
    await logActivity(chatId, 'agent', 'LOGIN', { username });
    return { ok: true, agent };
  }
  return { ok: false };
}

async function getAgentByChat(chatId) {
  return await Agent.findOne({ chatId, isActive: true });
}

async function canAgentCharge(agentId, amount) {
  const agent = await Agent.findOne({ chatId: agentId });
  if (!agent) return { ok: false, message: 'الوكيل غير موجود' };
  
  const potentialDebt = agent.debt + amount;
  if (potentialDebt > agent.creditLimit) {
    return { 
      ok: false, 
      message: `تجاوز الحد الائتماني!\nالحد: ${agent.creditLimit} دج\nالدين الحالي: ${agent.debt} دج\nالمطلوب: ${amount} دج`
    };
  }
  
  return { ok: true, agent };
}

// ============================================
// دوال العملاء
// ============================================
function generateReferralCode() {
  return 'REF' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

async function registerClientByAgent(data, agentId) {
  const agent = await Agent.findOne({ chatId: agentId });
  if (!agent) return { ok: false, message: 'الوكيل غير موجود' };
  
  const existing = await Client.findOne({ 
    $or: [{ playerId: data.playerId }, { username: data.username }]
  });
  if (existing) return { ok: false, message: 'العميل مسجل مسبقاً' };
  
  let referredBy = null;
  let referrer = null;
  if (data.referredBy) {
    referrer = await Client.findOne({ playerId: data.referredBy });
    if (referrer) {
      referredBy = data.referredBy;
    }
  }
  
  const referralCode = generateReferralCode();
  const cashbackPercent = await getSetting('cashback_percent', 7);
  const referralPercent = await getSetting('referral_percent', 1);
  
  const client = new Client({
    playerId: data.playerId,
    username: data.username,
    password: data.password,
    name: data.name,
    phone: data.phone,
    inviteLink: data.inviteLink,
    platform: data.platform || '1xbet',
    referredBy,
    referralCode,
    cashbackPercent,
    referralPercent,
    registeredBy: agent.agentCode
  });
  
  await client.save();
  
  agent.clientsRegistered += 1;
  await agent.save();
  
  if (referrer) {
    referrer.downlineCount += 1;
    await referrer.save();
  }
  
  await logActivity(agentId, 'agent', 'REGISTER_CLIENT', { 
    playerId: data.playerId, 
    name: data.name 
  });
  
  return { ok: true, client, referrer };
}

async function getClientData(identifier) {
  return await Client.findOne({
    $or: [
      { playerId: identifier },
      { username: identifier },
      { chatId: identifier }
    ]
  });
}

async function loginClient(username, password, chatId) {
  const client = await Client.findOne({ username, password });
  if (client) {
    if (!client.chatId) {
      client.chatId = chatId;
      await client.save();
    }
    await logActivity(chatId, 'client', 'LOGIN', { username });
    return { ok: true, client };
  }
  return { ok: false };
}

// ============================================
// نظام الكاش باك
// ============================================
async function addCashback(playerId, amount) {
  const client = await Client.findOne({ playerId });
  if (!client) return false;
  
  const cashbackAmount = amount * client.cashbackPercent / 100;
  client.cashback += cashbackAmount;
  client.totalDeposits += amount;
  client.depositCount += 1;
  client.lastUpdate = new Date();
  
  const vipThreshold = await getSetting('vip_threshold', 10000);
  if (!client.isVIP && client.totalDeposits >= vipThreshold) {
    client.isVIP = true;
    const vipCashback = await getSetting('vip_cashback', 10);
    client.cashbackPercent = vipCashback;
    
    if (client.chatId) {
      await sendTelegram(client.chatId,
        `🌟 <b>مبروك! تمت ترقيتك إلى VIP</b> 🌟\n\n` +
        `🎉 نسبة الكاش باك الجديدة: ${vipCashback}%\n` +
        `💰 إجمالي إيداعاتك: ${client.totalDeposits} دج`
      );
    }
  }
  
  await client.save();
  
  if (client.chatId) {
    await sendTelegram(client.chatId,
      `✅ تم إضافة <b>${cashbackAmount.toFixed(2)} دج</b> كاش باك\n\n` +
      `💰 رصيدك: <b>${client.cashback.toFixed(2)} دج</b>\n` +
      `${client.isVIP ? '🌟 حساب VIP' : ''}`
    );
  }
  
  if (client.referredBy) {
    await addReferralBonus(client.referredBy, amount, client.playerId);
  }
  
  await logActivity(playerId, 'client', 'CASHBACK_ADDED', { amount: cashbackAmount });
  
  return true;
}

async function addReferralBonus(referrerPlayerId, amount, fromPlayerId) {
  const referrer = await Client.findOne({ playerId: referrerPlayerId });
  if (!referrer) return;
  
  const referredClient = await Client.findOne({ playerId: fromPlayerId });
  if (!referredClient) return;
  
  const deductionAmount = amount * 0.01;
  
  referrer.cashback += deductionAmount;
  referrer.referralEarnings += deductionAmount;
  await referrer.save();
  
  if (referrer.chatId) {
    await sendTelegram(referrer.chatId,
      `🎁 <b>مكافأة إحالة!</b>\n\n` +
      `👤 من: ${referredClient.name}\n` +
      `💰 +${deductionAmount.toFixed(2)} دج\n` +
      `💳 رصيدك: ${referrer.cashback.toFixed(2)} دج`
    );
  }
  
  await logActivity(referrerPlayerId, 'client', 'REFERRAL_BONUS', { 
    amount: deductionAmount,
    from: fromPlayerId 
  });
}

// ============================================
// دوال الشحن
// ============================================
async function createCharge(agentId, playerId, amount) {
  const checkResult = await canAgentCharge(agentId, amount);
  if (!checkResult.ok) return checkResult;
  
  const agent = checkResult.agent;
  const client = await Client.findOne({ playerId });
  
  const commission = Math.floor(amount / 1000) * agent.commission;
  const totalAmount = amount + commission;
  
  const chargeId = 'CHG' + Date.now();
  const charge = new Charge({
    chargeId,
    agentId,
    agentName: agent.name,
    agentCode: agent.agentCode,
    playerId,
    clientName: client ? client.name : 'غير معروف',
    amount,
    commission,
    totalAmount
  });
  await charge.save();
  
  await logActivity(agentId, 'agent', 'CREATE_CHARGE', { chargeId, playerId, amount });
  
  return { ok: true, chargeId, totalAmount, commission };
}

async function approveCharge(chargeId) {
  const charge = await Charge.findOne({ chargeId, status: 'pending' });
  if (!charge) return { ok: false, message: 'العملية غير موجودة' };
  
  const agent = await Agent.findOne({ chatId: charge.agentId });
  if (!agent) return { ok: false, message: 'الوكيل غير موجود' };
  
  agent.debt += charge.totalAmount;
  agent.totalCharges += charge.amount;
  agent.totalProfit += charge.commission;
  await agent.save();
  
  await addCashback(charge.playerId, charge.amount);
  
  charge.status = 'approved';
  charge.approvedAt = new Date();
  charge.approvedBy = ADMIN_CHAT_ID;
  await charge.save();
  
  await sendTelegram(charge.agentId,
    `✅ <b>تمت الموافقة على العملية</b>\n\n` +
    `🆔 ${chargeId}\n` +
    `💰 المبلغ: ${charge.amount} دج\n` +
    `💵 العمولة: ${charge.commission} دج\n` +
    `📊 الإجمالي: ${charge.totalAmount} دج\n\n` +
    `💳 ديونك الحالية: <b>${agent.debt} دج</b>\n` +
    `📊 الحد الائتماني: ${agent.creditLimit} دج`
  );
  
  await logActivity(ADMIN_CHAT_ID, 'admin', 'APPROVE_CHARGE', { chargeId });
  
  return { ok: true, charge, agent };
}

async function rejectCharge(chargeId, reason = '') {
  const charge = await Charge.findOne({ chargeId, status: 'pending' });
  if (!charge) return false;
  
  charge.status = 'rejected';
  charge.approvedAt = new Date();
  charge.approvedBy = ADMIN_CHAT_ID;
  charge.rejectedReason = reason;
  await charge.save();
  
  await sendTelegram(charge.agentId,
    `❌ <b>تم رفض العملية</b>\n\n` +
    `🆔 ${chargeId}\n` +
    `💰 المبلغ: ${charge.amount} دج\n` +
    `📝 السبب: ${reason || 'غير محدد'}`
  );
  
  await logActivity(ADMIN_CHAT_ID, 'admin', 'REJECT_CHARGE', { chargeId, reason });
  
  return true;
}

// ============================================
// دوال الدفعات
// ============================================
async function createPayment(agentId, amount, method, notes) {
  const agent = await Agent.findOne({ chatId: agentId });
  if (!agent) return { ok: false, message: 'الوكيل غير موجود' };
  
  if (amount > agent.debt) {
    return { ok: false, message: `المبلغ أكبر من الديون\nديونك: ${agent.debt} دج` };
  }
  
  const paymentId = 'PAY' + Date.now();
  const payment = new Payment({
    paymentId,
    agentId,
    agentName: agent.name,
    agentCode: agent.agentCode,
    amount,
    method,
    notes
  });
  await payment.save();
  
  await logActivity(agentId, 'agent', 'CREATE_PAYMENT', { paymentId, amount });
  
  return { ok: true, paymentId };
}

async function approvePayment(paymentId) {
  const payment = await Payment.findOne({ paymentId, status: 'pending' });
  if (!payment) return false;
  
  const agent = await Agent.findOne({ chatId: payment.agentId });
  if (!agent) return false;
  
  agent.debt -= payment.amount;
  if (agent.debt < 0) agent.debt = 0;
  await agent.save();
  
  payment.status = 'approved';
  payment.approvedAt = new Date();
  payment.approvedBy = ADMIN_CHAT_ID;
  await payment.save();
  
  await sendTelegram(payment.agentId,
    `✅ <b>تم قبول دفعتك</b>\n\n` +
    `🆔 ${paymentId}\n` +
    `💰 المبلغ: ${payment.amount} دج\n` +
    `💳 ديونك الحالية: <b>${agent.debt} دج</b>\n` +
    `📊 الحد الائتماني: ${agent.creditLimit} دج`
  );
  
  await logActivity(ADMIN_CHAT_ID, 'admin', 'APPROVE_PAYMENT', { paymentId });
  
  return true;
}

// ============================================
// نظام المسابقات
// ============================================
async function createContest(data, creatorId, creatorType) {
  if (creatorType === 'agent') {
    const agent = await Agent.findOne({ chatId: creatorId });
    if (!agent || !agent.canCreateContests) {
      return { ok: false, message: 'ليس لديك صلاحية إنشاء مسابقات' };
    }
  }
  
  const contestId = 'CONT' + Date.now();
  
  const contest = new Contest({
    contestId,
    title: data.title,
    description: data.description,
    prize: data.prize,
    prizeType: data.prizeType || 'cashback',
    type: data.type || 'deposit',
    minDeposit: data.minDeposit || 0,
    minReferrals: data.minReferrals || 0,
    endDate: data.endDate,
    createdBy: creatorId,
    creatorType
  });
  
  await contest.save();
  await logActivity(creatorId, creatorType, 'CREATE_CONTEST', { contestId, title: data.title });
  
  await broadcastMessage(
    `🏆 <b>مسابقة جديدة!</b>\n\n` +
    `📋 ${data.title}\n` +
    `💰 الجائزة: ${data.prize} دج\n` +
    `📅 تنتهي: ${new Date(data.endDate).toLocaleDateString('ar-DZ')}\n\n` +
    `شارك الآن!`
  );
  
  return { ok: true, contest };
}

async function joinContest(contestId, playerId) {
  const contest = await Contest.findOne({ contestId, isActive: true, isFinished: false });
  if (!contest) return { ok: false, message: 'المسابقة غير موجودة أو منتهية' };
  
  if (new Date() > contest.endDate) {
    return { ok: false, message: 'المسابقة منتهية' };
  }
  
  const client = await Client.findOne({ playerId });
  if (!client) return { ok: false, message: 'العميل غير موجود' };
  
  const alreadyJoined = contest.participants.some(p => p.playerId === playerId);
  if (alreadyJoined) return { ok: false, message: 'أنت مشترك بالفعل' };
  
  contest.participants.push({
    playerId,
    name: client.name,
    score: 0,
    rank: 0
  });
  
  await contest.save();
  
  return { ok: true, message: 'تم الاشتراك بنجاح' };
}

// ============================================
// إحصائيات
// ============================================
async function getAdminStats() {
  const agentsCount = await Agent.countDocuments({ isActive: true });
  const clientsCount = await Client.countDocuments();
  const pendingCharges = await Charge.countDocuments({ status: 'pending' });
  const pendingPayments = await Payment.countDocuments({ status: 'pending' });
  const activeContests = await Contest.countDocuments({ isActive: true, isFinished: false });
  
  const agents = await Agent.find({ isActive: true });
  const totalDebt = agents.reduce((sum, a) => sum + a.debt, 0);
  const totalCreditLimit = agents.reduce((sum, a) => sum + a.creditLimit, 0);
  
  const clients = await Client.find();
  const totalCashback = clients.reduce((sum, c) => sum + c.cashback, 0);
  const vipCount = clients.filter(c => c.isVIP).length;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayCharges = await Charge.find({
    status: 'approved',
    approvedAt: { $gte: today }
  });
  const todayTotal = todayCharges.reduce((sum, c) => sum + c.amount, 0);
  const todayCommission = todayCharges.reduce((sum, c) => sum + c.commission, 0);
  
  const todayClients = await Client.countDocuments({ createdAt: { $gte: today } });
  
  return `📊 <b>إحصائيات النظام الشاملة</b>\n\n` +
         `👥 <b>الوكلاء:</b>\n` +
         `├ عدد الوكلاء: ${agentsCount}\n` +
         `├ إجمالي الديون: ${totalDebt.toFixed(2)} دج\n` +
         `├ الحد الائتماني الكلي: ${totalCreditLimit.toFixed(2)} دج\n` +
         `└ دفعات معلقة: ${pendingPayments}\n\n` +
         `👤 <b>العملاء:</b>\n` +
         `├ إجمالي العملاء: ${clientsCount}\n` +
         `├ عملاء VIP: ${vipCount}\n` +
         `├ تسجيلات اليوم: ${todayClients}\n` +
         `└ إجمالي Cashback: ${totalCashback.toFixed(2)} دج\n\n` +
         `💰 <b>العمليات:</b>\n` +
         `├ معلقة: ${pendingCharges}\n` +
         `├ اليوم: ${todayCharges.length}\n` +
         `├ مبلغ اليوم: ${todayTotal.toFixed(2)} دج\n` +
         `└ عمولة اليوم: ${todayCommission.toFixed(2)} دج\n\n` +
         `🏆 <b>المسابقات النشطة:</b> ${activeContests}`;
}

async function getAgentStats(agentId) {
  const agent = await Agent.findOne({ chatId: agentId });
  if (!agent) return null;
  
  const totalCharges = await Charge.countDocuments({ agentId, status: 'approved' });
  const charges = await Charge.find({ agentId, status: 'approved' });
  const totalAmount = charges.reduce((sum, c) => sum + c.amount, 0);
  const totalCommission = charges.reduce((sum, c) => sum + c.commission, 0);
  
  const clientsCount = await Client.countDocuments({ registeredBy: agent.agentCode });
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCharges = await Charge.countDocuments({ 
    agentId, 
    status: 'approved',
    approvedAt: { $gte: today }
  });
  
  const creditUsed = ((agent.debt / agent.creditLimit) * 100).toFixed(1);
  
  return {
    name: agent.name,
    agentCode: agent.agentCode,
    debt: agent.debt,
    creditLimit: agent.creditLimit,
    creditUsed,
    commission: agent.commission,
    totalCharges,
    totalAmount,
    totalCommission,
    todayCharges,
    clientsCount
  };
}

async function getClientStats(playerId) {
  const client = await Client.findOne({ playerId });
  if (!client) return null;
  
  const downline = await Client.find({ referredBy: playerId });
  const downlineTotal = downline.reduce((sum, c) => sum + c.totalDeposits, 0);
  
  return {
    ...client.toObject(),
    downlineTotal
  };
}

// ============================================
// إدارة الجلسات
// ============================================
async function getSession(chatId) {
  let session = await Session.findOne({ chatId });
  if (!session) {
    session = new Session({ chatId, data: {} });
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
  
  const isAdmin = chatId.toString() === ADMIN_CHAT_ID;
  const agent = await getAgentByChat(chatId.toString());
  const client = await getClientData(chatId.toString());
  
  if (text === '/start') {
    if (isAdmin) {
      await sendTelegram(chatId, 
        `👋 مرحباً <b>الأدمن</b>\n\n` +
        `🎛 استخدم لوحة التحكم للإدارة الكاملة`,
        getAdminKeyboard()
      );
    } else if (agent) {
      await sendTelegram(chatId,
        `👋 مرحباً <b>${agent.name}</b>\n\n` +
        `📊 كود الوكيل: ${agent.agentCode}\n` +
        `💰 الديون: ${agent.debt} دج\n` +
        `📈 الحد الائتماني: ${agent.creditLimit} دج`,
        getAgentKeyboard()
      );
    } else if (client) {
      await sendTelegram(chatId,
        `👋 مرحباً <b>${client.name}</b>\n\n` +
        `💰 رصيد Cashback: ${client.cashback.toFixed(2)} دج\n` +
        `🔗 كود الإحالة: ${client.referralCode}\n` +
        `${client.isVIP ? '🌟 حساب VIP' : ''}`,
        getClientKeyboard()
      );
    } else {
      await sendTelegram(chatId,
        `👋 مرحباً بك في نظام 1xbet/Melbet/Linebet\n\n` +
        `اختر طريقة الدخول:`,
        {
          inline_keyboard: [
            [{ text: '👤 دخول وكيل', callback_data: 'login_agent' }],
            [{ text: '👥 دخول عميل', callback_data: 'login_client' }],
            [{ text: '❓ مساعدة', callback_data: 'help' }]
          ]
        }
      );
    }
    return;
  }
  
  if (isAdmin) {
    await handleAdminCommands(chatId, text, session);
  } else if (agent) {
    await handleAgentCommands(chatId, text, session);
  } else if (client) {
    await handleClientCommands(chatId, text, session);
  } else {
    await handleLoginFlow(chatId, text, session);
  }
}

// ============================================
// أوامر الأدمن
// ============================================
async function handleAdminCommands(chatId, text, session) {
  switch (text) {
    case '📊 إحصائيات شاملة':
      const stats = await getAdminStats();
      await sendTelegram(chatId, stats, getAdminKeyboard());
      break;
      
    case '💰 العمليات المعلقة':
      await showPendingCharges(chatId);
      break;
      
    case '👥 إدارة الوكلاء':
      await showAgentsList(chatId);
      break;
      
    case '👤 إدارة العملاء':
      await showClientsList(chatId);
      break;
      
    case '➕ إضافة وكيل':
      await updateSession(chatId, 'ADD_AGENT_NAME');
      await sendTelegram(chatId, 'أرسل اسم الوكيل:');
      break;
      
    case '💳 دفعات الوكلاء':
      await showPendingPayments(chatId);
      break;
      
    case '🔍 البحث':
      await updateSession(chatId, 'SEARCH');
      await sendTelegram(chatId, 'أرسل معرف اللاعب أو اسم المستخدم:');
      break;
      
    case '📢 إرسال إعلان':
      await updateSession(chatId, 'BROADCAST_MESSAGE');
      await sendTelegram(chatId, 'أرسل رسالة الإعلان:');
      break;
      
    case '⚙️ الإعدادات':
      await showSettings(chatId);
      break;
      
    default:
      await handleAdminFlow(chatId, text, session);
  }
}

async function handleAdminFlow(chatId, text, session) {
  switch (session.step) {
    case 'ADD_AGENT_NAME':
      session.data.name = text;
      await updateSession(chatId, 'ADD_AGENT_USERNAME', session.data);
      await sendTelegram(chatId, 'أرسل اسم المستخدم (بدون @):');
      break;
      
    case 'ADD_AGENT_USERNAME':
      session.data.username = text.replace('@', '');
      await updateSession(chatId, 'ADD_AGENT_PASSWORD', session.data);
      await sendTelegram(chatId, 'أرسل كلمة المرور:');
      break;
      
    case 'ADD_AGENT_PASSWORD':
      session.data.password = text;
      await updateSession(chatId, 'ADD_AGENT_PHONE', session.data);
      await sendTelegram(chatId, 'أرسل رقم الهاتف:');
      break;
      
    case 'ADD_AGENT_PHONE':
      session.data.phone = text;
      await updateSession(chatId, 'ADD_AGENT_CREDIT', session.data);
      await sendTelegram(chatId, 'أرسل الحد الائتماني (أو اكتب 0 للافتراضي 10000):');
      break;
      
    case 'ADD_AGENT_CREDIT':
      const creditLimit = parseInt(text) || 10000;
      session.data.creditLimit = creditLimit;
      
      const agent = await createAgent(session.data, chatId.toString());
      await clearSession(chatId);
      
      await sendTelegram(chatId,
        `✅ <b>تم إضافة الوكيل بنجاح</b>\n\n` +
        `👤 الاسم: ${agent.name}\n` +
        `🆔 الكود: ${agent.agentCode}\n` +
        `📱 الهاتف: ${agent.phone}\n` +
        `💳 الحد الائتماني: ${agent.creditLimit} دج\n` +
        `📊 العمولة: ${agent.commission} دج لكل 1000 دج`,
        getAdminKeyboard()
      );
      break;
      
    case 'BROADCAST_MESSAGE':
      await sendTelegram(chatId, 'اختر الجمهور المستهدف:', {
        inline_keyboard: [
          [{ text: '👥 الكل', callback_data: `broadcast_all_${text}` }],
          [{ text: '🏢 الوكلاء فقط', callback_data: `broadcast_agents_${text}` }],
          [{ text: '👤 العملاء فقط', callback_data: `broadcast_clients_${text}` }],
          [{ text: '❌ إلغاء', callback_data: 'cancel' }]
        ]
      });
      await clearSession(chatId);
      break;
      
    case 'SEARCH':
      const searchResult = await getClientData(text);
      if (searchResult) {
        const stats = await getClientStats(searchResult.playerId);
        await sendTelegram(chatId,
          `👤 <b>معلومات العميل</b>\n\n` +
          `🆔 Player ID: ${stats.playerId}\n` +
          `📛 الاسم: ${stats.name}\n` +
          `👤 Username: @${stats.username}\n` +
          `💰 Cashback: ${stats.cashback.toFixed(2)} دج\n` +
          `📊 إجمالي الإيداعات: ${stats.totalDeposits} دج\n` +
          `🔢 عدد الإيداعات: ${stats.depositCount}\n` +
          `👥 الشبكة: ${stats.downlineCount} شخص\n` +
          `💵 أرباح الإحالة: ${stats.referralEarnings.toFixed(2)} دج\n` +
          `${stats.isVIP ? '🌟 VIP' : ''}`,
          getAdminKeyboard()
        );
      } else {
        await sendTelegram(chatId, '❌ لم يتم العثور على العميل', getAdminKeyboard());
      }
      await clearSession(chatId);
      break;
      
    case 'REJECT_CHARGE_REASON':
      await rejectCharge(session.data.chargeId, text);
      await sendTelegram(ADMIN_CHAT_ID, `✅ تم رفض العملية ${session.data.chargeId}`, getAdminKeyboard());
      await clearSession(chatId);
      break;
  }
}

// ============================================
// أوامر الوكيل
// ============================================
async function handleAgentCommands(chatId, text, session) {
  const agent = await getAgentByChat(chatId.toString());
  
  switch (text) {
    case '💳 شحن عميل':
      await updateSession(chatId, 'CHARGE_PLAYER_ID');
      await sendTelegram(chatId, 'أرسل معرف اللاعب (Player ID):');
      break;
      
    case '➕ تسجيل عميل':
      await updateSession(chatId, 'REGISTER_PLAYER_ID');
      await sendTelegram(chatId, 'أرسل معرف اللاعب (Player ID):');
      break;
      
    case '📋 عملياتي':
      await showAgentCharges(chatId);
      break;
      
    case '👥 عملائي':
      await showAgentClients(chatId);
      break;
      
    case '💰 حسابي وديوني':
      const stats = await getAgentStats(chatId.toString());
      await sendTelegram(chatId,
        `💼 <b>حسابك</b>\n\n` +
        `👤 ${stats.name}\n` +
        `🆔 ${stats.agentCode}\n\n` +
        `💰 <b>الديون:</b> ${stats.debt.toFixed(2)} دج\n` +
        `📊 <b>الحد الائتماني:</b> ${stats.creditLimit} دج\n` +
        `📈 <b>المستخدم:</b> ${stats.creditUsed}%\n\n` +
        `💵 <b>العمولة:</b> ${stats.commission} دج/1000\n` +
        `📊 <b>إجمالي العمليات:</b> ${stats.totalCharges}\n` +
        `💰 <b>إجمالي المبالغ:</b> ${stats.totalAmount.toFixed(2)} دج\n` +
        `💵 <b>إجمالي العمولة:</b> ${stats.totalCommission.toFixed(2)} دج\n` +
        `👥 <b>عدد العملاء:</b> ${stats.clientsCount}\n` +
        `📅 <b>عمليات اليوم:</b> ${stats.todayCharges}`,
        getAgentKeyboard()
      );
      break;
      
    case '💵 دفع ديون':
      if (agent.debt <= 0) {
        await sendTelegram(chatId, '✅ ليس لديك ديون', getAgentKeyboard());
      } else {
        await updateSession(chatId, 'PAYMENT_AMOUNT');
        await sendTelegram(chatId, 
          `💰 ديونك الحالية: <b>${agent.debt} دج</b>\n\n` +
          `أرسل المبلغ الذي تريد دفعه:`
        );
      }
      break;
      
    case '📊 إحصائياتي':
      const agentStats = await getAgentStats(chatId.toString());
      await sendTelegram(chatId,
        `📊 <b>إحصائياتك الشاملة</b>\n\n` +
        `📈 عمليات اليوم: ${agentStats.todayCharges}\n` +
        `📊 إجمالي العمليات: ${agentStats.totalCharges}\n` +
        `💰 إجمالي المبالغ: ${agentStats.totalAmount.toFixed(2)} دج\n` +
        `💵 إجمالي العمولة: ${agentStats.totalCommission.toFixed(2)} دج\n` +
        `👥 عدد العملاء: ${agentStats.clientsCount}`,
        getAgentKeyboard()
      );
      break;
      
    case '🚪 تسجيل خروج':
      agent.chatId = null;
      await agent.save();
      await clearSession(chatId);
      await sendTelegram(chatId, '👋 تم تسجيل الخروج بنجاح\n\nاستخدم /start للدخول مرة أخرى');
      break;
      
    default:
      await handleAgentFlow(chatId, text, session);
  }
}

async function handleAgentFlow(chatId, text, session) {
  const agent = await getAgentByChat(chatId.toString());
  
  switch (session.step) {
    case 'CHARGE_PLAYER_ID':
      session.data.playerId = text;
      const client = await getClientData(text);
      if (!client) {
        await sendTelegram(chatId, '❌ العميل غير موجود', getAgentKeyboard());
        await clearSession(chatId);
        return;
      }
      await updateSession(chatId, 'CHARGE_AMOUNT', session.data);
      await sendTelegram(chatId, 
        `👤 العميل: ${client.name}\n\n` +
        `أرسل مبلغ الشحن (بالدينار):`
      );
      break;
      
    case 'CHARGE_AMOUNT':
      const amount = parseInt(text);
      if (isNaN(amount) || amount < 500) {
        await sendTelegram(chatId, '❌ المبلغ غير صحيح (الحد الأدنى 500 دج)');
        return;
      }
      
      const chargeResult = await createCharge(chatId.toString(), session.data.playerId, amount);
      if (!chargeResult.ok) {
        await sendTelegram(chatId, `❌ ${chargeResult.message}`, getAgentKeyboard());
      } else {
        await sendTelegram(chatId,
          `✅ <b>تم إنشاء طلب الشحن</b>\n\n` +
          `🆔 ${chargeResult.chargeId}\n` +
          `💰 المبلغ: ${amount} دج\n` +
          `💵 العمولة: ${chargeResult.commission} دج\n` +
          `📊 الإجمالي: ${chargeResult.totalAmount} دج\n\n` +
          `⏳ في انتظار موافقة الأدمن`,
          getAgentKeyboard()
        );
        
        await sendTelegram(ADMIN_CHAT_ID,
          `🔔 <b>طلب شحن جديد</b>\n\n` +
          `🆔 ${chargeResult.chargeId}\n` +
          `👤 الوكيل: ${agent.name} (${agent.agentCode})\n` +
          `🎮 اللاعب: ${session.data.playerId}\n` +
          `💰 المبلغ: ${amount} دج\n` +
          `💵 العمولة: ${chargeResult.commission} دج\n` +
          `📊 الإجمالي: ${chargeResult.totalAmount} دج`,
          {
            inline_keyboard: [
              [
                { text: '✅ موافقة', callback_data: `approve_charge_${chargeResult.chargeId}` },
                { text: '❌ رفض', callback_data: `reject_charge_${chargeResult.chargeId}` }
              ]
            ]
          }
        );
      }
      await clearSession(chatId);
      break;
      
    case 'REGISTER_PLAYER_ID':
      session.data.playerId = text;
      await updateSession(chatId, 'REGISTER_USERNAME', session.data);
      await sendTelegram(chatId, 'أرسل اسم المستخدم (بدون @):');
      break;
      
    case 'REGISTER_USERNAME':
      session.data.username = text.replace('@', '');
      await updateSession(chatId, 'REGISTER_PASSWORD', session.data);
      await sendTelegram(chatId, 'أرسل كلمة المرور:');
      break;
      
    case 'REGISTER_PASSWORD':
      session.data.password = text;
      await updateSession(chatId, 'REGISTER_NAME', session.data);
      await sendTelegram(chatId, 'أرسل الاسم الكامل:');
      break;
      
    case 'REGISTER_NAME':
      session.data.name = text;
      await updateSession(chatId, 'REGISTER_PHONE', session.data);
      await sendTelegram(chatId, 'أرسل رقم الهاتف (أو اكتب 0 للتخطي):');
      break;
      
    case 'REGISTER_PHONE':
      session.data.phone = text === '0' ? '' : text;
      await updateSession(chatId, 'REGISTER_PLATFORM', session.data);
      await sendTelegram(chatId, 'اختر المنصة:', {
        inline_keyboard: [
          [{ text: '1xbet', callback_data: 'platform_1xbet' }],
          [{ text: 'Melbet', callback_data: 'platform_melbet' }],
          [{ text: 'Linebet', callback_data: 'platform_linebet' }]
        ]
      });
      break;
      
    case 'PAYMENT_AMOUNT':
      const payAmount = parseInt(text);
      if (isNaN(payAmount) || payAmount <= 0) {
        await sendTelegram(chatId, '❌ المبلغ غير صحيح');
        return;
      }
      
      if (payAmount > agent.debt) {
        await sendTelegram(chatId, `❌ المبلغ أكبر من ديونك (${agent.debt} دج)`, getAgentKeyboard());
        await clearSession(chatId);
        return;
      }
      
      session.data.amount = payAmount;
      await updateSession(chatId, 'PAYMENT_METHOD', session.data);
      await sendTelegram(chatId, 
        'اختر طريقة الدفع:',
        {
          inline_keyboard: [
            [{ text: 'CCP', callback_data: 'payment_ccp' }],
            [{ text: 'Baridimob', callback_data: 'payment_baridimob' }],
            [{ text: 'نقداً', callback_data: 'payment_cash' }],
            [{ text: 'أخرى', callback_data: 'payment_other' }]
          ]
        }
      );
      break;
      
    case 'PAYMENT_NOTES':
      const notes = text === '0' ? '' : text;
      
      const result = await createPayment(
        chatId.toString(),
        session.data.amount,
        session.data.method,
        notes
      );
      
      await clearSession(chatId);
      
      if (result.ok) {
        await sendTelegram(chatId,
          `✅ <b>تم إنشاء طلب الدفع</b>\n\n` +
          `🆔 ${result.paymentId}\n` +
          `💰 المبلغ: ${session.data.amount} دج\n` +
          `💳 الطريقة: ${session.data.method}\n\n` +
          `⏳ في انتظار موافقة الأدمن`,
          getAgentKeyboard()
        );
        
        await sendTelegram(ADMIN_CHAT_ID,
          `🔔 <b>طلب دفع جديد</b>\n\n` +
          `🆔 ${result.paymentId}\n` +
          `👤 الوكيل: ${agent.name} (${agent.agentCode})\n` +
          `💰 المبلغ: ${session.data.amount} دج\n` +
          `💳 الطريقة: ${session.data.method}\n` +
          `📝 ملاحظات: ${notes || 'لا يوجد'}`,
          {
            inline_keyboard: [
              [
                { text: '✅ موافقة', callback_data: `approve_payment_${result.paymentId}` },
                { text: '❌ رفض', callback_data: `reject_payment_${result.paymentId}` }
              ]
            ]
          }
        );
      } else {
        await sendTelegram(chatId, `❌ ${result.message}`, getAgentKeyboard());
      }
      break;
  }
}

// ============================================
// أوامر العميل
// ============================================
async function handleClientCommands(chatId, text, session) {
  const client = await getClientData(chatId.toString());
  
  switch (text) {
    case '💰 رصيدي':
      await sendTelegram(chatId,
        `💰 <b>رصيدك</b>\n\n` +
        `💵 Cashback: ${client.cashback.toFixed(2)} دج\n` +
        `📊 إجمالي الإيداعات: ${client.totalDeposits} دج\n` +
        `🔢 عدد الإيداعات: ${client.depositCount}\n` +
        `📈 نسبة Cashback: ${client.cashbackPercent}%\n` +
        `${client.isVIP ? '🌟 حساب VIP' : ''}`,
        getClientKeyboard()
      );
      break;
      
    case '👥 شبكتي':
      await sendTelegram(chatId,
        `👥 <b>شبكتك</b>\n\n` +
        `🔗 كود الإحالة: <code>${client.referralCode}</code>\n` +
        `👤 عدد المدعوين: ${client.downlineCount}\n` +
        `💵 أرباح الإحالة: ${client.referralEarnings.toFixed(2)} دج\n` +
        `📈 نسبة الإحالة: ${client.referralPercent}%`,
        getClientKeyboard()
      );
      break;
      
    case '🔗 رابط الإحالة':
      const inviteText = client.inviteLink || 
        `استخدم كود الإحالة: ${client.referralCode}`;
      await sendTelegram(chatId,
        `🔗 <b>رابط الإحالة الخاص بك</b>\n\n` +
        `${inviteText}\n\n` +
        `شارك هذا الرابط مع أصدقائك واحصل على ${client.referralPercent}% من إيداعاتهم!`,
        getClientKeyboard()
      );
      break;
      
    case '🏆 المسابقات':
      await showActiveContests(chatId);
      break;
      
    case '📊 إحصائياتي':
      const stats = await getClientStats(client.playerId);
      await sendTelegram(chatId,
        `📊 <b>إحصائياتك</b>\n\n` +
        `💰 Cashback: ${stats.cashback.toFixed(2)} دج\n` +
        `📊 إجمالي الإيداعات: ${stats.totalDeposits} دج\n` +
        `🔢 عدد الإيداعات: ${stats.depositCount}\n` +
        `👥 شبكتك: ${stats.downlineCount} شخص\n` +
        `💵 أرباح الإحالة: ${stats.referralEarnings.toFixed(2)} دج\n` +
        `📈 إجمالي إيداعات الشبكة: ${stats.downlineTotal.toFixed(2)} دج\n` +
        `${stats.isVIP ? '🌟 حساب VIP' : ''}`,
        getClientKeyboard()
      );
      break;
  }
}

// ============================================
// تدفق تسجيل الدخول
// ============================================
async function handleLoginFlow(chatId, text, session) {
  switch (session.step) {
    case 'LOGIN_AGENT_USERNAME':
      session.data.username = text.replace('@', '');
      await updateSession(chatId, 'LOGIN_AGENT_PASSWORD', session.data);
      await sendTelegram(chatId, '🔒 أرسل كلمة المرور:');
      break;
      
    case 'LOGIN_AGENT_PASSWORD':
      const agentLogin = await loginAgent(session.data.username, text, chatId.toString());
      if (agentLogin.ok) {
        await clearSession(chatId);
        await sendTelegram(chatId,
          `✅ مرحباً <b>${agentLogin.agent.name}</b>\n\n` +
          `📊 كود الوكيل: ${agentLogin.agent.agentCode}\n` +
          `💰 الديون: ${agentLogin.agent.debt} دج\n` +
          `📈 الحد الائتماني: ${agentLogin.agent.creditLimit} دج`,
          getAgentKeyboard()
        );
      } else {
        await sendTelegram(chatId, '❌ بيانات الدخول غير صحيحة\n\nاستخدم /start للمحاولة مرة أخرى');
        await clearSession(chatId);
      }
      break;
      
    case 'LOGIN_CLIENT_USERNAME':
      session.data.username = text.replace('@', '');
      await updateSession(chatId, 'LOGIN_CLIENT_PASSWORD', session.data);
      await sendTelegram(chatId, '🔒 أرسل كلمة المرور:');
      break;
      
    case 'LOGIN_CLIENT_PASSWORD':
      const clientLogin = await loginClient(session.data.username, text, chatId.toString());
      if (clientLogin.ok) {
        await clearSession(chatId);
        await sendTelegram(chatId,
          `✅ مرحباً <b>${clientLogin.client.name}</b>\n\n` +
          `💰 رصيد Cashback: ${clientLogin.client.cashback.toFixed(2)} دج\n` +
          `🔗 كود الإحالة: ${clientLogin.client.referralCode}\n` +
          `${clientLogin.client.isVIP ? '🌟 حساب VIP' : ''}`,
          getClientKeyboard()
        );
      } else {
        await sendTelegram(chatId, '❌ بيانات الدخول غير صحيحة\n\nاستخدم /start للمحاولة مرة أخرى');
        await clearSession(chatId);
      }
      break;
  }
}

// ============================================
// معالجة الأزرار (Callbacks)
// ============================================
async function handleCallback(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const session = await getSession(chatId);
  
  await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    callback_query_id: callbackQuery.callback_query_id
  });
  
  if (data === 'login_agent') {
    await updateSession(chatId, 'LOGIN_AGENT_USERNAME');
    await sendTelegram(chatId, '👤 أرسل اسم المستخدم:');
  }
  else if (data === 'login_client') {
    await updateSession(chatId, 'LOGIN_CLIENT_USERNAME');
    await sendTelegram(chatId, '👤 أرسل اسم المستخدم:');
  }
  else if (data.startsWith('approve_charge_')) {
    const chargeId = data.replace('approve_charge_', '');
    const result = await approveCharge(chargeId);
    if (result.ok) {
      await sendTelegram(ADMIN_CHAT_ID, `✅ تمت الموافقة على العملية ${chargeId}`);
    }
  }
  else if (data.startsWith('reject_charge_')) {
    const chargeId = data.replace('reject_charge_', '');
    await updateSession(chatId, 'REJECT_CHARGE_REASON', { chargeId });
    await sendTelegram(chatId, 'أرسل سبب الرفض:');
  }
  else if (data.startsWith('approve_payment_')) {
    const paymentId = data.replace('approve_payment_', '');
    await approvePayment(paymentId);
    await sendTelegram(ADMIN_CHAT_ID, `✅ تمت الموافقة على الدفعة ${paymentId}`);
  }
  else if (data.startsWith('platform_')) {
    const platform = data.replace('platform_', '');
    session.data.platform = platform;
    
    const result = await registerClientByAgent(session.data, chatId.toString());
    await clearSession(chatId);
    
    if (result.ok) {
      await sendTelegram(chatId,
        `✅ <b>تم تسجيل العميل بنجاح</b>\n\n` +
        `🆔 Player ID: ${result.client.playerId}\n` +
        `👤 الاسم: ${result.client.name}\n` +
        `🔗 كود الإحالة: ${result.client.referralCode}\n` +
        `📱 المنصة: ${result.client.platform}\n` +
        `💰 نسبة Cashback: ${result.client.cashbackPercent}%`,
        getAgentKeyboard()
      );
    } else {
      await sendTelegram(chatId, `❌ ${result.message}`, getAgentKeyboard());
    }
  }
  else if (data.startsWith('payment_')) {
    const method = data.replace('payment_', '');
    session.data.method = method;
    await updateSession(chatId, 'PAYMENT_NOTES', session.data);
    await sendTelegram(chatId, 'أرسل ملاحظات إضافية (أو اكتب 0 للتخطي):');
  }
  else if (data.startsWith('broadcast_')) {
    const parts = data.split('_');
    const audience = parts[1];
    const message = parts.slice(2).join('_');
    
    await broadcastMessage(message, audience);
    await sendTelegram(ADMIN_CHAT_ID, `✅ تم إرسال الإعلان إلى ${audience}`, getAdminKeyboard());
  }
  else if (data.startsWith('join_contest_')) {
    const contestId = data.replace('join_contest_', '');
    const client = await getClientData(chatId.toString());
    if (client) {
      const result = await joinContest(contestId, client.playerId);
      await sendTelegram(chatId, result.ok ? '✅ ' + result.message : '❌ ' + result.message);
    }
  }
}

// ============================================
// دوال عرض القوائم
// ============================================
async function showPendingCharges(chatId) {
  const charges = await Charge.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(10);
  
  if (charges.length === 0) {
    await sendTelegram(chatId, '✅ لا توجد عمليات معلقة', getAdminKeyboard());
    return;
  }
  
  for (const charge of charges) {
    await sendTelegram(chatId,
      `🔔 <b>عملية معلقة</b>\n\n` +
      `🆔 ${charge.chargeId}\n` +
      `👤 الوكيل: ${charge.agentName} (${charge.agentCode})\n` +
      `🎮 اللاعب: ${charge.playerId}\n` +
      `💰 المبلغ: ${charge.amount} دج\n` +
      `💵 العمولة: ${charge.commission} دج\n` +
      `📊 الإجمالي: ${charge.totalAmount} دج\n` +
      `📅 ${new Date(charge.createdAt).toLocaleString('ar-DZ')}`,
      {
        inline_keyboard: [
          [
            { text: '✅ موافقة', callback_data: `approve_charge_${charge.chargeId}` },
            { text: '❌ رفض', callback_data: `reject_charge_${charge.chargeId}` }
          ]
        ]
      }
    );
  }
}

async function showPendingPayments(chatId) {
  const payments = await Payment.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(10);
  
  if (payments.length === 0) {
    await sendTelegram(chatId, '✅ لا توجد دفعات معلقة', getAdminKeyboard());
    return;
  }
  
  for (const payment of payments) {
    await sendTelegram(chatId,
      `💳 <b>دفعة معلقة</b>\n\n` +
      `🆔 ${payment.paymentId}\n` +
      `👤 الوكيل: ${payment.agentName} (${payment.agentCode})\n` +
      `💰 المبلغ: ${payment.amount} دج\n` +
      `💳 الطريقة: ${payment.method}\n` +
      `📝 ملاحظات: ${payment.notes || 'لا يوجد'}\n` +
      `📅 ${new Date(payment.createdAt).toLocaleString('ar-DZ')}`,
      {
        inline_keyboard: [
          [
            { text: '✅ موافقة', callback_data: `approve_payment_${payment.paymentId}` },
            { text: '❌ رفض', callback_data: `reject_payment_${payment.paymentId}` }
          ]
        ]
      }
    );
  }
}

async function showAgentsList(chatId) {
  const agents = await Agent.find({ isActive: true }).sort({ createdAt: -1 }).limit(10);
  
  let msg = `👥 <b>قائمة الوكلاء (آخر 10)</b>\n\n`;
  for (const agent of agents) {
    msg += `🆔 ${agent.agentCode}\n`;
    msg += `👤 ${agent.name}\n`;
    msg += `💰 الديون: ${agent.debt} دج\n`;
    msg += `📊 الحد: ${agent.creditLimit} دج\n`;
    msg += `👥 العملاء: ${agent.clientsRegistered}\n`;
    msg += `━━━━━━━━━━━━━━\n`;
  }
  
  await sendTelegram(chatId, msg, getAdminKeyboard());
}

async function showClientsList(chatId) {
  const clients = await Client.find().sort({ createdAt: -1 }).limit(10);
  
  let msg = `👤 <b>قائمة العملاء (آخر 10)</b>\n\n`;
  for (const client of clients) {
    msg += `🆔 ${client.playerId}\n`;
    msg += `👤 ${client.name}\n`;
    msg += `💰 Cashback: ${client.cashback.toFixed(2)} دج\n`;
    msg += `📊 إيداعات: ${client.totalDeposits} دج\n`;
    msg += `${client.isVIP ? '🌟 VIP' : ''}\n`;
    msg += `━━━━━━━━━━━━━━\n`;
  }
  
  await sendTelegram(chatId, msg, getAdminKeyboard());
}

async function showAgentCharges(chatId) {
  const agent = await getAgentByChat(chatId.toString());
  const charges = await Charge.find({ agentId: chatId.toString() })
    .sort({ createdAt: -1 })
    .limit(10);
  
  if (charges.length === 0) {
    await sendTelegram(chatId, '📋 لا توجد عمليات', getAgentKeyboard());
    return;
  }
  
  let msg = `📋 <b>عملياتي (آخر 10)</b>\n\n`;
  for (const charge of charges) {
    const statusEmoji = charge.status === 'approved' ? '✅' : 
                       charge.status === 'rejected' ? '❌' : '⏳';
    msg += `${statusEmoji} ${charge.chargeId}\n`;
    msg += `🎮 ${charge.playerId}\n`;
    msg += `💰 ${charge.amount} دج + ${charge.commission} دج\n`;
    msg += `📅 ${new Date(charge.createdAt).toLocaleDateString('ar-DZ')}\n`;
    msg += `━━━━━━━━━━━━━━\n`;
  }
  
  await sendTelegram(chatId, msg, getAgentKeyboard());
}

async function showAgentClients(chatId) {
  const agent = await getAgentByChat(chatId.toString());
  const clients = await Client.find({ registeredBy: agent.agentCode })
    .sort({ createdAt: -1 })
    .limit(10);
  
  if (clients.length === 0) {
    await sendTelegram(chatId, '👥 لا توجد عملاء مسجلين', getAgentKeyboard());
    return;
  }
  
  let msg = `👥 <b>عملائي (آخر 10)</b>\n\n`;
  for (const client of clients) {
    msg += `🆔 ${client.playerId}\n`;
    msg += `👤 ${client.name}\n`;
    msg += `💰 ${client.totalDeposits} دج\n`;
    msg += `${client.isVIP ? '🌟 VIP' : ''}\n`;
    msg += `━━━━━━━━━━━━━━\n`;
  }
  
  await sendTelegram(chatId, msg, getAgentKeyboard());
}

async function showActiveContests(chatId) {
  const contests = await Contest.find({ isActive: true, isFinished: false });
  
  if (contests.length === 0) {
    await sendTelegram(chatId, '🏆 لا توجد مسابقات نشطة حالياً');
    return;
  }
  
  for (const contest of contests) {
    await sendTelegram(chatId,
      `🏆 <b>${contest.title}</b>\n\n` +
      `📝 ${contest.description || 'لا يوجد وصف'}\n` +
      `💰 الجائزة: ${contest.prize} دج\n` +
      `📊 النوع: ${contest.type}\n` +
      `👥 المشاركين: ${contest.participants.length}\n` +
      `📅 تنتهي: ${new Date(contest.endDate).toLocaleDateString('ar-DZ')}`,
      {
        inline_keyboard: [
          [{ text: '🎯 اشترك الآن', callback_data: `join_contest_${contest.contestId}` }]
        ]
      }
    );
  }
}

async function showSettings(chatId) {
  const settings = await Settings.find();
  
  let msg = `⚙️ <b>الإعدادات</b>\n\n`;
  for (const setting of settings) {
    msg += `🔸 ${setting.description}\n`;
    msg += `   ${setting.key}: ${setting.value}\n\n`;
  }
  
  await sendTelegram(chatId, msg, getAdminKeyboard());
}

// ============================================
// Webhook Endpoint
// ============================================
app.post('/webhook', async (req, res) => {
  try {
    const update = req.body;
    
    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return res.sendStatus(200);
    }
    
    if (!update.message) {
      return res.sendStatus(200);
    }
    
    const chatId = update.message.chat.id;
    const text = (update.message.text || '').trim();
    
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
  res.send('✅ نظام 1xbet/Melbet/Linebet - نظام هرمي احترافي v3.0');
});

// ============================================
// تشغيل السيرفر
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
  console.log(`✅ Bot Token: ${BOT_TOKEN ? 'موجود' : 'غير موجود'}`);
  console.log(`✅ Admin Chat ID: ${ADMIN_CHAT_ID}`);
  console.log(`✅ MongoDB URI: ${MONGODB_URI ? 'موجود' : 'غير موجود'}`);
});

module.exports = { 
  createAgent, 
  registerClientByAgent, 
  createCharge, 
  approveCharge,
  createContest,
  joinContest
};