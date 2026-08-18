import { useTranslation } from 'react-i18next'
import { useClock } from '../lib/hooks'

export default function Footer() {
  const { t } = useTranslation()
  const { clock } = useClock()
  const links = ['about', 'sources', 'data', 'api', 'contact'] as const

  return (
    <footer style={{ flex: '0 0 auto', borderTop: '1px solid var(--bd)', background: 'var(--panel)', zIndex: 40 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '0 12px', height: 34,
        fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: 'var(--tx3)',
        overflowX: 'auto', whiteSpace: 'nowrap',
      }}>
        <span style={{ color: 'var(--tx2)', fontWeight: 600 }}>caijing.today</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 6, height: 6, background: 'var(--down)', display: 'block', borderRadius: '50%' }} />
          {t('nav.live')}
        </span>
        {links.map((l) => (
          <a key={l} href="#" style={{ color: 'var(--tx3)' }}>{t(`foot.${l}`)}</a>
        ))}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center' }}>
          <span>{t('nav.disclaimer')}</span>
          <span style={{ color: 'var(--tx2)' }}>{clock}</span>
        </span>
      </div>
    </footer>
  )
}
