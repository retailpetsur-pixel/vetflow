'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

type Paciente = {
  id: number
  nombre: string
  especie: string
  tutor_id: number
  tutores?: {
    nombre: string
    telefono?: string | null
  } | null
}

type Atencion = {
  id: number
  descripcion: string
  created_at: string
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

type Receta = {
  id: number
  fecha: string
  diagnostico: string | null
  tratamiento: string
  indicaciones: string | null
  observaciones: string | null
  veterinarios?: {
    nombre: string
    cargo: string | null
    rut: string | null
  } | null
}

type Configuracion = {
  id: number
  nombre_clinica: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
  logo_url: string | null
}

function fechaHoyISO() {
  const now = new Date()
  const tzOffset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - tzOffset).toISOString().split('T')[0]
}

function formatFecha(fecha: string) {
  const d = new Date(`${fecha}T00:00:00`)
  return d.toLocaleDateString('es-CL')
}

export default function FichaPacientePage() {
  const params = useParams()
  const id = params.id as string

  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [atenciones, setAtenciones] = useState<Atencion[]>([])
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [veterinarios, setVeterinarios] = useState<Veterinario[]>([])
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null)

  const [nuevaAtencion, setNuevaAtencion] = useState('')
  const [motivoVisita, setMotivoVisita] = useState('')
  const [anamnesis, setAnamnesis] = useState('')
  const [examenClinico, setExamenClinico] = useState('')
  const [inyectablesProcedimientos, setInyectablesProcedimientos] = useState('')
  const [tratamientoAtencion, setTratamientoAtencion] = useState('')
  const [indicacionesAtencion, setIndicacionesAtencion] = useState('')
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [mostrarReceta, setMostrarReceta] = useState(false)
  const [guardandoReceta, setGuardandoReceta] = useState(false)

  const [fechaReceta, setFechaReceta] = useState(fechaHoyISO())
  const [veterinarioId, setVeterinarioId] = useState('')
  const [pinIngresado, setPinIngresado] = useState('')
  const [diagnostico, setDiagnostico] = useState('')
  const [tratamiento, setTratamiento] = useState('')
  const [indicaciones, setIndicaciones] = useState('')
  const [observaciones, setObservaciones] = useState('')

  const [recetaGenerada, setRecetaGenerada] = useState(false)
  const [ultimaRecetaId, setUltimaRecetaId] = useState<number | null>(null)

  const recetaRef = useRef<HTMLDivElement | null>(null)
  const recetaSectionRef = useRef<HTMLDivElement | null>(null)

  const cardClass =
    'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900'
  const inputClass =
    'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-500 dark:focus:ring-slate-800'

  const veterinarioSeleccionado = useMemo(() => {
    return veterinarios.find((v) => String(v.id) === veterinarioId) || null
  }, [veterinarioId, veterinarios])

  const irAReceta = () => {
    setTimeout(() => {
      recetaSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 100)
  }

  const cargarPaciente = async () => {
    const { data, error } = await supabase
      .from('pacientes')
      .select(`
        id,
        nombre,
        especie,
        tutor_id,
        tutores ( nombre, telefono )
      `)
      .eq('id', Number(id))
      .single()

    if (error) {
      console.error('Error cargando paciente:', error)
      setPaciente(null)
      return
    }

    setPaciente(data ? ((data as unknown) as Paciente) : null)
  }

const cargarConfiguracion = async () => {
  const { data, error } = await supabase
    .from('configuracion')
    .select('*')
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error cargando configuración:', error)
    setConfiguracion(null)
    return
  }

  setConfiguracion(data ? (data as Configuracion) : null)
}

  const cargarAtenciones = async () => {
    const { data, error } = await supabase
      .from('atenciones')
      .select('*')
      .eq('paciente_id', Number(id))
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error cargando atenciones:', error)
      setAtenciones([])
      return
    }

    setAtenciones(data ? ((data as unknown) as Atencion[]) : [])
  }

  const cargarVeterinarios = async () => {
    const { data, error } = await supabase
      .from('veterinarios')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) {
      console.error('Error cargando veterinarios:', error)
      setVeterinarios([])
      return
    }

    setVeterinarios((data ?? []) as Veterinario[])
  }

  const cargarRecetas = async () => {
    const { data, error } = await supabase
      .from('recetas')
      .select(`
        id,
        fecha,
        diagnostico,
        tratamiento,
        indicaciones,
        observaciones,
        veterinarios (
          nombre,
          cargo,
          rut
        )
      `)
      .eq('paciente_id', Number(id))
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error cargando recetas:', error)
      setRecetas([])
      return
    }

    const listaRecetas = ((data ?? []) as unknown) as Receta[]
    setRecetas(listaRecetas)
  }

const guardarAtencion = async () => {
  const descripcionFinal = `
Motivo de visita:
${motivoVisita.trim()}

Anamnesis:
${anamnesis.trim()}

Examen clínico:
${examenClinico.trim()}

Inyectables / procedimientos:
${inyectablesProcedimientos.trim()}

Tratamiento:
${tratamientoAtencion.trim()}

Indicaciones / plan:
${indicacionesAtencion.trim()}
  `.trim()

  if (!descripcionFinal.replace(/\s/g, '')) {
    alert('Completa al menos un campo de la atención')
    return
  }

  setGuardando(true)

  const { error } = await supabase.from('atenciones').insert([
    {
      paciente_id: Number(id),
      descripcion: descripcionFinal,
    },
  ])

  setGuardando(false)

  if (error) {
    console.error(error)
    alert('Error guardando atención')
    return
  }

  setNuevaAtencion('')
  setMotivoVisita('')
  setAnamnesis('')
  setExamenClinico('')
  setInyectablesProcedimientos('')
  setTratamientoAtencion('')
  setIndicacionesAtencion('')

  await cargarAtenciones()
}

  const limpiarFormularioReceta = () => {
    setFechaReceta(fechaHoyISO())
    setVeterinarioId('')
    setPinIngresado('')
    setDiagnostico('')
    setTratamiento('')
    setIndicaciones('')
    setObservaciones('')
    setRecetaGenerada(false)
    setUltimaRecetaId(null)
  }

  const generarReceta = async () => {
    if (!veterinarioId || !tratamiento.trim()) {
      alert('Debes seleccionar veterinario y escribir el tratamiento')
      return
    }

    if (!veterinarioSeleccionado) {
      alert('Veterinario no encontrado')
      return
    }

    if (pinIngresado.trim() !== veterinarioSeleccionado.pin) {
      alert('PIN incorrecto')
      return
    }

    setGuardandoReceta(true)

    const { data, error } = await supabase
      .from('recetas')
      .insert([
        {
          paciente_id: Number(id),
          veterinario_id: Number(veterinarioId),
          fecha: fechaReceta,
          diagnostico: diagnostico.trim() || null,
          tratamiento: tratamiento.trim(),
          indicaciones: indicaciones.trim() || null,
          observaciones: observaciones.trim() || null,
        },
      ])
      .select()
      .single()

    setGuardandoReceta(false)

    if (error) {
      console.error('Error generando receta:', error)
      alert(`Error generando receta: ${error.message}`)
      return
    }

    setUltimaRecetaId(data?.id ?? null)
    setRecetaGenerada(true)
    await cargarRecetas()
  }

  const prepararRecetaParaExportar = () => {
    if (!recetaRef.current) return null

    const elemento = recetaRef.current

    const prevBackground = elemento.style.background
    const prevColor = elemento.style.color
    const prevBoxShadow = elemento.style.boxShadow
    const prevBorder = elemento.style.border

    elemento.style.background = '#ffffff'
    elemento.style.color = '#111827'
    elemento.style.boxShadow = 'none'
    elemento.style.border = '1px solid #e5e7eb'

    const hijos = elemento.querySelectorAll('*')
    const anteriores: Array<{
      el: HTMLElement
      color: string
      background: string
      borderColor: string
    }> = []

    hijos.forEach((node) => {
      const el = node as HTMLElement
      anteriores.push({
        el,
        color: el.style.color,
        background: el.style.background,
        borderColor: el.style.borderColor,
      })

      el.style.color = '#111827'
      el.style.borderColor = '#cbd5e1'
    })

    return () => {
      elemento.style.background = prevBackground
      elemento.style.color = prevColor
      elemento.style.boxShadow = prevBoxShadow
      elemento.style.border = prevBorder

      anteriores.forEach(({ el, color, background, borderColor }) => {
        el.style.color = color
        el.style.background = background
        el.style.borderColor = borderColor
      })
    }
  }

  const descargarImagen = async () => {
    if (!recetaRef.current) {
      alert('No se encontró la receta para exportar')
      return
    }

    const restaurar = prepararRecetaParaExportar()

    try {
      const canvas = await html2canvas(recetaRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: recetaRef.current.scrollWidth,
        windowHeight: recetaRef.current.scrollHeight,
      })

      const dataUrl = canvas.toDataURL('image/png', 1.0)
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `receta-${paciente?.nombre || 'paciente'}-${fechaReceta}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error descargando imagen:', error)
      alert(
        `No se pudo descargar la imagen: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`
      )
    } finally {
      if (restaurar) restaurar()
    }
  }

  const descargarPDF = async () => {
    if (!recetaRef.current) {
      alert('No se encontró la receta para exportar')
      return
    }

    const restaurar = prepararRecetaParaExportar()

    try {
      const canvas = await html2canvas(recetaRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: recetaRef.current.scrollWidth,
        windowHeight: recetaRef.current.scrollHeight,
      })

      const imgData = canvas.toDataURL('image/png', 1.0)

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pdfWidth = 210
      const pdfHeight = 297
      const margin = 10
      const usableWidth = pdfWidth - margin * 2
      const imgHeight = (canvas.height * usableWidth) / canvas.width

      if (imgHeight <= pdfHeight - margin * 2) {
        pdf.addImage(imgData, 'PNG', margin, margin, usableWidth, imgHeight)
      } else {
        let heightLeft = imgHeight
        let position = 0

        pdf.addImage(imgData, 'PNG', margin, margin + position, usableWidth, imgHeight)
        heightLeft -= pdfHeight - margin * 2

        while (heightLeft > 0) {
          position = heightLeft - imgHeight
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', margin, margin + position, usableWidth, imgHeight)
          heightLeft -= pdfHeight - margin * 2
        }
      }

      const nombreArchivo = `receta-${paciente?.nombre || 'paciente'}-${fechaReceta}.pdf`
      pdf.save(nombreArchivo)
    } catch (error) {
      console.error('Error descargando PDF:', error)
      alert(
        `No se pudo descargar el PDF: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`
      )
    } finally {
      if (restaurar) restaurar()
    }
  }

  const compartirReceta = async () => {
    if (!recetaRef.current) {
      alert('No se encontró la receta para compartir')
      return
    }

    const restaurar = prepararRecetaParaExportar()

    try {
      const canvas = await html2canvas(recetaRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: recetaRef.current.scrollWidth,
        windowHeight: recetaRef.current.scrollHeight,
      })

      const dataUrl = canvas.toDataURL('image/png')
      const response = await fetch(dataUrl)
      const blob = await response.blob()

      const nombreArchivo = `receta-${paciente?.nombre || 'paciente'}-${fechaReceta}.png`
      const file = new File([blob], nombreArchivo, { type: 'image/png' })

      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean
      }

      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({
          title: `Receta ${paciente?.nombre || ''}`,
          text: 'Receta médica veterinaria',
          files: [file],
        })
        return
      }

      alert('Compartir directo no está disponible en este dispositivo o navegador. Usa Descargar PDF o Descargar imagen.')
    } catch (error) {
      console.error('Error compartiendo receta:', error)
      alert('No se pudo compartir la receta')
    } finally {
      if (restaurar) restaurar()
    }
  }

  useEffect(() => {
    const cargar = async () => {
      setLoading(true)
      await Promise.all([
        cargarPaciente(),
        cargarAtenciones(),
        cargarVeterinarios(),
        cargarRecetas(),
        cargarConfiguracion(),
      ])
      setLoading(false)
    }

    cargar()
  }, [id])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 dark:bg-slate-950">
        <div className="mx-auto max-w-5xl pt-12 text-slate-600 dark:text-slate-300">
          Cargando ficha...
        </div>
      </main>
    )
  }

  if (!paciente) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 dark:bg-slate-950">
        <div className="mx-auto max-w-5xl pt-12">
          <p className="text-slate-700 dark:text-slate-200">Paciente no encontrado</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-blue-600 hover:underline dark:text-blue-400"
          >
            Volver
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl space-y-6 pt-12">
        <Link
          href="/dashboard"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Volver al dashboard
        </Link>

        <div className={cardClass}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Ficha clínica de {paciente.nombre}
              </h1>

              <div className="mt-6 grid grid-cols-1 gap-4 text-slate-700 dark:text-slate-300 md:grid-cols-2">
                <div className="space-y-2">
                  <p><strong>ID:</strong> {paciente.id}</p>
                  <p><strong>Nombre:</strong> {paciente.nombre}</p>
                  <p><strong>Especie:</strong> {paciente.especie}</p>
                </div>

                <div className="space-y-2">
                  <p><strong>Tutor:</strong> {paciente.tutores?.nombre || '-'}</p>
                  <p><strong>Teléfono:</strong> {paciente.tutores?.telefono || '-'}</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setMostrarReceta(true)
                setRecetaGenerada(false)
                setUltimaRecetaId(null)
                irAReceta()
              }}
              className="rounded-xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Emitir receta
            </button>
          </div>
        </div>

<div className={cardClass}>
  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
    Nueva atención
  </h2>

  <div className="mt-4 grid grid-cols-1 gap-4">
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
        Motivo de visita
      </label>
      <input
        className={inputClass}
        placeholder="Ej: control, vómitos, diarrea, cojera, dermatológico..."
        value={motivoVisita}
        onChange={(e) => setMotivoVisita(e.target.value)}
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
        Anamnesis
      </label>
      <textarea
        className={`${inputClass} min-h-[110px]`}
        placeholder="Resumen de lo que refiere el tutor..."
        value={anamnesis}
        onChange={(e) => setAnamnesis(e.target.value)}
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
        Examen clínico
      </label>
      <textarea
        className={`${inputClass} min-h-[110px]`}
        placeholder="T°, FC, FR, mucosas, hidratación, dolor, hallazgos..."
        value={examenClinico}
        onChange={(e) => setExamenClinico(e.target.value)}
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
        Inyectables / procedimientos
      </label>
      <textarea
        className={`${inputClass} min-h-[100px]`}
        placeholder="Ej: Cerenia 1 mg/kg SC, meloxicam, fluidoterapia, curación..."
        value={inyectablesProcedimientos}
        onChange={(e) => setInyectablesProcedimientos(e.target.value)}
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
        Tratamiento
      </label>
      <textarea
        className={`${inputClass} min-h-[110px]`}
        placeholder="Tratamiento indicado en consulta..."
        value={tratamientoAtencion}
        onChange={(e) => setTratamientoAtencion(e.target.value)}
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
        Indicaciones / plan
      </label>
      <textarea
        className={`${inputClass} min-h-[110px]`}
        placeholder="Controles, exámenes, reposo, dieta, indicaciones al tutor..."
        value={indicacionesAtencion}
        onChange={(e) => setIndicacionesAtencion(e.target.value)}
      />
    </div>
  </div>

  <button
    onClick={guardarAtencion}
    disabled={guardando}
    className="mt-6 rounded-xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
  >
    {guardando ? 'Guardando...' : 'Guardar atención'}
  </button>
</div>

        <div className={cardClass}>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Historial clínico
          </h2>

          <div className="mt-4 space-y-3">
            {atenciones.length > 0 ? (
              atenciones.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                >
                  <div className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                  <div className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                    {a.descripcion}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 dark:text-slate-400">
                Sin atenciones registradas.
              </p>
            )}
          </div>
        </div>

        <div className={cardClass}>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Recetas emitidas
          </h2>

          <div className="mt-4 space-y-3">
            {recetas.length > 0 ? (
              recetas.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                >
                  <div className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                    {formatFecha(r.fecha)}
                  </div>
                  <div className="text-slate-800 dark:text-slate-200">
                    <div><strong>Veterinario:</strong> {r.veterinarios?.nombre || '-'}</div>
                    {r.diagnostico ? <div><strong>Diagnóstico:</strong> {r.diagnostico}</div> : null}
                    <div className="mt-2 whitespace-pre-wrap"><strong>Tratamiento:</strong> {r.tratamiento}</div>
                    {r.indicaciones ? (
                      <div className="mt-2 whitespace-pre-wrap"><strong>Indicaciones:</strong> {r.indicaciones}</div>
                    ) : null}
                    {r.observaciones ? (
                      <div className="mt-2 whitespace-pre-wrap"><strong>Observaciones:</strong> {r.observaciones}</div>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 dark:text-slate-400">
                Sin recetas emitidas.
              </p>
            )}
          </div>
        </div>

        {mostrarReceta && (
          <div ref={recetaSectionRef} className={cardClass}>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Emitir receta médica
              </h2>

              <button
                onClick={() => {
                  setMostrarReceta(false)
                  limpiarFormularioReceta()
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                type="date"
                className={inputClass}
                value={fechaReceta}
                onChange={(e) => setFechaReceta(e.target.value)}
              />

              <select
                className={inputClass}
                value={veterinarioId}
                onChange={(e) => setVeterinarioId(e.target.value)}
              >
                <option value="">Selecciona veterinario</option>
                {veterinarios.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Veterinarios cargados: {veterinarios.length}
            </div>

            <div className="mt-3">
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                className={inputClass}
                placeholder="PIN de 4 dígitos"
                value={pinIngresado}
                onChange={(e) => setPinIngresado(e.target.value)}
              />
            </div>

            <div className="mt-3">
              <input
                className={inputClass}
                placeholder="Diagnóstico"
                value={diagnostico}
                onChange={(e) => setDiagnostico(e.target.value)}
              />
            </div>

            <div className="mt-3">
              <textarea
                className={`${inputClass} min-h-[120px]`}
                placeholder="Tratamiento / medicamentos"
                value={tratamiento}
                onChange={(e) => setTratamiento(e.target.value)}
              />
            </div>

            <div className="mt-3">
              <textarea
                className={`${inputClass} min-h-[100px]`}
                placeholder="Indicaciones"
                value={indicaciones}
                onChange={(e) => setIndicaciones(e.target.value)}
              />
            </div>

            <div className="mt-3">
              <textarea
                className={`${inputClass} min-h-[100px]`}
                placeholder="Observaciones"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={generarReceta}
                disabled={guardandoReceta}
                className="rounded-xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {guardandoReceta ? 'Generando...' : 'Generar receta'}
              </button>

              {recetaGenerada && (
                <>
                  <button
                    onClick={descargarPDF}
                    className="rounded-xl border border-slate-300 px-4 py-3 font-medium dark:border-slate-700"
                  >
                    Descargar PDF
                  </button>

                  <button
                    onClick={descargarImagen}
                    className="rounded-xl border border-slate-300 px-4 py-3 font-medium dark:border-slate-700"
                  >
                    Descargar imagen
                  </button>

                  <button
                    onClick={compartirReceta}
                    className="rounded-xl border border-slate-300 px-4 py-3 font-medium dark:border-slate-700"
                  >
                    Compartir
                  </button>
                </>
              )}
            </div>

            {recetaGenerada && (
              <div className="mt-6">
                <div
                  ref={recetaRef}
                  className="mx-auto max-w-[800px] rounded-2xl bg-white p-8 text-slate-800"
                >
                  <div className="mb-8 flex items-start justify-between gap-6">
<div>
  {configuracion?.logo_url ? (
    <img
      src={configuracion.logo_url}
      alt="Logo"
      className="h-12 mb-2"
    />
  ) : (
    <div className="text-3xl">🐾</div>
  )}

<div className="mt-2 text-2xl font-bold text-indigo-700">
  {configuracion?.nombre_clinica || 'Nombre Clínica'}
</div>

<div className="mt-1 text-base font-semibold">
  🐾 VetFlow
</div>

<div className="text-xs text-slate-500">
  Powered by Petsur@
</div>

  <div className="mt-3 text-sm text-slate-600">
    {configuracion?.direccion || ''}
  </div>

  <div className="text-sm text-slate-600">
    {configuracion?.telefono || ''}
  </div>

  <div className="text-sm text-slate-600">
    {configuracion?.email || ''}
  </div>
</div>

                    <div className="text-right text-sm">
                      <div><strong>Dr/a.</strong> {veterinarioSeleccionado?.nombre || '-'}</div>
                      <div><strong>Cargo:</strong> {veterinarioSeleccionado?.cargo || '-'}</div>
                      <div><strong>RUT:</strong> {veterinarioSeleccionado?.rut || '-'}</div>
                      <div><strong>Teléfono:</strong> {veterinarioSeleccionado?.telefono || '-'}</div>
                      <div><strong>Dirección:</strong> {veterinarioSeleccionado?.direccion || '-'}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border-2 border-indigo-500 p-5">
                    <div className="text-lg font-bold text-indigo-700">Tutor / Paciente</div>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div><strong>Tutor:</strong> {paciente.tutores?.nombre || '-'}</div>
                      <div><strong>Teléfono:</strong> {paciente.tutores?.telefono || '-'}</div>
                      <div><strong>Paciente:</strong> {paciente.nombre}</div>
                      <div><strong>Especie:</strong> {paciente.especie}</div>
                    </div>
                  </div>

                  <div className="mt-8 space-y-4">
                    {diagnostico ? (
                      <div>
                        <div className="font-bold text-indigo-700">Diagnóstico</div>
                        <div className="mt-1 whitespace-pre-wrap">{diagnostico}</div>
                      </div>
                    ) : null}

                    <div>
                      <div className="font-bold text-indigo-700">Tratamiento</div>
                      <div className="mt-1 whitespace-pre-wrap">{tratamiento}</div>
                    </div>

                    {indicaciones ? (
                      <div>
                        <div className="font-bold text-indigo-700">Indicaciones</div>
                        <div className="mt-1 whitespace-pre-wrap">{indicaciones}</div>
                      </div>
                    ) : null}

                    {observaciones ? (
                      <div>
                        <div className="font-bold text-indigo-700">Observaciones</div>
                        <div className="mt-1 whitespace-pre-wrap">{observaciones}</div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-16 flex items-end justify-between">
                    <div>
                      <div className="font-bold text-indigo-700">Fecha</div>
                      <div>{formatFecha(fechaReceta)}</div>
                    </div>

                    <div className="text-right">
                      <div className="mb-6 text-4xl text-indigo-600">✍️</div>
                      <div className="border-t border-indigo-400 pt-2 font-bold text-indigo-700">
                        {veterinarioSeleccionado?.nombre || '-'}
                      </div>
                      <div>{veterinarioSeleccionado?.rut || '-'}</div>
                    </div>
                  </div>

                  {ultimaRecetaId ? (
                    <div className="mt-8 text-xs text-slate-400">
                      N° receta: {ultimaRecetaId}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}