/**
 * Edge Function: ai-generate-text
 * Generates professional bio or service descriptions using Claude AI.
 *
 * POST body:
 *   type: 'bio' | 'service_description'
 *   context: object with relevant fields
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

async function getAIConfig() {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_config')
      .maybeSingle()
    if (!data?.value) return null
    return JSON.parse(data.value)
  } catch {
    return null
  }
}

const PROVIDER_BASE_URLS: Record<string, string> = {
  openai:   'https://api.openai.com/v1',
  gemini:   'https://generativelanguage.googleapis.com/v1beta/openai',
  deepseek: 'https://api.deepseek.com/v1',
  qwen:     'https://dashscope.aliyuncs.com/compatible-mode/v1',
}

async function callAI(
  cfg: Record<string, unknown> | null,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
): Promise<string> {
  const provider = (cfg?.provider as string) || 'anthropic'
  const apiKey = (cfg?.api_key as string) || ''
  const model = (cfg?.model as string) || 'claude-haiku-4-5'

  if (provider === 'anthropic') {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(JSON.stringify(data))
    return (data.content?.[0]?.text as string) ?? ''
  } else {
    const baseUrl = provider === 'custom'
      ? ((cfg?.base_url as string) || '')
      : (PROVIDER_BASE_URLS[provider] || PROVIDER_BASE_URLS.openai)
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(JSON.stringify(data))
    return (data.choices?.[0]?.message?.content as string) ?? ''
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS })
  }

  // Load AI config from DB, fallback to env
  const aiCfg = await getAIConfig()
  const apiKey = (aiCfg?.api_key as string) || Deno.env.get('ANTHROPIC_API_KEY') || ''
  const maxTokens = Math.min((aiCfg?.max_tokens as number) || 512, 512) // cap at 512 for text gen

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'AI не настроен. Задайте API-ключ в Панели администратора → ИИ.' }), { status: 503, headers: CORS })
  }
  if (aiCfg?.enabled === false) {
    return new Response(JSON.stringify({ error: 'ИИ-функции отключены администратором.' }), { status: 503, headers: CORS })
  }

  try {
    const { type, context } = await req.json()

    let prompt = ''

    if (type === 'bio') {
      const { profession, specialty, city, name } = context ?? {}
      prompt = `Напиши профессиональное и тёплое описание (bio) для страницы мастера.

Данные мастера:
- Имя: ${name || 'Мастер'}
- Профессия: ${profession || 'Специалист'}
- Специализация: ${specialty || ''}
- Город: ${city || ''}

Требования:
- 2-3 предложения максимум
- Тёплый, профессиональный тон от первого лица
- Упомяни профессию и опыт
- Не используй клише и шаблонные фразы
- Только русский язык`

    } else if (type === 'service_description') {
      const { name, category, duration_min, price } = context ?? {}
      prompt = `Напиши краткое привлекательное описание услуги для страницы мастера.

Услуга:
- Название: ${name || 'Услуга'}
- Категория: ${category || ''}
- Длительность: ${duration_min ? duration_min + ' мин' : ''}
- Цена: ${price ? price + ' сум' : ''}

Требования:
- 1-2 предложения максимум
- Расскажи что получит клиент
- Привлекательный, конкретный текст
- Только русский язык`

    } else {
      return new Response(JSON.stringify({ error: 'Unknown type' }), { status: 400, headers: CORS })
    }

    // Call AI API (provider-aware)
    const text = await callAI(aiCfg, [{ role: 'user', content: prompt }], maxTokens)

    return new Response(JSON.stringify({ text: text.trim() }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('ai-generate-text error:', err)
    const msg = String(err)
    const status = msg.includes('credit') || msg.includes('balance') ? 402 : 502
    return new Response(JSON.stringify({ error: 'AI service error', detail: msg }), { status, headers: CORS })
  }
})
