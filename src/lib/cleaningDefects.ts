// Дефекты-модификаторы — % надбавка к цене позиции
export const DEFECT_MODIFIERS = [
  { id: 'oil',    name: 'Масло',     pct: 15 },
  { id: 'wine',   name: 'Вино',      pct: 20 },
  { id: 'blood',  name: 'Кровь',     pct: 25 },
  { id: 'grass',  name: 'Трава',     pct: 10 },
  { id: 'ink',    name: 'Чернила',   pct: 30 },
  { id: 'mud',    name: 'Грязь',     pct: 5  },
  { id: 'rust',   name: 'Ржавчина',  pct: 20 },
  { id: 'paint',  name: 'Краска',    pct: 30 },
  { id: 'wear',   name: 'Износ',     pct: 0  },
  { id: 'tear',   name: 'Разрыв',    pct: 0  },
] as const

export function defectsPctMultiplier(defects: string | null | undefined): number {
  if (!defects) return 1
  const list = defects.split(',').map(s => s.trim())
  let pct = 0
  for (const d of list) {
    const mod = DEFECT_MODIFIERS.find(m => m.name === d)
    if (mod) pct += mod.pct
  }
  return 1 + pct / 100
}
