import { createRouter } from '@tanstack/react-router'
import { AppRouteError } from '@/components/app-error'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppRouteError,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 15_000,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
