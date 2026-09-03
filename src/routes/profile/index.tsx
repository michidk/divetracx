import { createFileRoute } from '@tanstack/react-router'
import { getProfile } from '@/modules/profile/server/queries'
import { ProfilePage } from './-components/profile-page'

export const Route = createFileRoute('/profile/')({
  loader: () => getProfile(),
  head: () => ({ meta: [{ title: 'Profile · Divetracx' }] }),
  component: ProfileRoute,
})

function ProfileRoute() {
  return <ProfilePage profile={Route.useLoaderData()} />
}
