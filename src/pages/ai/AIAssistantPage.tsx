import { Bot, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'

export function AIAssistantPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="AI Ассистент"
        description="Умный помощник для вашего бизнеса"
      >
        <Bot className="h-5 w-5 text-primary" />
      </PageHeader>

      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-primary/60" />
        </div>
        <h3 className="text-lg font-semibold">Скоро будет доступно</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          AI ассистент поможет вам управлять записями, анализировать данные и отвечать на вопросы клиентов.
        </p>
      </div>
    </div>
  )
}
