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
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
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
  agentCode: { type: String, unique: true, required: true }, // كود خاص للوكيل
  chatId: { type: String, unique: true, sparse: true },
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String },
  debt: { type: Number, default: 0 },
  creditLimit: { type: Number, default: 10000 }, // الحد الائتماني
  commission: { type: Number, default: 100 }, // عمولة لكل 1000 دج
  totalCharges: { type: Number, default: 0 },
  totalProfit: { type: Number, default: 0 },
  clientsRegistered: { type: Number, default: 0 }, // عدد العملاء المسجلين
  isActive: { type: Boolean, default: true },
  canCreateContests: { type: Boolean, default: true }, // صلاحية المسابقات
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
  inviteLink: { type: String }, // رابط الدعوة الخاص به
  platform: { type: String, enum: ['1xbet', 'melbet', 'linebet'], default: '1xbet' },
  
  // نظام الكاش باك
  cashback: { type: Number, default: 0 },
  cashbackPercent: { type: Number, default: 7 }, // نسبة كاش باك مخصصة لكل عميل
  
  // نظام هرمي
  referredBy: { type: String, default: null }, // الشخص الذي دعاه (playerId)
  referralCode: { type: String, unique: true }, // كود الإحالة الخاص به
  referralEarnings: { type: Number, default: 0 }, // أرباح من الإحالات
  referralPercent: { type: Number, default: 1 }, // نسبة الإحالة (قابلة للتخصيص)
  downlineCount: { type: Number, default: 0 }, // عدد الأشخاص تحته
  
  totalDeposits: { type: Number, default: 0 },
  depositCount: { type: Number, default: 0 },
  isVIP: { type: Boolean, default: false },
  registeredBy: { type: String }, // الوكيل الذي سجله
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
  prize: { type: Number, required: true }, // قيمة الجائزة
  prizeType: { type: String, enum: ['cashback', 'bonus', 'gift'], default: 'cashback' },
  type: { type: String, enum: ['deposit', 'referral', 'lucky'], default: 'deposit' },
  
  // شروط المسابقة
  minDeposit: { type: Number, default: 0 }, // حد أدنى للإيداع
  minReferrals: { type: Number, default: 0 }, // حد أدنى للإحالات
  
  participants: [{
    playerId: String,
    name: String,
    score: Number, // النقاط أو المبلغ
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
  createdBy: { type: String }, // أدمن أو وكيل
  creatorType: { type: String, enum: ['admin', 'agent'] },
  createdAt: { type: Date, default: Date.now }
});
const Contest = mongoose.model('Contest', contestSchema);

// الجوائز والعروض
const promoSchema = new mongoose.Schema({
  promoId: { type: String, unique: true, required: true },
  title: { type: String, required: true },
  description: { type: String },
  code: { type: String, unique: true },
  type: { type: String, enum: ['bonus', 'cashback', 'free_bet', 'gift'], default: 'bonus' },
  value: { type: Number },
  usedBy: [{ type: String }],
  maxUses: { type: Number, default: 1 },
  expiresAt: { type: Date },
  isActive: { type: Boolean, default: true },
  createdBy: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const Promo = mongoose.model('Promo', promoSchema);

// الإشعارات والإعلانات
const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  image: { type: String },
  targetAudience: { type: String, enum: ['all', 'agents', 'clients'], default: 'all' },
  sentTo: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});
const Announcement = mongoose.model('Announcement', announcementSchema);

// سجل النشاطات (للمراقبة)
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

async function updateSetting(key, value) {
  await Settings.findOneAndUpdate(
    { key },
    { value, updatedAt: new Date() },
    { upsert: true }
  );
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

async function sendPhoto(chatId, photo, caption = '') {
  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      chat_id: chatId,
      photo: photo,
      caption: caption,
      parse_mode: 'HTML'
    });
  } catch (error) {
    console.error('خطأ في إرسال الصورة:', error.message);
  }
}

// البث الجماعي
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
      if (image) {
        await sendPhoto(chatId, image, text);
      } else {
        await sendTelegram(chatId, text);
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`فشل الإرسال لـ ${chatId}`);
    }
  }
}

// تسجيل النشاط
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
      [{ text: "🏆 إدارة المسابقات" }, { text: "🎁 إدارة الجوائز" }],
      [{ text: "📢 إرسال إعلان" }, { text: "🔍 البحث" }],
      [{ text: "⚙️ الإعدادات" }, { text: "📈 تقارير" }],
      [{ text: "🔄 تحديث" }, { text: "📋 سجل النشاطات" }]
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
      [{ text: "🏆 المسابقات" }, { text: "📊 إحصائياتي" }],
      [{ text: "🎁 الجوائز" }, { text: "❓ مساعدة" }],
      [{ text: "🚪 تسجيل خروج" }]
    ],
    resize_keyboard: true
  };
}

function getClientKeyboard() {
  return {
    keyboard: [
      [{ text: "💰 رصيدي" }, { text: "📊 إحصائياتي" }],
      [{ text: "👥 شبكتي" }, { text: "🎁 الجوائز" }],
      [{ text: "🏆 المسابقات" }, { text: "🔗 رابط الإحالة" }],
      [{ text: "📞 الدعم" }, { text: "❓ مساعدة" }]
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

async function getAgentByCode(agentCode) {
  return await Agent.findOne({ agentCode, isActive: true });
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
// دوال العملاء (نظام هرمي)
// ============================================
function generateReferralCode() {
  return 'REF' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

async function registerClientByAgent(data, agentId) {
  const agent = await Agent.findOne({ chatId: agentId });
  if (!agent) return { ok: false, message: 'الوكيل غير موجود' };
  
  // التحقق من وجود العميل
  const existing = await Client.findOne({ 
    $or: [{ playerId: data.playerId }, { username: data.username }]
  });
  if (existing) return { ok: false, message: 'العميل مسجل مسبقاً' };
  
  // التحقق من الإحالة
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
  
  // تحديث عداد العملاء للوكيل
  agent.clientsRegistered += 1;
  await agent.save();
  
  // تحديث عداد الإحالات
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
  // البحث بالـ playerId أو username أو chatId
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
// نظام الكاش باك الهرمي
// ============================================
async function addCashback(playerId, amount) {
  const client = await Client.findOne({ playerId });
  if (!client) {
    await logActivity('system', 'system', 'CASHBACK_FAILED', { playerId, reason: 'client_not_found' });
    return false;
  }
  
  // كاش باك للعميل
  const cashbackAmount = amount * client.cashbackPercent / 100;
  client.cashback += cashbackAmount;
  client.totalDeposits += amount;
  client.depositCount += 1;
  client.lastUpdate = new Date();
  
  // ترقية لـ VIP
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
  
  // إشعار العميل
  if (client.chatId) {
    await sendTelegram(client.chatId,
      `✅ تم إضافة <b>${cashbackAmount.toFixed(2)} دج</b> كاش باك\n\n` +
      `💰 رصيدك: <b>${client.cashback.toFixed(2)} دج</b>\n` +
      `${client.isVIP ? '🌟 حساب VIP' : ''}`
    );
  }
  
  // نظام الإحالة الهرمي
  if (client.referredBy) {
    await addReferralBonus(client.referredBy, amount, client.playerId);
  }
  
  await logActivity(playerId, 'client', 'CASHBACK_ADDED', { amount: cashbackAmount });
  
  return true;
}

async function addReferralBonus(referrerPlayerId, amount, fromPlayerId) {
  const referrer = await Client.findOne({ playerId: referrerPlayerId });
  if (!referrer) return;
  
  // حساب النسبة (1% من نسبة الـ cashback الأصلية للعميل المُحال)
  const referredClient = await Client.findOne({ playerId: fromPlayerId });
  if (!referredClient) return;
  
  // خصم 1% من نسبة كاش باك العميل المُحال
  const deductionAmount = amount * 0.01; // 1% من المبلغ
  
  // إضافة للمُحيل
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
  // التحقق من الحد الائتماني
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
  
  // تحديث دين الوكيل
  agent.debt += charge.totalAmount;
  agent.totalCharges += charge.amount;
  agent.totalProfit += charge.commission;
  await agent.save();
  
  // إضافة كاش باك للعميل
  await addCashback(charge.playerId, charge.amount);
  
  // تحديث حالة الشحن
  charge.status = 'approved';
  charge.approvedAt = new Date();
  charge.approvedBy = ADMIN_CHAT_ID;
  await charge.save();
  
  // إشعار الوكيل
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
  // تكملة الكود السابق...

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
  // التحقق من الصلاحيات
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
  
  // إشعار الجميع
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
  
  // التحقق من الاشتراك المسبق
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

async function updateContestScore(contestId, playerId, scoreToAdd) {
  const contest = await Contest.findOne({ contestId, isActive: true });
  if (!contest) return false;
  
  const participant = contest.participants.find(p => p.playerId === playerId);
  if (participant) {
    participant.score += scoreToAdd;
    await contest.save();
    return true;
  }
  
  return false;
}

async function finishContest(contestId) {
  const contest = await Contest.findOne({ contestId });
  if (!contest) return { ok: false, message: 'المسابقة غير موجودة' };
  
  // ترتيب المشاركين
  contest.participants.sort((a, b) => b.score - a.score);
  
  // تحديد الفائزين (أفضل 3)
  const topWinners = contest.participants.slice(0, 3);
  const prizes = [contest.prize, contest.prize * 0.5, contest.prize * 0.3]; // 100%, 50%, 30%
  
  for (let i = 0; i < topWinners.length; i++) {
    const winner = topWinners[i];
    const prize = prizes[i];
    
    contest.winners.push({
      playerId: winner.playerId,
      name: winner.name,
      prize,
      rank: i + 1
    });
    
    // إضافة الجائزة للفائز
    const client = await Client.findOne({ playerId: winner.playerId });
    if (client) {
      client.cashback += prize;
      await client.save();
      
      if (client.chatId) {
        await sendTelegram(client.chatId,
          `🎉 <b>مبروك! فزت في المسابقة</b> 🎉\n\n` +
          `🏆 ${contest.title}\n` +
          `🥇 المركز: ${i + 1}\n` +
          `💰 الجائزة: ${prize} دج\n` +
          `📊 نقاطك: ${winner.score}`
        );
      }
    }
  }
  
  contest.isActive = false;
  contest.isFinished = true;
  await contest.save();
  
  // إشعار الجميع بالنتائج
  let resultsMsg = `🏆 <b>نتائج المسابقة</b>\n${contest.title}\n\n`;
  contest.winners.forEach((w, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
    resultsMsg += `${medal} ${w.name} - ${w.prize} دج\n`;
  });
  
  await broadcastMessage(resultsMsg);
  
  return { ok: true, contest };
}

// ============================================
// إحصائيات متقدمة
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

async function getNetworkTree(playerId, depth = 3) {
  const client = await Client.findOne({ playerId });
  if (!client) return null;
  
  const tree = {
    playerId: client.playerId,
    name: client.name,
    cashback: client.cashback,
    totalDeposits: client.totalDeposits,
    children: []
  };
  
  if (depth > 0) {
    const children = await Client.find({ referredBy: playerId });
    for (const child of children) {
      const childTree = await getNetworkTree(child.playerId, depth - 1);
      if (childTree) tree.children.push(childTree);
    }
  }
  
  return tree;
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
async function processMessage(chatId, text) {
  if (text === '/start') {
    await sendTelegram(
      chatId,
      "👋 مرحباً بك في البوت\n\nاختر طريقة الدخول:",
      {
        keyboard: [
          [{ text: "🔑 دخول وكيل" }],
          [{ text: "👤 دخول عميل" }]
        ],
        resize_keyboard: true
      }
    );
    return;
  }

  await sendTelegram(chatId, "❓ الأمر غير معروف، أرسل /start");
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
   async function processMessage(chatId, text) {

  // START
  if (text === '/start') {
    await clearSession(chatId);

    return sendTelegram(
      chatId,
      "👋 مرحباً بك في البوت\n\nاختر طريقة الدخول:",
      {
        keyboard: [
          [{ text: "🔑 دخول وكيل" }],
          [{ text: "👤 دخول عميل" }]
        ],
        resize_keyboard: true
      }
    );
  }

  // دخول وكيل
  if (text === "🔑 دخول وكيل") {
    await updateSession(chatId, "AGENT_LOGIN_USERNAME");

    return sendTelegram(
      chatId,
      "🔑 <b>تسجيل دخول وكيل</b>\n\n✏️ أرسل اسم المستخدم:",
      { remove_keyboard: true }
    );
  }

  // دخول عميل
  if (text === "👤 دخول عميل") {
    await updateSession(chatId, "CLIENT_LOGIN_USERNAME");

    return sendTelegram(
      chatId,
      "👤 <b>تسجيل دخول عميل</b>\n\n✏️ أرسل اسم المستخدم:",
      { remove_keyboard: true }
    );
  }

  // الجلسة
  const session = await getSession(chatId);

  // وكيل - اسم المستخدم
  if (session.step === "AGENT_LOGIN_USERNAME") {
    session.data = { username: text };
    await updateSession(chatId, "AGENT_LOGIN_PASSWORD", session.data);

    return sendTelegram(chatId, "🔒 أرسل كلمة المرور:");
  }

  // وكيل - كلمة المرور
  if (session.step === "AGENT_LOGIN_PASSWORD") {
    const { username } = session.data;
    const result = await loginAgent(username, text, chatId);

    if (!result.ok) {
      await clearSession(chatId);
      return sendTelegram(chatId, "❌ بيانات الدخول غير صحيحة");
    }

    await clearSession(chatId);
    return sendTelegram(
      chatId,
      `✅ أهلاً <b>${result.agent.name}</b>`,
      getAgentKeyboard()
    );
  }

  // افتراضي
  await sendTelegram(chatId, "❓ الأمر غير معروف، أرسل /start");


});

// ملاحظة: أضف هنا دوال processMessage و handleAdminCommands و handleAgentCommands و handleClientCommands
// من الكود الأول مع التعديلات المطلوبة

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
});

module.exports = { 
  createAgent, 
  registerClientByAgent, 
  createCharge, 
  approveCharge,
  createContest,
  finishContest
};