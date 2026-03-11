/**
 * Telegram Bot Polling — Ezze App (Supabase version)
 * Запускать: node tg_polling.js
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

try {
  const env = readFileSync(".env", "utf8");
  env.split("\n").forEach((line) => {
    const idx = line.indexOf("=");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  });
} catch {}

const BOT_TOKEN = process.env.TG_BOT_TOKEN || "8365728736:AAHdA_B9bVQQLqqCsJsSzBk9ej2Mocsw_7M";
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const APP_URL = process.env.APP_URL || "https://ezze.site";
const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:8001";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let offset = 0;

async function sendMessage(chatId, text, replyMarkup) {
  const body = { chat_id: chatId, text, parse_mode: "HTML" };
  if (replyMarkup) body.reply_markup = replyMarkup;
  const res = await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await res.json();
  if (!result.ok) console.error("sendMessage error:", result.description);
}

async function sendMessageWithWebApp(chatId, text, buttonText, webAppUrl) {
  await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId, text, parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: buttonText, web_app: { url: webAppUrl } }]] }
    }),
  });
}

async function findMasterByChatId(chatId) {
  try {
    const { data, error } = await supabase
      .from("master_profiles").select("*").eq("tg_chat_id", String(chatId)).maybeSingle();
    if (error) console.error("findMasterByChatId error:", error.message);
    return data || null;
  } catch (e) {
    console.error("findMasterByChatId exception:", e.message);
    return null;
  }
}

async function autoFixMasterProfile(chatId, tgUsername) {
  try {
    const tgEmail = `tg_${chatId}@ezze.site`;
    const { data: usersData } = await supabase.auth.admin.listUsers();
    const user = usersData?.users?.find(u => u.email === tgEmail);
    if (!user) return null;

    const { data: profile } = await supabase
      .from("master_profiles").select("*").eq("user_id", user.id).maybeSingle();

    if (profile) {
      if (!profile.tg_chat_id) {
        const patch = { tg_chat_id: String(chatId) };
        if (tgUsername) patch.telegram = "@" + tgUsername;
        await supabase.from("master_profiles").update(patch).eq("id", profile.id);
        console.log(`✅ autoFix: set tg_chat_id=${chatId}`);
        profile.tg_chat_id = String(chatId);
      }
      return profile;
    } else {
      const create = { user_id: user.id, tg_chat_id: String(chatId) };
      if (tgUsername) create.telegram = "@" + tgUsername;
      const { data: newProfile, error } = await supabase
        .from("master_profiles").insert(create).select().single();
      if (error) { console.error("autoFix create error:", error.message); return null; }
      console.log(`✅ autoFix: created master_profiles with tg_chat_id=${chatId}`);
      return newProfile;
    }
  } catch (e) {
    console.error("autoFixMasterProfile error:", e.message);
    return null;
  }
}

async function processUpdate(update) {
  const message = update.message;
  if (message?.text) {
    const chatId = message.chat.id;
    const text = message.text;
    const firstName = message.from?.first_name || "";
    console.log(`💬 chat=${chatId} text="${text}"`);

    if (text.startsWith("/start")) {
      const param = text.split(" ")[1] || "";

      if (param) {
        if (param.startsWith("book_")) {
          const slug = param.slice(5);
          const { data: profile } = await supabase
            .from("master_profiles").select("profession").eq("booking_slug", slug).maybeSingle();

          if (profile) {
            await fetch(`${TG_API}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: `👋 <b>Привет${firstName ? ", " + firstName : ""}!</b>\n\nВы переходите к записи у мастера <b>${profile.profession || "Мастер"}</b>.\n\nНажмите кнопку ниже чтобы выбрать услугу и время:`,
                parse_mode: "HTML",
                reply_markup: { inline_keyboard: [
                  [{ text: "📅 Записаться", web_app: { url: `${APP_URL}/book/${slug}` } }],
                  [{ text: "📋 Мои записи", web_app: { url: `${APP_URL}/my` } }],
                ]}
              }),
            });
          } else {
            await sendMessage(chatId, `❌ Мастер не найден или страница записи закрыта.`);
          }
          return;
        }

        const slug = param.startsWith("connect_") ? param.slice(8) : param;
        const { data: profile } = await supabase
          .from("master_profiles").select("id").eq("booking_slug", slug).maybeSingle();

        if (profile) {
          const patch = { tg_chat_id: String(chatId) };
          if (message.from?.username) patch.telegram = "@" + message.from.username;
          await supabase.from("master_profiles").update(patch).eq("id", profile.id);
          console.log(`✅ Connected Telegram ${chatId} to master slug: ${slug}`);
          await sendMessage(chatId,
            `✅ <b>Отлично, ${firstName}!</b>\n\nВаш Telegram подключён к Ezze.\nТеперь вы будете получать уведомления о новых записях прямо сюда! 🎉`
          );
        } else {
          await sendMessage(chatId, `❌ Профиль мастера не найден. Проверьте ссылку.`);
        }

      } else {
        const tgUsername = message.from?.username;
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
          console.log(`ℹ️  No master profile for chat=${chatId} — showing client menu`);
          await sendClientMenu(chatId, firstName);
        }
      }
    }

    if (text === "/menu") await sendClientMenu(chatId, firstName);
  }

  const callback = update.callback_query;
  if (callback) {
    const chatId = callback.message?.chat?.id;
    if (!chatId) return;
    await fetch(`${TG_API}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callback.id }),
    });
    if (callback.data === "open_cabinet") {
      await sendMessageWithWebApp(chatId, "📋 Открываю ваши записи...", "📋 Мои записи", `${APP_URL}/my`);
    }
  }
}

async function sendMasterMenu(chatId, firstName, masterProfile) {
  const masterName = masterProfile.profession || firstName || "Мастер";
  await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `👋 <b>Привет, ${masterName}!</b>\n\nРады видеть вас снова в <b>Ezze</b>.\n\nНажмите кнопку ниже, чтобы открыть кабинет мастера.`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[
        { text: "🔑 Войти в кабинет мастера", web_app: { url: `${APP_URL}/tg?start=master` } }
      ]]}
    }),
  });
}

async function sendClientMenu(chatId, firstName) {
  await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `👋 <b>Привет${firstName ? ", " + firstName : ""}!</b>\n\nЯ бот платформы <b>Ezze</b> — сервиса для самозанятых мастеров.\n\nЗарегистрируйтесь, чтобы начать вести клиентов онлайн.`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[
        { text: "📝 Зарегистрироваться", web_app: { url: `${APP_URL}/register` } }
      ]]}
    }),
  });
}

async function poll() {
  try {
    const res = await fetch(`${TG_API}/getUpdates?offset=${offset}&timeout=30`);
    const data = await res.json();
    if (!data.ok) {
      console.error("getUpdates error:", data.description);
    } else if (data.result.length > 0) {
      for (const update of data.result) {
        await processUpdate(update);
        offset = update.update_id + 1;
      }
    }
  } catch (e) {
    console.error("Poll error:", e.message);
  }
  setTimeout(poll, 1000);
}

async function deleteWebhook() {
  try {
    const res = await fetch(`${TG_API}/deleteWebhook?drop_pending_updates=false`);
    const data = await res.json();
    if (data.ok) console.log("✅ Webhook deleted, polling mode active");
  } catch (e) {
    console.error("deleteWebhook error:", e.message);
  }
}

console.log("🤖 Telegram bot (Supabase) polling started...");
console.log(`Supabase: ${SUPABASE_URL}`);
console.log(`App URL: ${APP_URL}`);
deleteWebhook().then(() => poll());
