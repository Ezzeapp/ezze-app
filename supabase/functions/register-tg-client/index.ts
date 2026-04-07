import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { tg_chat_id, phone, name, lang, tg_username, tg_name } = await req.json()

    if (!tg_chat_id || !phone || !name) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Upsert в tg_clients
    const { error } = await supabase.from('tg_clients').upsert({
      tg_chat_id: String(tg_chat_id),
      phone,
      name,
      lang:        lang        || 'ru',
      tg_username: tg_username || null,
      tg_name:     tg_name     || null,
      updated_at:  new Date().toISOString(),
    }, { onConflict: 'tg_chat_id' })

    if (error) throw new Error(error.message)

    // Устанавливаем кнопку меню через клиентский бот
    const BOT_TOKEN = Deno.env.get('TG_CLIENT_BOT_TOKEN')
    const APP_URL   = Deno.env.get('APP_URL') || 'https://pro.ezze.site'

    if (BOT_TOKEN) {
      // Берём название кнопки из app_settings.tg_config (как в боте)
      let clientLabel = 'Ezze client'
      const { data: tgCfgRow } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'tg_config')
        .maybeSingle()
      if (tgCfgRow?.value?.client_label) {
        clientLabel = tgCfgRow.value.client_label
      }

      const menuUrl = `${APP_URL}/my?tg_id=${tg_chat_id}&tg_phone=${encodeURIComponent(phone)}&tg_name=${encodeURIComponent(name)}`

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tg_chat_id,
          menu_button: {
            type:    'web_app',
            text:    clientLabel,
            web_app: { url: menuUrl },
          },
        }),
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('register-tg-client error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
