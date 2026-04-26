import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req: Request) => {
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const fnName = pathParts[0]

  if (!fnName) {
    return new Response(JSON.stringify({ error: 'Function not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const worker = await (EdgeRuntime as any).userWorkers.create({
      servicePath: `/home/deno/functions/${fnName}`,
      memoryLimitMb: 150,
      workerTimeoutMs: 30 * 1000,
      noModuleCache: false,
      envVars: [
        ['SUPABASE_URL', Deno.env.get('SUPABASE_URL') ?? ''],
        ['SUPABASE_PUBLIC_URL', Deno.env.get('SUPABASE_PUBLIC_URL') ?? ''],
        ['SUPABASE_ANON_KEY', Deno.env.get('SUPABASE_ANON_KEY') ?? ''],
        ['SUPABASE_SERVICE_ROLE_KEY', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''],
        ['JWT_SECRET', Deno.env.get('JWT_SECRET') ?? ''],
        ['TG_BOT_TOKEN', Deno.env.get('TG_BOT_TOKEN') ?? ''],
        ['TG_CLIENT_BOT_TOKEN', Deno.env.get('TG_CLIENT_BOT_TOKEN') ?? ''],
        ['TG_BOT_TOKEN_WORKSHOP', Deno.env.get('TG_BOT_TOKEN_WORKSHOP') ?? ''],
        ['TG_BOT_TOKEN_CLINIC', Deno.env.get('TG_BOT_TOKEN_CLINIC') ?? ''],
        ['TG_BOT_TOKEN_EDU', Deno.env.get('TG_BOT_TOKEN_EDU') ?? ''],
        ['APP_URL', Deno.env.get('APP_URL') ?? ''],
        ['TG_GATEWAY_TOKEN', Deno.env.get('TG_GATEWAY_TOKEN') ?? ''],
      ],
      forceCreate: false,
    })
    return await worker.fetch(req)
  } catch (err) {
    console.error(`[main] ${fnName} error:`, err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})
