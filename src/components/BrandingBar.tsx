import siteMetadata from '../static/site-metadata'

export function BrandingBar() {
  return (
    <div className="flex items-center gap-2">
      <img src={siteMetadata.logo} alt="avatar" className="w-7 h-7 rounded-full" />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold">JASON.LOG</span>
        <span className="text-[10px] text-[var(--color-muted)]">https://github.com/imjasondai/workouts</span>
      </div>
    </div>
  )
}
