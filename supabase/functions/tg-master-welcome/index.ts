/**
 * Edge Function: tg-master-welcome
 *
 * POST /functions/v1/tg-master-welcome
 * Body: { tg_chat_id: string, name: string, lang: string, product?: string, app_url?: string }
 *
 * Called by RegisterPage after a master auto-registers via Telegram Mini App.
 * Sets the chat menu button and sends a welcome message (no inline buttons).
 * Per-product: uses TG_BOT_TOKEN_{PRODUCT} (falls back to TG_BOT_TOKEN) and
 * filters app_settings.tg_config by product.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// ── Локализованные тексты ──────────────────────────────────────────────────────

const TEXTS: Record<string, { welcome: (name: string) => string }> = {
  ru: {
    welcome: (name) =>
      `🎉 <b>Добро пожаловать${name ? ', ' + name : ''}!</b>\n\nВы успешно зарегистрировались в Ezze.\nИспользуйте кнопку меню, чтобы открыть кабинет мастера.`,
  },
  uz: {
    welcome: (name) =>
      `🎉 <b>Xush kelibsiz${name ? ', ' + name : ''}!</b>\n\nSiz Ezzega muvaffaqiyatli ro'yxatdan o'tdingiz.\nUsta kabinetini ochish uchun menyu tugmasini bosing.`,
  },
  en: {
    welcome: (name) =>
      `🎉 <b>Welcome${name ? ', ' + name : ''}!</b>\n\nYou have successfully registered in Ezze.\nUse the menu button to open your master cabinet.`,
  },
  tg: {
    welcome: (name) =>
      `🎉 <b>Хуш омадед${name ? ', ' + name : ''}!</b>\n\nШумо бо муваффақият дар Ezze ба қайд гирифта шудед.\nБарои кушодани кабинети устод тугмаи менюро истифода баред.`,
  },
  kz: {
    welcome: (name) =>
      `🎉 <b>Қош келдіңіз${name ? ', ' + name : ''}!</b>\n\nСіз Ezze-ге сәтті тіркелдіңіз.\nШебер кабинетін ашу үшін мәзір түймесін пайдаланыңыз.`,
  },
  ky: {
    welcome: (name) =>
      `🎉 <b>Кош келдиңиз${name ? ', ' + name : ''}!</b>\n\nСиз Ezzege ийгиликтүү катталдыңыз.\nУста кабинетин ачуу үчүн меню баскычын колдонуңуз.`,
  },
}

// ── Bot token (единый для всех продуктов) ─────────────────────────────────────

function getBotToken(_product: string): string {
  // Единый бот @ezzepro_bot обслуживает все продукты — один токен
  return Deno.env.get('TG_BOT_TOKEN') || ''
}

// ── Получить название кнопки меню из app_settings (per product) ────────────────

async function getMasterMenuLabel(product: string): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('product', product)
      .eq('key', 'tg_config')
      .maybeSingle()
    if (data?.value) {
      const raw = data.value
      const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw
      return cfg?.master_label || 'Ezze'
    }
  } catch { /* non-critical */ }
  return 'Ezze'
}

// ── Вспомогательные TG API запросы ────────────────────────────────────────────

async function setChatMenuButton(
  botToken: string,
  chatId: string,
  label: string,
  appUrl: string,
) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      menu_button: {
        type: 'web_app',
        text: label,
        web_app: { url: `${appUrl}/tg?start=master` },
      },
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[tg-master-welcome] setChatMenuButton failed: ${res.status} ${body}`)
  }
}

async function sendWelcomeMessage(botToken: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true },
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[tg-master-welcome] sendMessage failed: ${res.status} ${body}`)
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let tg_chat_id = '', name = '', lang = 'ru', product = 'beauty', app_url = ''
  try {
    const body = await req.json()
    tg_chat_id = String(body?.tg_chat_id || '').trim()
    name       = String(body?.name || '').trim()
    lang       = String(body?.lang || 'ru').trim()
    product    = String(body?.product || 'beauty').trim() || 'beauty'
    app_url    = String(body?.app_url || '').trim()
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

  const botToken = getBotToken(product)
  if (!botToken) {
    return new Response(JSON.stringify({ error: `Bot not configured for product=${product}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const appUrl = app_url || Deno.env.get('APP_URL') || 'https://pro.ezze.site'
  const t = TEXTS[lang] ?? TEXTS['ru']
  const menuLabel = await getMasterMenuLabel(product)

  try {
    await Promise.allSettled([
      setChatMenuButton(botToken, tg_chat_id, menuLabel, appUrl),
      sendWelcomeMessage(botToken, tg_chat_id, t.welcome(name)),
    ])
  } catch { /* non-fatal */ }

  return new Response(JSON.stringify({ ok: true, product }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
