import { useEffect, useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import type { LandingContent, LandingHowStep, LandingReview } from '@/types'

const DEFAULT_STEPS: LandingHowStep[] = [
  { title: 'Оставляете заявку',  description: 'Через сайт, бот или звонок. 2 минуты вашего времени.' },
  { title: 'Курьер забирает',    description: 'В удобное окно. Бесплатно от {free_pickup}.' },
  { title: 'Чистим и гладим',    description: 'Эко-средства, индивидуальная программа под материал.' },
  { title: 'Привозим обратно',   description: 'Через {turnaround_hours} часов в фирменной упаковке.' },
]

interface Props {
  value: LandingContent
  onCommit: (next: LandingContent) => void | Promise<void>
}

export function LandingContentEditor({ value, onCommit }: Props) {
  const [draft, setDraft] = useState<LandingContent>(value)
  const [stepsOpen, setStepsOpen] = useState(false)
  const [reviewsOpen, setReviewsOpen] = useState(false)

  // Sync external value into draft only when reference changes (load from server).
  useEffect(() => { setDraft(value) }, [value])

  const patch = <K extends keyof LandingContent>(key: K, v: LandingContent[K]) => {
    setDraft(prev => ({ ...prev, [key]: v }))
  }
  const commit = (next: LandingContent = draft) => {
    onCommit(next)
  }

  // For switches/lists — change locally + commit immediately.
  const setAndCommit = <K extends keyof LandingContent>(key: K, v: LandingContent[K]) => {
    const next = { ...draft, [key]: v }
    setDraft(next)
    commit(next)
  }

  const steps = draft.how_steps?.length ? draft.how_steps : DEFAULT_STEPS
  const reviews = draft.reviews ?? []

  const updateStep = (i: number, patch: Partial<LandingHowStep>) => {
    setDraft(prev => ({
      ...prev,
      how_steps: steps.map((s, idx) => idx === i ? { ...s, ...patch } : s),
    }))
  }
  const commitSteps = () => commit(draft)
  const addStep = () => {
    if (steps.length >= 4) return
    setAndCommit('how_steps', [...steps, { title: 'Новый шаг', description: '' }])
  }
  const removeStep = (i: number) => {
    setAndCommit('how_steps', steps.filter((_, idx) => idx !== i))
  }

  const updateReview = (i: number, patch: Partial<LandingReview>) => {
    setDraft(prev => ({
      ...prev,
      reviews: reviews.map((r, idx) => idx === i ? { ...r, ...patch } : r),
    }))
  }
  const addReview = () => {
    if (reviews.length >= 6) return
    setAndCommit('reviews', [...reviews, { name: '', text: '', rating: 5 }])
  }
  const removeReview = (i: number) => {
    setAndCommit('reviews', reviews.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Бейдж в hero</Label>
          <Input
            placeholder="Доставка 24/7"
            value={draft.hero_badge ?? ''}
            onChange={(e) => patch('hero_badge', e.target.value)}
            onBlur={() => commit()}
          />
          <p className="text-[11px] text-muted-foreground">Маленькая надпись над заголовком. Оставьте пустым — будет скрыта.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Подзаголовок бизнеса</Label>
          <Input
            placeholder="Премиум химчистка"
            value={draft.business_subtitle ?? ''}
            onChange={(e) => patch('business_subtitle', e.target.value)}
            onBlur={() => commit()}
          />
          <p className="text-[11px] text-muted-foreground">Под названием в шапке (Premium шаблон).</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Срок выполнения, часов</Label>
          <Input
            type="number"
            min={1}
            placeholder="48"
            value={draft.turnaround_hours ?? ''}
            onChange={(e) => patch('turnaround_hours', e.target.value === '' ? undefined : Number(e.target.value))}
            onBlur={() => commit()}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Бесплатный самовывоз от, сум</Label>
          <Input
            type="number"
            min={0}
            placeholder="200000"
            value={draft.free_pickup_threshold ?? ''}
            onChange={(e) => patch('free_pickup_threshold', e.target.value === '' ? undefined : Number(e.target.value))}
            onBlur={() => commit()}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Часы работы</Label>
        <Input
          placeholder="9:00 — 21:00, ежедневно"
          value={draft.working_hours ?? ''}
          onChange={(e) => patch('working_hours', e.target.value)}
          onBlur={() => commit()}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3 rounded-lg border p-3 bg-muted/30">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div className="min-w-0">
            <div className="text-sm font-medium">Эко-средства</div>
            <div className="text-[11px] text-muted-foreground">Бейдж «Эко» в hero и marquee</div>
          </div>
          <Switch
            checked={draft.show_eco_badge ?? true}
            onCheckedChange={(v) => setAndCommit('show_eco_badge', v)}
          />
        </label>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div className="min-w-0">
            <div className="text-sm font-medium">Гарантия качества</div>
            <div className="text-[11px] text-muted-foreground">Бейдж «Гарантия»</div>
          </div>
          <Switch
            checked={draft.show_quality_badge ?? true}
            onCheckedChange={(v) => setAndCommit('show_quality_badge', v)}
          />
        </label>
      </div>

      <div className="rounded-lg border bg-card">
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2.5"
          onClick={() => setStepsOpen(!stepsOpen)}
        >
          <div className="text-left">
            <div className="text-sm font-semibold">Как это работает</div>
            <div className="text-[11px] text-muted-foreground">{steps.length} {steps.length === 1 ? 'шаг' : 'шагов'} · можно использовать <code>&#123;turnaround_hours&#125;</code> и <code>&#123;free_pickup&#125;</code></div>
          </div>
          {stepsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {stepsOpen && (
          <div className="border-t p-3 space-y-3">
            {steps.map((s, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2 bg-background">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-primary/10 text-primary grid place-items-center text-sm font-bold">{i + 1}</div>
                  <Input
                    className="flex-1"
                    placeholder="Заголовок шага"
                    value={s.title}
                    onChange={(e) => updateStep(i, { title: e.target.value })}
                    onBlur={commitSteps}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeStep(i)}
                    disabled={steps.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  placeholder="Описание шага"
                  value={s.description}
                  onChange={(e) => updateStep(i, { description: e.target.value })}
                  onBlur={commitSteps}
                />
              </div>
            ))}
            {steps.length < 4 && (
              <Button type="button" variant="outline" size="sm" onClick={addStep} className="w-full">
                <Plus className="h-4 w-4 mr-1.5" /> Добавить шаг
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground">
              Плейсхолдеры: <code>&#123;turnaround_hours&#125;</code> подставит срок выполнения, <code>&#123;free_pickup&#125;</code> — порог бесплатного вывоза.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2.5"
          onClick={() => setReviewsOpen(!reviewsOpen)}
        >
          <div className="text-left">
            <div className="text-sm font-semibold">Отзывы клиентов</div>
            <div className="text-[11px] text-muted-foreground">
              {reviews.length === 0 ? 'Не отображаются на лендинге' : `${reviews.length} отзыв${reviews.length > 1 ? 'а' : ''}`}
            </div>
          </div>
          {reviewsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {reviewsOpen && (
          <div className="border-t p-3 space-y-3">
            {reviews.length === 0 && (
              <p className="text-xs text-muted-foreground">Пока ни одного отзыва. Если оставить пустым — секция «Отзывы» на лендинге не покажется.</p>
            )}
            {reviews.map((r, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2 bg-background">
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Имя клиента"
                    value={r.name}
                    onChange={(e) => updateReview(i, { name: e.target.value })}
                    onBlur={() => commit()}
                  />
                  <select
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    value={r.rating ?? 5}
                    onChange={(e) => {
                      updateReview(i, { rating: Number(e.target.value) })
                      // commit immediately for select
                      setTimeout(() => commit(), 0)
                    }}
                  >
                    {[5, 4, 3, 2, 1].map(n => (
                      <option key={n} value={n}>{n}★</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeReview(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  placeholder="Текст отзыва"
                  value={r.text}
                  onChange={(e) => updateReview(i, { text: e.target.value })}
                  onBlur={() => commit()}
                />
                <Input
                  placeholder='Дата (например, "3 дня назад")'
                  value={r.date ?? ''}
                  onChange={(e) => updateReview(i, { date: e.target.value })}
                  onBlur={() => commit()}
                />
              </div>
            ))}
            {reviews.length < 6 && (
              <Button type="button" variant="outline" size="sm" onClick={addReview} className="w-full">
                <Plus className="h-4 w-4 mr-1.5" /> Добавить отзыв
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
