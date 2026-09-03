import { Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft, LockKeyhole, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AgencyMark } from '@/modules/profile/components/agency-mark'
import {
  addCustomAgency,
  type getAgencies,
  removeCustomAgency,
} from '@/modules/profile/server/agencies'

type Agency = Awaited<ReturnType<typeof getAgencies>>[number]

function AgencyGrid({ agencies }: { agencies: Agency[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {agencies.map((agency) => (
        <li
          key={agency.id}
          className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-card p-3"
        >
          <AgencyMark agency={agency} className="size-14" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{agency.name}</p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {agency.fullName ?? 'Custom agency'}
            </p>
          </div>
          {agency.builtIn ? (
            <LockKeyhole
              size={15}
              className="mr-1 shrink-0 text-muted-foreground"
              aria-label="Built-in agency"
            />
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export function AgenciesPage({ agencies }: { agencies: Agency[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [loginUrl, setLoginUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const builtIn = agencies.filter((agency) => agency.builtIn)
  const custom = agencies.filter((agency) => !agency.builtIn)

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await addCustomAgency({ data: { name, websiteUrl, loginUrl } })
      setName('')
      setWebsiteUrl('')
      setLoginUrl('')
      await router.invalidate()
      setMessage('Agency added. It is now available in agency selectors.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Adding the agency failed')
    } finally {
      setSaving(false)
    }
  }

  async function remove(agency: Agency) {
    if (!window.confirm(`Delete “${agency.name}”?`)) return
    setRemovingId(agency.id)
    setMessage(null)
    try {
      await removeCustomAgency({ data: { agencyId: agency.id } })
      await router.invalidate()
      setMessage(`${agency.name} was deleted.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Deleting the agency failed')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <Link
          to="/settings"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to settings
        </Link>
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Settings
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Agencies</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Built-in agencies include their official mark. Add another organization once,
          then select it on memberships and certifications.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <h2 className="font-semibold">Add a custom agency</h2>
        <form
          onSubmit={(event) => void add(event)}
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <Input
            className="sm:col-span-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Agency or organization name"
            aria-label="Agency name"
            required
            maxLength={120}
          />
          <Input
            type="url"
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
            placeholder="Website URL (optional)"
            aria-label="Website URL"
            maxLength={2_048}
          />
          <Input
            type="url"
            value={loginUrl}
            onChange={(event) => setLoginUrl(event.target.value)}
            placeholder="Member login URL (optional)"
            aria-label="Member login URL"
            maxLength={2_048}
          />
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={saving || !name.trim()}>
              <Plus size={16} aria-hidden="true" /> {saving ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </form>
        <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
          {message}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Built-in agencies · {builtIn.length}
        </h2>
        <AgencyGrid agencies={builtIn} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Custom agencies · {custom.length}
        </h2>
        {custom.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No custom agencies yet.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {custom.map((agency) => (
              <li
                key={agency.id}
                className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <AgencyMark agency={agency} className="size-14" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{agency.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Custom agency</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={removingId === agency.id}
                  onClick={() => void remove(agency)}
                  aria-label={`Delete ${agency.name}`}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
