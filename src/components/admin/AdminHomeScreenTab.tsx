import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PRODUCT } from '@/lib/config'
import { useHomeScreenConfig, useUpdateHomeScreenConfig } from '@/hooks/useAppSettings'
import type { HomeScreenConfig, HomeScreenTile } from '@/hooks/useAppSettings'
import { getDefaultTiles } from '@/lib/homeScreenDefaults'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Calendar, Users, ClipboardList, ShoppingCart, Truck, Droplets,
  BarChart3, Tag, Settings2, Wallet, LayoutDashboard, Wrench,
  MessageSquare, Star, Package, Bot, Shield, CalendarDays,
  BarChart2, ChevronUp, ChevronDown, Trash2, Plus, RotateCcw, Save,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/components/shared/Toaster'

const ICON_OPTIONS: { value: string; Icon: LucideIcon }[] = [
  { value: 'ClipboardList', Icon: ClipboardList },
  { value: 'ShoppingCart',  Icon: ShoppingCart },
  { value: 'Users',         Icon: Users },
  { value: 'Truck',         Icon: Truck },
  { value: 'Droplets',      Icon: Droplets },
  { value: 'BarChart3',     Icon: BarChart3 },
  { value: 'BarChart2',     Icon: BarChart2 },
  { value: 'Tag',           Icon: Tag },
  { value: 'Settings2',     Icon: Settings2 },
  { value: 'Wallet',        Icon: Wallet },
  { value: 'LayoutDashboard', Icon: LayoutDashboard },
  { value: 'Calendar',      Icon: Calendar },
  { value: 'CalendarDays',  Icon: CalendarDays },
  { value: 'Wrench',        Icon: Wrench },
  { value: 'MessageSquare', Icon: MessageSquare },
  { value: 'Star',          Icon: Star },
  { value: 'Package',       Icon: Package },
  { value: 'Bot',           Icon: Bot },
  { value: 'Shield',        Icon: Shield },
]

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ICON_OPTIONS.map(({ value, Icon }) => [value, Icon])
)

// Языки для редактирования меток
const LABEL_LANGS = [
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
  { code: 'kz', label: 'KZ' },
  { code: 'uz', label: 'UZ' },
]

export function AdminHomeScreenTab() {
  const { t } = useTranslation()
  const { data: config, isLoading } = useHomeScreenConfig()
  const updateConfig = useUpdateHomeScreenConfig()

  const [mode, setMode] = useState<'sidebar' | 'tiles'>('sidebar')
  const [tiles, setTiles] = useState<HomeScreenTile[]>([])

  useEffect(() => {
    if (!config) return
    setMode(config.mode)
    setTiles(
      config.tiles?.length
        ? config.tiles
        : getDefaultTiles(PRODUCT)
    )
  }, [config])

  async function handleSave() {
    const cfg: HomeScreenConfig = {
      mode,
      tiles: tiles.map((t, i) => ({ ...t, order: i })),
    }
    try {
      await updateConfig.mutateAsync(cfg)
      toast.success(t('common.saved'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  function handleReset() {
    setTiles(getDefaultTiles(PRODUCT))
  }

  function moveTile(index: number, dir: -1 | 1) {
    const next = [...tiles]
    const swap = index + dir
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]]
    setTiles(next)
  }

  function updateTile(index: number, patch: Partial<HomeScreenTile>) {
    setTiles(prev => prev.map((t, i) => i === index ? { ...t, ...patch } : t))
  }

  function updateTileLabel(index: number, lang: string, value: string) {
    setTiles(prev => prev.map((t, i) =>
      i === index ? { ...t, label: { ...t.label, [lang]: value } } : t
    ))
  }

  function removeTile(index: number) {
    setTiles(prev => prev.filter((_, i) => i !== index))
  }

  function addTile() {
    const newTile: HomeScreenTile = {
      id: `tile_${Date.now()}`,
      label: { ru: 'Новый раздел', en: 'New section', kz: 'Жаңа бөлім', uz: 'Yangi bo\'lim' },
      icon: 'LayoutDashboard',
      route: '/',
      visible: true,
      order: tiles.length,
    }
    setTiles(prev => [...prev, newTile])
  }

  if (isLoading) {
    return <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">{t('common.loading')}</div>
  }

  return (
    <div className="space-y-6">
      {/* Режим навигации */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">{t('admin.homeScreen.mode')}</Label>
        <div className="flex gap-3">
          {(['sidebar', 'tiles'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors text-left',
                mode === m
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted'
              )}
            >
              {m === 'sidebar' ? t('admin.homeScreen.modeSidebar') : t('admin.homeScreen.modeTiles')}
            </button>
          ))}
        </div>
      </div>

      {/* Плитки — только в tiles-режиме */}
      {mode === 'tiles' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">{t('admin.homeScreen.tiles')}</Label>
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5 text-xs">
              <RotateCcw className="h-3.5 w-3.5" />
              {t('admin.homeScreen.resetDefault')}
            </Button>
          </div>

          <div className="space-y-2">
            {tiles.map((tile, index) => {
              const Icon = ICON_MAP[tile.icon] ?? LayoutDashboard
              return (
                <div
                  key={tile.id}
                  className="rounded-lg border bg-card p-3 space-y-3"
                >
                  {/* Строка 1: иконка + видимость + порядок + удалить */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10 shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>

                    {/* Иконка select */}
                    <Select value={tile.icon} onValueChange={v => updateTile(index, { icon: v })}>
                      <SelectTrigger className="h-7 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_OPTIONS.map(({ value, Icon: Ic }) => (
                          <SelectItem key={value} value={value}>
                            <span className="flex items-center gap-2">
                              <Ic className="h-3.5 w-3.5" />
                              {value}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Роут */}
                    <Input
                      value={tile.route}
                      onChange={e => updateTile(index, { route: e.target.value })}
                      placeholder="/route"
                      className="h-7 text-xs flex-1"
                    />

                    {/* Видимость */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch
                        checked={tile.visible}
                        onCheckedChange={v => updateTile(index, { visible: v })}
                        className="scale-75"
                      />
                    </div>

                    {/* Порядок */}
                    <div className="flex flex-col shrink-0">
                      <button
                        type="button"
                        onClick={() => moveTile(index, -1)}
                        disabled={index === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTile(index, 1)}
                        disabled={index === tiles.length - 1}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Удалить */}
                    <button
                      type="button"
                      onClick={() => removeTile(index)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Строка 2: названия по языкам */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {LABEL_LANGS.map(({ code, label: langLabel }) => (
                      <div key={code}>
                        <Label className="text-[10px] text-muted-foreground mb-0.5">{langLabel}</Label>
                        <Input
                          value={tile.label[code] || ''}
                          onChange={e => updateTileLabel(index, code, e.target.value)}
                          className="h-7 text-xs"
                          placeholder={langLabel}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Добавить плитку */}
          <Button variant="outline" size="sm" onClick={addTile} className="gap-1.5 w-full text-xs">
            <Plus className="h-3.5 w-3.5" />
            {t('admin.homeScreen.addTile')}
          </Button>
        </div>
      )}

      {/* Сохранить */}
      <Button onClick={handleSave} disabled={updateConfig.isPending} className="gap-2">
        <Save className="h-4 w-4" />
        {updateConfig.isPending ? t('common.saving') : t('admin.homeScreen.save')}
      </Button>
    </div>
  )
}
