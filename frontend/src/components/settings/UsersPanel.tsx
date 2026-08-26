import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import api from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useI18n } from '../../context/LocaleContext'
import type { Paginated, User } from '../../types'
import Card from '../ui/Card'
import FilterBar from '../ui/FilterBar'

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'secretaire' as User['role'],
}

export default function UsersPanel() {
  const { user: currentUser } = useAuth()
  const { t } = useI18n()
  const [users, setUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    api.get<Paginated<User>>('/users', { params }).then((res) => setUsers(res.data.data))
  }, [filters])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await api.post('/users', form)
      setShowForm(false)
      setForm(emptyForm)
      load()
    } catch {
      setError(t.users.createError)
    }
  }

  async function handleDelete(user: User) {
    if (!window.confirm(t.users.deleteConfirm.replace('{name}', user.name))) return
    try {
      await api.delete(`/users/${user.id}`)
      load()
    } catch {
      setError(t.users.deleteError)
    }
  }

  function roleLabel(role: User['role']) {
    if (role === 'admin') return t.users.roleAdmin
    if (role === 'comptable') return t.users.roleComptable
    return t.users.roleSecretaire
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t.users.description}</p>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus size={16} />
          {t.users.new}
        </button>
      </div>

      <FilterBar
        fields={[
          { key: 'search', label: t.filters.search, type: 'text', placeholder: 'Nom ou e-mail...' },
          {
            key: 'role',
            label: t.users.role,
            type: 'select',
            placeholder: t.common.all,
            options: [
              { value: 'admin', label: t.users.roleAdmin },
              { value: 'secretaire', label: t.users.roleSecretaire },
              { value: 'comptable', label: t.users.roleComptable },
            ],
          },
        ]}
        values={filters}
        onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onReset={() => setFilters({})}
      />

      {showForm && (
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-semibold">{t.users.new}</h2>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">{t.common.name}</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-border px-4 py-3"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.auth.email}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl border border-border px-4 py-3"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.auth.password}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-xl border border-border px-4 py-3"
                minLength={8}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.users.role}</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as User['role'] })}
                className="w-full rounded-xl border border-border px-4 py-3"
              >
                <option value="secretaire">{t.users.roleSecretaire}</option>
                <option value="comptable">{t.users.roleComptable}</option>
                <option value="admin">{t.users.roleAdmin}</option>
              </select>
            </div>
            {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}
            <button
              type="submit"
              className="cursor-pointer rounded-xl bg-navy-900 px-4 py-3 font-semibold text-white md:col-span-2"
            >
              {t.users.save}
            </button>
          </form>
        </Card>
      )}

      {error && !showForm && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="px-3 py-3">{t.common.name}</th>
                <th className="px-3 py-3">{t.auth.email}</th>
                <th className="px-3 py-3">{t.users.role}</th>
                <th className="px-3 py-3">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted">
                    {t.users.noUsers}
                  </td>
                </tr>
              )}
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border/70">
                  <td className="px-3 py-3 font-medium text-navy-900">
                    {user.name}
                    {user.id === currentUser?.id && (
                      <span className="ml-2 text-xs text-muted">({t.users.you})</span>
                    )}
                  </td>
                  <td className="px-3 py-3">{user.email}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        user.role === 'admin'
                          ? 'bg-navy-900 text-white'
                          : user.role === 'comptable'
                            ? 'bg-teal-500/20 text-teal-800'
                            : 'bg-gold-500/20 text-navy-900'
                      }`}
                    >
                      {roleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {user.id !== currentUser?.id && (
                      <button
                        type="button"
                        onClick={() => handleDelete(user)}
                        className="inline-flex cursor-pointer items-center gap-1 text-red-600 hover:underline"
                      >
                        <Trash2 size={14} />
                        {t.users.delete}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
