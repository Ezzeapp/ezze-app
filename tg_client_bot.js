/**
 * tg_client_bot.js — Telegram бот для КЛИЕНТОВ
 * Бот: @ezzeclient_bot | Token: TG_CLIENT_BOT_TOKEN
 * Запуск: node tg_client_bot.js
 * Systemd: ezze-client-bot.service
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

// ── Клиентские хелперы ────────────────────────────────────────────────────────

async function setClientMenuButton(chatId) {
  const cfg = await loadTgConfig();
  await bot.setUserMenuButton(chatId, cfg.client_label, `${APP_URL}/my?tg_id=${chatId}`);
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

async function sendClientMenuSmart(chatId, firstName) {
  const greeting = `👋 <b>Привет${firstName ? ", " + firstName : ""}!</b>`;

  // Проверяем, есть ли у клиента записи по telegram_id
  const { count } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("telegram_id", String(chatId));

  let isKnownClient = (count ?? 0) > 0;
  if (!isKnownClient) {
    const { data: clientRecord } = await supabase
      .from("clients").select("id").eq("tg_chat_id", String(chatId)).maybeSingle();
    isKnownClient = !!clientRecord;
  }

  // Также считаем зарегистрированным, если есть сохранённая сессия
  const savedSession = pendingBookings.get(chatId);
  if (!isKnownClient && savedSession?.mode === "registered") {
    isKnownClient = true;
  }

  if (isKnownClient) {
    const cfg = await loadTgConfig();
    await setClientMenuButton(chatId);
    const searchUrl = buildSearchUrl(chatId, savedSession);
    await fetch(`${bot.TG_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `${greeting}\n\nРады видеть вас снова в <b>Ezze</b>!\n\nНажмите кнопку <b>${cfg.client_label}</b>, чтобы посмотреть ваши записи, или найдите нового мастера:`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "🔍 Найти мастера", style: "primary", web_app: { url: searchUrl } },
          ]],
        },
      }),
    });
  } else {
    // Новый клиент — запускаем регистрацию
    pendingBookings.set(chatId, {
      step: "waiting_phone",
      mode: "registration",
      tgUsername: "",
    });
    savePendingBookings();
    await fetch(`${bot.TG_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `${greeting}\n\nДобро пожаловать в <b>Ezze</b>!\n\n📱 Для начала поделитесь вашим номером телефона:`,
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "📱 Поделиться номером", request_contact: true, style: "primary" }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }),
    });
  }
}

function buildSearchUrl(chatId, session) {
  const params = new URLSearchParams({ tg_id: String(chatId) });
  if (session?.phone) params.set("tg_phone", session.phone);
  if (session?.name)  params.set("tg_name",  session.name);
  return `${APP_URL}/search?${params.toString()}`;
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
      pending.step = "waiting_name";
      pending.phone = phone;
      pending.tgName = contactName;
      savePendingBookings();
      await bot.sendMessage(
        chatId,
        `📱 Номер получен!\n\nКак вас зовут?${contactName ? `\n\n<i>Можете просто написать: ${contactName}</i>` : ""}`,
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
      const param = text.split(" ")[1] || "";

      if (param.startsWith("book_")) {
        const slug = param.slice(5);
        const { data: profile } = await supabase
          .from("master_profiles").select("profession").eq("booking_slug", slug).maybeSingle();

        if (profile) {
          await bot.setUserMenuButton(chatId); // сброс старой кнопки
          pendingBookings.set(chatId, {
            slug,
            masterProfession: profile.profession || "Мастер",
            step: "waiting_phone",
            tgUsername: message.from?.username || '',
          });
          savePendingBookings();
          await fetch(`${bot.TG_API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `👋 <b>Привет${firstName ? ", " + firstName : ""}!</b>\n\nВы записываетесь к мастеру <b>${profile.profession || "Мастер"}</b>.\n\n📱 Для записи нам нужен ваш номер телефона.\nНажмите кнопку ниже:`,
              parse_mode: "HTML",
              reply_markup: {
                keyboard: [[{ text: "📱 Поделиться номером", request_contact: true }]],
                resize_keyboard: true,
                one_time_keyboard: true,
              },
            }),
          });
        } else {
          await bot.sendMessage(chatId, `❌ Мастер не найден или страница записи закрыта.`);
        }
        return;
      }

      // /start без book_ → возвращающийся клиент или новый
      // сохраняем tgUsername в текущую сессию регистрации (если она запускается)
      const existingSession = pendingBookings.get(chatId);
      if (existingSession && existingSession.mode !== "registered") {
        existingSession.tgUsername = message.from?.username || '';
      }
      await sendClientMenuSmart(chatId, firstName);
      return;
    }

    if (text === "/menu") {
      await sendClientMenuSmart(chatId, firstName);
      return;
    }

    // ── Шаг 1b: написал текст вместо кнопки "Поделиться номером" ─────────────
    if (!text.startsWith("/")) {
      const pending = pendingBookings.get(chatId);
      if (pending?.step === "waiting_phone") {
        await fetch(`${bot.TG_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `📱 Пожалуйста, нажмите кнопку <b>«Поделиться номером»</b> ниже — это нужно для записи.`,
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
    }

    // ── Шаг 2: ввод имени ────────────────────────────────────────────────────
    if (!text.startsWith("/")) {
      const pending = pendingBookings.get(chatId);
      if (pending?.step === "waiting_name") {
        const name = text.trim() || pending.tgName || firstName;
        const tgUsername = pending.tgUsername || '';

        if (pending.mode === "registration") {
          // Регистрация без мастера — сохраняем сессию, показываем поиск
          pendingBookings.set(chatId, {
            mode: "registered",
            phone: pending.phone,
            name,
            tgUsername,
          });
          savePendingBookings();
          await setClientMenuButton(chatId);
          const searchUrl = buildSearchUrl(chatId, { phone: pending.phone, name });
          await fetch(`${bot.TG_API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `✅ <b>Регистрация успешна, ${name}!</b>\n\nТеперь найдите мастера и запишитесь на приём:`,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [[
                  { text: "🔍 Найти мастера", style: "primary", web_app: { url: searchUrl } },
                ]],
              },
            }),
          });
        } else {
          // Запись к конкретному мастеру
          pendingBookings.delete(chatId);
          savePendingBookings();
          await showBookingButton(chatId, pending.slug, pending.phone, name, tgUsername);
          await setClientMenuButton(chatId);
        }
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

    if (callback.data === "open_cabinet") {
      await bot.sendMessageWithWebApp(chatId, "📋 Открываю ваши записи...", "Ezze", `${APP_URL}/my?tg_id=${chatId}`);
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

      await supabase.from("appointments").update({ status: "cancelled" }).eq("id", apptId);

      await bot.editMessageText(
        chatId, msgId,
        `❌ <b>Запись отменена.</b>\n\nЕсли захотите записаться снова — воспользуйтесь ссылкой мастера.`
      );

      // Уведомляем мастера через мастерский бот
      const { data: prof } = await supabase
        .from("master_profiles").select("tg_chat_id, profession")
        .eq("user_id", appt.master_id).maybeSingle();

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
