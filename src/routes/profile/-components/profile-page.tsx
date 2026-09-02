import { Link } from '@tanstack/react-router'
import { Award, Clock3, Plus, Waves } from 'lucide-react'
import { EntityForm } from '@/components/entity-form'
import { formatDiveDate, formatPersonName } from '@/modules/dives/format'
import type { getProfile } from '@/modules/profile/server/queries'
import { AgencyMembershipList } from './agency-membership-list'
import { CertificationList } from './certification-list'

type ProfileData = Awaited<ReturnType<typeof getProfile>>

function formatHours(seconds: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(
    seconds / 3600,
  )
}

export function ProfilePage({ profile }: { profile: ProfileData }) {
  const { diver, certifications, agencyMemberships, logbook } = profile

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Diver</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          {diver ? formatPersonName(diver) : 'Profile'}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {logbook.firstDiveDate
            ? `Diving since ${formatDiveDate(logbook.firstDiveDate)}`
            : 'Your personal details, emergency information, and certifications.'}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-5">
          <Waves className="text-primary" size={20} aria-hidden="true" />
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Logged dives
          </p>
          <p className="mt-1 text-xl font-semibold">
            {logbook.totalDives.toLocaleString()}
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-5">
          <Clock3 className="text-primary" size={20} aria-hidden="true" />
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Bottom time
          </p>
          <p className="mt-1 text-xl font-semibold">
            {formatHours(logbook.totalSeconds)} h
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-5">
          <Award className="text-primary" size={20} aria-hidden="true" />
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Certifications
          </p>
          <p className="mt-1 text-xl font-semibold">{certifications.length}</p>
        </article>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Agency memberships
          </h2>
          <Link
            to="/profile/agencies/$agencyMembershipId"
            params={{ agencyMembershipId: 'new' }}
            className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <Plus size={15} aria-hidden="true" /> Add agency
          </Link>
        </div>
        {agencyMemberships.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No agency memberships yet.
          </p>
        ) : (
          <AgencyMembershipList memberships={agencyMemberships} />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]">
        <section>
          <CertificationList certifications={certifications} />
        </section>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Personal details
          </h2>
          {diver ? (
            <EntityForm entity="divers" recordId={diver.id} record={diver} />
          ) : (
            <EntityForm entity="divers" recordId="new" record={null} />
          )}
        </div>
      </div>
    </div>
  )
}
