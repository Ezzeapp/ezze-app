/**
 * tg_shared.js — Общие утилиты для мастерского и клиентского ботов
 * Не запускается напрямую, импортируется другими ботами.
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// ── Загрузка .env ─────────────────────────────────────────────────────────────

try {
  const env = readFileSync(".env", "utf8");
  env.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return; // пропускаем пустые строки и комментарии
    const idx = trimmed.indexOf("=");
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  });
} catch { /* .env не найден — используем только process.env */ }

// ── Константы ─────────────────────────────────────────────────────────────────

export const APP_URL = process.env.APP_URL || "https://ezze.site";
export const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:8001";
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

export const MASTER_BOT_TOKEN = process.env.TG_BOT_TOKEN || "";
export const CLIENT_BOT_TOKEN = process.env.TG_CLIENT_BOT_TOKEN || "";

// Проверяем наличие обязательных переменных среды при запуске
if (!MASTER_BOT_TOKEN) {
  console.error("❌ TG_BOT_TOKEN не задан. Укажите его в .env или переменных окружения.");
  process.exit(1);
}
if (!CLIENT_BOT_TOKEN) {
  console.error("❌ TG_CLIENT_BOT_TOKEN не задан. Укажите его в .env или переменных окружения.");
  process.exit(1);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Утилиты ───────────────────────────────────────────────────────────────────

/**
 * Экранирует HTML-спецсимволы в пользовательском тексте.
 * Используется перед вставкой имён/текста в Telegram-сообщения с parse_mode="HTML".
 */
export function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Создаёт объект сессии с временной меткой (для TTL-очистки).
 */
export function sessionEntry(data) {
  return { ...data, _ts: Date.now() };
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа

/**
 * Удаляет устаревшие сессии из Map (старше 24 часов).
 * Вызывать периодически (setInterval) и сохранять результат в файл.
 */
export function cleanupSessions(sessions) {
  const now = Date.now();
  let count = 0;
  for (const [key, val] of sessions.entries()) {
    if (val._ts && now - val._ts > SESSION_TTL_MS) {
      sessions.delete(key);
      count++;
    }
  }
  if (count > 0) console.log(`🧹 Очищено устаревших сессий: ${count}`);
  return count;
}

export function fmtDate(s) {
  const months = ['января','февраля','марта','апреля','мая','июня',
                  'июля','августа','сентября','октября','ноября','декабря'];
  const d = (s ?? '').slice(0, 10).split('-');
  if (d.length !== 3) return s;
  const day = parseInt(d[2]), mon = parseInt(d[1]) - 1;
  return (mon >= 0 && mon <= 11) ? `${day} ${months[mon]}` : s;
}

// ── Конфиги из app_settings (с кешем 5 мин) ──────────────────────────────────

/** Сбрасывает кеш tg_config — вызывать при изменении настроек в admin */
export function invalidateTgConfigCache() {
  // no-op: кеш убран, конфиг всегда читается свежим из БД
}

export async function loadTgConfig() {
  // Без кеша — всегда читаем актуальный config из БД.
  // Вызывается только при взаимодействии пользователя с ботом → нагрузка минимальна.
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "tg_config")
      .maybeSingle();
    if (data?.value) {
      return JSON.parse(data.value);
    }
  } catch (e) {
    console.error("Failed to load tg_config:", e.message);
  }
  return { client_label: "Ezze", master_label: "Ezze" };
}

let _cachedAIConfig = null;
let _aiConfigLoadedAt = 0;

export async function loadAIConfig() {
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
      console.log(`🤖 AI config: model=${_cachedAIConfig.model}, enabled=${_cachedAIConfig.enabled}`);
    }
  } catch (e) {
    console.error("Failed to load ai_config:", e.message);
  }
  return _cachedAIConfig;
}

// ── DB-запросы ────────────────────────────────────────────────────────────────

export async function findMasterByChatId(chatId) {
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

export async function autoFixMasterProfile(chatId, tgUsername) {
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
        profile.tg_chat_id = String(chatId);
      }
      return profile;
    } else {
      // Профиль мастера не найден (удалён) — возвращаем null, не создаём
      return null;
    }
  } catch (e) {
    console.error("autoFixMasterProfile error:", e.message);
    return null;
  }
}

// ── AI Tools ──────────────────────────────────────────────────────────────────

export function getMasterTools() {
  return [
    {
      name: "get_appointments",
      description: "Получить записи мастера за указанный период.",
      input_schema: {
        type: "object",
        properties: {
          date_from: { type: "string", description: "Дата начала (YYYY-MM-DD)" },
          date_to:   { type: "string", description: "Дата конца (YYYY-MM-DD)" },
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

export function getClientTools() {
  return [
    {
      name: "get_my_appointments",
      description: "Получить мои предстоящие и прошлые записи к мастерам.",
      input_schema: { type: "object", properties: {} },
    },
  ];
}

export async function executeMasterTool(toolName, input, masterId) {
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
        date: a.date, time: a.start_time, status: a.status, price: a.price,
        client: a.clients ? `${a.clients.first_name || ""} ${a.clients.last_name || ""}`.trim() : "—",
        service: (a.notes || "").match(/^\[([^\]]+)\]/)?.[1] || "",
      }));
      return JSON.stringify(formatted);
    }
    if (toolName === "get_stats") {
      const days = Math.min(input.days || 30, 365);
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);
      const { data } = await supabase
        .from("appointments").select("price, status, date")
        .eq("master_id", masterId).gte("date", dateFrom.toISOString().slice(0, 10));
      const done = (data || []).filter(a => a.status === "done");
      const revenue = done.reduce((s, a) => s + (a.price || 0), 0);
      return JSON.stringify({ period_days: days, completed: done.length, total: (data || []).length, revenue });
    }
  } catch (e) { return `Error: ${e.message}`; }
  return "Unknown tool";
}

export async function executeClientTool(toolName, _input, chatId) {
  try {
    if (toolName === "get_my_appointments") {
      const { data } = await supabase
        .from("appointments").select("date, start_time, end_time, status, price, notes")
        .eq("telegram_id", String(chatId))
        .order("date", { ascending: false }).limit(10);
      return JSON.stringify(data || []);
    }
  } catch (e) { return `Error: ${e.message}`; }
  return "Unknown tool";
}

// ── AI Runners ────────────────────────────────────────────────────────────────

export const PROVIDER_BASE_URLS = {
  openai:   "https://api.openai.com/v1",
  gemini:   "https://generativelanguage.googleapis.com/v1beta/openai",
  deepseek: "https://api.deepseek.com/v1",
  qwen:     "https://dashscope.aliyuncs.com/compatible-mode/v1",
};

export async function runAnthropicAgentic(messages, tools, systemPrompt, toolExecutor, apiKey, model, maxTokens) {
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

export async function runOpenAIAgentic(messages, tools, systemPrompt, toolExecutor, apiKey, model, maxTokens, cfg) {
  const provider = cfg?.provider || "openai";
  const baseUrl = provider === "custom"
    ? (cfg?.base_url || "")
    : (PROVIDER_BASE_URLS[provider] || PROVIDER_BASE_URLS.openai);
  const oaiTools = tools?.map(t => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
  let msgs = [{ role: "system", content: systemPrompt }, ...messages];
  for (let i = 0; i < 5; i++) {
    const body = { model, max_tokens: maxTokens, messages: msgs };
    if (oaiTools?.length) body.tools = oaiTools;
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) { console.error("OpenAI-compat API error:", data); return "Извините, ИИ-помощник недоступен."; }
    const choice = data.choices?.[0];
    const msg = choice?.message;
    if (!msg?.tool_calls?.length || choice.finish_reason === "stop") return msg?.content || "Готово.";
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

export async function runAgentic(messages, tools, systemPrompt, toolExecutor, cfg) {
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

// ── handleAIMessage (принимает bot helpers) ───────────────────────────────────

export async function handleAIMessage(chatId, text, masterProfile, bot, cfg) {
  const apiKey = cfg?.api_key || ANTHROPIC_API_KEY;
  if (!apiKey) return false;
  if (cfg?.enabled === false) return false;

  await bot.sendTyping(chatId);
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (masterProfile) {
      const masterId = masterProfile.user_id;
      const system = `Ты умный помощник мастера в приложении Ezze. Сегодня ${today}. Отвечай кратко и по делу на русском. Используй инструменты чтобы ответить на вопросы о расписании и выручке.`;
      const answer = await runAgentic(
        [{ role: "user", content: text }],
        getMasterTools(), system,
        (name, input) => executeMasterTool(name, input, masterId),
        cfg
      );
      await bot.sendMessage(chatId, answer);
    } else {
      const system = `Ты помощник клиента в приложении Ezze — сервисе записи к мастерам. Сегодня ${today}. Отвечай кратко и по делу на русском.`;
      const answer = await runAgentic(
        [{ role: "user", content: text }],
        getClientTools(), system,
        (name, input) => executeClientTool(name, input, chatId),
        cfg
      );
      await bot.sendMessage(chatId, answer);
    }
    return true;
  } catch (err) {
    console.error("handleAIMessage error:", err);
    await bot.sendMessage(chatId, "Извините, произошла ошибка. Попробуйте позже.");
    return false;
  }
}

// ── Фабрика Bot API helpers ───────────────────────────────────────────────────

export function createBotHelpers(token) {
  const TG_API = `https://api.telegram.org/bot${token}`;

  async function sendMessage(chatId, text, replyMarkup) {
    const body = { chat_id: chatId, text, parse_mode: "HTML" };
    if (replyMarkup) body.reply_markup = replyMarkup;
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await res.json();
    if (!result.ok) console.error("sendMessage error:", result.description);
    return result;
  }

  async function editMessageText(chatId, messageId, text) {
    try {
      await fetch(`${TG_API}/editMessageText`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" }),
      });
    } catch (e) { console.error("editMessageText error:", e.message); }
  }

  async function sendMessageWithWebApp(chatId, text, buttonText, webAppUrl) {
    await fetch(`${TG_API}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId, text, parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: buttonText, web_app: { url: webAppUrl } }]] },
      }),
    });
  }

  async function sendTyping(chatId) {
    await fetch(`${TG_API}/sendChatAction`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }),
    }).catch(() => {});
  }

  async function setUserMenuButton(chatId, text, url) {
    try {
      const menuButton = (text && url)
        ? { type: "web_app", text, web_app: { url } }
        : { type: "default" };
      await fetch(`${TG_API}/setChatMenuButton`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, menu_button: menuButton }),
      });
    } catch (e) { console.error("setUserMenuButton error:", e.message); }
  }

  async function answerCallbackQuery(callbackQueryId) {
    await fetch(`${TG_API}/answerCallbackQuery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });
  }

  async function deleteWebhook() {
    try {
      const res = await fetch(`${TG_API}/deleteWebhook?drop_pending_updates=false`);
      const data = await res.json();
      if (data.ok) console.log(`✅ [${token.slice(0, 10)}...] Webhook deleted`);
    } catch (e) { console.error("deleteWebhook error:", e.message); }
  }

  async function setupDefaultMenuButton() {
    try {
      await fetch(`${TG_API}/setChatMenuButton`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu_button: { type: "default" } }),
      });
    } catch (e) { console.error("setupDefaultMenuButton error:", e.message); }
  }

  function startPolling(processUpdate) {
    let offset = 0;
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
    poll();
  }

  return {
    TG_API,
    sendMessage,
    editMessageText,
    sendMessageWithWebApp,
    sendTyping,
    setUserMenuButton,
    answerCallbackQuery,
    deleteWebhook,
    setupDefaultMenuButton,
    startPolling,
  };
}
