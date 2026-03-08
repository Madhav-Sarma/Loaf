import { useEffect, useMemo, useState } from 'react'
import { Share2, Smartphone } from 'lucide-react'

import { DownloadIcon } from '@/components/ui/download-icon'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const getIsIos = () => {
  if (typeof navigator === 'undefined') {
    return false
  }

  const ua = navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(ua)
}

const getIsStandalone = () => {
  if (typeof window === 'undefined') {
    return false
  }

  return window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(getIsStandalone)
  const [showIosHelp, setShowIosHelp] = useState(false)

  const isIos = useMemo(getIsIos, [])
  const canInstallFromPrompt = Boolean(deferredPrompt)
  const shouldShowIosInstallHelp = isIos && !isInstalled
  const shouldShowInstallButton = !isInstalled && (canInstallFromPrompt || shouldShowIosInstallHelp)

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      setShowIosHelp(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setDeferredPrompt(null)
      return
    }

    setShowIosHelp((value) => !value)
  }

  if (!shouldShowInstallButton) {
    return null
  }

  return (
    <div className="mx-auto mt-5 max-w-md rounded-3xl border border-orange-300/70 bg-white/80 p-3 shadow-lg shadow-orange-500/15 backdrop-blur">
      <button
        type="button"
        onClick={handleInstallClick}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-amber-500 via-orange-500 to-red-500 px-4 text-sm font-extrabold text-white shadow-md shadow-orange-500/25 transition-transform duration-200 active:scale-[0.98]"
      >
        <DownloadIcon className="text-white" size={18} />
        Install Loaf
      </button>

      {showIosHelp && shouldShowIosInstallHelp ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-left text-sm text-slate-700">
          <p className="font-bold text-slate-900">Add to Home Screen (iPhone/iPad)</p>
          <p className="mt-2 flex items-center gap-2">
            <Share2 className="size-4 text-cyan-600" />
            Tap the Share button in Safari.
          </p>
          <p className="mt-1 flex items-center gap-2">
            <Smartphone className="size-4 text-cyan-600" />
            Choose <span className="font-semibold">Add to Home Screen</span>.
          </p>
        </div>
      ) : null}
    </div>
  )
}
