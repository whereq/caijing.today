import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import zh from './locales/zh.json'
import { lsSet, lsGet } from '../lib/storage'

const LOCALE_KEY = 'Caijing_locale'

function getInitialLocale(): string {
  const stored = lsGet(LOCALE_KEY)
  if (stored && ['en', 'zh'].includes(stored)) return stored
  const browser = navigator.language.toLowerCase()
  return browser.startsWith('zh') ? 'zh' : 'en'
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, zh: { translation: zh } },
  lng: getInitialLocale(),
  fallbackLng: 'zh',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => lsSet(LOCALE_KEY, lng))

export default i18n
