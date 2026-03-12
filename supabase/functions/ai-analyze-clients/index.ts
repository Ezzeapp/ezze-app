/**
 * Edge Function: ai-analyze-clients
 * Analyzes master's client base using Claude AI and returns business insights.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS })
  }
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), { status: 500, headers: CORS })
  }

  // Get authenticated user
  const authHeader = req.headers.get('Authorization') ?? ''
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
  }

  const masterId = user.id

  try {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10)

    // Fetch clients
    const { data: clients } = await supabase
      .from('clients')
      .select('id, first_name, last_name, birthday, tags, source, created_at, last_visit, total_visits')
      .eq('master_id', masterId)

    // Fetch appointments for last 6 months
    const { data: appts } = await supabase
      .from('appointments')
      .select('id, client_id, status, date, price, service_id')
      .eq('master_id', masterId)
      .gte('date', sixMonthsAgoStr)

    if (!clients?.length) {
      return new Response(JSON.stringify({ analysis: 'У вас пока нет клиентов для анализа. Добавьте клиентов и запишите их на услуги.' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    // Build aggregated stats (no PII — only metrics)
    const totalClients = clients.length
    const now = new Date()
    const twoMonthsAgo = new Date(); twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)

    const clientStats = clients.map(c => {
      const clientAppts = appts?.filter(a => a.client_id === c.id) ?? []
      const completedAppts = clientAppts.filter(a => a.status === 'done')
      const revenue = completedAppts.reduce((sum, a) => sum + (a.price ?? 0), 0)
      const lastVisit = c.last_visit ? new Date(c.last_visit) : null
      const daysSinceVisit = lastVisit ? Math.floor((now.getTime() - lastVisit.getTime()) / 86400000) : null
      return {
        totalVisits: c.total_visits ?? 0,
        revenue,
        daysSinceLastVisit: daysSinceVisit,
        appointmentsLast6m: completedAppts.length,
      }
    })

    const atRiskCount = clientStats.filter(c => c.daysSinceLastVisit !== null && c.daysSinceLastVisit > 60).length
    const loyalCount = clientStats.filter(c => c.totalVisits >= 5).length
    const newCount = clientStats.filter(c => c.totalVisits <= 1).length
    const totalRevenue = clientStats.reduce((sum, c) => sum + c.revenue, 0)
    const avgRevenue = totalClients > 0 ? Math.round(totalRevenue / totalClients) : 0
    const topClients = [...clientStats].sort((a, b) => b.revenue - a.revenue).slice(0, 3)
    const avgVisitsPerClient = totalClients > 0
      ? Math.round(clientStats.reduce((s, c) => s + c.appointmentsLast6m, 0) / totalClients * 10) / 10
      : 0

    const stats = {
      totalClients,
      loyalClients: loyalCount,         // 5+ visits
      atRiskClients: atRiskCount,        // 60+ days without visit
      newClients: newCount,              // 1 or 0 visits
      totalRevenueLast6m: totalRevenue,
      avgRevenuePerClient: avgRevenue,
      avgVisitsPerClientLast6m: avgVisitsPerClient,
      topClientRevenues: topClients.map(c => c.revenue),
    }

    const prompt = `Ты бизнес-аналитик для самозанятых мастеров. Проанализируй клиентскую базу и дай конкретные практичные советы.

Статистика за 6 месяцев:
- Всего клиентов: ${stats.totalClients}
- Лояльных (5+ визитов): ${stats.loyalClients}
- Под угрозой оттока (не были 60+ дней): ${stats.atRiskClients}
- Новых (1 визит): ${stats.newClients}
- Суммарная выручка: ${stats.totalRevenueLast6m.toLocaleString('ru')} сум
- Средняя выручка с клиента: ${stats.avgRevenuePerClient.toLocaleString('ru')} сум
- Среднее визитов на клиента: ${stats.avgVisitsPerClientLast6m}

Напиши анализ в следующем формате (markdown):

## 📊 Состояние базы
[2-3 предложения о текущей ситуации]

## ⚠️ Проблемы
[bullet list — конкретные проблемы]

## ✅ Рекомендации
[bullet list — конкретные действия, что сделать прямо сейчас]

Текст на русском языке, конкретно и по делу, без воды.`

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!resp.ok) {
      const err = await resp.text()
      console.error('Anthropic API error:', err)
      return new Response(JSON.stringify({ error: 'AI service error' }), { status: 502, headers: CORS })
    }

    const aiData = await resp.json()
    const analysis = aiData.content?.[0]?.text?.trim() ?? ''

    return new Response(JSON.stringify({ analysis, stats }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('ai-analyze-clients error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS })
  }
})
