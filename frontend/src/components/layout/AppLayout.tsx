import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AdminSidebar from './AdminSidebar'
import ComptableSidebar from './ComptableSidebar'
import SecretaireSidebar from './SecretaireSidebar'
import Topbar from './Topbar'
import AiAssistant from '../ai/AiAssistant'

export default function AppLayout() {
  const { user, loading, isSecretaire, isComptable } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const sidebarProps = {
    mobileOpen: mobileMenuOpen,
    onClose: () => setMobileMenuOpen(false),
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {isSecretaire ? (
        <SecretaireSidebar {...sidebarProps} />
      ) : isComptable ? (
        <ComptableSidebar {...sidebarProps} />
      ) : (
        <AdminSidebar {...sidebarProps} />
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar onMenuToggle={() => setMobileMenuOpen((open) => !open)} />
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
        <AiAssistant />
      </div>
    </div>
  )
}
