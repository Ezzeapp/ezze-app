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
// Делаем это ДО рендера React — чтобы viewport уже был правильным при первом рендере
if (window.Telegram?.WebApp?.initData) {
  window.Telegram.WebApp.ready()
  window.Telegram.WebApp.expand()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
