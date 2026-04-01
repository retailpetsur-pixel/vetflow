'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Configuracion = {
  id: number
  nombre_clinica: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
  logo_url: string | null
}

type Veterinario = {
  id: number
  nombre: string
  cargo: string | null
  rut: string | null
  telefono: string | null
  direccion: string | null
  pin: string
  firma_url: string | null
}

export default function ConfiguracionPage() {
  const [configId, setConfigId] = useState<number | null>(null)
  const [nombreClinica, setNombreClinica] = useState('')
  const [direccionClinica, setDireccionClinica] = useState('')
  const [telefonoClinica, setTelefonoClinica] = useState('')
  const [emailClinica, setEmailClinica] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  const [veterinarios, setVeterinarios] = useState<Veterinario[]>([])
  const [editandoVeterinarioId, setEditandoVeterinarioId] = useState<number | null>(null)

  const [nombreVet, setNombreVet] = useState('')
  const [cargoVet, setCargoVet] = useState('Médico Veterinario')
  const [rutVet, setRutVet] = useState('')
  const [telefonoVet, setTelefonoVet] = useState('')
  const [direccionVet, setDireccionVet] = useState('')
  const [pinVet, setPinVet] = useState('')
  const [firmaUrlVet, setFirmaUrlVet] = useState('')

  const [guardandoConfig, setGuardandoConfig] = useState(false)
  const [guardandoVeterinario, setGuardandoVeterinario] = useState(false)
  const [cargando, setCargando] = useState(true)

  const cardClass =
    'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900'
  const inputClass =
    'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-500 dark:focus:ring-slate-800'
  const buttonPrimary =
    'rounded-xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200'
  const buttonSecondary =
    'rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'

  const cargarConfiguracion = async () => {
    const { data, error } = await supabase
      .from('configuracion')
      .select('*')
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error cargando configuración:', error)
      return
    }

    if (data) {
      const conf = data as Configuracion
      setConfigId(conf.id)
      setNombreClinica(conf.nombre_clinica || '')
      setDireccionClinica(conf.direccion || '')
      setTelefonoClinica(conf.telefono || '')
      setEmailClinica(conf.email || '')
      setLogoUrl(conf.logo_url || '')
    }
  }

  const cargarVeterinarios = async () => {
    const { data, error } = await supabase
      .from('veterinarios')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) {
      console.error('Error cargando veterinarios:', error)
      return
    }

    setVeterinarios((data ?? []) as Veterinario[])
  }

  useEffect(() => {
    const cargar = async () => {
      setCargando(true)
      await Promise.all([cargarConfiguracion(), cargarVeterinarios()])
      setCargando(false)
    }

    cargar()
  }, [])

  const guardarConfiguracion = async () => {
    setGuardandoConfig(true)

    const payload = {
      nombre_clinica: nombreClinica.trim() || null,
      direccion: direccionClinica.trim() || null,
      telefono: telefonoClinica.trim() || null,
      email: emailClinica.trim() || null,
      logo_url: logoUrl.trim() || null,
    }

    let error = null

    if (configId) {
      const respuesta = await supabase
        .from('configuracion')
        .update(payload)
        .eq('id', configId)

      error = respuesta.error
    } else {
      const respuesta = await supabase
        .from('configuracion')
        .insert([payload])
        .select()
        .single()

      error = respuesta.error

      if (!error && respuesta.data) {
        setConfigId(respuesta.data.id)
      }
    }

    setGuardandoConfig(false)

    if (error) {
      console.error(error)
      alert('Error guardando configuración')
      return
    }

    alert('Configuración guardada')
    await cargarConfiguracion()
  }

  const limpiarVeterinario = () => {
    setEditandoVeterinarioId(null)
    setNombreVet('')
    setCargoVet('Médico Veterinario')
    setRutVet('')
    setTelefonoVet('')
    setDireccionVet('')
    setPinVet('')
    setFirmaUrlVet('')
  }

  const guardarVeterinario = async () => {
    if (!nombreVet.trim() || !pinVet.trim()) {
      alert('Debes ingresar nombre y PIN')
      return
    }

    setGuardandoVeterinario(true)

    const payload = {
      nombre: nombreVet.trim(),
      cargo: cargoVet.trim() || 'Médico Veterinario',
      rut: rutVet.trim() || null,
      telefono: telefonoVet.trim() || null,
      direccion: direccionVet.trim() || null,
      pin: pinVet.trim(),
      firma_url: firmaUrlVet.trim() || null,
    }

    let error = null

    if (editandoVeterinarioId) {
      const respuesta = await supabase
        .from('veterinarios')
        .update(payload)
        .eq('id', editandoVeterinarioId)

      error = respuesta.error
    } else {
      const respuesta = await supabase.from('veterinarios').insert([payload])
      error = respuesta.error
    }

    setGuardandoVeterinario(false)

    if (error) {
      console.error(error)
      alert('Error guardando veterinario')
      return
    }

    limpiarVeterinario()
    await cargarVeterinarios()
  }

  const editarVeterinario = (vet: Veterinario) => {
    setEditandoVeterinarioId(vet.id)
    setNombreVet(vet.nombre || '')
    setCargoVet(vet.cargo || 'Médico Veterinario')
    setRutVet(vet.rut || '')
    setTelefonoVet(vet.telefono || '')
    setDireccionVet(vet.direccion || '')
    setPinVet(vet.pin || '')
    setFirmaUrlVet(vet.firma_url || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const eliminarVeterinario = async (id: number, nombre: string) => {
    const confirmar = window.confirm(`¿Eliminar a ${nombre}?`)
    if (!confirmar) return

    const { error } = await supabase.from('veterinarios').delete().eq('id', id)

    if (error) {
      console.error(error)
      alert('Error eliminando veterinario')
      return
    }

    if (editandoVeterinarioId === id) {
      limpiarVeterinario()
    }

    await cargarVeterinarios()
  }

  if (cargando) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl pt-12 text-slate-600 dark:text-slate-300">
          Cargando configuración...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="pt-12">
          <Link
            href="/dashboard"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Volver al dashboard
          </Link>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            ⚙️ Configuración VetFlow
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Clínica, veterinarios y datos para receta.
          </p>
        </div>

        <div className={cardClass}>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Datos de la clínica
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Estos datos se usarán en la receta y en la identidad del sistema.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              className={inputClass}
              placeholder="Nombre clínica"
              value={nombreClinica}
              onChange={(e) => setNombreClinica(e.target.value)}
            />

            <input
              className={inputClass}
              placeholder="Teléfono"
              value={telefonoClinica}
              onChange={(e) => setTelefonoClinica(e.target.value)}
            />

            <input
              className={inputClass}
              placeholder="Dirección"
              value={direccionClinica}
              onChange={(e) => setDireccionClinica(e.target.value)}
            />

            <input
              className={inputClass}
              placeholder="Email"
              value={emailClinica}
              onChange={(e) => setEmailClinica(e.target.value)}
            />
          </div>

          <div className="mt-3">
<input
  type="file"
  accept="image/*"
  onChange={async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const fileName = `logo-${Date.now()}`

    const { data, error } = await supabase.storage
      .from('logos')
      .upload(fileName, file)

if (error) {
  console.error('Error subiendo logo:', error)
  alert(`Error subiendo logo: ${error.message}`)
  return
}

    const { data: publicUrlData } = supabase.storage
      .from('logos')
      .getPublicUrl(fileName)

    setLogoUrl(publicUrlData.publicUrl)
  }}
/>
          </div>

          <div className="mt-4">
            <button
              onClick={guardarConfiguracion}
              disabled={guardandoConfig}
              className={buttonPrimary}
            >
              {guardandoConfig ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        </div>

        <div className={cardClass}>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Veterinarios
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Se usarán en recetas, PIN y datos clínicos.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              className={inputClass}
              placeholder="Nombre"
              value={nombreVet}
              onChange={(e) => setNombreVet(e.target.value)}
            />

            <input
              className={inputClass}
              placeholder="Cargo"
              value={cargoVet}
              onChange={(e) => setCargoVet(e.target.value)}
            />

            <input
              className={inputClass}
              placeholder="RUT"
              value={rutVet}
              onChange={(e) => setRutVet(e.target.value)}
            />

            <input
              className={inputClass}
              placeholder="Teléfono"
              value={telefonoVet}
              onChange={(e) => setTelefonoVet(e.target.value)}
            />

            <input
              className={inputClass}
              placeholder="Dirección"
              value={direccionVet}
              onChange={(e) => setDireccionVet(e.target.value)}
            />

            <input
              className={inputClass}
              placeholder="PIN de 4 dígitos"
              value={pinVet}
              onChange={(e) => setPinVet(e.target.value)}
            />
          </div>

          <div className="mt-3">
            <input
              className={inputClass}
              placeholder="URL firma (opcional)"
              value={firmaUrlVet}
              onChange={(e) => setFirmaUrlVet(e.target.value)}
            />
          </div>



          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={guardarVeterinario}
              disabled={guardandoVeterinario}
              className={buttonPrimary}
            >
              {guardandoVeterinario
                ? 'Guardando...'
                : editandoVeterinarioId
                ? 'Actualizar veterinario'
                : 'Guardar veterinario'}
            </button>

            {editandoVeterinarioId && (
              <button onClick={limpiarVeterinario} className={buttonSecondary}>
                Cancelar
              </button>
            )}
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-6 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <div>Nombre</div>
              <div>Cargo</div>
              <div>RUT</div>
              <div>Teléfono</div>
              <div>PIN</div>
              <div>Acciones</div>
            </div>

            {veterinarios.length > 0 ? (
              veterinarios.map((vet) => (
                <div
                  key={vet.id}
                  className="grid grid-cols-6 items-center border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800"
                >
                  <div className="font-medium">{vet.nombre}</div>
                  <div>{vet.cargo || '-'}</div>
                  <div>{vet.rut || '-'}</div>
                  <div>{vet.telefono || '-'}</div>
                  <div>{vet.pin}</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => editarVeterinario(vet)}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs dark:border-slate-700"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => eliminarVeterinario(vet.id, vet.nombre)}
                      className="rounded-lg border border-rose-300 px-3 py-1 text-xs text-rose-700 dark:border-rose-700 dark:text-rose-300"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                No hay veterinarios cargados.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}