import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CATS } from '../lib/categories'
import { isCn } from '../lib/format'

export default function Drawer({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const cn = isCn(i18n.language)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 90, animation: 'fade .12s ease-out' }}>
      <nav
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 270, maxWidth: '82vw', height: '100%', background: 'var(--panel)',
          borderRight: '1px solid var(--bd2)', animation: 'slidein .16s ease-out',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: 14, borderBottom: '1px solid var(--bd)', background: 'var(--panel2)' }}>
          <span style={{ width: 26, height: 26, background: 'var(--acc2)', display: 'grid', placeItems: 'center', borderRadius: 2, color: '#fff', fontWeight: 700, fontFamily: "'Noto Serif SC',serif" }}>财</span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>财经今日</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', width: 34, height: 34, background: 'none', border: '1px solid var(--bd)', borderRadius: 2, color: 'var(--tx2)', cursor: 'pointer' }}>✕</button>
        </div>
        <Link to="/" onClick={onClose} style={{ padding: '0 14px', minHeight: 46, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--bd)', color: 'var(--tx)', fontSize: 13.5, fontWeight: 600 }}>
          {t('nav.home')}
        </Link>
        {CATS.map((c) => (
          <Link
            key={c.id}
            to={`/category/${c.id}`}
            onClick={onClose}
            data-hoverbg
            style={{ padding: '0 14px', minHeight: 46, display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--bd)', color: 'var(--tx)', fontSize: 13.5 }}
          >
            <span style={{ width: 12, height: 12, background: c.color, display: 'block', borderRadius: 2 }} />
            <span>{cn ? c.cn : c.en}</span>
            <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'var(--tx3)' }}>{c.en}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
