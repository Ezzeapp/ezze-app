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
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

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

// Постоянная ReplyKeyboard для клиентов — прилипает к низу, не уезжает вверх
function clientReplyKeyboard() {
  return {
    keyboard: [
      [
        { text: "📋 Мои записи", web_app: { url: `${APP_URL}/my` } },
        { text: "💎 Мои бонусы", web_app: { url: `${APP_URL}/my` } },
      ],
    ],
    resize_keyboard: true,
    persistent: true,
  };
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

// ── AI / Claude helpers ──────────────────────────────────────────────────────

// Динамическая загрузка AI-конфига из Supabase (с кешем 5 мин)
let _cachedAIConfig = null;
let _aiConfigLoadedAt = 0;

async function loadAIConfig() {
  const now = Date.now();
  if (_cachedAIConfig !== null && now - _aiConfigLoadedAt < 5 * 60_000) {
    return _cachedAIConfig;
  }
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "ai_config")
      .maybeSingle();
    if (data?.value) {
      _cachedAIConfig = JSON.parse(data.value);
      _aiConfigLoadedAt = now;
      console.log(`🤖 AI config loaded: model=${_cachedAIConfig.model}, enabled=${_cachedAIConfig.enabled}`);
    }
  } catch (e) {
    console.error("Failed to load AI config from DB:", e.message);
  }
  return _cachedAIConfig;
}

async function sendTyping(chatId) {
  await fetch(`${TG_API}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  }).catch(() => {});
}

function getMasterTools() {
  return [
    {
      name: "get_appointments",
      description: "Получить записи мастера за указанный период. Используй для вопросов о расписании, записях, клиентах.",
      input_schema: {
        type: "object",
        properties: {
          date_from: { type: "string", description: "Дата начала (YYYY-MM-DD)" },
          date_to: { type: "string", description: "Дата конца (YYYY-MM-DD)" },
        },
        required: ["date_from", "date_to"],
      },
    },
    {
      name: "get_stats",
      description: "Получить статистику мастера: выручку и количество записей за период.",
      input_schema: {
        type: "object",
        properties: {
          days: { type: "number", description: "Количество последних дней (7, 30, 90)" },
        },
        required: ["days"],
      },
    },
  ];
}

function getClientTools() {
  return [
    {
      name: "get_my_appointments",
      description: "Получить мои предстоящие и прошлые записи к мастерам.",
      input_schema: { type: "object", properties: {} },
    },
  ];
}

async function executeMasterTool(toolName, input, masterId) {
  try {
    if (toolName === "get_appointments") {
      const { data } = await supabase
        .from("appointments")
        .select("date, start_time, end_time, status, price, notes, clients(first_name, last_name)")
        .eq("master_id", masterId)
        .gte("date", input.date_from)
        .lte("date", input.date_to)
        .order("date").order("start_time");
      const formatted = (data || []).map(a => ({
        date: a.date,
        time: a.start_time,
        status: a.status,
        price: a.price,
        client: a.clients ? `${a.clients.first_name || ""} ${a.clients.last_name || ""}`.trim() : "—",
        service: (a.notes || "").match(/^\[([^\]]+)\]/)?.[1] || "",
      }));
      return JSON.stringify(formatted);
    }
    if (toolName === "get_stats") {
      const days = Math.min(input.days || 30, 365);
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);
      const dateStr = dateFrom.toISOString().slice(0, 10);
      const { data } = await supabase
        .from("appointments")
        .select("price, status, date")
        .eq("master_id", masterId)
        .gte("date", dateStr);
      const done = (data || []).filter(a => a.status === "done");
      const revenue = done.reduce((s, a) => s + (a.price || 0), 0);
      return JSON.stringify({ period_days: days, completed: done.length, total_appointments: (data || []).length, revenue });
    }
  } catch (e) {
    return `Error: ${e.message}`;
  }
  return "Unknown tool";
}

async function executeClientTool(toolName, _input, chatId) {
  try {
    if (toolName === "get_my_appointments") {
      const { data } = await supabase
        .from("appointments")
        .select("date, start_time, end_time, status, price, notes")
        .eq("telegram_id", String(chatId))
        .order("date", { ascending: false })
        .limit(10);
      return JSON.stringify(data || []);
    }
  } catch (e) {
    return `Error: ${e.message}`;
  }
  return "Unknown tool";
}

const PROVIDER_BASE_URLS = {
  openai:   "https://api.openai.com/v1",
  gemini:   "https://generativelanguage.googleapis.com/v1beta/openai",
  deepseek: "https://api.deepseek.com/v1",
  qwen:     "https://dashscope.aliyuncs.com/compatible-mode/v1",
};

// Anthropic agentic loop (native tool use format)
async function runAnthropicAgentic(messages, tools, systemPrompt, toolExecutor, apiKey, model, maxTokens) {
  const resolvedKey = apiKey || ANTHROPIC_API_KEY;
  let msgs = [...messages];
  for (let i = 0; i < 5; i++) {
    const body = { model, max_tokens: maxTokens, system: systemPrompt, messages: msgs };
    if (tools?.length) body.tools = tools;
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": resolvedKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) { console.error("Anthropic API error:", data); return "Извините, ИИ-помощник недоступен."; }
    const content = data.content || [];
    const toolUses = content.filter(c => c.type === "tool_use");
    if (!toolUses.length || data.stop_reason === "end_turn") {
      return content.find(c => c.type === "text")?.text || "Готово.";
    }
    msgs.push({ role: "assistant", content });
    const results = await Promise.all(toolUses.map(async tu => ({
      type: "tool_result", tool_use_id: tu.id, content: await toolExecutor(tu.name, tu.input),
    })));
    msgs.push({ role: "user", content: results });
  }
  return "Не удалось получить ответ.";
}

// OpenAI-compatible agentic loop (works with OpenAI, Gemini, DeepSeek, Qwen, custom)
async function runOpenAIAgentic(messages, tools, systemPrompt, toolExecutor, apiKey, model, maxTokens, cfg) {
  const provider = cfg?.provider || "openai";
  const baseUrl = provider === "custom"
    ? (cfg?.base_url || "")
    : (PROVIDER_BASE_URLS[provider] || PROVIDER_BASE_URLS.openai);

  // Convert Anthropic tool schema → OpenAI function format
  const oaiTools = tools?.map(t => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));

  let msgs = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  for (let i = 0; i < 5; i++) {
    const body = { model, max_tokens: maxTokens, messages: msgs };
    if (oaiTools?.length) body.tools = oaiTools;
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) { console.error("OpenAI-compatible API error:", data); return "Извините, ИИ-помощник недоступен."; }
    const choice = data.choices?.[0];
    const msg = choice?.message;
    if (!msg?.tool_calls?.length || choice.finish_reason === "stop") {
      return msg?.content || "Готово.";
    }
    msgs.push({ role: "assistant", content: msg.content || null, tool_calls: msg.tool_calls });
    for (const tc of msg.tool_calls) {
      let input = {};
      try { input = JSON.parse(tc.function.arguments || "{}"); } catch {}
      const result = await toolExecutor(tc.function.name, input);
      msgs.push({ role: "tool", content: result, tool_call_id: tc.id });
    }
  }
  return "Не удалось получить ответ.";
}

// Единый dispatcher — выбирает loop по провайдеру
async function runAgentic(messages, tools, systemPrompt, toolExecutor, cfg) {
  const provider = cfg?.provider || "anthropic";
  const apiKey = cfg?.api_key || ANTHROPIC_API_KEY;
  const model = cfg?.model || "claude-haiku-4-5";
  const maxTokens = cfg?.max_tokens || 1024;

  if (provider === "anthropic") {
    return runAnthropicAgentic(messages, tools, systemPrompt, toolExecutor, apiKey, model, maxTokens);
  } else {
    return runOpenAIAgentic(messages, tools, systemPrompt, toolExecutor, apiKey, model, maxTokens, cfg);
  }
}

async function handleAIMessage(chatId, text, masterProfile) {
  const cfg = await loadAIConfig();
  const apiKey = cfg?.api_key || ANTHROPIC_API_KEY;

  if (!apiKey) return false;
  if (cfg?.enabled === false) return false;

  await sendTyping(chatId);
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (masterProfile) {
      const masterId = masterProfile.user_id;
      const system = `Ты умный помощник мастера в приложении Ezze. Сегодня ${today}. Отвечай кратко и по делу на русском. Используй инструменты чтобы ответить на вопросы о расписании и выручке. Форматируй даты как ДД.ММ, время как ЧЧ:ММ.`;
      const answer = await runAgentic(
        [{ role: "user", content: text }],
        getMasterTools(), system,
        (name, input) => executeMasterTool(name, input, masterId),
        cfg
      );
      await sendMessage(chatId, answer);
    } else {
      const system = `Ты помощник клиента в приложении Ezze — сервисе записи к мастерам. Сегодня ${today}. Отвечай кратко и по делу на русском.`;
      const answer = await runAgentic(
        [{ role: "user", content: text }],
        getClientTools(), system,
        (name, input) => executeClientTool(name, input, chatId),
        cfg
      );
      await sendMessage(chatId, answer);
    }
    return true;
  } catch (err) {
    console.error("handleAIMessage error:", err);
    await sendMessage(chatId, "Извините, произошла ошибка. Попробуйте позже.");
    return false;
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
          // Не мастер — показываем клиентское меню (Мои записи + Стать мастером)
          await sendClientMenu(chatId, firstName);
        }
      }
    }

    if (text === "/menu") await sendClientMenu(chatId, firstName);

    // AI: handle arbitrary (non-command) messages
    if (!text.startsWith("/")) {
      const masterProfile = await findMasterByChatId(chatId);
      if (masterProfile) {
        await handleAIMessage(chatId, text, masterProfile);
      } else {
        // Check if this telegram user has any appointments (is a known client)
        const { count } = await supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("telegram_id", String(chatId));
        if ((count ?? 0) > 0) {
          await handleAIMessage(chatId, text, null);
        }
      }
    }
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

// Клиентское меню: для всех кто не является мастером.
// Устанавливаем постоянную ReplyKeyboard — она не уезжает вверх при новых сообщениях.
async function sendClientMenu(chatId, firstName) {
  await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `👋 <b>Привет${firstName ? ", " + firstName : ""}!</b>\n\nЗдесь вы можете посмотреть свои записи к мастерам.\n\n<i>Кнопки снизу всегда доступны 👇</i>`,
      parse_mode: "HTML",
      reply_markup: clientReplyKeyboard(),
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

// Устанавливает кнопку меню бота (рядом с полем ввода) — открывает Mini App напрямую
async function setupMenuButton() {
  try {
    const res = await fetch(`${TG_API}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: {
          type: "web_app",
          text: "📋 Мои записи",
          web_app: { url: `${APP_URL}/my` },
        },
      }),
    });
    const data = await res.json();
    if (data.ok) console.log("✅ Menu button → WebApp configured");
    else console.error("setChatMenuButton error:", data.description);
  } catch (e) {
    console.error("setupMenuButton error:", e.message);
  }
}

console.log("🤖 Telegram bot (Supabase) polling started...");
console.log(`Supabase: ${SUPABASE_URL}`);
console.log(`App URL: ${APP_URL}`);
deleteWebhook().then(() => setupMenuButton()).then(() => poll());
