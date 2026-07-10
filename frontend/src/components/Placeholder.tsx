export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-gray-800">{title}</h1>
      <p className="text-gray-500 mt-2">Coming soon…</p>
    </div>
  )
}
