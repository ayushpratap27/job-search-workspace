import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Save, Plus, X } from 'lucide-react'
import { useSettings, useUpdateSearchConfig } from '@/hooks/useSettings'

const AI_PROVIDERS = [
  { value: 'none', label: 'None (use synonym map)' },
  { value: 'openai', label: 'OpenAI (gpt-4o-mini)' },
  { value: 'gemini', label: 'Google Gemini (gemini-1.5-flash)' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 mb-1">{children}</label>
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
    if (kw && !keywords.includes(kw)) {
      setKeywords(k => [...k, kw])
      setNewKeyword('')
    }
  }

  function removeKeyword(kw: string) {
    setKeywords(k => k.filter(x => x !== kw))
  }

  function handleSave() {
    updateMutation.mutate({
      keywords,
      filters: { easyApplyOnly, under10Applicants: under10, timeRange: '24h', jobTypes: ['full_time', 'internship'] },
      searchStartTime: searchTime,
      summaryTime,
      maxJobsPerSession: maxJobs,
      aiProvider,
    }, {
      onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000) },
    })
  }

  if (isLoading) {
    return (
      <div className="p-8 animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-32" />
        <div className="h-48 bg-gray-200 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <SettingsIcon size={24} className="text-blue-600" />
        Settings
      </h1>

      <Section title="Job Search Keywords">
        <p className="text-xs text-gray-500">Base keywords — AI expands these with related titles before each session.</p>
        <div className="flex flex-wrap gap-2">
          {keywords.map(kw => (
            <span key={kw} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full">
              {kw}
              <button onClick={() => removeKeyword(kw)} className="hover:text-red-500"><X size={12} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add keyword (press Enter)"
            value={newKeyword}
            onChange={e => setNewKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addKeyword()}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={addKeyword} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus size={16} />
          </button>
        </div>
      </Section>

      <Section title="Search Filters">
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={easyApplyOnly} onChange={e => setEasyApplyOnly(e.target.checked)} className="w-4 h-4 rounded text-blue-600" />
            <span className="text-sm text-gray-700">Easy Apply only</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={under10} onChange={e => setUnder10(e.target.checked)} className="w-4 h-4 rounded text-blue-600" />
            <span className="text-sm text-gray-700">Under 10 applicants only</span>
          </label>
        </div>
      </Section>

      <Section title="Schedule">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Morning search time</Label>
            <input type="time" value={searchTime} onChange={e => setSearchTime(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <Label>Daily summary email time</Label>
            <input type="time" value={summaryTime} onChange={e => setSummaryTime(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <Label>Max jobs per session</Label>
          <input type="number" min={1} max={200} value={maxJobs} onChange={e => setMaxJobs(Number(e.target.value))}
            className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </Section>

      <Section title="AI Provider">
        <p className="text-xs text-gray-500">Set <code className="bg-gray-100 px-1 rounded">OPENAI_API_KEY</code> or <code className="bg-gray-100 px-1 rounded">GEMINI_API_KEY</code> in <code className="bg-gray-100 px-1 rounded">backend/.env</code> to enable AI.</p>
        <select value={aiProvider} onChange={e => setAiProvider(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {AI_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Section>

      <Section title="Email (SMTP)">
        <p className="text-sm text-gray-500">
          SMTP settings are configured via environment variables in{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">backend/.env</code>.
        </p>
        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1 font-mono">
          <p>SMTP_HOST · SMTP_PORT · SMTP_USER</p>
          <p>SMTP_PASSWORD · SMTP_FROM · SUMMARY_RECIPIENT_EMAIL</p>
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Save size={15} />
          {updateMutation.isPending ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
      </div>
    </div>
  )
}
