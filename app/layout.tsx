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
        <div className="fixed right-4 top-4 z-50">
          <button
            onClick={() => setDark(!dark)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            {dark ? '☀️ Modo claro' : '🌙 Modo oscuro'}
          </button>
        </div>

        {children}
      </body>
    </html>
  )
}
