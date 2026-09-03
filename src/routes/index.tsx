import { createFileRoute, redirect } from '@tanstack/react-router'
import { DEMO_MODE } from '@/lib/build-mode'
import { DemoLandingPage } from './-components/demo-landing-page'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (!DEMO_MODE) throw redirect({ to: '/overview' })
  },
  component: DemoLandingPage,
})
