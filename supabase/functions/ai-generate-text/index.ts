/**
 * Edge Function: ai-generate-text
 * Generates professional bio or service descriptions using Claude AI.
 *
 * POST body:
 *   type: 'bio' | 'service_description'
 *   context: object with relevant fields
 */

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS })
  }
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), { status: 500, headers: CORS })
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

    // Call Claude API
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!resp.ok) {
      const err = await resp.text()
      console.error('Anthropic API error:', err)
      return new Response(JSON.stringify({ error: 'AI service error' }), { status: 502, headers: CORS })
    }

    const data = await resp.json()
    const text = data.content?.[0]?.text ?? ''

    return new Response(JSON.stringify({ text: text.trim() }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('ai-generate-text error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS })
  }
})
