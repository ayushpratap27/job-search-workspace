export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-8">
      <p className="label-m mb-2">Job Search Workspace</p>
      <h1 className="text-2xl font-bold uppercase tracking-wide text-on-dark">{title}</h1>
      <p className="text-muted text-sm mt-2 font-light">Coming soon…</p>
    </div>
  )
}
