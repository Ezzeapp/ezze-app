/**
 * tg_client_bot.js — Telegram бот для КЛИЕНТОВ
 * Бот: @ezzeclient_bot | Token: TG_CLIENT_BOT_TOKEN
 * Запуск: node tg_client_bot.js
 * Systemd: ezze-client-bot.service
 *
 * Назначение (после рефакторинга):
 *   Клиент бронируется на САЙТЕ мастера (без Mini App).
 *   Бот — это канал уведомлений + быстрый просмотр (мои записи, бонусы, история)
 *   через chat-кнопки. Связь «клиент ↔ запись» идёт по нормализованному телефону.
 *
 * Сценарий /start:
 *   1. Выбор языка (6 языков)
 *   2. Поделиться номером телефона (request_contact)
 *   3. Имя берётся автоматически из Telegram-профиля
 *   4. Линкуем существующие appointments по телефону (telegram_id = chat_id)
 *   5. Показываем главное меню (persistent reply-keyboard, 5 кнопок)
 */

import { readFileSync, writeFileSync } from "fs";
import {
  supabase, APP_URL, CLIENT_BOT_TOKEN, MASTER_BOT_TOKEN,
  loadTgConfig, loadAIConfig, invalidateTgConfigCache,
  getClientTools, executeClientTool,
  handleAIMessage, fmtDate,
  createBotHelpers,
  escapeHtml, sessionEntry, cleanupSessions, PRODUCT,
  normalizePhone, linkAppointmentsByPhone,
} from "./tg_shared.js";

const bot = createBotHelpers(CLIENT_BOT_TOKEN);

// Отдельный helper для уведомлений мастерам через мастерский бот
const masterBot = createBotHelpers(MASTER_BOT_TOKEN);

// ── Persistent сессии регистрации (waiting_language / waiting_phone) ─────────

const SESSIONS_FILE = "./tg_client_sessions.json";

function loadSessions() {
  try {
    const raw = readFileSync(SESSIONS_FILE, "utf8");
    return new Map(Object.entries(JSON.parse(raw)));
  } catch {
    return new Map();
  }
}

function saveSessions() {
  try {
    writeFileSync(SESSIONS_FILE, JSON.stringify(Object.fromEntries(sessions)));
  } catch (e) {
    console.error("saveSessions error:", e.message);
  }
}

const sessions = loadSessions();

// ── Многоязычные строки ──────────────────────────────────────────────────────

const LANG_STRINGS = {
  ru: {
    langTitle:    `🌐 <b>Выберите язык / Tilni tanlang / Select language:</b>`,
    phonePrompt:  `📱 Поделитесь номером телефона, чтобы получать уведомления о записях.`,
    shareBtn:     "📱 Поделиться номером",
    remindShare:  `📱 Пожалуйста, нажмите кнопку <b>«Поделиться номером»</b> ниже.`,
    registered:   name => `✅ <b>Готово, ${name}!</b>\n\nТеперь вы будете получать уведомления о ваших записях.\nИспользуйте кнопки ниже 👇`,
    welcomeBack:  name => `👋 С возвращением, <b>${name}</b>!\n\nИспользуйте кнопки ниже 👇`,
    btnBookings:  "📅 Мои записи",
    btnBonuses:   "🎁 Бонусы",
    btnHistory:   "🕓 История",
    btnLang:      "🌐 Язык",
    btnHelp:      "❓ Помощь",
    soon:         "⏳ Функция скоро будет доступна.",
    noClient:     "⚠️ Похоже, вы ещё не зарегистрированы. Нажмите /start для начала.",
  },
  uz: {
    langTitle:    `🌐 <b>Tilni tanlang / Выберите язык / Select language:</b>`,
    phonePrompt:  `📱 Yozuvlar haqida xabarnomalarni olish uchun telefon raqamingizni ulashing.`,
    shareBtn:     "📱 Raqamni ulashish",
    remindShare:  `📱 Iltimos, <b>«Raqamni ulashish»</b> tugmasini bosing.`,
    registered:   name => `✅ <b>Tayyor, ${name}!</b>\n\nEndi siz yozuvlar haqida xabarnomalar olasiz.\nQuyidagi tugmalardan foydalaning 👇`,
    welcomeBack:  name => `👋 Qaytganingizdan xursandmiz, <b>${name}</b>!\n\nQuyidagi tugmalardan foydalaning 👇`,
    btnBookings:  "📅 Yozuvlarim",
    btnBonuses:   "🎁 Bonuslar",
    btnHistory:   "🕓 Tarix",
    btnLang:      "🌐 Til",
    btnHelp:      "❓ Yordam",
    soon:         "⏳ Funksiya tez orada mavjud bo'ladi.",
    noClient:     "⚠️ Siz hali ro'yxatdan o'tmagansiz. Boshlash uchun /start bosing.",
  },
  en: {
    langTitle:    `🌐 <b>Select language / Выберите язык / Tilni tanlang:</b>`,
    phonePrompt:  `📱 Share your phone number to receive appointment notifications.`,
    shareBtn:     "📱 Share phone number",
    remindShare:  `📱 Please press the <b>«Share phone number»</b> button below.`,
    registered:   name => `✅ <b>Done, ${name}!</b>\n\nYou'll now receive appointment notifications.\nUse the buttons below 👇`,
    welcomeBack:  name => `👋 Welcome back, <b>${name}</b>!\n\nUse the buttons below 👇`,
    btnBookings:  "📅 My bookings",
    btnBonuses:   "🎁 Bonuses",
    btnHistory:   "🕓 History",
    btnLang:      "🌐 Language",
    btnHelp:      "❓ Help",
    soon:         "⏳ This feature will be available soon.",
    noClient:     "⚠️ You are not registered yet. Send /start to begin.",
  },
  tg: {
    langTitle:    `🌐 <b>Забонро интихоб кунед / Выберите язык / Select language:</b>`,
    phonePrompt:  `📱 Барои гирифтани огоҳномаҳо рақами телефонро мубодила кунед.`,
    shareBtn:     "📱 Мубодилаи рақам",
    remindShare:  `📱 Лутфан, тугмаи <b>«Мубодилаи рақам»</b>-ро пахш кунед.`,
    registered:   name => `✅ <b>Тайёр, ${name}!</b>\n\nАкнун шумо огоҳномаҳо мегиред.\nТугмаҳои поёниро истифода баред 👇`,
    welcomeBack:  name => `👋 Боз хуш омадед, <b>${name}</b>!\n\nТугмаҳои поёниро истифода баред 👇`,
    btnBookings:  "📅 Сабтҳои ман",
    btnBonuses:   "🎁 Бонусҳо",
    btnHistory:   "🕓 Таърих",
    btnLang:      "🌐 Забон",
    btnHelp:      "❓ Кумак",
    soon:         "⏳ Функсия ба зудӣ дастрас мешавад.",
    noClient:     "⚠️ Шумо ҳанӯз сабти ном нашудаед. /start-ро пахш кунед.",
  },
  kz: {
    langTitle:    `🌐 <b>Тілді таңдаңыз / Выберите язык / Select language:</b>`,
    phonePrompt:  `📱 Хабарландырулар алу үшін телефон нөміріңізді бөлісіңіз.`,
    shareBtn:     "📱 Нөмірді бөлісу",
    remindShare:  `📱 <b>«Нөмірді бөлісу»</b> түймесін басыңыз.`,
    registered:   name => `✅ <b>Дайын, ${name}!</b>\n\nЕнді сіз жазбалар туралы хабарландырулар аласыз.\nТөмендегі түймелерді қолданыңыз 👇`,
    welcomeBack:  name => `👋 Қайта қош келдіңіз, <b>${name}</b>!\n\nТөмендегі түймелерді қолданыңыз 👇`,
    btnBookings:  "📅 Жазбаларым",
    btnBonuses:   "🎁 Бонустар",
    btnHistory:   "🕓 Тарих",
    btnLang:      "🌐 Тіл",
    btnHelp:      "❓ Көмек",
    soon:         "⏳ Функция жақында қолжетімді болады.",
    noClient:     "⚠️ Сіз әлі тіркелмегенсіз. /start басыңыз.",
  },
  ky: {
    langTitle:    `🌐 <b>Тилди тандаңыз / Выберите язык / Select language:</b>`,
    phonePrompt:  `📱 Билдирүүлөрдү алуу үчүн телефон номериңизди бөлүшүңүз.`,
    shareBtn:     "📱 Номерди бөлүшүү",
    remindShare:  `📱 <b>«Номерди бөлүшүү»</b> баскычын басыңыз.`,
    registered:   name => `✅ <b>Даяр, ${name}!</b>\n\nЭми сиз жазуулар боюнча билдирүү аласыз.\nТөмөнкү баскычтарды колдонуңуз 👇`,
    welcomeBack:  name => `👋 Кайра кош келиңиз, <b>${name}</b>!\n\nТөмөнкү баскычтарды колдонуңуз 👇`,
    btnBookings:  "📅 Жазууларым",
    btnBonuses:   "🎁 Бонустар",
    btnHistory:   "🕓 Тарых",
    btnLang:      "🌐 Тил",
    btnHelp:      "❓ Жардам",
    soon:         "⏳ Функция жакында жеткиликтүү болот.",
    noClient:     "⚠️ Сиз али катталбагансыз. /start басыңыз.",
  },
};

const LANG_NAMES = {
  ru: "🇷🇺 Русский", uz: "🇺🇿 O'zbek", en: "🇬🇧 English",
  tg: "🇹🇯 Тоҷикӣ",  kz: "🇰🇿 Қазақша", ky: "🇰🇬 Кыргызча",
};

function getLang(lang) { return LANG_STRINGS[lang] ? lang : 'ru'; }

// ── tg_clients: CRUD + трекинг message_ids ───────────────────────────────────

async function findTgClient(chatId) {
  const { data } = await supabase
    .from("tg_clients")
    .select("id, name, phone, tg_username, tg_name, lang, bot_message_ids")
    .eq("tg_chat_id", String(chatId))
    .maybeSingle();
  return data ?? null;
}

async function saveTgClient({ chatId, phone, tgName, tgUsername, lang }) {
  const { error } = await supabase.from("tg_clients").upsert({
    tg_chat_id:  String(chatId),
    name:        tgName || 'Клиент', // имя берём из TG-профиля, fallback
    phone:       phone,
    tg_username: tgUsername || null,
    tg_name:     tgName     || null,
    lang:        lang       || 'ru',
    updated_at:  new Date().toISOString(),
  }, { onConflict: "tg_chat_id" });
  if (error) console.error("saveTgClient error:", error.message);
}

/**
 * Fire-and-forget: дописывает message_id в tg_clients.bot_message_ids.
 * Нужен, чтобы при DELETE клиента realtime-хэндлер мог почистить чат.
 */
function trackMsg(chatId, msgId) {
  if (!msgId) return;
  supabase.from("tg_clients")
    .select("bot_message_ids").eq("tg_chat_id", String(chatId)).maybeSingle()
    .then(({ data }) => {
      if (!data) return; // клиент не зарегистрирован ещё — не трекаем
      const ids = (data.bot_message_ids || []).slice(-199);
      ids.push(msgId);
      return supabase.from("tg_clients")
        .update({ bot_message_ids: ids })
        .eq("tg_chat_id", String(chatId));
    })
    .then((res) => { if (res?.error) console.error("trackMsg:", res.error.message); })
    .catch(() => {});
}

/** Отправка сообщения + автотрекинг message_id */
async function sendMsg(chatId, text, extra = {}) {
  const res = await fetch(`${bot.TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
  });
  const json = await res.json().catch(() => ({}));
  const msgId = json?.result?.message_id;
  trackMsg(chatId, msgId);
  return msgId;
}

// ── Удаление всех сообщений бота в чате (при DELETE клиента) ─────────────────

async function deleteBotMessages(chatId, msgIds) {
  if (!msgIds?.length) return;
  console.log(`🗑️ deleteBotMessages: ${msgIds.length} сообщений для chat ${chatId}`);
  await Promise.allSettled(
    msgIds.map(id =>
      fetch(`${bot.TG_API}/deleteMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: String(chatId), message_id: id }),
      }).catch(() => {})
    )
  );
}

// ── Регистрация: шаги ────────────────────────────────────────────────────────

async function sendLanguageSelection(chatId, firstName) {
  const greeting = `👋 <b>Привет${firstName ? ", " + escapeHtml(firstName) : ""}!</b>`;
  await sendMsg(chatId,
    `${greeting}\n\nДобро пожаловать в <b>Ezze</b>!\n\n${LANG_STRINGS.ru.langTitle}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: LANG_NAMES.ru, callback_data: "lang_ru" },
           { text: LANG_NAMES.uz, callback_data: "lang_uz" }],
          [{ text: LANG_NAMES.en, callback_data: "lang_en" },
           { text: LANG_NAMES.tg, callback_data: "lang_tg" }],
          [{ text: LANG_NAMES.kz, callback_data: "lang_kz" },
           { text: LANG_NAMES.ky, callback_data: "lang_ky" }],
        ],
      },
    }
  );
}

async function sendPhoneRequest(chatId, lang) {
  const s = LANG_STRINGS[lang];
  await sendMsg(chatId, s.phonePrompt, {
    reply_markup: {
      keyboard: [[{ text: s.shareBtn, request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

/** Возвращает persistent reply-клавиатуру для главного меню на выбранном языке */
function buildMainKeyboard(lang) {
  const s = LANG_STRINGS[lang];
  return {
    keyboard: [
      [{ text: s.btnBookings }, { text: s.btnBonuses }],
      [{ text: s.btnHistory },  { text: s.btnLang }],
      [{ text: s.btnHelp }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

async function sendMainMenu(chatId, lang, name, firstTime = false) {
  const s = LANG_STRINGS[lang];
  const text = firstTime
    ? s.registered(escapeHtml(name))
    : s.welcomeBack(escapeHtml(name));
  await sendMsg(chatId, text, { reply_markup: buildMainKeyboard(lang) });
}

// ── Обработчики кнопок главного меню (заглушки для этапа 1) ──────────────────

async function handleMenuAction(chatId, action, client) {
  const lang = getLang(client?.lang || 'ru');
  const s = LANG_STRINGS[lang];

  if (action === 'lang') {
    // Смена языка — показать тот же выбор, что при регистрации
    sessions.set(chatId, sessionEntry({ step: 'waiting_language', changingLang: true }));
    saveSessions();
    await sendMsg(chatId, s.langTitle, {
      reply_markup: {
        inline_keyboard: [
          [{ text: LANG_NAMES.ru, callback_data: "lang_ru" },
           { text: LANG_NAMES.uz, callback_data: "lang_uz" }],
          [{ text: LANG_NAMES.en, callback_data: "lang_en" },
           { text: LANG_NAMES.tg, callback_data: "lang_tg" }],
          [{ text: LANG_NAMES.kz, callback_data: "lang_kz" },
           { text: LANG_NAMES.ky, callback_data: "lang_ky" }],
        ],
      },
    });
    return;
  }

  // bookings / bonuses / history / help — заглушки, наполним в этапе 2
  await sendMsg(chatId, s.soon);
}

/** Матчит текст пользователя с кнопкой меню, с учётом языка клиента */
function matchMenuButton(text, lang) {
  const s = LANG_STRINGS[lang];
  if (text === s.btnBookings) return 'bookings';
  if (text === s.btnBonuses)  return 'bonuses';
  if (text === s.btnHistory)  return 'history';
  if (text === s.btnLang)     return 'lang';
  if (text === s.btnHelp)     return 'help';
  return null;
}

// ── /start — умная точка входа ───────────────────────────────────────────────

async function handleStart(chatId, firstName) {
  const client = await findTgClient(chatId);
  if (client?.phone) {
    // Уже зарегистрирован — показываем главное меню
    const lang = getLang(client.lang);
    const name = client.tg_name || client.name || firstName || 'Клиент';
    await sendMainMenu(chatId, lang, name, false);
    return;
  }
  // Новый клиент — запускаем регистрацию
  sessions.set(chatId, sessionEntry({ step: 'waiting_language' }));
  saveSessions();
  await sendLanguageSelection(chatId, firstName);
}

// ── processUpdate ────────────────────────────────────────────────────────────

async function processUpdate(update) {
  const message = update.message;

  // ── Контакт (шаг 2: телефон) ─────────────────────────────────────────────
  if (message?.contact) {
    const chatId  = message.chat.id;
    const pending = sessions.get(chatId);
    if (pending?.step !== "waiting_phone") {
      // Контакт пришёл вне регистрации — игнорируем
      return;
    }
    const rawPhone  = message.contact.phone_number;
    const tgProfile = [message.from?.first_name, message.from?.last_name]
                        .filter(Boolean).join(" ").trim() || 'Клиент';
    const tgUsername = message.from?.username || '';
    const lang = getLang(pending.lang);

    // 1. Сохраняем клиента
    await saveTgClient({
      chatId, phone: rawPhone,
      tgName: tgProfile, tgUsername, lang,
    });

    // 2. Линкуем существующие appointments по нормализованному телефону
    await linkAppointmentsByPhone(rawPhone, chatId);

    // 3. Очищаем сессию регистрации
    sessions.delete(chatId);
    saveSessions();

    // 4. Показываем главное меню (с приветствием для нового клиента)
    await sendMainMenu(chatId, lang, tgProfile, true);
    return;
  }

  // ── Текстовые сообщения ───────────────────────────────────────────────────
  if (message?.text) {
    const chatId = message.chat.id;
    const text = message.text;
    const firstName = message.from?.first_name || "";
    console.log(`👤 [client] chat=${chatId} text="${text}"`);

    // /start — умная точка входа
    if (text.startsWith("/start")) {
      await handleStart(chatId, firstName);
      return;
    }

    // Если на этапе waiting_phone пользователь пишет текст вместо кнопки
    const pending = sessions.get(chatId);
    if (pending?.step === "waiting_phone") {
      const lang = getLang(pending.lang);
      const s = LANG_STRINGS[lang];
      await sendMsg(chatId, s.remindShare, {
        reply_markup: {
          keyboard: [[{ text: s.shareBtn, request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
      return;
    }

    // Если на этапе waiting_language пользователь пишет текст
    if (pending?.step === "waiting_language") {
      await sendLanguageSelection(chatId, firstName);
      return;
    }

    // Проверяем — не нажал ли пользователь кнопку главного меню
    const client = await findTgClient(chatId);
    if (client) {
      const action = matchMenuButton(text, getLang(client.lang));
      if (action) {
        await handleMenuAction(chatId, action, client);
        return;
      }
    } else {
      // Не зарегистрирован — вежливо просим /start
      await sendMsg(chatId, LANG_STRINGS.ru.noClient);
      return;
    }

    // ── AI для клиентов (только если у клиента есть хотя бы одна запись) ────
    if (!text.startsWith("/")) {
      const { count } = await supabase
        .from("appointments").select("id", { count: "exact", head: true })
        .eq("telegram_id", String(chatId));
      if ((count ?? 0) > 0) {
        const cfg = await loadAIConfig();
        await handleAIMessage(chatId, text, null, bot, cfg);
      }
    }
  }

  // ── Callback queries ──────────────────────────────────────────────────────
  const callback = update.callback_query;
  if (callback) {
    const chatId = callback.message?.chat?.id;
    const msgId  = callback.message?.message_id;
    if (!chatId) return;

    await bot.answerCallbackQuery(callback.id);

    // ── Выбор языка ────────────────────────────────────────────────────────
    if (callback.data?.startsWith("lang_")) {
      const selectedLang = callback.data.slice(5);
      if (!LANG_STRINGS[selectedLang]) return;

      const pending = sessions.get(chatId);
      const isChangingLang = pending?.changingLang === true;

      await bot.editMessageText(chatId, msgId, `✅ ${LANG_NAMES[selectedLang]}`);

      if (isChangingLang) {
        // Смена языка у зарегистрированного клиента
        await supabase.from("tg_clients")
          .update({ lang: selectedLang, updated_at: new Date().toISOString() })
          .eq("tg_chat_id", String(chatId));
        sessions.delete(chatId);
        saveSessions();
        const client = await findTgClient(chatId);
        const name = client?.tg_name || client?.name || 'Клиент';
        await sendMainMenu(chatId, selectedLang, name, false);
      } else if (pending?.step === "waiting_language") {
        // Первичная регистрация → переход к шагу телефона
        pending.step = "waiting_phone";
        pending.lang = selectedLang;
        saveSessions();
        await sendPhoneRequest(chatId, selectedLang);
      }
      return;
    }

    // ── Отмена записи (из уведомления) ────────────────────────────────────
    if (callback.data?.startsWith("cancel_appt_")) {
      const apptId = callback.data.replace("cancel_appt_", "");
      const { data: appt } = await supabase
        .from("appointments")
        .select("id, status, client_name, date, start_time, master_id")
        .eq("id", apptId).maybeSingle();

      if (!appt) {
        await bot.editMessageText(chatId, msgId, "❌ Запись не найдена.");
        return;
      }
      if (appt.status === "cancelled") {
        await bot.editMessageText(chatId, msgId, "❌ <b>Запись уже была отменена ранее.</b>");
        return;
      }
      if (appt.status === "done" || appt.status === "no_show") {
        await bot.editMessageText(chatId, msgId, "ℹ️ <b>Визит уже состоялся — отменить невозможно.</b>");
        return;
      }

      const { data: prof } = await supabase
        .from("master_profiles").select("tg_chat_id, profession")
        .eq("user_id", appt.master_id).maybeSingle();

      await supabase.from("appointments").update({ status: "cancelled" }).eq("id", apptId);

      const masterName = prof?.profession ?? "мастера";
      await bot.editMessageText(
        chatId, msgId,
        `❌ Ваша запись к <b>${masterName}</b> на ${fmtDate(appt.date)} в ${appt.start_time ?? "—"} отменена.`
      );

      // Уведомляем мастера через мастерский бот
      if (prof?.tg_chat_id) {
        await masterBot.sendMessage(
          prof.tg_chat_id,
          `❌ <b>Клиент отменил запись</b>\n\n` +
          `👤 <b>Клиент:</b> ${appt.client_name ?? "—"}\n` +
          `📅 <b>Дата:</b> ${fmtDate(appt.date)}\n` +
          `🕐 <b>Время:</b> ${appt.start_time ?? "—"}`
        );
      }
    }
  }
}

// ── Запуск ────────────────────────────────────────────────────────────────────

console.log(`👤 [${PRODUCT}] Ezze Client Bot starting...`);
console.log(`App URL: ${APP_URL}`);

bot.deleteWebhook()
  .then(() => bot.setupDefaultMenuButton()) // menu-button = commands (без WebApp)
  .then(() => {
    console.log("✅ Client bot polling started");
    bot.startPolling(processUpdate);

    // Очищаем устаревшие сессии каждые 10 минут
    setInterval(() => {
      const removed = cleanupSessions(sessions);
      if (removed > 0) saveSessions();
    }, 10 * 60 * 1000);

    // ── Realtime: при удалении клиента из tg_clients — чистим чат ────────
    // Требует миграции 016: REPLICA IDENTITY FULL на tg_clients
    supabase
      .channel('tg_clients_delete_bot')
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tg_clients' },
        async (payload) => {
          const tgChatId = payload.old?.tg_chat_id;
          const msgIds   = payload.old?.bot_message_ids || [];
          if (!tgChatId) return;
          console.log(`🗑️ tg_clients DELETE → чистим чат ${tgChatId} (${msgIds.length} msgs)`);
          await deleteBotMessages(tgChatId, msgIds);
        }
      )
      .subscribe((status) => {
        console.log(`📡 tg_clients Realtime: ${status}`);
      });
  });
