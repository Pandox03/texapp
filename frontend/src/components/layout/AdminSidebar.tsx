import {
  Banknote,
  Box,
  FileText,
  History,
  Layers,
  LayoutDashboard,
  Package,
  Palette,
  Receipt,
  Settings,
  ShoppingCart,
  UserCog,
  Users,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useI18n } from '../../context/LocaleContext'
import SidebarShell from './SidebarShell'

type AdminSidebarProps = {
  mobileOpen: boolean
  onClose: () => void
}

export default function AdminSidebar({ mobileOpen, onClose }: AdminSidebarProps) {
  const { user } = useAuth()
  const { t } = useI18n()

  const links = [
    { to: '/', label: t.nav.dashboard, icon: LayoutDashboard, end: true },
    { to: '/containers', label: t.nav.containers, icon: Package },
    { to: '/stock', label: t.nav.stock, icon: Layers },
    { to: '/fabric-types', label: t.nav.fabricTypes, icon: Palette },
    { to: '/sales', label: t.nav.sales, icon: ShoppingCart },
    { to: '/credits/new', label: t.nav.credits, icon: Receipt },
    { to: '/invoices', label: t.nav.invoices, icon: FileText },
    { to: '/payments', label: t.nav.payments, icon: Banknote },
    { to: '/clients', label: t.nav.clients, icon: Users },
    { to: '/settings', label: t.nav.settings, icon: Settings },
    { to: '/users', label: t.nav.users, icon: UserCog },
    { to: '/logs', label: t.nav.logs, icon: History },
  ]

  return (
    <SidebarShell
      mobileOpen={mobileOpen}
      onClose={onClose}
      bgClass="bg-navy-900"
      activeClass="bg-teal-500 text-white"
      accentClass="text-mint-400"
      subtitle={t.app.importWholesale}
      links={links}
      footerIcon={Box}
      footerRole="Admin"
      userName={user?.name}
    />
  )
}
