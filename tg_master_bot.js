/**
 * tg_master_bot.js — Telegram бот для МАСТЕРОВ
 * Бот: @ezzepro_bot | Token: TG_BOT_TOKEN
 * Запуск: node tg_master_bot.js
 * Systemd: ezze-master-bot.service
 */

import { readFileSync, writeFileSync } from "fs";
import {
  supabase, APP_URL, MASTER_BOT_TOKEN, CLIENT_BOT_TOKEN,
  SUPABASE_URL, SUPABASE_SERVICE_KEY,
  loadTgConfig, loadAIConfig, invalidateTgConfigCache,
  findMasterByChatId, autoFixMasterProfile,
  getMasterTools, executeMasterTool,
  handleAIMessage, runAgentic,
  createBotHelpers, fmtDate,
  escapeHtml, sessionEntry, cleanupSessions, PRODUCT,
} from "./tg_shared.js";

const bot       = createBotHelpers(MASTER_BOT_TOKEN);
const clientBot = createBotHelpers(CLIENT_BOT_TOKEN); // для уведомлений клиентам

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
    shareBtn:     "Поделиться номером",
    remindShare:  `📱 Пожалуйста, нажмите кнопку <b>«Поделиться номером»</b> ниже.`,
    found:        "✅ <b>Аккаунт найден!</b>",
    notFound:     `❌ <b>Аккаунт не найден</b>\n\nМастер с таким номером телефона не зарегистрирован в системе.\n\nЗарегистрируйтесь — это займёт 2 минуты:`,
    registerBtn:  "Зарегистрироваться",
    openApp:      "Открыть приложение",
    askName:      `👤 Как вас зовут? Введите своё имя:`,
    askNameHint:  name => `\n\n<i>Можете написать: ${name}</i>`,
    successReg:   name => `✅ <b>Отлично, ${name}!</b>\n\nНажмите кнопку меню рядом с полем ввода, чтобы пройти регистрацию — ваши данные уже заполнены.`,
  },
  uz: {
    phonePrompt:  `📱 Telefon raqamingizni ulashish uchun quyidagi tugmani bosing:`,
    shareBtn:     "Raqamni ulashish",
    remindShare:  `📱 Iltimos, quyidagi <b>«Raqamni ulashish»</b> tugmasini bosing.`,
    found:        "✅ <b>Hisob topildi!</b>",
    notFound:     `❌ <b>Hisob topilmadi</b>\n\nBu raqam bilan hech qanday usta ro'yxatdan o'tmagan.\n\nRo'yxatdan o'ting — bu 2 daqiqa oladi:`,
    registerBtn:  "Ro'yxatdan o'tish",
    openApp:      "Ilovani ochish",
    askName:      `👤 Ismingiz nima? Ismingizni kiriting:`,
    askNameHint:  name => `\n\n<i>Yozishingiz mumkin: ${name}</i>`,
    successReg:   name => `✅ <b>Ajoyib, ${name}!</b>\n\nRo'yxatdan o'tish uchun kiritish maydoni yonidagi menyu tugmasini bosing — ma'lumotlaringiz allaqachon to'ldirilgan.`,
  },
  en: {
    phonePrompt:  `📱 Press the button below to share your phone number:`,
    shareBtn:     "Share phone number",
    remindShare:  `📱 Please press the <b>«Share phone number»</b> button below.`,
    found:        "✅ <b>Account found!</b>",
    notFound:     `❌ <b>Account not found</b>\n\nNo master with this phone number is registered in the system.\n\nSign up — it takes only 2 minutes:`,
    registerBtn:  "Sign up",
    openApp:      "Open App",
    askName:      `👤 What is your name? Please enter it:`,
    askNameHint:  name => `\n\n<i>You can type: ${name}</i>`,
    successReg:   name => `✅ <b>Great, ${name}!</b>\n\nPress the menu button next to the input field to complete registration — your details are pre-filled.`,
  },
  tg: {
    phonePrompt:  `📱 Барои мубодилаи рақами телефон тугмаи зеринро пахш кунед:`,
    shareBtn:     "Мубодилаи рақам",
    remindShare:  `📱 Лутфан тугмаи <b>«Мубодилаи рақам»</b>-ро пахш кунед.`,
    found:        "✅ <b>Ҳисоб ёфт шуд!</b>",
    notFound:     `❌ <b>Ҳисоб ёфт нашуд</b>\n\nАз ин рақами телефон ягон устои бақайдгирифта вуҷуд надорад.\n\nБақайд гиред — ин 2 дақиқа мегирад:`,
    registerBtn:  "Бақайдгирӣ",
    openApp:      "Кушодани барнома",
    askName:      `👤 Номи шумо чист? Номатонро ворид кунед:`,
    askNameHint:  name => `\n\n<i>Навиштан мумкин: ${name}</i>`,
    successReg:   name => `✅ <b>Аъло, ${name}!</b>\n\nБарои бақайдгирӣ тугмаи менюи паҳлӯи майдони вуруд фишор диҳед — маълумоти шумо аллакай пур шудааст.`,
  },
  kz: {
    phonePrompt:  `📱 Телефон нөміріңізді бөлісу үшін төмендегі түймені басыңыз:`,
    shareBtn:     "Нөмірді бөлісу",
    remindShare:  `📱 Төмендегі <b>«Нөмірді бөлісу»</b> түймесін басыңыз.`,
    found:        "✅ <b>Аккаунт табылды!</b>",
    notFound:     `❌ <b>Аккаунт табылмады</b>\n\nБұл телефон нөмірімен тіркелген шебер жоқ.\n\nТіркеліңіз — бұл 2 минут алады:`,
    registerBtn:  "Тіркелу",
    openApp:      "Қолданбаны ашу",
    askName:      `👤 Атыңыз қалай? Атыңызды енгізіңіз:`,
    askNameHint:  name => `\n\n<i>Жазуыңызға болады: ${name}</i>`,
    successReg:   name => `✅ <b>Тамаша, ${name}!</b>\n\nТіркелу үшін енгізу өрісінің жанындағы мәзір түймесін басыңыз — деректеріңіз толтырылды.`,
  },
  ky: {
    phonePrompt:  `📱 Телефон номериңизди бөлүшүү үчүн төмөндөгү баскычты басыңыз:`,
    shareBtn:     "Номерди бөлүшүү",
    remindShare:  `📱 Төмөндөгү <b>«Номерди бөлүшүү»</b> баскычын басыңыз.`,
    found:        "✅ <b>Аккаунт табылды!</b>",
    notFound:     `❌ <b>Аккаунт табылган жок</b>\n\nБул телефон номери менен каттоодон өткөн чебер жок.\n\nКаттоодон өтүңүз — бул 2 мүнөт алат:`,
    registerBtn:  "Каттоодон өтүү",
    openApp:      "Колдонмону ачуу",
    askName:      `👤 Атыңыз кандай? Атыңызды киргизиңиз:`,
    askNameHint:  name => `\n\n<i>Жазсаңыз болот: ${name}</i>`,
    successReg:   name => `✅ <b>Мыкты, ${name}!</b>\n\nКатталуу үчүн киргизүү талаасынын жанындагы меню баскычын басыңыз — дайындарыңыз толтурулду.`,
  },
};

function getLang(pending) {
  return LANG_STRINGS[pending?.lang] ? pending.lang : "ru";
}

// ── Маппинг продуктов → URL (единый бот для всех продуктов) ──────────────────

const PRODUCT_MAP = {
  beauty:    "https://beauty.ezze.site",
  clinic:    "https://clinic.ezze.site",
  workshop:  "https://workshop.ezze.site",
  edu:       "https://edu.ezze.site",
  hotel:     "https://hotel.ezze.site",
  food:      "https://food.ezze.site",
  event:     "https://event.ezze.site",
  farm:      "https://farm.ezze.site",
  transport: "https://transport.ezze.site",
  build:     "https://build.ezze.site",
  trade:     "https://trade.ezze.site",
  cleaning:  "https://cleaning.ezze.site",
  rental:    "https://rental.ezze.site",
};

function getProductUrl(product) {
  return PRODUCT_MAP[product] || PRODUCT_MAP.beauty;
}

// Загрузить tg_config для конкретного продукта (не зависит от PRODUCT в .env)
async function loadTgConfigForProduct(product) {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "tg_config")
      .eq("product", product || "beauty")
      .maybeSingle();
    if (data?.value) return JSON.parse(data.value);
  } catch (e) {
    console.error("loadTgConfigForProduct error:", e.message);
  }
  return { master_label: "Кабинет мастера" };
}

// Кнопка запуска регистрации через мини-эпп (выбор продукта теперь внутри мини-эппа)
const REGISTER_KEYBOARD = [[{
  text: "🚀 Начать регистрацию",
  web_app: { url: "https://app.ezze.site/register" }
}]];

// ── Роли сотрудников: отображаемые названия ──────────────────────────────────

const ROLE_LABELS = {
  admin:    "Админ",
  operator: "Оператор",
  worker:   "Сотрудник",
  member:   "Участник",
};

function roleLabel(role) {
  return ROLE_LABELS[role] || ROLE_LABELS.operator;
}

// ── Ссылка для входа сотрудника в кабинет команды ──────────────────────────

function buildTeamCabinetUrl(product, accessToken, refreshToken) {
  const baseUrl = getProductUrl(product);
  if (accessToken && refreshToken) {
    const at = encodeURIComponent(accessToken);
    const rt = encodeURIComponent(refreshToken);
    // Используем start=master, тк TelegramEntryPage умеет обрабатывать at/rt из URL
    // и редиректит на /orders (для cleaning) после setSession.
    // Когда фронт обновится — можно будет переключить на start=team для team-only UI.
    return `${baseUrl}/tg?start=master&at=${at}&rt=${rt}`;
  }
  // Fallback: phone+code login on web (Day 5.5)
  return `${baseUrl}/login?role=employee`;
}

// ── Мастерское меню (для зарегистрированных) ──────────────────────────────────

async function sendMasterMenu(chatId, firstName, masterProfile) {
  const masterName = escapeHtml(masterProfile.profession || firstName || "Мастер");
  // Получаем продукт пользователя из БД
  const { data: userData } = await supabase
    .from("users").select("product").eq("id", masterProfile.user_id).maybeSingle();
  const userProduct = userData?.product || "beauty";
  const productUrl  = getProductUrl(userProduct);
  const cfg = await loadTgConfigForProduct(userProduct);
  const label = escapeHtml(cfg.master_label || "Кабинет мастера");
  await bot.setUserMenuButton(chatId, cfg.master_label || "Кабинет мастера", `${productUrl}/tg?start=master`);
  await bot.sendMessage(
    chatId,
    `👋 <b>Привет, ${masterName}!</b>\n\nРады видеть вас снова в <b>Ezze</b>.\n\nИспользуйте кнопку <b>${label}</b> рядом с полем ввода, чтобы открыть кабинет мастера.`,
    { remove_keyboard: true }
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
  const cfg = await loadTgConfig();
  const defaultText =
    `👋 <b>Привет, {name}!</b>\n\n` +
    `Добро пожаловать в <b>Ezze</b> — сервис для мастеров красоты.\n\n` +
    `🌐 <b>Выберите язык:</b>`;
  const template = cfg.welcome_text || defaultText;
  const greetingText = firstName
    ? template.replace("{name}", firstName)
    : template.replace(", {name}", "").replace("{name}", "");

  await fetch(`${bot.TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: greetingText,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🇷🇺 Русский",   callback_data: "lang_ru", style: "primary" },
            { text: "🇺🇿 O'zbek",    callback_data: "lang_uz", style: "primary" },
          ],
          [
            { text: "🇬🇧 English",   callback_data: "lang_en", style: "primary" },
            { text: "🇹🇯 Тоҷикӣ",   callback_data: "lang_tg", style: "primary" },
          ],
          [
            { text: "🇰🇿 Қазақша",  callback_data: "lang_kz", style: "primary" },
            { text: "🇰🇬 Кыргызча", callback_data: "lang_ky", style: "primary" },
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

    if (data === "register_after_delete") {
      await answerCbQuery(cb.id, "✓");
      const firstName = cb.from?.first_name || "";
      // Очищаем любое pending-состояние
      pendingMasters.delete(chatId);
      savePendingSessions();
      // Если мастер уже зарегистрировался — показываем меню
      const existingProfile = await findMasterByChatId(chatId);
      if (existingProfile) {
        await sendMasterMenu(chatId, firstName, existingProfile);
        return;
      }
      // Открываем мини-эпп для регистрации (выбор продукта — внутри мини-эппа)
      pendingMasters.set(chatId, sessionEntry({ step: "pending_web_registration" }));
      savePendingSessions();
      await bot.sendMessage(chatId,
        `👋 <b>Привет${firstName ? ', ' + escapeHtml(firstName) : ''}!</b>\n\nДобро пожаловать в <b>Ezze</b>!\n\nНажмите кнопку ниже, чтобы начать регистрацию 👇`,
        { inline_keyboard: REGISTER_KEYBOARD }
      );
      return;

    } else if (data.startsWith("lang_")) {
      const lang = data.slice(5); // "ru", "uz", "en", "tg", "kz", "kg"
      if (!LANG_STRINGS[lang]) {
        await answerCbQuery(cb.id);
        return;
      }
      const pending = pendingMasters.get(chatId);
      if (pending?.step === "waiting_language") {
        console.log(`🌐 [master] chat=${chatId} lang=${lang}`);
        pendingMasters.set(chatId, sessionEntry({ step: "waiting_phone", lang }));
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
              keyboard: [[{ text: s.shareBtn, request_contact: true, style: "primary" }]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          }),
        });
      } else {
        await answerCbQuery(cb.id);
      }

    } else if (data.startsWith("cancel_appt_")) {
      // ── Мастер отменяет запись прямо из уведомления ───────────────────────
      const apptId = data.replace("cancel_appt_", "");
      const msgId = cb.message?.message_id;
      await answerCbQuery(cb.id, "⏳");

      const { data: appt } = await supabase
        .from("appointments")
        .select("id, status, client_name, client_id, date, start_time")
        .eq("id", apptId)
        .maybeSingle();

      if (!appt) {
        if (msgId) await bot.editMessageText(chatId, msgId, "❌ Запись не найдена.");
        return;
      }
      if (appt.status === "cancelled") {
        if (msgId) await bot.editMessageText(chatId, msgId, "❌ <b>Запись уже была отменена ранее.</b>");
        return;
      }
      if (appt.status === "done" || appt.status === "no_show") {
        if (msgId) await bot.editMessageText(chatId, msgId, "ℹ️ <b>Визит уже состоялся — отменить невозможно.</b>");
        return;
      }

      await supabase.from("appointments").update({ status: "cancelled" }).eq("id", apptId);
      console.log(`🚫 [master] cancel appt ${apptId} by master chat=${chatId}`);

      // Подтягиваем имя клиента если не было в записи
      let clientName = (appt.client_name ?? "").trim();
      if (!clientName && appt.client_id) {
        const { data: cl } = await supabase
          .from("clients").select("first_name, last_name").eq("id", appt.client_id).maybeSingle();
        if (cl) clientName = [cl.first_name, cl.last_name].filter(Boolean).join(" ");
      }

      const cancelText =
        `❌ <b>Запись отменена</b>\n\n` +
        (clientName ? `👤 <b>Клиент:</b> ${clientName}\n` : "") +
        `📅 <b>Дата:</b> ${fmtDate(appt.date)}\n` +
        `🕐 <b>Время:</b> ${appt.start_time ?? "—"}`;
      if (msgId) await bot.editMessageText(chatId, msgId, cancelText);

    } else if (data.startsWith("confirm_appt_")) {
      // ── Мастер подтверждает запись прямо из уведомления ──────────────────
      const apptId = data.replace("confirm_appt_", "");
      const msgId = cb.message?.message_id;
      await answerCbQuery(cb.id, "⏳");

      const { data: appt } = await supabase
        .from("appointments")
        .select("id, status, confirmed_at, client_name, client_id, date, start_time, telegram_id")
        .eq("id", apptId)
        .maybeSingle();

      if (!appt) {
        if (msgId) await bot.editMessageText(chatId, msgId, "❌ Запись не найдена.");
        return;
      }
      if (appt.confirmed_at) {
        if (msgId) await bot.editMessageText(chatId, msgId, "✅ <b>Запись уже была подтверждена ранее.</b>");
        return;
      }
      if (appt.status === "cancelled") {
        if (msgId) await bot.editMessageText(chatId, msgId, "❌ <b>Запись отменена — подтвердить невозможно.</b>");
        return;
      }
      if (appt.status === "done" || appt.status === "no_show") {
        if (msgId) await bot.editMessageText(chatId, msgId, "ℹ️ <b>Визит уже состоялся — подтвердить невозможно.</b>");
        return;
      }

      await supabase.from("appointments")
        .update({ confirmed_at: new Date().toISOString() })
        .eq("id", apptId);
      console.log(`✅ [master] confirmed appt ${apptId} by master chat=${chatId}`);

      // Подтягиваем имя клиента если не было в записи
      let clientName = (appt.client_name ?? "").trim();
      if (!clientName && appt.client_id) {
        const { data: cl } = await supabase
          .from("clients").select("first_name, last_name").eq("id", appt.client_id).maybeSingle();
        if (cl) clientName = [cl.first_name, cl.last_name].filter(Boolean).join(" ");
      }

      const confirmText =
        `✅ <b>Запись подтверждена</b>\n\n` +
        (clientName ? `👤 <b>Клиент:</b> ${clientName}\n` : "") +
        `📅 <b>Дата:</b> ${fmtDate(appt.date)}\n` +
        `🕐 <b>Время:</b> ${appt.start_time ?? "—"}`;
      if (msgId) await bot.editMessageText(chatId, msgId, confirmText);

      // Уведомляем клиента через клиентский бот
      if (appt.telegram_id) {
        await clientBot.sendMessage(
          appt.telegram_id,
          `✅ <b>Ваша запись подтверждена!</b>\n\n` +
          `📅 <b>Дата:</b> ${fmtDate(appt.date)}\n` +
          `🕐 <b>Время:</b> ${appt.start_time ?? "—"}\n\n` +
          `Ждём вас! 🎉`
        );
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

    // ── Сотрудник делится контактом для регистрации в команду ──────────────
    if (pending?.step === "waiting_employee_phone") {
      const phone = message.contact.phone_number;
      const tgFirst = message.from?.first_name || "";
      const tgLast = message.from?.last_name || "";
      const tgUsername = message.from?.username || "";

      console.log(`👥 [employee] chat=${chatId} invite=${pending.inviteCode} phone=${phone}`);

      // Call edge function: team-employee-register
      let result = null;
      let errMsg = null;

      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/team-employee-register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({
            invite_code: pending.inviteCode,
            phone,
            tg_chat_id: String(chatId),
            first_name: tgFirst,
            last_name: tgLast,
            tg_username: tgUsername,
          }),
        });
        if (!resp.ok) {
          const errBody = await resp.json().catch(() => ({}));
          errMsg = errBody?.message || `HTTP ${resp.status}`;
        } else {
          result = await resp.json();
        }
      } catch (e) {
        console.error("[employee-register] fetch error:", e);
        errMsg = String(e?.message || e);
      }

      pendingMasters.delete(chatId);
      savePendingSessions();

      if (errMsg) {
        const errText = {
          phone_already_registered:
            `❌ <b>Этот номер уже зарегистрирован в системе.</b>\n\n` +
            `Используйте другой Telegram-аккаунт или обратитесь к владельцу команды.`,
          tg_chat_already_linked:
            `❌ <b>Ваш Telegram уже связан с другой командой.</b>\n\n` +
            `Сначала покиньте текущую команду через её владельца.`,
          seat_limit_reached:
            `❌ <b>В команде достигнут лимит сотрудников по тарифу владельца.</b>\n\n` +
            `Попросите владельца повысить тариф и пригласить вас снова.`,
          invite_expired:
            `❌ <b>Срок действия приглашения истёк.</b>\n\nПопросите новую ссылку.`,
          invite_used_up:
            `❌ <b>Приглашение уже использовано.</b>\n\nПопросите новую ссылку.`,
          invite_not_found:
            `❌ <b>Приглашение не найдено.</b>\n\nПопросите новую ссылку.`,
        }[errMsg] || `❌ <b>Не удалось завершить регистрацию.</b>\n\n<code>${escapeHtml(errMsg)}</code>`;

        await bot.sendMessage(chatId, errText, { remove_keyboard: true });
        return;
      }

      // Success — send inline button to open team cabinet
      const teamNameSafe = escapeHtml(result.team_name || "");
      const fullName = escapeHtml([tgFirst, tgLast].filter(Boolean).join(" ") || "Сотрудник");
      const cabinetUrl = buildTeamCabinetUrl(
        result.product,
        result.access_token,
        result.refresh_token
      );

      await bot.sendMessage(chatId,
        `✅ <b>Готово, ${fullName}!</b>\n\n` +
        `Вы добавлены в команду <b>«${teamNameSafe}»</b> на роль <b>${roleLabel(result.role)}</b>.\n\n` +
        `Нажмите кнопку ниже, чтобы открыть кабинет команды:`,
        {
          remove_keyboard: true,
          inline_keyboard: [[
            { text: "🌐 Открыть кабинет", url: cabinetUrl },
          ]],
        }
      );

      // Notify team owner about new employee
      try {
        const { data: team } = await supabase
          .from("teams").select("owner_id").eq("id", result.team_id).maybeSingle();
        if (team?.owner_id) {
          const { data: ownerProfile } = await supabase
            .from("master_profiles").select("tg_chat_id")
            .eq("user_id", team.owner_id).maybeSingle();
          if (ownerProfile?.tg_chat_id) {
            await bot.sendMessage(ownerProfile.tg_chat_id,
              `👥 <b>Новый сотрудник в команде</b>\n\n` +
              `${fullName} присоединился(ась) на роль <b>${roleLabel(result.role)}</b>.`
            );
          }
        }
      } catch (e) {
        console.error("[employee-register] notify owner error:", e?.message);
      }
      return;
    }

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
        if (stored === phoneDigits) return true;
        // Сравниваем последние 10 цифр (страновой код может отличаться)
        if (stored.length >= 10 && phoneDigits.length >= 10) {
          return stored.slice(-10) === phoneDigits.slice(-10);
        }
        return false;
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
        // Не найден — спрашиваем имя для предзаполнения регистрации
        const tgFullName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ");
        pendingMasters.set(chatId, sessionEntry({
          step: "waiting_master_name",
          lang,
          phone: message.contact.phone_number,
          tgName: tgFullName,
        }));
        savePendingSessions();
        const askText = `${s.askName}${tgFullName ? s.askNameHint(escapeHtml(tgFullName)) : ""}`;
        await bot.sendMessage(chatId, askText, { remove_keyboard: true });
      }
    } else {
      // Mini App вызвал requestContact() — контакт пришёл в чат бота
      // Сохраняем телефон в кеш, Mini App заберёт его через polling
      const phone = message.contact.phone_number;
      if (phone) {
        console.log(`📱 [master] phone cache: chat=${chatId} phone=${phone}`);
        await supabase.from("tg_phone_cache").upsert(
          { tg_chat_id: String(chatId), phone, created_at: new Date().toISOString() },
          { onConflict: "tg_chat_id" }
        );
      }
    }
    return;
  }

  // ── web_app_data — телефон из PhoneSharePage (/tg/phone) ────────────────────
  if (message?.web_app_data) {
    const chatId = message.chat.id;
    const pending = pendingMasters.get(chatId);
    let phone = "", lang = getLang(pending);
    try {
      const parsed = JSON.parse(message.web_app_data.data);
      phone = parsed.phone || "";
      if (parsed.lang && LANG_STRINGS[parsed.lang]) lang = parsed.lang;
    } catch { /* ignore */ }

    if (!phone) return;
    const s = LANG_STRINGS[lang];
    const phoneDigits = normalizePhone(phone);
    console.log(`📱 [master/webapp] chat=${chatId} phone_digits=${phoneDigits}`);

    const { data: profiles } = await supabase
      .from("master_profiles").select("*").not("phone", "is", null);
    const profile = (profiles || []).find(p => {
      if (!p.phone) return false;
      const stored = normalizePhone(p.phone);
      if (stored === phoneDigits) return true;
      // Сравниваем последние 10 цифр (страновой код может отличаться)
      if (stored.length >= 10 && phoneDigits.length >= 10) {
        return stored.slice(-10) === phoneDigits.slice(-10);
      }
      return false;
    });

    pendingMasters.delete(chatId);
    savePendingSessions();

    if (profile) {
      await supabase.from("master_profiles")
        .update({ tg_chat_id: String(chatId) }).eq("id", profile.id);
      profile.tg_chat_id = String(chatId);
      console.log(`✅ [webapp] Linked chat=${chatId} to master profile id=${profile.id}`);
      await bot.sendMessage(chatId, s.found);
      await sendMasterMenu(chatId, message.from?.first_name || "", profile);
    } else {
      // Не найден — спрашиваем имя для предзаполнения регистрации
      const tgFullName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ");
      pendingMasters.set(chatId, sessionEntry({
        step: "waiting_master_name",
        lang,
        phone,
        tgName: tgFullName,
      }));
      savePendingSessions();
      const askText = `${s.askName}${tgFullName ? s.askNameHint(escapeHtml(tgFullName)) : ""}`;
      await bot.sendMessage(chatId, askText);
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
        // /start join_<inviteCode> — приглашение сотрудника в команду
        if (param.startsWith("join_")) {
          const inviteCode = param.slice(5);

          // Validate invite via RPC
          const { data: validations, error: vErr } = await supabase
            .rpc("validate_team_invite", { p_code: inviteCode });
          const v = Array.isArray(validations) ? validations[0] : validations;

          if (vErr || !v) {
            await bot.sendMessage(chatId,
              `❌ <b>Приглашение не найдено</b>\n\nПопросите владельца команды прислать новую ссылку.`
            );
            return;
          }

          if (!v.is_valid) {
            const reasonText = {
              not_found: "Приглашение не найдено",
              inactive:  "Приглашение отключено владельцем",
              expired:   "Срок действия приглашения истёк",
              used_up:   "Приглашение уже использовано максимальное число раз",
            }[v.reason] || "Приглашение недействительно";
            await bot.sendMessage(chatId,
              `❌ <b>${reasonText}</b>\n\nПопросите владельца команды прислать новую ссылку.`
            );
            return;
          }

          // Check if user already a member of any team
          const { data: existingMember } = await supabase
            .from("team_members")
            .select("team_id, status")
            .eq("tg_chat_id", String(chatId))
            .eq("status", "active")
            .maybeSingle();

          if (existingMember) {
            if (existingMember.team_id === v.team_id) {
              await bot.sendMessage(chatId,
                `ℹ️ <b>Вы уже в этой команде.</b>\n\nИспользуйте кнопку меню рядом с полем ввода, чтобы открыть кабинет.`
              );
            } else {
              await bot.sendMessage(chatId,
                `❌ <b>Вы уже состоите в другой команде.</b>\n\nДля смены команды попросите владельца текущей команды удалить вас, затем используйте новую ссылку.`
              );
            }
            return;
          }

          // Save pending session — wait for phone share
          pendingMasters.set(chatId, sessionEntry({
            step: "waiting_employee_phone",
            inviteCode,
            inviteId: v.invite_id,
            teamId: v.team_id,
            teamName: v.team_name,
            product: v.product || "beauty",
            role: v.role || "operator",
          }));
          savePendingSessions();

          const teamNameSafe = escapeHtml(v.team_name || "");
          const roleName = roleLabel(v.role);

          await fetch(`${bot.TG_API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text:
                `👋 <b>Приглашение в команду</b>\n\n` +
                `Вас приглашают в команду <b>«${teamNameSafe}»</b> на роль <b>${roleName}</b>.\n\n` +
                `📱 Поделитесь номером телефона для регистрации:`,
              parse_mode: "HTML",
              reply_markup: {
                keyboard: [[{ text: "📱 Поделиться номером", request_contact: true }]],
                resize_keyboard: true,
                one_time_keyboard: true,
              },
            }),
          });
          return;
        }

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

      // /start без параметра — сначала проверяем, не сотрудник ли это
      const { data: employeeMember } = await supabase
        .from("team_members")
        .select("team_id, role, status, teams(id, name, owner_id, product)")
        .eq("tg_chat_id", String(chatId))
        .eq("status", "active")
        .maybeSingle();

      if (employeeMember && employeeMember.teams) {
        // Это сотрудник — показываем кнопку открытия кабинета команды
        const team = employeeMember.teams;
        const teamNameSafe = escapeHtml(team.name || "");
        const cabinetUrl = buildTeamCabinetUrl(team.product || "beauty", null, null);

        await bot.sendMessage(chatId,
          `👋 <b>Привет${firstName ? ", " + escapeHtml(firstName) : ""}!</b>\n\n` +
          `Вы в команде <b>«${teamNameSafe}»</b> на роль <b>${roleLabel(employeeMember.role)}</b>.\n\n` +
          `Откройте кабинет, чтобы продолжить работу:`,
          {
            inline_keyboard: [[
              { text: "🌐 Открыть кабинет", url: cabinetUrl },
            ]],
          }
        );
        return;
      }

      // Поиск мастера по chat_id
      let masterProfile = await findMasterByChatId(chatId);
      if (!masterProfile) {
        console.log(`ℹ️  Master not found by tg_chat_id=${chatId}, trying autoFix...`);
        masterProfile = await autoFixMasterProfile(chatId, tgUsername);
        if (masterProfile) console.log(`✅ autoFix success for chat=${chatId}`);
      }

      if (masterProfile) {
        // Очищаем pending_web_registration если регистрация завершена
        if (pendingMasters.has(chatId)) {
          pendingMasters.delete(chatId);
          savePendingSessions();
        }
        if (tgUsername) {
          supabase.from("master_profiles").update({ telegram: "@" + tgUsername })
            .eq("id", masterProfile.id).then(() => {}).catch(() => {});
        }
        await sendMasterMenu(chatId, firstName, masterProfile);
      } else {
        // Не найден — проверяем сессию
        const existingSession = pendingMasters.get(chatId);

        if (existingSession?.step === "pending_web_registration") {
          // Уже показывали кнопку регистрации — показываем снова
          await bot.sendMessage(chatId,
            `👇 Нажмите кнопку ниже, чтобы зарегистрироваться:`,
            { inline_keyboard: REGISTER_KEYBOARD }
          );
        } else {
          // Совсем новый — показываем кнопку регистрации (выбор продукта внутри мини-эппа)
          pendingMasters.set(chatId, sessionEntry({ step: "pending_web_registration" }));
          savePendingSessions();
          await bot.sendMessage(chatId,
            `👋 <b>Привет${firstName ? ', ' + escapeHtml(firstName) : ''}!</b>\n\nДобро пожаловать в <b>Ezze</b>!\n\nНажмите кнопку ниже, чтобы начать регистрацию 👇`,
            { inline_keyboard: REGISTER_KEYBOARD }
          );
        }
      }
      return;
    }

    // ── Неизвестные команды (/help, /settings и т.д.) ──────────────────────────
    if (text.startsWith("/") && !text.startsWith("/start")) {
      const masterProfile = await findMasterByChatId(chatId);
      if (masterProfile) {
        await bot.sendMessage(chatId,
          `ℹ️ Используйте кнопку меню рядом с полем ввода, чтобы открыть кабинет мастера.`
        );
      } else {
        await bot.sendMessage(chatId,
          `ℹ️ Доступные команды:\n\n/start — начать регистрацию`
        );
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
              keyboard: [[{ text: s.shareBtn, request_contact: true, style: "primary" }]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          }),
        });
        return;
      }
      // ── Текст при ожидании контакта от сотрудника (employee invite) ─────────
      if (pending?.step === "waiting_employee_phone") {
        await fetch(`${bot.TG_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `📱 Пожалуйста, нажмите кнопку <b>«Поделиться номером»</b> ниже для регистрации в команде.`,
            parse_mode: "HTML",
            reply_markup: {
              keyboard: [[{ text: "📱 Поделиться номером", request_contact: true }]],
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
      // ── Текст при ожидании имени (новый мастер, не найден в базе) ─────────────
      if (pending?.step === "waiting_master_name") {
        const name = text.trim() || pending.tgName || firstName;
        const lang = getLang(pending);
        const s = LANG_STRINGS[lang];
        // Переводим в состояние ожидания веб-регистрации.
        pendingMasters.set(chatId, sessionEntry({ step: "pending_web_registration", lang, phone: pending.phone || "" }));
        savePendingSessions();

        // Кнопка меню → всегда на /tg?start=master (TelegramEntryPage сам маршрутизирует)
        const cfg = await loadTgConfig();
        const menuBtnLabel = cfg.master_label || s.registerBtn;
        await bot.setUserMenuButton(chatId, menuBtnLabel, `${APP_URL}/tg?start=master`);

        // Текстовое сообщение — без inline-кнопки, направляем к кнопке меню
        await bot.sendMessage(chatId, s.successReg(escapeHtml(name)));
        return;
      }
    }

    // ── AI-сообщения от мастеров / подсказки для незарегистрированных ─────────
    if (!text.startsWith("/")) {
      // Если в состоянии pending_web_registration — направляем к кнопке меню
      const pending = pendingMasters.get(chatId);
      if (pending?.step === "pending_web_registration") {
        const lang = getLang(pending);
        const s = LANG_STRINGS[lang];
        const cfg = await loadTgConfig();
        const menuBtnLabel = cfg.master_label || s.registerBtn;
        await bot.sendMessage(chatId,
          `ℹ️ Для завершения регистрации нажмите кнопку <b>${escapeHtml(menuBtnLabel)}</b> рядом с полем ввода сообщения.`
        );
        return;
      }

      const masterProfile = await findMasterByChatId(chatId);
      if (masterProfile) {
        const cfg = await loadAIConfig();
        await handleAIMessage(chatId, text, masterProfile, bot, cfg);
      } else {
        await bot.sendMessage(chatId,
          `ℹ️ Вы ещё не зарегистрированы.\n\nНажмите /start чтобы начать регистрацию.`
        );
      }
    }
  }
}

// ── Запуск ────────────────────────────────────────────────────────────────────

console.log(`👷 [${PRODUCT}] Ezze Master Bot starting...`);
console.log(`App URL: ${APP_URL}`);

bot.deleteWebhook()
  .then(() => bot.setupDefaultMenuButton())
  .then(() => {
    console.log("✅ Master bot polling started (@ezzepro_bot)");
    bot.startPolling(processUpdate);

    // Очищаем устаревшие сессии каждые 10 минут
    setInterval(() => {
      const removed = cleanupSessions(pendingMasters);
      if (removed > 0) savePendingSessions();
    }, 10 * 60 * 1000);

    // ── Realtime: tg_config изменился → обновляем кнопку меню у всех мастеров ──
    // Требует миграции 017: app_settings в supabase_realtime
    supabase
      .channel('app_settings_tg_config_master')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.tg_config' },
        async () => {
          invalidateTgConfigCache();
          const newCfg = await loadTgConfig();
          console.log(`🔄 tg_config обновлён: master_label="${newCfg.master_label}"`);
          const { data: masters } = await supabase
            .from('master_profiles')
            .select('tg_chat_id')
            .eq('product', PRODUCT)
            .not('tg_chat_id', 'is', null);
          if (!masters?.length) return;
          console.log(`🔄 Обновляем кнопку меню у ${masters.length} мастеров...`);
          await Promise.allSettled(
            masters.map(m =>
              bot.setUserMenuButton(m.tg_chat_id, newCfg.master_label, `${APP_URL}/tg?start=master`)
            )
          );
          console.log(`✅ Кнопки меню мастеров обновлены`);
        }
      )
      .subscribe((status) => {
        console.log(`📡 app_settings Realtime (master): ${status}`);
      });
  });
