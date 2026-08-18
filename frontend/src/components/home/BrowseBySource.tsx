import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Panel, SectionHeader } from '../ui'
import { api } from '../../api/client'
import { CATS } from '../../lib/categories'
import { cardTitle, isCn } from '../../lib/format'

export default function BrowseBySource() {
  const { t, i18n } = useTranslation()
  const cn = isCn(i18n.language)
  const { data: sources } = useQuery({ queryKey: ['sources'], queryFn: api.getSources })
  const { data: pool } = useQuery({ queryKey: ['latest', 'source-pool'], queryFn: () => api.getLatest({ range: '30d', limit: 60 }) })
  const cards = pool ?? []
  const list = sources ?? []

  return (
    <Panel>
      <SectionHeader accent="var(--acc2)" title={t('nav.bySource')} note={`${list.length} ${t('nav.sourcesUnit')}`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))' }}>
        {list.map((s, i) => {
          const name = cn ? s.name_cn : s.name_en
          const color = CATS[i % CATS.length].color
          return (
            <div key={i} style={{ borderRight: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--bd)' }}>
                <span style={{ width: 18, height: 18, display: 'grid', placeItems: 'center', borderRadius: 2, background: color, color: '#fff', fontSize: 10, fontWeight: 700, flex: '0 0 auto' }}>{name[0]}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx)' }}>{name}</span>
                <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, color: 'var(--tx3)' }}>{s.region}</span>
              </div>
              {cards.length > 0 && Array.from({ length: 4 }, (_, j) => cards[(i * 3 + j) % cards.length]).map((it, j) => (
                <Link key={j} to={`/article/${it.id}`} data-hoverbg style={{ display: 'flex', gap: 8, padding: '6px 12px', color: 'var(--tx2)', fontSize: 12, alignItems: 'baseline', borderBottom: '1px solid var(--bd)' }}>
                  <span style={{ flex: '0 0 auto', fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'var(--tx3)' }}>{j + 1}</span>
                  <span style={{ flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cardTitle(it, i18n.language)}</span>
                </Link>
              ))}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
