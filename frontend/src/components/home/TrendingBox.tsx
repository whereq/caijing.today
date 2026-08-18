import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Panel, SectionHeader } from '../ui'
import KeywordChips from '../KeywordChips'

export default function TrendingBox() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <Panel>
      <SectionHeader accent="var(--acc)" title={t('nav.keywords')} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '10px 12px' }}>
        <KeywordChips numbered onPick={(kw) => navigate(`/search?q=${encodeURIComponent(kw)}`)} />
      </div>
    </Panel>
  )
}
