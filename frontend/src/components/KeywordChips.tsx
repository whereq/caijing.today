import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { isCn } from '../lib/format'

/** Trending keyword chips. Clicking one calls onPick with the keyword text. */
export default function KeywordChips({ numbered, onPick }: { numbered?: boolean; onPick: (kw: string) => void }) {
  const { i18n } = useTranslation()
  const cn = isCn(i18n.language)
  const { data } = useQuery({ queryKey: ['keywords'], queryFn: api.getKeywords })

  return (
    <>
      {(data ?? []).map((k, i) => {
        const label = cn ? k.cn : k.en
        return (
          <a
            key={i}
            href="#"
            onClick={(e) => { e.preventDefault(); onPick(label) }}
            data-hoverbg
            style={{
              padding: '4px 9px', border: '1px solid var(--bd)', background: 'var(--panel2)',
              borderRadius: 2, fontSize: 11.5, color: 'var(--tx2)',
            }}
          >
            {numbered ? `${i + 1}. ${label}` : label}
          </a>
        )
      })}
    </>
  )
}
