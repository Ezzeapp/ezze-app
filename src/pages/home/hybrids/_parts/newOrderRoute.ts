/** Куда вести по «Новый заказ» — DnD на десктопе, Wizard на мобиле. */
export function getNewOrderRoute(): string {
  if (typeof window === 'undefined') return '/orders/dnd'
  return window.innerWidth >= 1024 ? '/orders/dnd' : '/orders/wizard'
}
