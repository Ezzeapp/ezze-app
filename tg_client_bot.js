/**
 * tg_client_bot.js — Telegram бот для КЛИЕНТОВ
 * Бот: @ezzeclient_bot | Token: TG_CLIENT_BOT_TOKEN
 * Запуск: node tg_client_bot.js
 * Systemd: ezze-client-bot.service
 *
 * Сценарий 1: Клиент открывает бота сам (/start без параметра)
 *   → регистрация (телефон → имя) → запись в tg_clients → личный кабинет
 *
 * Сценарий 2: Клиент переходит по ссылке мастера (/start book_SLUG)
 *   → уже в tg_clients? → сразу кнопка "Записаться" (без повторного ввода)
 *   → не в tg_clients? → регистрация → запись в tg_clients → кнопка "Записаться"
 */

import { readFileSync, writeFileSync } from "fs";
import {
  supabase, APP_URL, CLIENT_BOT_TOKEN, MASTER_BOT_TOKEN,
  loadTgConfig, loadAIConfig,
  getClientTools, executeClientTool,
  handleAIMessage, fmtDate,
  createBotHelpers,
} from "./tg_shared.js";

const bot = createBotHelpers(CLIENT_BOT_TOKEN);

// Отдельный helper для отправки уведомлений мастерам через мастерский бот
const masterBot = createBotHelpers(MASTER_BOT_TOKEN);

// ── Persistent sessions ───────────────────────────────────────────────────────

const SESSIONS_FILE = "./tg_client_sessions.json";

function loadPendingBookings() {
  try {
    const raw = readFileSync(SESSIONS_FILE, "utf8");
    return new Map(Object.entries(JSON.parse(raw)));
  } catch {
    return new Map();
  }
}

function savePendingBookings() {
  try {
    writeFileSync(SESSIONS_FILE, JSON.stringify(Object.fromEntries(pendingBookings)));
  } catch (e) {
    console.error("savePendingBookings error:", e.message);
  }
}

const pendingBookings = loadPendingBookings();

// ── Многоязычные строки клиентского бота ──────────────────────────────────────

const CLIENT_LANG_STRINGS = {
  ru: {
    phonePrompt: `📱 Поделитесь вашим номером телефона:`,
    shareBtn:    'Поделиться номером',
    remindShare: `📱 Пожалуйста, нажмите кнопку <b>«Поделиться номером»</b> ниже.`,
    askName:     `👤 Как вас зовут?`,
    askNameHint: name => `\n\n<i>Можете написать: ${name}</i>`,
    registered:  name => `✅ <b>Готово, ${name}!</b>\n\nВы зарегистрированы. Откройте кабинет — там можно найти мастера через поиск или отсканировать QR-код:`,
    cabinetBtn:  '📋 Мой кабинет',
    welcomeBack: `Рады видеть вас снова в <b>Ezze</b>!\n\nНажмите кнопку ниже, чтобы открыть личный кабинет:`,
  },
  uz: {
    phonePrompt: `📱 Telefon raqamingizni ulashing:`,
    shareBtn:    "Raqamni ulashish",
    remindShare: `📱 Iltimos, <b>«Raqamni ulashish»</b> tugmasini bosing.`,
    askName:     `👤 Ismingiz nima?`,
    askNameHint: name => `\n\n<i>Yozishingiz mumkin: ${name}</i>`,
    registered:  name => `✅ <b>Tayyor, ${name}!</b>\n\nSiz ro'yxatdan o'tdingiz. Kabinetni oching — u yerda usta qidirish yoki QR-kod skanerlash mumkin:`,
    cabinetBtn:  "📋 Mening kabinetim",
    welcomeBack: `<b>Ezze</b>ga yana xush kelibsiz!\n\nShaxsiy kabinetingizni ochish uchun tugmani bosing:`,
  },
  en: {
    phonePrompt: `📱 Please share your phone number:`,
    shareBtn:    "Share phone number",
    remindShare: `📱 Please press the <b>«Share phone number»</b> button below.`,
    askName:     `👤 What is your name?`,
    askNameHint: name => `\n\n<i>You can type: ${name}</i>`,
    registered:  name => `✅ <b>Done, ${name}!</b>\n\nYou're registered. Open your cabinet — search for a master or scan a QR code:`,
    cabinetBtn:  "📋 My Cabinet",
    welcomeBack: `Welcome back to <b>Ezze</b>!\n\nPress the button below to open your personal cabinet:`,
  },
  tg: {
    phonePrompt: `📱 Рақами телефони худро мубодила кунед:`,
    shareBtn:    "Мубодилаи рақам",
    remindShare: `📱 Лутфан тугмаи <b>«Мубодилаи рақам»</b>-ро пахш кунед.`,
    askName:     `👤 Номи шумо чист?`,
    askNameHint: name => `\n\n<i>Навиштан мумкин: ${name}</i>`,
    registered:  name => `✅ <b>Тайёр, ${name}!</b>\n\nШумо сабти ном шудед. Кабинетро кушоед:`,
    cabinetBtn:  "📋 Кабинети ман",
    welcomeBack: `Ба <b>Ezze</b> хуш омадед!\n\nБарои кушодани кабинет тугмаро пахш кунед:`,
  },
  kz: {
    phonePrompt: `📱 Телефон нөміріңізді бөлісіңіз:`,
    shareBtn:    "Нөмірді бөлісу",
    remindShare: `📱 <b>«Нөмірді бөлісу»</b> түймесін басыңыз.`,
    askName:     `👤 Атыңыз қалай?`,
    askNameHint: name => `\n\n<i>Жазуыңызға болады: ${name}</i>`,
    registered:  name => `✅ <b>Дайын, ${name}!</b>\n\nТіркелдіңіз. Кабинетіңізді ашыңыз:`,
    cabinetBtn:  "📋 Менің кабинетім",
    welcomeBack: `<b>Ezze</b>-ге қайта қош келдіңіз!\n\nКабинетті ашу үшін түймені басыңыз:`,
  },
  ky: {
    phonePrompt: `📱 Телефон номериңизди бөлүшүңүз:`,
    shareBtn:    "Номерди бөлүшүү",
    remindShare: `📱 <b>«Номерди бөлүшүү»</b> баскычын басыңыз.`,
    askName:     `👤 Атыңыз кандай?`,
    askNameHint: name => `\n\n<i>Жазсаңыз болот: ${name}</i>`,
    registered:  name => `✅ <b>Даяр, ${name}!</b>\n\nКаттоодон өттүңүз. Кабинетиңизди ачыңыз:`,
    cabinetBtn:  "📋 Менин кабинетим",
    welcomeBack: `<b>Ezze</b>-ге кайра кош келиңиз!\n\nКабинетти ачуу үчүн баскычты басыңыз:`,
  },
};

function getClientLang(lang) {
  return CLIENT_LANG_STRINGS[lang] ? lang : 'ru';
}

// ── tg_clients: сохранение/поиск платформенных клиентов ───────────────────────

/** Ищет клиента в tg_clients по tg_chat_id. Возвращает запись или null. */
async function findTgClient(chatId) {
  const { data } = await supabase
    .from("tg_clients")
    .select("id, name, phone, tg_username, tg_name, lang")
    .eq("tg_chat_id", String(chatId))
    .maybeSingle();
  return data ?? null;
}

/**
 * Сохраняет/обновляет клиента в tg_clients.
 * @param {number|string} chatId     — Telegram chat ID
 * @param {string}        name       — имя, введённое клиентом
 * @param {string}        phone      — телефон
 * @param {string|null}   tgUsername — @никнейм из Telegram-профиля
 * @param {string|null}   tgName     — отображаемое имя из Telegram-профиля
 * @param {string}        lang       — выбранный язык
 */
async function saveTgClient(chatId, name, phone, tgUsername = null, tgName = null, lang = 'ru') {
  const { error } = await supabase.from("tg_clients").upsert({
    tg_chat_id:  String(chatId),
    name,
    phone,
    tg_username: tgUsername || null,
    tg_name:     tgName     || null,
    lang:        lang       || 'ru',
    updated_at:  new Date().toISOString(),
  }, { onConflict: "tg_chat_id" });
  if (error) console.error("saveTgClient error:", error.message);
}

// ── Выбор языка для клиента ───────────────────────────────────────────────────

async function sendClientLangSelection(chatId, firstName) {
  const greeting = `👋 <b>Привет${firstName ? ", " + firstName : ""}!</b>`;
  await fetch(`${bot.TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `${greeting}\n\nДобро пожаловать в <b>Ezze</b>!\n\n🌐 <b>Выберите язык / Tilni tanlang / Select language:</b>`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🇷🇺 Русский",   callback_data: "lang_ru" },
            { text: "🇺🇿 O'zbek",    callback_data: "lang_uz" },
          ],
          [
            { text: "🇬🇧 English",   callback_data: "lang_en" },
            { text: "🇹🇯 Тоҷикӣ",   callback_data: "lang_tg" },
          ],
          [
            { text: "🇰🇿 Қазақша",  callback_data: "lang_kz" },
            { text: "🇰🇬 Кыргызча", callback_data: "lang_ky" },
          ],
        ],
      },
    }),
  });
}

// ── Клиентские хелперы ────────────────────────────────────────────────────────

async function setClientMenuButton(chatId, phone = '', name = '') {
  const cfg = await loadTgConfig();
  // Если телефон не передан — пробуем достать из tg_clients
  if (!phone) {
    const tgClient = await findTgClient(chatId);
    phone = tgClient?.phone || '';
    if (!name) name = tgClient?.name || '';
  }
  const params = new URLSearchParams({ tg_id: String(chatId) });
  if (phone) params.set('tg_phone', phone);
  if (name) params.set('tg_name', name);
  await bot.setUserMenuButton(chatId, cfg.client_label, `${APP_URL}/my?${params.toString()}`);
}

async function showBookingButton(chatId, slug, phone, name, tgUsername = '') {
  const params = new URLSearchParams({ tg_phone: phone, tg_name: name, tg_id: String(chatId) });
  if (tgUsername) params.set('tg_username', tgUsername);
  const bookUrl = `${APP_URL}/book/${slug}?${params.toString()}`;
  await fetch(`${bot.TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `✅ <b>Отлично, ${name}!</b>\n\nВсё готово — нажмите кнопку ниже, чтобы выбрать услугу и удобное время:`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "📅 Записаться", style: "primary", web_app: { url: bookUrl } }]] },
    }),
  });
}

async function showTeamBookingButton(chatId, teamSlug, phone, name, tgUsername = '') {
  const params = new URLSearchParams({ tg_phone: phone, tg_name: name, tg_id: String(chatId) });
  if (tgUsername) params.set('tg_username', tgUsername);
  const teamUrl = `${APP_URL}/book/team/${teamSlug}?${params.toString()}`;
  await fetch(`${bot.TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `✅ <b>Отлично, ${name}!</b>\n\nНажмите кнопку ниже, чтобы выбрать мастера и записаться:`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "👥 Выбрать мастера", style: "primary", web_app: { url: teamUrl } }]] },
    }),
  });
}

async function sendClientMenuSmart(chatId, firstName, tgUsername = '') {
  const greeting = `👋 <b>Привет${firstName ? ", " + firstName : ""}!</b>`;

  // 1. Есть ли активные/прошлые записи по telegram_id?
  const { count } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("telegram_id", String(chatId));

  let isKnownClient = (count ?? 0) > 0;

  // 2. Есть ли запись в clients.tg_chat_id (старый механизм)?
  if (!isKnownClient) {
    const { data: clientRecord } = await supabase
      .from("clients").select("id").eq("tg_chat_id", String(chatId)).maybeSingle();
    isKnownClient = !!clientRecord;
  }

  // 3. Зарегистрирован в tg_clients (платформенная регистрация)?
  let knownTgClient = null;
  if (!isKnownClient) {
    knownTgClient = await findTgClient(chatId);
    isKnownClient = !!knownTgClient;
  } else {
    knownTgClient = await findTgClient(chatId);
  }

  // 4. Есть ли сохранённая JSON-сессия (резервный вариант)?
  const savedSession = pendingBookings.get(chatId);
  if (!isKnownClient && savedSession?.mode === "registered") {
    isKnownClient = true;
  }

  if (isKnownClient) {
    const clientPhone = knownTgClient?.phone || '';
    const clientName  = knownTgClient?.name  || '';
    const clientLang  = getClientLang(knownTgClient?.lang || 'ru');
    const s = CLIENT_LANG_STRINGS[clientLang];
    const cabinetParams = new URLSearchParams({ tg_id: String(chatId) });
    if (clientPhone) cabinetParams.set('tg_phone', clientPhone);
    if (clientName)  cabinetParams.set('tg_name', clientName);
    const cabinetUrl = `${APP_URL}/my?${cabinetParams.toString()}`;
    await setClientMenuButton(chatId, clientPhone, clientName);
    await fetch(`${bot.TG_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `${greeting}\n\n${s.welcomeBack}`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: s.cabinetBtn, style: "primary", web_app: { url: cabinetUrl } },
          ]],
        },
      }),
    });
  } else {
    // Новый клиент — сбрасываем кнопку меню, показываем выбор языка
    await bot.setUserMenuButton(chatId); // убираем кнопку до окончания регистрации
    pendingBookings.set(chatId, {
      step: "waiting_language",
      mode: "registration",
      tgUsername,
    });
    savePendingBookings();
    await sendClientLangSelection(chatId, firstName);
  }
}

// ── Обработка обновлений ──────────────────────────────────────────────────────

async function processUpdate(update) {
  const message = update.message;

  // ── Контакт (шаг 1: номер телефона) ──────────────────────────────────────
  if (message?.contact) {
    const chatId = message.chat.id;
    const pending = pendingBookings.get(chatId);
    if (pending?.step === "waiting_phone") {
      const phone = message.contact.phone_number;
      const contactName = [message.contact.first_name, message.contact.last_name]
        .filter(Boolean).join(" ");
      // tgProfileName — отображаемое имя из Telegram-профиля (может отличаться от имени контакта)
      const tgProfileName = [message.from?.first_name, message.from?.last_name]
        .filter(Boolean).join(" ") || contactName;
      const lang = getClientLang(pending?.lang);
      const s = CLIENT_LANG_STRINGS[lang];
      pending.step = "waiting_name";
      pending.phone = phone;
      pending.tgName = contactName;
      pending.tgProfileName = tgProfileName;
      pending.tgUsername = message.from?.username || '';
      savePendingBookings();
      await bot.sendMessage(
        chatId,
        `${s.askName}${contactName ? s.askNameHint(contactName) : ""}`,
        { remove_keyboard: true }
      );
    }
    return;
  }

  if (message?.text) {
    const chatId = message.chat.id;
    const text = message.text;
    const firstName = message.from?.first_name || "";
    console.log(`👤 [client] chat=${chatId} text="${text}"`);

    // ── /start ────────────────────────────────────────────────────────────────
    if (text.startsWith("/start")) {
      // Единственный сценарий: регистрация → личный кабинет
      // Клиент находит мастера через поиск или QR-сканер внутри кабинета
      const tgUsernameNow = message.from?.username || '';
      const existingSession = pendingBookings.get(chatId);
      if (existingSession && existingSession.mode !== "registered") {
        existingSession.tgUsername = tgUsernameNow;
      }
      await sendClientMenuSmart(chatId, firstName, tgUsernameNow);
      return;
    }

    if (text === "/menu") {
      await sendClientMenuSmart(chatId, firstName);
      return;
    }

    // ── Шаг 0b: написал текст при ожидании выбора языка ──────────────────────
    if (!text.startsWith("/")) {
      const pending = pendingBookings.get(chatId);
      if (pending?.step === "waiting_language") {
        await sendClientLangSelection(chatId, firstName);
        return;
      }
    }

    // ── Шаг 1b: написал текст вместо кнопки "Поделиться номером" ─────────────
    if (!text.startsWith("/")) {
      const pending = pendingBookings.get(chatId);
      if (pending?.step === "waiting_phone") {
        const lang = getClientLang(pending?.lang);
        const s = CLIENT_LANG_STRINGS[lang];
        await fetch(`${bot.TG_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: s.remindShare,
            parse_mode: "HTML",
            reply_markup: {
              keyboard: [[{ text: s.shareBtn, request_contact: true }]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          }),
        });
        return;
      }
    }

    // ── Шаг 2: ввод имени ────────────────────────────────────────────────────
    if (!text.startsWith("/")) {
      const pending = pendingBookings.get(chatId);
      if (pending?.step === "waiting_name") {
        const name          = text.trim() || pending.tgName || firstName;
        const tgUsername    = pending.tgUsername    || '';
        const tgProfileName = pending.tgProfileName || '';
        const lang          = getClientLang(pending?.lang);
        const s             = CLIENT_LANG_STRINGS[lang];

        // ✅ Сохраняем клиента в tg_clients → всегда открываем кабинет
        await saveTgClient(chatId, name, pending.phone, tgUsername, tgProfileName, lang);

        pendingBookings.set(chatId, {
          mode: "registered",
          phone: pending.phone,
          name,
          tgUsername,
        });
        savePendingBookings();
        await setClientMenuButton(chatId, pending.phone, name);
        const regParams = new URLSearchParams({ tg_id: String(chatId), tg_phone: pending.phone, tg_name: name });
        await fetch(`${bot.TG_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: s.registered(name),
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                { text: s.cabinetBtn, style: "primary", web_app: { url: `${APP_URL}/my?${regParams.toString()}` } },
              ]],
            },
          }),
        });
        return;
      }
    }

    // ── AI для клиентов ───────────────────────────────────────────────────────
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
      const selectedLang = callback.data.slice(5); // "lang_ru" → "ru"
      if (!CLIENT_LANG_STRINGS[selectedLang]) return;
      const pending = pendingBookings.get(chatId);
      if (pending?.step === "waiting_language") {
        pending.step = "waiting_phone";
        pending.lang = selectedLang;
        savePendingBookings();
        const s = CLIENT_LANG_STRINGS[selectedLang];
        const langNames = { ru: "🇷🇺 Русский", uz: "🇺🇿 O'zbek", en: "🇬🇧 English", tg: "🇹🇯 Тоҷикӣ", kz: "🇰🇿 Қазақша", ky: "🇰🇬 Кыргызча" };
        await bot.editMessageText(chatId, msgId, `✅ ${langNames[selectedLang] || selectedLang}`);
        await fetch(`${bot.TG_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: s.phonePrompt,
            parse_mode: "HTML",
            reply_markup: {
              keyboard: [[{ text: s.shareBtn, request_contact: true }]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          }),
        });
      }
      return;
    }

    if (callback.data === "open_cabinet") {
      const tgCl = await findTgClient(chatId);
      const cbParams = new URLSearchParams({ tg_id: String(chatId) });
      if (tgCl?.phone) cbParams.set('tg_phone', tgCl.phone);
      if (tgCl?.name)  cbParams.set('tg_name', tgCl.name);
      await bot.sendMessageWithWebApp(chatId, "📋 Открываю ваши записи...", "Ezze", `${APP_URL}/my?${cbParams.toString()}`);
    }

    if (callback.data?.startsWith("cancel_appt_")) {
      const apptId = callback.data.replace("cancel_appt_", "");

      const { data: appt } = await supabase
        .from("appointments")
        .select("id, status, client_name, date, start_time, master_id")
        .eq("id", apptId).maybeSingle();

      if (!appt) {
        await bot.editMessageText(chatId, msgId, "❌ Запись не найдена. Возможно, она была удалена.");
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

      // Получаем данные мастера заранее
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

console.log("👤 Ezze Client Bot starting...");
console.log(`App URL: ${APP_URL}`);

bot.deleteWebhook()
  .then(() => bot.setupDefaultMenuButton())
  .then(() => {
    console.log("✅ Client bot polling started (@ezzeclient_bot)");
    bot.startPolling(processUpdate);
  });
