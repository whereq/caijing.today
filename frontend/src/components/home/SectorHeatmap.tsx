import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Panel, SectionHeader } from '../ui'
import { api } from '../../api/client'
import { isCn } from '../../lib/format'

export default function SectorHeatmap() {
  const { t, i18n } = useTranslation()
  const cn = isCn(i18n.language)
  const { data } = useQuery({ queryKey: ['sectors'], queryFn: api.getSectors })
  const sectors = data ?? []
  const maxAbs = Math.max(1, ...sectors.map((s) => Math.abs(s.change_pct)))

  return (
    <Panel>
      <SectionHeader
        accent="var(--up)"
        title={t('nav.sectors')}
        note={t('nav.sectorNote')}
        right={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, color: 'var(--tx3)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 9, height: 9, background: 'var(--up)', display: 'block' }} />{t('nav.upLabel')}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 9, height: 9, background: 'var(--down)', display: 'block' }} />{t('nav.downLabel')}</span>
          </span>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,96px),1fr))', gap: 1, padding: 1, background: 'var(--bd)' }}>
        {sectors.map((s, i) => {
          const up = s.change_pct > 0
          const m = Math.min(1, Math.abs(s.change_pct) / maxAbs)
          const base = up ? '#e8443a' : '#12a150'
          return (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '9px 10px',
              minHeight: 72, color: '#fff',
              background: `color-mix(in oklab, ${base} ${(28 + m * 62).toFixed(0)}%, var(--panel3))`,
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{cn ? s.name_cn : s.name_en}</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 600, marginTop: 4 }}>{(up ? '+' : '') + s.change_pct.toFixed(2)}%</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, opacity: .75, marginTop: 2 }}>{(up ? '+' : '') + s.inflow.toFixed(1)}{cn ? '亿' : 'e8'}</span>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
