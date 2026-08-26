import {
  Banknote,
  ClipboardList,
  FilePlus,
  FileText,
  Layers,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Users,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useI18n } from '../../context/LocaleContext'
import SidebarShell from './SidebarShell'

type SecretaireSidebarProps = {
  mobileOpen: boolean
  onClose: () => void
}

export default function SecretaireSidebar({ mobileOpen, onClose }: SecretaireSidebarProps) {
  const { user } = useAuth()
  const { t } = useI18n()

  const links = [
    { to: '/', label: t.secretaire.home, icon: LayoutDashboard, end: true },
    { to: '/containers', label: t.nav.containers, icon: Package },
    { to: '/clients', label: t.nav.clients, icon: Users },
    { to: '/sales', label: t.nav.sales, icon: ShoppingCart },
    { to: '/stock', label: t.nav.stock, icon: Layers },
    { to: '/invoices', label: t.nav.invoices, icon: FileText },
    { to: '/invoices/generer', label: t.secretaire.generateInvoice, icon: FilePlus },
    { to: '/payments', label: t.nav.payments, icon: Banknote },
    { to: '/settings', label: t.nav.settings, icon: Settings },
  ]

  return (
    <SidebarShell
      mobileOpen={mobileOpen}
      onClose={onClose}
      bgClass="bg-navy-800"
      activeClass="bg-gold-500 text-navy-900"
      accentClass="text-gold-500"
      subtitle={t.secretaire.workspace}
      links={links}
      footerIcon={ClipboardList}
      footerRole={t.secretaire.roleLabel}
      userName={user?.name}
    />
  )
}
