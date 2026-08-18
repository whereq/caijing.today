import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, type RangeKey } from '../api/client'
import { Panel, Chip } from '../components/ui'
import { catById } from '../lib/categories'
import { cardTitle, cardSource, isCn, timeAgo, heatLabel, pick } from '../lib/format'

const RANGES: { key: RangeKey; cn: string; en: string }[] = [
  { key: '1h', cn: '1小时', en: '1H' },
  { key: '24h', cn: '24小时', en: '24H' },
  { key: '7d', cn: '本周', en: '7D' },
  { key: '30d', cn: '本月', en: '30D' },
]

export default function Category() {
  const { t, i18n } = useTranslation()
  const cn = isCn(i18n.language)
  const { cat = 'macro' } = useParams()
  const c = catById(cat)

  const [range, setRange] = useState<RangeKey>('24h')
  const [source, setSource] = useState<string>('all')
  const [limit, setLimit] = useState(18)

  const { data: sources } = useQuery({ queryKey: ['sources'], queryFn: api.getSources })
  const { data } = useQuery({
    queryKey: ['category', cat, range, source, limit],
    queryFn: () => api.getByCategory(cat, { range, source: source === 'all' ? undefined : source, limit }),
  })
  const list = data ?? []

  return (
    <div style={{ padding: 10, maxWidth: 1800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Panel>
        <div style={{ padding: '20px 22px', background: c.color, color: '#fff', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: '.12em', opacity: .85 }}>{c.en}</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 2 }}>{c.cn}</div>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, marginTop: 6, opacity: .9 }}>
            {list.length} {cn ? '篇 · 今日更新' : 'stories · updated today'}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '9px 12px', borderBottom: '1px solid var(--bd)', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--tx3)', fontFamily: "'IBM Plex Mono',monospace", marginRight: 2 }}>{t('nav.filterSource')}</span>
          <Chip active={source === 'all'} onClick={() => setSource('all')}>{t('nav.all')}</Chip>
          {(sources ?? []).map((s, i) => {
            const name = cn ? s.name_cn : s.name_en
            return <Chip key={i} active={source === name} onClick={() => setSource(name)}>{name}</Chip>
          })}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '9px 12px', borderBottom: '1px solid var(--bd)', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--tx3)', fontFamily: "'IBM Plex Mono',monospace", marginRight: 2 }}>{t('nav.filterTime')}</span>
          {RANGES.map((r) => (
            <Chip key={r.key} active={range === r.key} onClick={() => setRange(r.key)}>{cn ? r.cn : r.en}</Chip>
          ))}
        </div>

        {list.map((h, i) => (
          <Link key={h.id} to={`/article/${h.id}`} data-hoverbg style={{ display: 'flex', gap: 11, alignItems: 'baseline', padding: '10px 12px', borderBottom: '1px solid var(--bd)', color: 'var(--tx)' }}>
            <span style={{ flex: '0 0 26px', textAlign: 'center', fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 600, color: i < 3 ? c.color : 'var(--tx3)', filter: i < 3 ? 'brightness(1.4)' : 'none' }}>{i + 1}</span>
            <span style={{ flex: '1 1 auto', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 500, lineHeight: 1.4 }}>{cardTitle(h, i18n.language)}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--tx2)', marginTop: 3 }}>{pick(i18n.language, h.summary_cn, h.summary_en)}</span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 5, fontSize: 10.5, color: 'var(--tx3)', fontFamily: "'IBM Plex Mono',monospace" }}>
                <span style={{ color: 'var(--acc)' }}>{cardSource(h, i18n.language)}</span>
                <span>{timeAgo(h.published_at, i18n.language, t)}</span>
                <span>{heatLabel(h.heat)} {t('nav.heatUnit')}</span>
              </span>
            </span>
          </Link>
        ))}

        <div style={{ padding: 14, textAlign: 'center' }}>
          <button
            onClick={() => setLimit((n) => n + 18)}
            data-hoverbg
            style={{ padding: '9px 22px', background: 'var(--panel2)', border: '1px solid var(--bd2)', borderRadius: 2, color: 'var(--tx2)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', minHeight: 40 }}
          >
            {t('nav.loadMore')}
          </button>
        </div>
      </Panel>
    </div>
  )
}
