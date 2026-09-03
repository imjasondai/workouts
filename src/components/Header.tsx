import type { SportFilter, Activity } from '../types'
import { WORKOUT_TYPES } from '../types'
import { useLocale } from '../hooks/useLocale'

type Page = 'home' | 'tracks'

interface HeaderProps {
  filter: SportFilter
  setFilter: (f: SportFilter) => void
  dark: boolean
  toggleTheme: () => void
  activities: Activity[]
  page: Page
  onNavigate: (p: Page) => void
}


export function Header({ filter, setFilter, dark, toggleTheme, activities, page, onNavigate }: HeaderProps) {
  const { locale, setLocale, t } = useLocale()

  const existingTypes = new Set(activities.map((a) => a.type))
  const hasGym = WORKOUT_TYPES.some((t) => existingTypes.has(t))

  const allTabs: { label: string; value: SportFilter }[] = [
    { label: t('all'), value: 'all' },
    { label: t('run'), value: 'Run' },
    { label: t('ride'), value: 'Ride' },
    { label: t('hike'), value: 'Hike' },
    { label: t('swim'), value: 'Swim' },
    { label: t('gym'), value: 'Gym' },
  ]
  const tabs = allTabs.filter((tab) => {
    if (tab.value === 'all') return true
    if (tab.value === 'Gym') return hasGym
    return existingTypes.has(tab.value)
  })

  const navItems: { label: string; page: Page }[] = [
    { label: t('home'), page: 'home' },
    { label: t('tracks'), page: 'tracks' },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/70 backdrop-blur-md">
      <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-[var(--color-text)]">
            JASON<span className="text-[var(--color-run)]">.</span>LOG
          </span>
        </div>

        {/* Sport filter tabs */}
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                filter === tab.value && page === 'home'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right nav */}
        <div className="flex items-center gap-4">
          {/* Page nav */}
          {navItems.map((item) => (
            <span
              key={item.label}
              onClick={() => onNavigate(item.page)}
              className={`text-sm cursor-pointer transition-colors ${
                item.page === page
                  ? 'text-[var(--color-accent)] font-medium'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {item.label}
            </span>
          ))}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-card)] transition-colors"
          >
            {dark ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Locale toggle */}
          <button
            onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-card)] transition-colors text-[var(--color-muted)] hover:text-[var(--color-text)] text-xs font-bold"
          >
            {locale === 'zh' ? 'EN' : '中'}
          </button>

        </div>
      </div>
    </header>
  )
}
