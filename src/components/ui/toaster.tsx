import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors
      mobileOffset={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      toastOptions={{ duration: 6_000 }}
    />
  )
}
