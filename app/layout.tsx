'use client'

import './globals.css'
import { useEffect, useState } from 'react'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [dark, setDark] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('petsur-theme')
    if (saved === 'dark') {
      setDark(true)
    } else if (saved === 'light') {
      setDark(false)
    } else {
      setDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    localStorage.setItem('petsur-theme', dark ? 'dark' : 'light')
  }, [dark, ready])

  return (
    <html lang="es" className={dark ? 'dark' : ''}>
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