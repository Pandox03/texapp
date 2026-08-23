import type { LucideIcon } from 'lucide-react'
import { X, UserCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useBranding } from '../../context/BrandingContext'
import { useI18n } from '../../context/LocaleContext'

export type SidebarLink = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

type SidebarShellProps = {
  mobileOpen: boolean
  onClose: () => void
  bgClass: string
  activeClass: string
  accentClass?: string
  subtitle: string
  links: SidebarLink[]
  footerIcon: LucideIcon
  footerRole: string
  userName?: string
}

function BrandLogo({ logoUrl, appName }: { logoUrl: string | null; appName: string }) {
  const [hidden, setHidden] = useState(false)

  if (!logoUrl || hidden) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-sm font-bold">
        {appName.slice(0, 2).toUpperCase()}
      </div>
    )
  }

  return (
    <img
      src={logoUrl}
      alt={appName}
      className="h-10 w-10 rounded-lg bg-white object-contain p-1"
      onError={() => setHidden(true)}
    />
  )
}

export default function SidebarShell({
  mobileOpen,
  onClose,
  bgClass,
  activeClass,
  accentClass: _accentClass = 'text-mint-400',
  subtitle,
  links,
  footerIcon: FooterIcon,
  footerRole,
  userName,
}: SidebarShellProps) {
  const { t } = useI18n()
  const { branding } = useBranding()

  function SidebarContent() {
    return (
      <>
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo logoUrl={branding.logo_url} appName={branding.app_name} />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold leading-tight">{branding.app_name}</p>
              <p className="truncate text-xs text-white/60">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-2 text-white/75 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label={t.nav.closeMenu}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? activeClass
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4 text-xs text-white/50">
          <Link
            to="/profile"
            onClick={onClose}
            className="mb-2 flex cursor-pointer items-center gap-2 text-white/75 hover:text-white"
          >
            <UserCircle size={14} />
            {t.auth.myProfile}
          </Link>
          <div className="flex items-center gap-2">
            <FooterIcon size={14} />
            {userName} · {footerRole}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer bg-black/50"
            onClick={onClose}
            aria-label={t.nav.closeMenu}
          />
          <aside
            className={`absolute start-0 top-0 z-50 flex h-full w-72 max-w-[85vw] flex-col shadow-xl ${bgClass} text-white`}
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      <aside className={`hidden h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-border lg:flex ${bgClass} text-white`}>
        <SidebarContent />
      </aside>
    </>
  )
}
