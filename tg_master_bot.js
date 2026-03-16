/**
 * tg_master_bot.js — Telegram бот для МАСТЕРОВ
 * Бот: @ezzeapp_bot | Token: TG_BOT_TOKEN
 * Запуск: node tg_master_bot.js
 * Systemd: ezze-master-bot.service
 */

import { readFileSync, writeFileSync } from "fs";
import {
  supabase, APP_URL, MASTER_BOT_TOKEN,
  loadTgConfig, loadAIConfig,
  findMasterByChatId, autoFixMasterProfile,
  getMasterTools, executeMasterTool,
  handleAIMessage, runAgentic,
  createBotHelpers,
} from "./tg_shared.js";

const bot = createBotHelpers(MASTER_BOT_TOKEN);

// ── Persistent sessions (для phone-onboarding flow) ───────────────────────────

const SESSIONS_FILE = "./tg_master_sessions.json";

function loadPendingSessions() {
  try {
    const raw = readFileSync(SESSIONS_FILE, "utf8");
    return new Map(Object.entries(JSON.parse(raw)));
  } catch {
    return new Map();
  }
}

function savePendingSessions() {
  try {
    writeFileSync(SESSIONS_FILE, JSON.stringify(Object.fromEntries(pendingMasters)));
  } catch (e) {
    console.error("savePendingSessions error:", e.message);
  }
}

const pendingMasters = loadPendingSessions();

// Нормализация номера: только цифры
function normalizePhone(phone) {
  return (phone || "").replace(/\D/g, "");
}

// ── Многоязычные строки ───────────────────────────────────────────────────────

const LANG_STRINGS = {
  ru: {
    phonePrompt:  `📱 Нажмите кнопку ниже, чтобы поделиться номером телефона:`,
    shareBtn:     "📱 Поделиться номером",
    remindShare:  `📱 Пожалуйста, нажмите кнопку <b>«Поделиться номером»</b> ниже.`,
    found:        "✅ <b>Аккаунт найден!</b>",
    notFound:     `❌ <b>Аккаунт не найден</b>\n\nМастер с таким номером телефона не зарегистрирован в системе.\n\nЗарегистрируйтесь — это займёт 2 минуты:`,
    registerBtn:  "🚀 Зарегистрироваться",
  },
  uz: {
    phonePrompt:  `📱 Telefon raqamingizni ulashish uchun quyidagi tugmani bosing:`,
    shareBtn:     "📱 Raqamni ulashish",
    remindShare:  `📱 Iltimos, quyidagi <b>«Raqamni ulashish»</b> tugmasini bosing.`,
    found:        "✅ <b>Hisob topildi!</b>",
    notFound:     `❌ <b>Hisob topilmadi</b>\n\nBu raqam bilan hech qanday usta ro'yxatdan o'tmagan.\n\nRo'yxatdan o'ting — bu 2 daqiqa oladi:`,
    registerBtn:  "🚀 Ro'yxatdan o'tish",
  },
  en: {
    phonePrompt:  `📱 Press the button below to share your phone number:`,
    shareBtn:     "📱 Share phone number",
    remindShare:  `📱 Please press the <b>«Share phone number»</b> button below.`,
    found:        "✅ <b>Account found!</b>",
    notFound:     `❌ <b>Account not found</b>\n\nNo master with this phone number is registered in the system.\n\nSign up — it takes only 2 minutes:`,
    registerBtn:  "🚀 Sign up",
  },
  tg: {
    phonePrompt:  `📱 Барои мубодилаи рақами телефон тугмаи зеринро пахш кунед:`,
    shareBtn:     "📱 Мубодилаи рақам",
    remindShare:  `📱 Лутфан тугмаи <b>«Мубодилаи рақам»</b>-ро пахш кунед.`,
    found:        "✅ <b>Ҳисоб ёфт шуд!</b>",
    notFound:     `❌ <b>Ҳисоб ёфт нашуд</b>\n\nАз ин рақами телефон ягон устои бақайдгирифта вуҷуд надорад.\n\nБақайд гиред — ин 2 дақиқа мегирад:`,
    registerBtn:  "🚀 Бақайдгирӣ",
  },
  kz: {
    phonePrompt:  `📱 Телефон нөміріңізді бөлісу үшін төмендегі түймені басыңыз:`,
    shareBtn:     "📱 Нөмірді бөлісу",
    remindShare:  `📱 Төмендегі <b>«Нөмірді бөлісу»</b> түймесін басыңыз.`,
    found:        "✅ <b>Аккаунт табылды!</b>",
    notFound:     `❌ <b>Аккаунт табылмады</b>\n\nБұл телефон нөмірімен тіркелген шебер жоқ.\n\nТіркеліңіз — бұл 2 минут алады:`,
    registerBtn:  "🚀 Тіркелу",
  },
  kg: {
    phonePrompt:  `📱 Телефон номериңизди бөлүшүү үчүн төмөндөгү баскычты басыңыз:`,
    shareBtn:     "📱 Номерди бөлүшүү",
    remindShare:  `📱 Төмөндөгү <b>«Номерди бөлүшүү»</b> баскычын басыңыз.`,
    found:        "✅ <b>Аккаунт табылды!</b>",
    notFound:     `❌ <b>Аккаунт табылган жок</b>\n\nБул телефон номери менен каттоодон өткөн чебер жок.\n\nКаттоодон өтүңүз — бул 2 мүнөт алат:`,
    registerBtn:  "🚀 Каттоодон өтүү",
  },
};

function getLang(pending) {
  return LANG_STRINGS[pending?.lang] ? pending.lang : "ru";
}

// ── Мастерское меню ───────────────────────────────────────────────────────────

async function sendMasterMenu(chatId, firstName, masterProfile) {
  const masterName = masterProfile.profession || firstName || "Мастер";
  const cfg = await loadTgConfig();
  const label = cfg.master_label;
  await bot.setUserMenuButton(chatId, label, `${APP_URL}/tg?start=master`);
  await bot.sendMessage(
    chatId,
    `👋 <b>Привет, ${masterName}!</b>\n\nРады видеть вас снова в <b>Ezze</b>.\n\nИспользуйте кнопку <b>${label}</b> рядом с полем ввода, чтобы открыть кабинет мастера.`
  );
}

// ── Ответ на callback_query (убирает индикатор загрузки) ─────────────────────

async function answerCbQuery(callbackQueryId, text = "") {
  await fetch(`${bot.TG_API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  }).catch(() => {});
}

// ── Экран выбора языка ────────────────────────────────────────────────────────

async function sendLangSelection(chatId, firstName) {
  const name = firstName ? `, ${firstName}` : "";
  await fetch(`${bot.TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text:
        `👋 <b>Привет${name}!</b> / <b>Salom${name}!</b> / <b>Hi${name}!</b>\n\n` +
        `Добро пожаловать в <b>Ezze</b> — сервис для мастеров красоты.\n\n` +
        `🌐 <b>Выберите язык / Tilni tanlang / Choose language:</b>`,
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
            { text: "🇰🇬 Кыргызча", callback_data: "lang_kg" },
          ],
        ],
      },
    }),
  });
}

// ── Обработка обновлений ──────────────────────────────────────────────────────

async function processUpdate(update) {

  // ── Callback query (выбор языка) ───────────────────────────────────────────
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message?.chat?.id || cb.from?.id;
    const data = cb.data || "";

    if (data.startsWith("lang_")) {
      const lang = data.slice(5); // "ru", "uz", "en", "tg", "kz", "kg"
      if (!LANG_STRINGS[lang]) {
        await answerCbQuery(cb.id);
        return;
      }
      const pending = pendingMasters.get(chatId);
      if (pending?.step === "waiting_language") {
        console.log(`🌐 [master] chat=${chatId} lang=${lang}`);
        pendingMasters.set(chatId, { step: "waiting_phone", lang });
        savePendingSessions();
        await answerCbQuery(cb.id, "✓");
        const s = LANG_STRINGS[lang];
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
      } else {
        await answerCbQuery(cb.id);
      }
    } else {
      await answerCbQuery(cb.id);
    }
    return;
  }

  const message = update.message;

  // ── Контакт (phone-onboarding шаг 2) ──────────────────────────────────────
  if (message?.contact) {
    const chatId = message.chat.id;
    const pending = pendingMasters.get(chatId);
    if (pending?.step === "waiting_phone") {
      const lang = getLang(pending);
      const s = LANG_STRINGS[lang];
      const phoneDigits = normalizePhone(message.contact.phone_number);
      console.log(`📱 [master] chat=${chatId} phone_digits=${phoneDigits}`);

      // Ищем мастера по телефону в master_profiles
      const { data: profiles } = await supabase
        .from("master_profiles").select("*").not("phone", "is", null);
      const profile = (profiles || []).find(p => {
        if (!p.phone) return false;
        const stored = normalizePhone(p.phone);
        return stored === phoneDigits
          || stored.endsWith(phoneDigits)
          || phoneDigits.endsWith(stored);
      });

      pendingMasters.delete(chatId);
      savePendingSessions();

      if (profile) {
        // Нашли — привязываем tg_chat_id
        await supabase.from("master_profiles")
          .update({ tg_chat_id: String(chatId) }).eq("id", profile.id);
        profile.tg_chat_id = String(chatId);
        console.log(`✅ Linked chat=${chatId} to master profile id=${profile.id}`);
        await bot.sendMessage(chatId, s.found, { remove_keyboard: true });
        await sendMasterMenu(chatId, message.contact.first_name || "", profile);
      } else {
        // Не найден — предлагаем регистрацию
        await fetch(`${bot.TG_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: s.notFound,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                { text: s.registerBtn, web_app: { url: `${APP_URL}/register` } },
              ]],
              remove_keyboard: true,
            },
          }),
        });
      }
    }
    return;
  }

  if (message?.text) {
    const chatId = message.chat.id;
    const text = message.text;
    const firstName = message.from?.first_name || "";
    const tgUsername = message.from?.username;
    console.log(`👷 [master] chat=${chatId} text="${text}"`);

    if (text.startsWith("/start")) {
      const param = text.split(" ")[1] || "";

      if (param) {
        // /start connect_slug или /start slug — привязка Telegram к профилю мастера
        const slug = param.startsWith("connect_") ? param.slice(8) : param;
        const { data: profile } = await supabase
          .from("master_profiles").select("id").eq("booking_slug", slug).maybeSingle();

        if (profile) {
          const patch = { tg_chat_id: String(chatId) };
          if (tgUsername) patch.telegram = "@" + tgUsername;
          await supabase.from("master_profiles").update(patch).eq("id", profile.id);
          console.log(`✅ Connected Telegram ${chatId} to master slug: ${slug}`);
          await bot.sendMessage(chatId,
            `✅ <b>Отлично, ${firstName}!</b>\n\nВаш Telegram подключён к Ezze.\nТеперь вы будете получать уведомления о новых записях прямо сюда! 🎉`
          );
        } else {
          await bot.sendMessage(chatId, `❌ Профиль мастера не найден. Проверьте ссылку.`);
        }
        return;
      }

      // /start без параметра — поиск мастера по chat_id
      let masterProfile = await findMasterByChatId(chatId);
      if (!masterProfile) {
        console.log(`ℹ️  Master not found by tg_chat_id=${chatId}, trying autoFix...`);
        masterProfile = await autoFixMasterProfile(chatId, tgUsername);
        if (masterProfile) console.log(`✅ autoFix success for chat=${chatId}`);
      }

      if (masterProfile) {
        if (tgUsername) {
          supabase.from("master_profiles").update({ telegram: "@" + tgUsername })
            .eq("id", masterProfile.id).then(() => {}).catch(() => {});
        }
        await sendMasterMenu(chatId, firstName, masterProfile);
      } else {
        // Не найден — показываем выбор языка (шаг 1 онбординга)
        await bot.setUserMenuButton(chatId); // сброс к default
        pendingMasters.set(chatId, { step: "waiting_language" });
        savePendingSessions();
        await sendLangSelection(chatId, firstName);
      }
      return;
    }

    // ── Текст при ожидании номера телефона ────────────────────────────────────
    if (!text.startsWith("/")) {
      const pending = pendingMasters.get(chatId);
      if (pending?.step === "waiting_phone") {
        const lang = getLang(pending);
        const s = LANG_STRINGS[lang];
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
      // ── Текст при ожидании выбора языка ─────────────────────────────────────
      if (pending?.step === "waiting_language") {
        await sendLangSelection(chatId, firstName);
        return;
      }
    }

    // ── AI-сообщения от мастеров ──────────────────────────────────────────────
    if (!text.startsWith("/")) {
      const masterProfile = await findMasterByChatId(chatId);
      if (masterProfile) {
        const cfg = await loadAIConfig();
        await handleAIMessage(chatId, text, masterProfile, bot, cfg);
      } else {
        await bot.sendMessage(chatId,
          `ℹ️ Этот бот только для мастеров Ezze.\n\nЕсли вы мастер — подключите Telegram в профиле приложения.`
        );
      }
    }
  }
}

// ── Запуск ────────────────────────────────────────────────────────────────────

console.log("👷 Ezze Master Bot starting...");
console.log(`App URL: ${APP_URL}`);

bot.deleteWebhook()
  .then(() => bot.setupDefaultMenuButton())
  .then(() => {
    console.log("✅ Master bot polling started (@ezzeapp_bot)");
    bot.startPolling(processUpdate);
  });
