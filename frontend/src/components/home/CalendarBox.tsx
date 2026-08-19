import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Panel, SectionHeader } from '../ui'
import { api } from '../../api/client'
import { useClock } from '../../lib/hooks'
import { isCn } from '../../lib/format'

export default function CalendarBox({ maxHeight = 420 }: { maxHeight?: number }) {
  const { t, i18n } = useTranslation()
  const cn = isCn(i18n.language)
  const { today } = useClock()
  const { data } = useQuery({ queryKey: ['calendar'], queryFn: api.getCalendar })

  return (
    <Panel>
      <SectionHeader accent="var(--down)" title={t('nav.calendar')} right={<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'var(--tx3)' }}>{today}</span>} />
      <div style={{ maxHeight, overflowY: 'auto' }}>
        {(data ?? []).map((e, i) => {
          const starColor = e.importance === 3 ? 'var(--up)' : e.importance === 2 ? 'var(--amber)' : 'var(--tx3)'
          const fc = e.forecast && !['nan', 'none', 'null', '—'].includes(e.forecast.trim().toLowerCase()) ? e.forecast : '—'
          return (
            <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'baseline', padding: '7px 12px', borderBottom: '1px solid var(--bd)' }}>
              <span style={{ flex: '0 0 38px', fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: 'var(--tx2)' }}>{e.time}</span>
              <span style={{ flex: '0 0 auto', fontSize: 9, color: starColor, letterSpacing: '.5px' }}>{'★'.repeat(Math.max(0, Math.min(3, e.importance)))}</span>
              <span style={{ flex: '1 1 auto', fontSize: 12 }}>{cn ? e.name_cn : e.name_en}</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: 'var(--tx3)' }}>{fc}</span>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
