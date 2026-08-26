import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Building2, Palette, Truck, UserCog, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/LocaleContext'
import PageHeader from '../components/ui/PageHeader'
import CompanySettingsPanel from '../components/settings/CompanySettingsPanel'
import ArticlesPanel from '../components/settings/ArticlesPanel'
import FournisseursPanel from '../components/settings/FournisseursPanel'
import ClientsAddPanel from '../components/settings/ClientsAddPanel'
import UsersPanel from '../components/settings/UsersPanel'

type SettingsTab = 'company' | 'articles' | 'fournisseurs' | 'clients' | 'users'

export default function SettingsPage() {
  const { t } = useI18n()
  const { isAdmin } = useAuth()
  const [params, setParams] = useSearchParams()

  const tabs = useMemo(() => {
    const list: { id: SettingsTab; label: string; icon: typeof Building2 }[] = []
    if (isAdmin) {
      list.push({ id: 'company', label: t.settings.tabs.company, icon: Building2 })
    }
    list.push(
      { id: 'articles', label: t.settings.tabs.articles, icon: Palette },
      { id: 'fournisseurs', label: t.settings.tabs.fournisseurs, icon: Truck },
      { id: 'clients', label: t.settings.tabs.clients, icon: Users },
    )
    if (isAdmin) {
      list.push({ id: 'users', label: t.settings.tabs.users, icon: UserCog })
    }
    return list
  }, [isAdmin, t])

  const requested = (params.get('tab') as SettingsTab | null) ?? null
  const active: SettingsTab =
    requested && tabs.some((tab) => tab.id === requested)
      ? requested
      : (tabs[0]?.id ?? 'articles')

  function selectTab(id: SettingsTab) {
    setParams(id === tabs[0]?.id ? {} : { tab: id })
  }

  return (
    <div>
      <PageHeader title={t.settings.title} description={t.settings.description} />

      <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const selected = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                selected
                  ? 'bg-navy-900 text-white'
                  : 'bg-surface text-navy-800 hover:bg-border/60'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {active === 'company' && isAdmin && <CompanySettingsPanel />}
      {active === 'articles' && <ArticlesPanel />}
      {active === 'fournisseurs' && <FournisseursPanel />}
      {active === 'clients' && <ClientsAddPanel />}
      {active === 'users' && isAdmin && <UsersPanel />}
    </div>
  )
}
