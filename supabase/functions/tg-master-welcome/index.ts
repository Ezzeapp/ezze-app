/**
 * Edge Function: tg-master-welcome
 *
 * POST /functions/v1/tg-master-welcome
 * Body: { tg_chat_id: string, name: string, lang: string }
 *
 * Called by RegisterPage after a master auto-registers via Telegram Mini App.
 * Sets the chat menu button and sends a welcome message.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const TG_API_URL = `https://api.telegram.org/bot${Deno.env.get('TG_BOT_TOKEN')}`
const APP_URL = Deno.env.get('APP_URL') ?? 'https://ezze.site'

// ── Локализованные тексты ──────────────────────────────────────────────────────

const TEXTS: Record<string, { welcome: (name: string) => string; openApp: string }> = {
  ru: {
    welcome: (name) =>
      `🎉 <b>Добро пожаловать${name ? ', ' + name : ''}!</b>\n\nВы успешно зарегистрировались в Ezze.\nОткройте приложение, чтобы завершить настройку профиля.`,
    openApp: 'Открыть приложение',
  },
  uz: {
    welcome: (name) =>
      `🎉 <b>Xush kelibsiz${name ? ', ' + name : ''}!</b>\n\nSiz Ezzega muvaffaqiyatli ro'yxatdan o'tdingiz.\nProfilni sozlash uchun ilovani oching.`,
    openApp: 'Ilovani ochish',
  },
  en: {
    welcome: (name) =>
      `🎉 <b>Welcome${name ? ', ' + name : ''}!</b>\n\nYou have successfully registered in Ezze.\nOpen the app to set up your profile.`,
    openApp: 'Open App',
  },
  tg: {
    welcome: (name) =>
      `🎉 <b>Хуш омадед${name ? ', ' + name : ''}!</b>\n\nШумо бо муваффақият дар Ezze ба қайд гирифта шудед.\nБарои танзими профил барномаро кушоед.`,
    openApp: 'Кушодани барнома',
  },
  kz: {
    welcome: (name) =>
      `🎉 <b>Қош келдіңіз${name ? ', ' + name : ''}!</b>\n\nСіз Ezze-ге сәтті тіркелдіңіз.\nПрофильді реттеу үшін қолданбаны ашыңыз.`,
    openApp: 'Қолданбаны ашу',
  },
  ky: {
    welcome: (name) =>
      `🎉 <b>Кош келдиңиз${name ? ', ' + name : ''}!</b>\n\nСиз Ezzege ийгиликтүү катталдыңыз.\nПрофилиңизди орнотуу үшүн колдонмону ачыңыз.`,
    openApp: 'Колдонмону ачуу',
  },
}

// ── Получить название кнопки меню из app_settings ──────────────────────────────

async function getMasterMenuLabel(): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'tg_config')
      .maybeSingle()
    if (data?.value) {
      const cfg = JSON.parse(data.value)
      return cfg.master_label || 'Ezze'
    }
  } catch { /* non-critical */ }
  return 'Ezze'
}

// ── Вспомогательные TG API запросы ────────────────────────────────────────────

async function setChatMenuButton(chatId: string, label: string) {
  await fetch(`${TG_API_URL}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      menu_button: {
        type: 'web_app',
        text: label,
        web_app: { url: `${APP_URL}/dashboard` },
      },
    }),
  })
}

async function sendWelcomeMessage(chatId: string, text: string, openAppLabel: string) {
  // Сначала убираем reply-клавиатуру (если осталась кнопка "Поделиться номером")
  await fetch(`${TG_API_URL}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true },
    }),
  })
  // Затем отправляем inline-кнопку отдельным сообщением
  await fetch(`${TG_API_URL}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: openAppLabel,
      reply_markup: {
        inline_keyboard: [[
          { text: openAppLabel, web_app: { url: `${APP_URL}/dashboard` }, style: 'primary' },
        ]],
      },
    }),
  })
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let tg_chat_id = '', name = '', lang = 'ru'
  try {
    const body = await req.json()
    tg_chat_id = String(body?.tg_chat_id || '').trim()
    name       = String(body?.name || '').trim()
    lang       = String(body?.lang || 'ru').trim()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!tg_chat_id) {
    return new Response(JSON.stringify({ error: 'tg_chat_id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const botToken = Deno.env.get('TG_BOT_TOKEN')
  if (!botToken) {
    return new Response(JSON.stringify({ error: 'Bot not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const t = TEXTS[lang] ?? TEXTS['ru']
  const menuLabel = await getMasterMenuLabel()

  try {
    // Fire both in parallel — non-critical if they fail
    await Promise.allSettled([
      setChatMenuButton(tg_chat_id, menuLabel),
      sendWelcomeMessage(tg_chat_id, t.welcome(name), t.openApp),
    ])
  } catch { /* non-fatal */ }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
