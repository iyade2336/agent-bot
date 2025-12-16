// ============================================
// معالجة الرسائل
// ============================================
async function processMessage(chatId, text) {
  const session = await getSession(chatId);
  
  // التحقق من نوع المستخدم
  const isAdmin = chatId.toString() === ADMIN_CHAT_ID;
  const agent = await getAgentByChat(chatId.toString());
  const client = await getClientData(chatId.toString());
  
  // معالجة أمر /start
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
  
  // توجيه الرسائل حسب نوع المستخدم
  if (isAdmin) {
    await handleAdminCommands(chatId, text, session);
  } else if (agent) {
    await handleAgentCommands(chatId, text, session);
  } else if (client) {
    await handleClientCommands(chatId, text, session);
  } else {
    // معالجة تسجيل الدخول
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
      
    case '🏆 إدارة المسابقات':
      await showContestsList(chatId);
      break;
      
    case '📢 إرسال إعلان':
      await updateSession(chatId, 'BROADCAST_MESSAGE');
      await sendTelegram(chatId, 
        'أرسل رسالة الإعلان:\n\n' +
        'يمكنك استخدام:\n' +
        '- <b>نص عريض</b>\n' +
        '- <i>نص مائل</i>\n' +
        '- <code>كود</code>'
      );
      break;
      
    case '🔍 البحث':
      await updateSession(chatId, 'SEARCH');
      await sendTelegram(chatId, 'أرسل معرف اللاعب أو اسم المستخدم:');
      break;
      
    case '⚙️ الإعدادات':
      await showSettings(chatId);
      break;
      
    case '📋 سجل النشاطات':
      await showRecentActivities(chatId);
      break;
      
    case '🔄 تحديث':
      await sendTelegram(chatId, '🔄 جاري التحديث...', getAdminKeyboard());
      break;
      
    default:
      await handleAdminFlow(chatId, text, session);
  }
}

// ============================================
// تدفق إضافة وكيل
// ============================================
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
      
      // إنشاء الوكيل
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
      
    case '🏆 المسابقات':
      await showActiveContests(chatId);
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

// ============================================
// تدفق عمليات الوكيل
// ============================================
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
        
        // إشعار الأدمن
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

async function handleCallback(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const session = await getSession(chatId);
  
  // الرد على الـ callback
  await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    callback_query_id: callbackQuery.callback_query_id
  });
  
  // معالجة الأوامر
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
  }// ============================================
// معالجة الرسائل
// ============================================
async function processMessage(chatId, text) {
  const session = await getSession(chatId);
  
  // التحقق من نوع المستخدم
  const isAdmin = chatId.toString() === ADMIN_CHAT_ID;
  const agent = await getAgentByChat(chatId.toString());
  const client = await getClientData(chatId.toString());
  
  // معالجة أمر /start
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
  
  // توجيه الرسائل حسب نوع المستخدم
  if (isAdmin) {
    await handleAdminCommands(chatId, text, session);
  } else if (agent) {
    await handleAgentCommands(chatId, text, session);
  } else if (client) {
    await handleClientCommands(chatId, text, session);
  } else {
    // معالجة تسجيل الدخول
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
      
    case '🏆 إدارة المسابقات':
      await showContestsList(chatId);
      break;
      
    case '📢 إرسال إعلان':
      await updateSession(chatId, 'BROADCAST_MESSAGE');
      await sendTelegram(chatId, 
        'أرسل رسالة الإعلان:\n\n' +
        'يمكنك استخدام:\n' +
        '- <b>نص عريض</b>\n' +
        '- <i>نص مائل</i>\n' +
        '- <code>كود</code>'
      );
      break;
      
    case '🔍 البحث':
      await updateSession(chatId, 'SEARCH');
      await sendTelegram(chatId, 'أرسل معرف اللاعب أو اسم المستخدم:');
      break;
      
    case '⚙️ الإعدادات':
      await showSettings(chatId);
      break;
      
    case '📋 سجل النشاطات':
      await showRecentActivities(chatId);
      break;
      
    case '🔄 تحديث':
      await sendTelegram(chatId, '🔄 جاري التحديث...', getAdminKeyboard());
      break;
      
    default:
      await handleAdminFlow(chatId, text, session);
  }
}

// ============================================
// تدفق إضافة وكيل
// ============================================
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
      
      // إنشاء الوكيل
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
      
    case '🏆 المسابقات':
      await showActiveContests(chatId);
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

// ============================================
// تدفق عمليات الوكيل
// ============================================
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
        
        // إشعار الأدمن
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

async function handleCallback(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const session = await getSession(chatId);
  
  // الرد على الـ callback
  await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    callback_query_id: callbackQuery.callback_query_id
  });
  
  // معالجة الأوامر
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

// معالجة تكملة تدفق الوكيل
async function handlePaymentNotes(chatId, text, session) {
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
    
    const agent = await getAgentByChat(chatId.toString());
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

async function showContestsList(chatId) {
  const contests = await Contest.find().sort({ createdAt: -1 }).limit(5);
  
  let msg = `🏆 <b>المسابقات</b>\n\n`;
  for (const contest of contests) {
    const status = contest.isFinished ? '✅ منتهية' : 
                  contest.isActive ? '🟢 نشطة' : '⏸ متوقفة';
    msg += `${status} ${contest.title}\n`;
    msg += `💰 ${contest.prize} دج\n`;
    msg += `👥 ${contest.participants.length} مشارك\n`;
    msg += `━━━━━━━━━━━━━━\n`;
  }
  
  await sendTelegram(chatId, msg, getAdminKeyboard());
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

async function showRecentActivities(chatId) {
  const activities = await Activity.find()
    .sort({ createdAt: -1 })
    .limit(20);
  
  let msg = `📋 <b>آخر النشاطات</b>\n\n`;
  for (const activity of activities) {
    msg += `🔸 ${activity.action}\n`;
    msg += `👤 ${activity.userType}: ${activity.userId}\n`;
    msg += `📅 ${new Date(activity.createdAt).toLocaleString('ar-DZ')}\n`;
    msg += `━━━━━━━━━━━━━━\n`;
  }
  
  await sendTelegram(chatId, msg, getAdminKeyboard());
}

// تكملة معالجة التدفقات في handleAgentFlow
async function completeAgentFlow(chatId, text, session) {
  if (session.step === 'PAYMENT_NOTES') {
    await handlePaymentNotes(chatId, text, session);
  }
}

// إضافة في handleAdminFlow
async function completeAdminFlow(chatId, text, session) {
  if (session.step === 'REJECT_CHARGE_REASON') {
    await rejectCharge(session.data.chargeId, text);
    await sendTelegram(ADMIN_CHAT_ID, `✅ تم رفض العملية ${session.data.chargeId}`, getAdminKeyboard());
    await clearSession(chatId);
  }
}

// ============================================
// الصفحة الرئيسية
// ============================================
app.get('/', (req, res) => {
  res.send('✅ نظام 1xbet/Melbet/Linebet - نظام هرمي احترافي v3.0');
});