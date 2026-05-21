'use client'

import './globals.css'
import { useEffect, useState } from 'react'

function getInitialTheme() {
  if (typeof window === 'undefined') return false

  const saved = localStorage.getItem('petsur-theme')
  if (saved === 'dark') return true
  if (saved === 'light') return false

  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [dark, setDark] = useState(getInitialTheme)

  useEffect(() => {
    localStorage.setItem('petsur-theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <html lang="es" className={dark ? 'dark' : ''} suppressHydrationWarning>
      <body>
        <div className="fixed right-3 top-3 z-50 sm:right-4 sm:top-4">
          <button
            onClick={() => setDark(!dark)}
            className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50 sm:px-4 sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            {dark ? 'Modo claro' : 'Modo oscuro'}
          </button>
        </div>

        {children}
      </body>
    </html>
  )
}
