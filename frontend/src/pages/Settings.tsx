import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Save, Plus, X } from 'lucide-react'
import { useSettings, useUpdateSearchConfig } from '@/hooks/useSettings'

const AI_PROVIDERS = [
  { value: 'none', label: 'None (synonym map fallback)' },
  { value: 'openai', label: 'OpenAI — gpt-4o-mini' },
  { value: 'gemini', label: 'Google Gemini — gemini-1.5-flash' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-m space-y-4">
      <p className="label-m border-b border-hairline pb-2">{title}</p>
      {children}
    </div>
  )
}

export default function Settings() {
  const { data, isLoading } = useSettings()
  const updateMutation = useUpdateSearchConfig()
  const cfg = data?.searchConfig

  const [keywords, setKeywords] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [easyApplyOnly, setEasyApplyOnly] = useState(false)
  const [under10, setUnder10] = useState(false)
  const [searchTime, setSearchTime] = useState('09:00')
  const [summaryTime, setSummaryTime] = useState('22:00')
  const [maxJobs, setMaxJobs] = useState(50)
  const [aiProvider, setAiProvider] = useState('none')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!cfg) return
    setKeywords(cfg.keywords ?? [])
    setEasyApplyOnly(cfg.filters?.easyApplyOnly ?? false)
    setUnder10(cfg.filters?.under10Applicants ?? false)
    setSearchTime(cfg.searchStartTime?.slice(0, 5) ?? '09:00')
    setSummaryTime(cfg.summaryTime?.slice(0, 5) ?? '22:00')
    setMaxJobs(cfg.maxJobsPerSession ?? 50)
    setAiProvider(cfg.aiProvider ?? 'none')
  }, [cfg])

  function addKeyword() {
    const kw = newKeyword.trim()
    if (kw && !keywords.includes(kw)) { setKeywords(k => [...k, kw]); setNewKeyword('') }
  }

  function handleSave() {
    updateMutation.mutate({
      keywords,
      filters: { easyApplyOnly, under10Applicants: under10, timeRange: '24h', jobTypes: ['full_time', 'internship'] },
      searchStartTime: searchTime,
      summaryTime,
      maxJobsPerSession: maxJobs,
      aiProvider,
    }, { onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000) } })
  }

  if (isLoading) {
    return (
      <div className="p-8 animate-pulse space-y-4">
        <div className="h-8 bg-surface-card w-32" />
        <div className="h-48 bg-surface-card" />
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div className="border-b border-hairline pb-5">
        <p className="label-m mb-1 flex items-center gap-2"><SettingsIcon size={11} /> Configuration</p>
        <h1 className="text-2xl font-bold uppercase tracking-wide text-on-dark">Settings</h1>
      </div>

      <Section title="Job Search Keywords">
        <p className="text-xs text-muted font-light">Base keywords — AI expands these with related titles before each session.</p>
        <div className="flex flex-wrap gap-2">
          {keywords.map(kw => (
            <span key={kw} className="flex items-center gap-1.5 bg-surface-elevated border border-hairline text-body text-[11px] uppercase tracking-wider px-2 py-1">
              {kw}
              <button onClick={() => setKeywords(k => k.filter(x => x !== kw))}
                className="text-muted hover:text-[#e22718] transition-colors"><X size={10} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" placeholder="Add keyword (press Enter)"
            value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addKeyword()}
            className="input-m flex-1 text-xs" />
          <button onClick={addKeyword} className="btn-m btn-m-primary py-2 px-4"><Plus size={13} /></button>
        </div>
      </Section>

      <Section title="Search Filters">
        <div className="space-y-3">
          {[
            { checked: easyApplyOnly, setter: setEasyApplyOnly, label: 'Easy Apply only' },
            { checked: under10, setter: setUnder10, label: 'Under 10 applicants only' },
          ].map(({ checked, setter, label }) => (
            <label key={label} className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => setter(!checked)}
                className={`w-4 h-4 border flex-shrink-0 flex items-center justify-center cursor-pointer transition-colors ${checked ? 'bg-m-blue-dark border-m-blue-dark' : 'border-hairline'}`}
              >
                {checked && <span className="text-white text-[8px] font-bold">✓</span>}
              </div>
              <span className="text-xs text-body uppercase tracking-wider group-hover:text-on-dark transition-colors">{label}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Schedule">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="label-m mb-2">Morning search time</p>
            <input type="time" value={searchTime} onChange={e => setSearchTime(e.target.value)} className="input-m" />
          </div>
          <div>
            <p className="label-m mb-2">Daily summary time</p>
            <input type="time" value={summaryTime} onChange={e => setSummaryTime(e.target.value)} className="input-m" />
          </div>
        </div>
        <div>
          <p className="label-m mb-2">Max jobs per session</p>
          <input type="number" min={1} max={200} value={maxJobs}
            onChange={e => setMaxJobs(Number(e.target.value))} className="input-m w-28 text-center" />
        </div>
      </Section>

      <Section title="AI Provider">
        <p className="text-xs text-muted font-light">
          Set <code className="bg-surface-elevated px-1 text-body-strong text-[11px]">OPENAI_API_KEY</code> or{' '}
          <code className="bg-surface-elevated px-1 text-body-strong text-[11px]">GEMINI_API_KEY</code> in <code className="bg-surface-elevated px-1 text-body-strong text-[11px]">backend/.env</code>.
        </p>
        <select value={aiProvider} onChange={e => setAiProvider(e.target.value)} className="select-m w-full">
          {AI_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Section>

      <Section title="Email / SMTP">
        <p className="text-xs text-muted font-light">SMTP settings are configured via environment variables in <code className="bg-surface-elevated px-1 text-body-strong text-[11px]">backend/.env</code>.</p>
        <div className="bg-surface-elevated border border-hairline p-3 font-mono text-[11px] text-muted space-y-1">
          <p>SMTP_HOST · SMTP_PORT · SMTP_USER</p>
          <p>SMTP_PASSWORD · SMTP_FROM · SUMMARY_RECIPIENT_EMAIL</p>
        </div>
      </Section>

      <div className="flex items-center gap-4 pt-2">
        <button onClick={handleSave} disabled={updateMutation.isPending}
          className="btn-m btn-m-primary flex items-center gap-2">
          <Save size={13} />
          {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && <span className="text-[#0fa336] text-[11px] uppercase tracking-wider font-bold">Saved</span>}
      </div>
    </div>
  )
}
