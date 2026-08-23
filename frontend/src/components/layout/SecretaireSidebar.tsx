import {
  Banknote,
  ClipboardList,
  FilePlus,
  FileText,
  Layers,
  LayoutDashboard,
  Package,
  Palette,
  Receipt,
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
    { to: '/fabric-types', label: t.nav.fabricTypes, icon: Palette },
    { to: '/clients', label: t.nav.clients, icon: Users },
    { to: '/sales', label: t.nav.sales, icon: ShoppingCart },
    { to: '/credits/new', label: t.nav.credits, icon: Receipt },
    { to: '/stock', label: t.nav.stock, icon: Layers },
    { to: '/invoices', label: t.nav.invoices, icon: FileText },
    { to: '/invoices/generer', label: t.secretaire.generateInvoice, icon: FilePlus },
    { to: '/payments', label: t.nav.payments, icon: Banknote },
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
