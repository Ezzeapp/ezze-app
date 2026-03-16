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

// ── Обработка обновлений ──────────────────────────────────────────────────────

async function processUpdate(update) {
  const message = update.message;

  // ── Контакт (phone-onboarding шаг 2) ──────────────────────────────────────
  if (message?.contact) {
    const chatId = message.chat.id;
    const pending = pendingMasters.get(chatId);
    if (pending?.step === "waiting_phone") {
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
        await bot.sendMessage(chatId, "✅ <b>Аккаунт найден!</b>", { remove_keyboard: true });
        await sendMasterMenu(chatId, message.contact.first_name || "", profile);
      } else {
        // Не найден — предлагаем регистрацию
        await fetch(`${bot.TG_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text:
              `❌ <b>Аккаунт не найден</b>\n\n` +
              `Мастер с таким номером телефона не зарегистрирован в системе.\n\n` +
              `Зарегистрируйтесь — это займёт 2 минуты:`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                { text: "🚀 Зарегистрироваться", web_app: { url: `${APP_URL}/register` } },
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
        // Не найден — начинаем phone-onboarding
        await bot.setUserMenuButton(chatId); // сброс к default
        pendingMasters.set(chatId, { step: "waiting_phone" });
        savePendingSessions();
        await fetch(`${bot.TG_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text:
              `👋 <b>Привет${firstName ? ", " + firstName : ""}!</b>\n\n` +
              `Добро пожаловать в <b>Ezze</b> — сервис для мастеров.\n\n` +
              `📱 Нажмите кнопку ниже, чтобы поделиться номером телефона:`,
            parse_mode: "HTML",
            reply_markup: {
              keyboard: [[{ text: "📱 Поделиться номером", request_contact: true }]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          }),
        });
      }
      return;
    }

    // ── Текст при ожидании номера телефона ────────────────────────────────────
    if (!text.startsWith("/")) {
      const pending = pendingMasters.get(chatId);
      if (pending?.step === "waiting_phone") {
        await fetch(`${bot.TG_API}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `📱 Пожалуйста, нажмите кнопку <b>«Поделиться номером»</b> ниже.`,
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
