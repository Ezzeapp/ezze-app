import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './lib/i18n'
import { initTheme } from './stores/themeStore'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import 'dayjs/locale/en'
import 'dayjs/locale/kk'
import 'dayjs/locale/uz'
import 'dayjs/locale/tg'
import 'dayjs/locale/ky'
import 'dayjs/locale/be'
import 'dayjs/locale/uk'
import i18n from './lib/i18n'

// Маппинг app-языков → dayjs-локали
const DAYJS_LOCALE_MAP: Record<string, string> = {
  ru: 'ru', en: 'en', kz: 'kk', uz: 'uz',
  tg: 'tg', ky: 'ky', by: 'be', uk: 'uk',
}

const applyDayjsLocale = (lng: string) => {
  dayjs.locale(DAYJS_LOCALE_MAP[lng] ?? 'ru')
}

// Применить сразу и при каждой смене языка
applyDayjsLocale(i18n.language)
i18n.on('languageChanged', applyDayjsLocale)

initTheme()

// Telegram Mini App: сразу сигнализируем готовность и раскрываем на весь экран
// Делаем это ДО рендера React — до загрузки любых lazy-chunks
if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp
  tg.ready()

  // Тема: берём из Telegram (светлая/тёмная) и переключаем CSS-класс
  const applyTgTheme = () => {
    document.documentElement.classList.toggle('dark', tg.colorScheme === 'dark')
  }
  applyTgTheme()
  tg.onEvent('themeChanged', applyTgTheme)

  // Клиентские страницы (/book, /my, /tg, /cancel) — requestFullscreen() (Bot API 8.0+)
  // Это критично для /book: без этого страница грузится медленно и Telegram
  // фиксирует compact-режим до того как компонент вызовет expand().
  // Для остальных страниц — expand() (мастер-кабинет и т.д.)
  const path = window.location.pathname
  const needsFullscreen = path.startsWith('/book/') || path === '/my' ||
    path.startsWith('/tg') || path.startsWith('/cancel/')
  if (needsFullscreen && typeof tg.requestFullscreen === 'function') {
    tg.requestFullscreen()
  } else {
    tg.expand()
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
