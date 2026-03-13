import { useTranslation } from 'react-i18next'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

const LANGUAGES = [
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: 'EN' },
  { code: 'kz', label: 'Қазақша', flag: '🇰🇿' },
  { code: 'uz', label: "O'zbekcha", flag: '🇺🇿' },
  { code: 'tg', label: 'Тоҷикӣ', flag: '🇹🇯' },
  { code: 'ky', label: 'Кыргызча', flag: '🇰🇬' },
  { code: 'by', label: 'Беларуская', flag: '🇧🇾' },
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'kaa', label: 'Қарақалпақша', flag: 'KK' },
]

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title="Language" className="text-base">
          {current.flag}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={lang.code === i18n.language ? 'bg-accent' : ''}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
