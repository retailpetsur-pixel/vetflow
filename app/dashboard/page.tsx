'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Tutor = {
  id: number
  nombre: string
  telefono?: string | null
}

type Paciente = {
  id: number
  nombre: string
  especie: string
  edad?: string | null
  peso?: number | null
  tutor_id: number
  tutores?: {
    nombre: string
    telefono?: string | null
  } | null
}

type Cita = {
  id: number
  fecha: string
  hora: string
  paciente_id: number | null
  veterinario: string
  motivo: string
  estado: string
  es_paciente_nuevo?: boolean | null
  nombre_tutor?: string | null
  telefono_tutor?: string | null
  nombre_mascota?: string | null
  especie_mascota?: string | null
  pacientes?: {
    id: number
    nombre: string
    especie: string
    edad?: string | null
    peso?: number | null
    tutores?: {
      nombre: string
      telefono?: string | null
    } | null
  } | null
}

type VistaAgenda = 'dia' | 'semana' | 'mes'
type ModoReserva = 'existente' | 'nuevo'

const veterinarios = ['Dra. Colin', 'Dra. Bravo']
const estadosCita = [
  'Agendada',
  'Confirmada',
  'En espera',
  'En atención',
  'Finalizada',
  'Cancelada',
  'No asistió',
]
const especiesBase = ['Gato', 'Perro', 'Ave', 'Cuyi', 'Hamster', 'Erizo', 'Otro']
const motivosBase = ['Control', 'Atención', 'Cirugía', 'Exámenes', 'Otro']

function generarHoras() {
  const horas: string[] = []
  for (let h = 11; h <= 20; h++) {
    for (let m = 0; m < 60; m += 15) {
      horas.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return horas
}

const horasBase = generarHoras()

function hoyLocalISO() {
  const ahora = new Date()
  const tzOffset = ahora.getTimezoneOffset() * 60000
  return new Date(ahora.getTime() - tzOffset).toISOString().split('T')[0]
}

function parseISODate(fecha: string) {
  const [year, month, day] = fecha.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toISODate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateLabel(fecha: string) {
  const date = parseISODate(fecha)
  return date.toLocaleDateString('es-CL', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })
}

function formatLongDate(fecha: string) {
  const date = parseISODate(fecha)
  return date.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function formatMonthLabel(fecha: string) {
  const date = parseISODate(fecha)
  return date.toLocaleDateString('es-CL', {
    month: 'long',
    year: 'numeric',
  })
}

function getWeekStart(date: Date) {
  const copy = new Date(date)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function getWeekDays(baseDateISO: string) {
  const start = getWeekStart(parseISODate(baseDateISO))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return toISODate(d)
  })
}

function getMonthGrid(baseDateISO: string) {
  const base = parseISODate(baseDateISO)
  const firstDayOfMonth = new Date(base.getFullYear(), base.getMonth(), 1)
  const start = getWeekStart(firstDayOfMonth)

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function getEstadoClasses(estado: string) {
  switch (estado) {
    case 'Agendada':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
    case 'Confirmada':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    case 'En espera':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    case 'En atención':
      return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
    case 'Finalizada':
      return 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
    case 'Cancelada':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
    case 'No asistió':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
  }
}

function nombreVisibleCita(cita: Cita) {
  return cita.pacientes?.nombre || cita.nombre_mascota || 'Sin nombre'
}

function especieVisibleCita(cita: Cita) {
  return cita.pacientes?.especie || cita.especie_mascota || '-'
}

function tutorVisibleCita(cita: Cita) {
  return cita.pacientes?.tutores?.nombre || cita.nombre_tutor || '-'
}

export default function Dashboard() {
  const [tutores, setTutores] = useState<Tutor[]>([])
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [citas, setCitas] = useState<Cita[]>([])

  const [busqueda, setBusqueda] = useState('')
  const [busquedaPacienteInput, setBusquedaPacienteInput] = useState('')
  const [busquedaTutorInput, setBusquedaTutorInput] = useState('')
  const [mostrarSugerenciasPaciente, setMostrarSugerenciasPaciente] = useState(false)
  const [mostrarSugerenciasTutor, setMostrarSugerenciasTutor] = useState(false)

  const [nombrePaciente, setNombrePaciente] = useState('')
  const [especie, setEspecie] = useState('')
  const [especieOtra, setEspecieOtra] = useState('')
  const [edadPaciente, setEdadPaciente] = useState('')
  const [pesoPaciente, setPesoPaciente] = useState('')
  const [nombreTutor, setNombreTutor] = useState('')
  const [telefonoTutor, setTelefonoTutor] = useState('')
  const [editandoPacienteId, setEditandoPacienteId] = useState<number | null>(null)
  const [citaPendienteCrearFichaId, setCitaPendienteCrearFichaId] = useState<number | null>(null)

  const [fecha, setFecha] = useState(hoyLocalISO())
  const [hora, setHora] = useState('')
  const [pacienteId, setPacienteId] = useState('')
  const [veterinario, setVeterinario] = useState('Dra. Colin')
  const [motivoTipo, setMotivoTipo] = useState('')
  const [motivoOtro, setMotivoOtro] = useState('')
  const [estado, setEstado] = useState('Agendada')
  const [editandoCitaId, setEditandoCitaId] = useState<number | null>(null)

  const [modoReserva, setModoReserva] = useState<ModoReserva>('existente')
  const [nombreTutorReserva, setNombreTutorReserva] = useState('')
  const [telefonoTutorReserva, setTelefonoTutorReserva] = useState('')
  const [nombreMascotaReserva, setNombreMascotaReserva] = useState('')
  const [especieReserva, setEspecieReserva] = useState('')
  const [especieReservaOtra, setEspecieReservaOtra] = useState('')

  const [vistaAgenda, setVistaAgenda] = useState<VistaAgenda>('mes')
  const [cargando, setCargando] = useState(true)
  const [guardandoPaciente, setGuardandoPaciente] = useState(false)
  const [guardandoCita, setGuardandoCita] = useState(false)
  const [citasExpandidas, setCitasExpandidas] = useState<number[]>([])
  const [agendaContraida, setAgendaContraida] = useState(false)

  const agendaRef = useRef<HTMLDivElement | null>(null)
  const nuevoPacienteRef = useRef<HTMLDivElement | null>(null)

  const inputClass =
    'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-500 dark:focus:ring-slate-800'

  const cardClass =
    'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900'

  const buttonPrimary =
    'rounded-xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200'

  const buttonSecondary =
    'rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'

  const especieFinal = especie === 'Otro' ? especieOtra.trim() : especie
  const motivoFinal = motivoTipo === 'Otro' ? motivoOtro.trim() : motivoTipo
  const especieReservaFinal =
    especieReserva === 'Otro' ? especieReservaOtra.trim() : especieReserva

  const toggleExpandirCita = (id: number) => {
    setCitasExpandidas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const irAAgenda = () => {
    setTimeout(() => {
      agendaRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 50)
  }

  const irANuevoPaciente = () => {
    setTimeout(() => {
      nuevoPacienteRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 50)
  }

  const cargarTutores = async () => {
    const { data, error } = await supabase
      .from('tutores')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    setTutores((data ?? []) as Tutor[])
  }

  const cargarPacientes = async () => {
    const { data, error } = await supabase
      .from('pacientes')
      .select(`
        id,
        nombre,
        especie,
        edad,
        peso,
        tutor_id,
        tutores ( nombre, telefono )
      `)
      .order('id', { ascending: true })

    if (error) {
      console.error(error)
      alert('Error cargando pacientes')
      return
    }

    const lista = data ? (((data ?? []) as unknown) as Paciente[]) : []
    setPacientes(lista)

    if (!pacienteId && lista.length > 0) {
      setPacienteId(String(lista[0].id))
    }
  }

  const cargarCitas = async () => {
    const { data, error } = await supabase
      .from('citas')
      .select(`
        id,
        fecha,
        hora,
        paciente_id,
        veterinario,
        motivo,
        estado,
        es_paciente_nuevo,
        nombre_tutor,
        telefono_tutor,
        nombre_mascota,
        especie_mascota,
        pacientes (
          id,
          nombre,
          especie,
          edad,
          peso,
          tutores ( nombre, telefono )
        )
      `)
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true })

    if (error) {
      console.error(error)
      alert('Error cargando citas')
      return
    }

    setCitas(data ? (((data ?? []) as unknown) as Cita[]) : [])
  }

  useEffect(() => {
    const cargar = async () => {
      setCargando(true)
      await Promise.all([cargarTutores(), cargarPacientes(), cargarCitas()])
      setCargando(false)
    }

    cargar()
  }, [])

  const pacientesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return pacientes

    return pacientes.filter((p) => {
      const nombrePacienteLower = p.nombre.toLowerCase()
      const nombreTutorLower = p.tutores?.nombre?.toLowerCase() || ''
      return (
        nombrePacienteLower.includes(texto) ||
        nombreTutorLower.includes(texto)
      )
    })
  }, [busqueda, pacientes])

  const sugerenciasPacientes = useMemo(() => {
    const texto = busquedaPacienteInput.trim().toLowerCase()
    if (!texto) return []
    return pacientes
      .filter((p) => p.nombre.toLowerCase().includes(texto))
      .slice(0, 6)
  }, [busquedaPacienteInput, pacientes])

  const sugerenciasTutores = useMemo(() => {
    const texto = busquedaTutorInput.trim().toLowerCase()
    if (!texto) return []
    return tutores
      .filter((t) => t.nombre.toLowerCase().includes(texto))
      .slice(0, 6)
  }, [busquedaTutorInput, tutores])

  const pacientesBusquedaRapida = useMemo(() => {
    const texto = busquedaPacienteInput.trim().toLowerCase()
    if (!texto) return []
    return pacientes
      .filter((p) => {
        const tutor = p.tutores?.nombre?.toLowerCase() || ''
        return p.nombre.toLowerCase().includes(texto) || tutor.includes(texto)
      })
      .slice(0, 8)
  }, [busquedaPacienteInput, pacientes])

  const buscarPacientes = () => {
    if (busquedaPacienteInput.trim()) {
      setBusqueda(busquedaPacienteInput.trim())
    } else if (busquedaTutorInput.trim()) {
      setBusqueda(busquedaTutorInput.trim())
    } else {
      setBusqueda(busqueda.trim())
    }

    setMostrarSugerenciasPaciente(false)
    setMostrarSugerenciasTutor(false)
  }

  const resolverTutor = async (nombre: string, telefono: string) => {
    const { data: tutorExistente, error: errorTutorExistente } = await supabase
      .from('tutores')
      .select('*')
      .eq('nombre', nombre.trim())
      .maybeSingle()

    if (errorTutorExistente) throw errorTutorExistente

    if (tutorExistente) {
      const telefonoNormalizado = telefono.trim() || ''
      if ((tutorExistente.telefono || '') !== telefonoNormalizado) {
        const { error: errorUpdateTutor } = await supabase
          .from('tutores')
          .update({ telefono: telefonoNormalizado })
          .eq('id', tutorExistente.id)

        if (errorUpdateTutor) throw errorUpdateTutor
      }
      return tutorExistente.id
    }

    const { data: nuevoTutor, error: errorNuevoTutor } = await supabase
      .from('tutores')
      .insert([{ nombre: nombre.trim(), telefono: telefono.trim() || '' }])
      .select()
      .single()

    if (errorNuevoTutor) throw errorNuevoTutor

    return nuevoTutor.id
  }

  const limpiarFormularioPaciente = () => {
    setNombrePaciente('')
    setEspecie('')
    setEspecieOtra('')
    setEdadPaciente('')
    setPesoPaciente('')
    setNombreTutor('')
    setTelefonoTutor('')
    setEditandoPacienteId(null)
    setCitaPendienteCrearFichaId(null)
  }

  const guardarPaciente = async () => {
    if (!nombrePaciente.trim() || !nombreTutor.trim()) {
      alert('Debes ingresar nombre de paciente y tutor')
      return
    }

    if (!especieFinal) {
      alert('Debes seleccionar especie')
      return
    }

    setGuardandoPaciente(true)

    try {
      const tutorId = await resolverTutor(nombreTutor, telefonoTutor)

      const payload = {
        nombre: nombrePaciente.trim(),
        especie: especieFinal,
        edad: edadPaciente.trim() || null,
        peso: pesoPaciente.trim() ? Number(pesoPaciente) : null,
        tutor_id: tutorId,
      }

      let nuevoPacienteId: number | null = null

      if (editandoPacienteId) {
        const { error } = await supabase
          .from('pacientes')
          .update(payload)
          .eq('id', editandoPacienteId)

        if (error) throw error
        nuevoPacienteId = editandoPacienteId
      } else {
        const { data, error } = await supabase
          .from('pacientes')
          .insert([payload])
          .select()
          .single()

        if (error) throw error
        nuevoPacienteId = data?.id ?? null
      }

      if (citaPendienteCrearFichaId && nuevoPacienteId) {
        const { error: errorUpdateCita } = await supabase
          .from('citas')
          .update({
            paciente_id: nuevoPacienteId,
            es_paciente_nuevo: false,
          })
          .eq('id', citaPendienteCrearFichaId)

        if (errorUpdateCita) throw errorUpdateCita
      }

      limpiarFormularioPaciente()
      await Promise.all([cargarTutores(), cargarPacientes(), cargarCitas()])
    } catch (error) {
      console.error(error)
      alert(editandoPacienteId ? 'Error actualizando paciente' : 'Error creando paciente')
    } finally {
      setGuardandoPaciente(false)
    }
  }

  const editarPaciente = (paciente: Paciente) => {
    setEditandoPacienteId(paciente.id)
    setNombrePaciente(paciente.nombre)

    if (especiesBase.includes(paciente.especie)) {
      setEspecie(paciente.especie)
      setEspecieOtra('')
    } else {
      setEspecie('Otro')
      setEspecieOtra(paciente.especie)
    }

    setEdadPaciente(paciente.edad || '')
    setPesoPaciente(
      paciente.peso !== null && paciente.peso !== undefined ? String(paciente.peso) : ''
    )
    setNombreTutor(paciente.tutores?.nombre || '')
    setTelefonoTutor(paciente.tutores?.telefono || '')
    setCitaPendienteCrearFichaId(null)
    irANuevoPaciente()
  }

  const crearFichaDesdeCita = (cita: Cita) => {
    setEditandoPacienteId(null)
    setCitaPendienteCrearFichaId(cita.id)
    setNombrePaciente(cita.nombre_mascota || '')
    if (especiesBase.includes(cita.especie_mascota || '')) {
      setEspecie(cita.especie_mascota || '')
      setEspecieOtra('')
    } else {
      setEspecie('Otro')
      setEspecieOtra(cita.especie_mascota || '')
    }
    setEdadPaciente('')
    setPesoPaciente('')
    setNombreTutor(cita.nombre_tutor || '')
    setTelefonoTutor(cita.telefono_tutor || '')
    irANuevoPaciente()
  }

  const eliminarPaciente = async (paciente: Paciente) => {
    const confirmar = window.confirm(
      `¿Eliminar la ficha de ${paciente.nombre}? También se eliminarán sus citas y atenciones.`
    )
    if (!confirmar) return

    try {
      await supabase.from('atenciones').delete().eq('paciente_id', paciente.id)
      await supabase.from('citas').delete().eq('paciente_id', paciente.id)

      const { error } = await supabase.from('pacientes').delete().eq('id', paciente.id)
      if (error) throw error

      if (editandoPacienteId === paciente.id) {
        limpiarFormularioPaciente()
      }

      await Promise.all([cargarPacientes(), cargarCitas()])
    } catch (error) {
      console.error(error)
      alert('Error eliminando ficha')
    }
  }

  const limpiarFormularioCita = () => {
    setHora('')
    setMotivoTipo('')
    setMotivoOtro('')
    setEstado('Agendada')
    setEditandoCitaId(null)
    setModoReserva('existente')
    setNombreTutorReserva('')
    setTelefonoTutorReserva('')
    setNombreMascotaReserva('')
    setEspecieReserva('')
    setEspecieReservaOtra('')
  }

  const guardarCita = async () => {
    if (!fecha || !hora || !motivoFinal) {
      alert('Completa fecha, hora y motivo')
      return
    }

    if (modoReserva === 'existente' && !pacienteId) {
      alert('Selecciona un paciente')
      return
    }

    if (modoReserva === 'nuevo') {
      if (
        !nombreTutorReserva.trim() ||
        !nombreMascotaReserva.trim() ||
        !especieReservaFinal
      ) {
        alert('Completa tutor, mascota y especie para la reserva sin ficha')
        return
      }
    }

    setGuardandoCita(true)

    const payload =
      modoReserva === 'existente'
        ? {
            fecha,
            hora,
            paciente_id: Number(pacienteId),
            veterinario,
            motivo: motivoFinal,
            estado,
            es_paciente_nuevo: false,
            nombre_tutor: null,
            telefono_tutor: null,
            nombre_mascota: null,
            especie_mascota: null,
          }
        : {
            fecha,
            hora,
            paciente_id: null,
            veterinario,
            motivo: motivoFinal,
            estado,
            es_paciente_nuevo: true,
            nombre_tutor: nombreTutorReserva.trim(),
            telefono_tutor: telefonoTutorReserva.trim() || null,
            nombre_mascota: nombreMascotaReserva.trim(),
            especie_mascota: especieReservaFinal,
          }

    let error = null

    if (editandoCitaId) {
      const respuesta = await supabase
        .from('citas')
        .update(payload)
        .eq('id', editandoCitaId)

      error = respuesta.error
    } else {
      const respuesta = await supabase.from('citas').insert([payload])
      error = respuesta.error
    }

    setGuardandoCita(false)

    if (error) {
      console.error(error)
      alert(editandoCitaId ? 'Error actualizando cita' : 'Error creando cita')
      return
    }

    limpiarFormularioCita()
    await cargarCitas()
  }

  const eliminarCita = async () => {
    if (!editandoCitaId) return

    const confirmar = window.confirm('¿Eliminar esta cita?')
    if (!confirmar) return

    const { error } = await supabase.from('citas').delete().eq('id', editandoCitaId)

    if (error) {
      console.error(error)
      alert('Error eliminando cita')
      return
    }

    limpiarFormularioCita()
    await cargarCitas()
  }

  const seleccionarCita = (cita: Cita) => {
    setEditandoCitaId(cita.id)
    setFecha(cita.fecha)
    setHora(cita.hora)
    setVeterinario(cita.veterinario)

    if (motivosBase.includes(cita.motivo)) {
      setMotivoTipo(cita.motivo)
      setMotivoOtro('')
    } else {
      setMotivoTipo('Otro')
      setMotivoOtro(cita.motivo)
    }

    setEstado(cita.estado)

    if (cita.es_paciente_nuevo) {
      setModoReserva('nuevo')
      setPacienteId('')
      setNombreTutorReserva(cita.nombre_tutor || '')
      setTelefonoTutorReserva(cita.telefono_tutor || '')
      setNombreMascotaReserva(cita.nombre_mascota || '')
      if (especiesBase.includes(cita.especie_mascota || '')) {
        setEspecieReserva(cita.especie_mascota || '')
        setEspecieReservaOtra('')
      } else {
        setEspecieReserva('Otro')
        setEspecieReservaOtra(cita.especie_mascota || '')
      }
    } else {
      setModoReserva('existente')
      setPacienteId(cita.paciente_id ? String(cita.paciente_id) : '')
      setNombreTutorReserva('')
      setTelefonoTutorReserva('')
      setNombreMascotaReserva('')
      setEspecieReserva('')
      setEspecieReservaOtra('')
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const seleccionarBloque = (fechaSeleccionada: string, horaSeleccionada: string, vet: string) => {
    setEditandoCitaId(null)
    setFecha(fechaSeleccionada)
    setHora(horaSeleccionada)
    setVeterinario(vet)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const citasDelDia = useMemo(() => {
    return citas.filter((c) => c.fecha === fecha)
  }, [citas, fecha])

  const diasSemana = useMemo(() => getWeekDays(fecha), [fecha])
  const calendarioMes = useMemo(() => getMonthGrid(fecha), [fecha])

  const citasPorVeterinarioYHora = (nombreVet: string, horaBloque: string) => {
    return citasDelDia.find(
      (c) => c.veterinario === nombreVet && c.hora === horaBloque
    )
  }

  const renderCitaCompacta = (cita: Cita) => {
    const expandida = citasExpandidas.includes(cita.id)

    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={() => seleccionarCita(cita)}
            className="flex-1 text-left"
          >
            <div className="font-medium">{nombreVisibleCita(cita)}</div>
            <div className="text-xs text-slate-500">{cita.hora}</div>
          </button>

          <button
            onClick={() => toggleExpandirCita(cita.id)}
            className="text-xs text-slate-500 hover:underline"
          >
            {expandida ? 'Ocultar' : 'Ver más'}
          </button>
        </div>

        {expandida && (
          <div className="mt-2 space-y-2 text-xs">
            <div className="text-slate-500">Tutor: {tutorVisibleCita(cita)}</div>
            <div className="text-slate-500">Motivo: {cita.motivo}</div>
            <span
              className={`inline-flex rounded-full px-2 py-1 font-medium ${getEstadoClasses(
                cita.estado
              )}`}
            >
              {cita.estado}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => seleccionarCita(cita)}
                className="rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700"
              >
                Editar cita
              </button>
              {cita.pacientes?.id ? (
                <Link
                  href={`/paciente/${cita.pacientes.id}`}
                  className="rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700"
                >
                  Ver ficha
                </Link>
              ) : (
                <button
                  onClick={() => crearFichaDesdeCita(cita)}
                  className="rounded-lg border border-amber-300 px-2 py-1 text-amber-700 dark:border-amber-700 dark:text-amber-300"
                >
                  Crear ficha
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
<div className="pt-12 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
  <div>
    <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
      🐾 VetFlow
    </h1>
    <p className="mt-2 text-slate-600 dark:text-slate-400">
      gestión clínica veterinaria simple y rápida
    </p>
    <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">
      Powered by Petsur@
    </p>
  </div>

  <Link
    href="/configuracion"
    className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
  >
    ⚙️ Configuración
  </Link>
</div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div ref={nuevoPacienteRef} className={cardClass}>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {editandoPacienteId
                ? 'Editar ficha'
                : citaPendienteCrearFichaId
                ? 'Crear ficha desde cita'
                : 'Nuevo paciente'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Crea pacientes y encuentra fichas rápidamente.
            </p>

            {citaPendienteCrearFichaId && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                Estás creando una ficha desde una reserva sin ficha. Al guardar, la cita quedará vinculada automáticamente.
              </div>
            )}

            <div className="mt-4 space-y-3">
              <input
                className={inputClass}
                placeholder="Nombre paciente"
                value={nombrePaciente}
                onChange={(e) => setNombrePaciente(e.target.value)}
              />

              <select
                className={inputClass}
                value={especie}
                onChange={(e) => setEspecie(e.target.value)}
              >
                <option value="">Selecciona especie</option>
                {especiesBase.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              {especie === 'Otro' && (
                <input
                  className={inputClass}
                  placeholder="Especificar especie"
                  value={especieOtra}
                  onChange={(e) => setEspecieOtra(e.target.value)}
                />
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  className={inputClass}
                  placeholder="Edad (opcional)"
                  value={edadPaciente}
                  onChange={(e) => setEdadPaciente(e.target.value)}
                />

                <input
                  type="number"
                  step="0.1"
                  className={inputClass}
                  placeholder="Peso en kg (opcional)"
                  value={pesoPaciente}
                  onChange={(e) => setPesoPaciente(e.target.value)}
                />
              </div>

              <input
                className={inputClass}
                placeholder="Nombre tutor"
                value={nombreTutor}
                onChange={(e) => setNombreTutor(e.target.value)}
              />

              <input
                className={inputClass}
                placeholder="Teléfono (opcional)"
                value={telefonoTutor}
                onChange={(e) => setTelefonoTutor(e.target.value)}
              />

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={guardarPaciente}
                  disabled={guardandoPaciente}
                  className={buttonPrimary}
                >
                  {guardandoPaciente
                    ? 'Guardando...'
                    : editandoPacienteId
                    ? 'Actualizar ficha'
                    : 'Guardar paciente'}
                </button>

                {(editandoPacienteId || citaPendienteCrearFichaId) && (
                  <button onClick={limpiarFormularioPaciente} className={buttonSecondary}>
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Buscar paciente
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Abre una ficha desde aquí.
              </p>

              <div className="mt-4 relative">
                <input
                  className={inputClass}
                  placeholder="Buscar por paciente o tutor"
                  value={busquedaPacienteInput}
                  onFocus={() => setMostrarSugerenciasPaciente(true)}
                  onBlur={() => setTimeout(() => setMostrarSugerenciasPaciente(false), 150)}
                  onChange={(e) => setBusquedaPacienteInput(e.target.value)}
                />

                {mostrarSugerenciasPaciente && pacientesBusquedaRapida.length > 0 && (
                  <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    {pacientesBusquedaRapida.map((p) => (
                      <Link
                        key={p.id}
                        href={`/paciente/${p.id}`}
                        className="block border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                      >
                        <span className="font-medium">{p.nombre}</span>
                        <span className="ml-2 text-slate-500">
                          {p.especie} · {p.tutores?.nombre || '-'}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {busquedaPacienteInput.trim() && pacientesBusquedaRapida.length === 0 && (
                <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  No se encontraron pacientes.
                </div>
              )}
            </div>
          </div>

          <div ref={agendaRef} className={cardClass}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Agendar y agenda
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Crea citas y revisa tu calendario.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAgendaContraida((prev) => !prev)}
                  className={buttonSecondary}
                >
                  {agendaContraida ? 'Expandir agenda' : 'Contraer agenda'}
                </button>

                {!agendaContraida && (
                  <>
                    <button
                      onClick={() => setVistaAgenda('dia')}
                      className={vistaAgenda === 'dia' ? buttonPrimary : buttonSecondary}
                    >
                      Día
                    </button>
                    <button
                      onClick={() => setVistaAgenda('semana')}
                      className={vistaAgenda === 'semana' ? buttonPrimary : buttonSecondary}
                    >
                      Semana
                    </button>
                    <button
                      onClick={() => setVistaAgenda('mes')}
                      className={vistaAgenda === 'mes' ? buttonPrimary : buttonSecondary}
                    >
                      Mes
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => setModoReserva('existente')}
                className={modoReserva === 'existente' ? buttonPrimary : buttonSecondary}
              >
                Paciente existente
              </button>
              <button
                onClick={() => setModoReserva('nuevo')}
                className={modoReserva === 'nuevo' ? buttonPrimary : buttonSecondary}
              >
                Paciente nuevo / sin ficha
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  type="date"
                  className={inputClass}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />

                <input
                  type="time"
                  step={900}
                  className={inputClass}
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                />
              </div>

              {modoReserva === 'existente' ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <select
                    className={inputClass}
                    value={pacienteId}
                    onChange={(e) => setPacienteId(e.target.value)}
                  >
                    <option value="">Selecciona paciente</option>
                    {pacientes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} - {p.especie}
                      </option>
                    ))}
                  </select>

                  <select
                    className={inputClass}
                    value={veterinario}
                    onChange={(e) => setVeterinario(e.target.value)}
                  >
                    {veterinarios.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input
                      className={inputClass}
                      placeholder="Nombre tutor"
                      value={nombreTutorReserva}
                      onChange={(e) => setNombreTutorReserva(e.target.value)}
                    />

                    <input
                      className={inputClass}
                      placeholder="Teléfono"
                      value={telefonoTutorReserva}
                      onChange={(e) => setTelefonoTutorReserva(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input
                      className={inputClass}
                      placeholder="Nombre mascota"
                      value={nombreMascotaReserva}
                      onChange={(e) => setNombreMascotaReserva(e.target.value)}
                    />

                    <select
                      className={inputClass}
                      value={especieReserva}
                      onChange={(e) => setEspecieReserva(e.target.value)}
                    >
                      <option value="">Selecciona especie</option>
                      {especiesBase.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  {especieReserva === 'Otro' && (
                    <input
                      className={inputClass}
                      placeholder="Especificar especie"
                      value={especieReservaOtra}
                      onChange={(e) => setEspecieReservaOtra(e.target.value)}
                    />
                  )}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <select
                      className={inputClass}
                      value={veterinario}
                      onChange={(e) => setVeterinario(e.target.value)}
                    >
                      {veterinarios.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>

                    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Se reservará sin crear ficha clínica.
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select
                  className={inputClass}
                  value={motivoTipo}
                  onChange={(e) => setMotivoTipo(e.target.value)}
                >
                  <option value="">Selecciona motivo</option>
                  {motivosBase.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

                <select
                  className={inputClass}
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                >
                  {estadosCita.map((estadoItem) => (
                    <option key={estadoItem}>{estadoItem}</option>
                  ))}
                </select>
              </div>

              {motivoTipo === 'Otro' && (
                <input
                  className={inputClass}
                  placeholder="Especificar motivo"
                  value={motivoOtro}
                  onChange={(e) => setMotivoOtro(e.target.value)}
                />
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={guardarCita}
                  disabled={guardandoCita}
                  className={buttonPrimary}
                >
                  {guardandoCita
                    ? editandoCitaId
                      ? 'Actualizando...'
                      : 'Guardando...'
                    : editandoCitaId
                    ? 'Actualizar cita'
                    : 'Guardar cita'}
                </button>

                {editandoCitaId && (
                  <>
                    <button onClick={eliminarCita} className={buttonSecondary}>
                      Eliminar cita
                    </button>
                    <button onClick={limpiarFormularioCita} className={buttonSecondary}>
                      Cancelar edición
                    </button>
                  </>
                )}
              </div>
            </div>

            {agendaContraida ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                Agenda clínica contraída.
              </div>
            ) : (
              <>
                {vistaAgenda === 'mes' && (
                  <div className="mt-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="text-lg font-semibold text-slate-900 dark:text-white">
                        {formatMonthLabel(fecha)}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const base = parseISODate(fecha)
                            base.setMonth(base.getMonth() - 1)
                            setFecha(toISODate(base))
                          }}
                          className={buttonSecondary}
                        >
                          ← Mes anterior
                        </button>

                        <button
                          onClick={() => {
                            const base = parseISODate(fecha)
                            base.setMonth(base.getMonth() + 1)
                            setFecha(toISODate(base))
                          }}
                          className={buttonSecondary}
                        >
                          Mes siguiente →
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-3 text-sm">
                      {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                        <div
                          key={d}
                          className="rounded-xl bg-slate-50 p-3 text-center font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {d}
                        </div>
                      ))}

                      {calendarioMes.map((dateObj) => {
                        const iso = toISODate(dateObj)
                        const citasDia = citas.filter((c) => c.fecha === iso)
                        const esMesActual =
                          dateObj.getMonth() === parseISODate(fecha).getMonth()

                        return (
                          <button
                            key={iso}
                            onClick={() => {
                              setFecha(iso)
                              setVistaAgenda('dia')
                              irAAgenda()
                            }}
                            className={`min-h-[110px] rounded-2xl border p-3 text-left transition ${
                              esMesActual
                                ? 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800'
                                : 'border-slate-100 bg-slate-50 text-slate-400 dark:border-slate-900 dark:bg-slate-950 dark:text-slate-600'
                            }`}
                          >
                            <div className="font-semibold">{dateObj.getDate()}</div>
                            <div className="mt-2 space-y-1">
                              {citasDia.slice(0, 3).map((cita) => (
                                <div
                                  key={cita.id}
                                  className="truncate rounded-lg bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800"
                                >
                                  {cita.hora} · {nombreVisibleCita(cita)}
                                </div>
                              ))}
                              {citasDia.length > 3 && (
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  +{citasDia.length - 3} más
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {vistaAgenda === 'dia' && (
                  <>
                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Resumen del día
                          </div>
                          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {formatLongDate(fecha)}
                          </div>
                        </div>

                        <button
                          onClick={() => setVistaAgenda('mes')}
                          className={buttonSecondary}
                        >
                          Volver al mes
                        </button>
                      </div>

                      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        {citasDelDia.length > 0
                          ? `${citasDelDia.length} reserva(s) registrada(s)`
                          : 'Sin reservas para este día'}
                      </div>

                      {citasDelDia.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {citasDelDia.map((cita) => (
                            <div
                              key={cita.id}
                              className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
                            >
                              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <div className="font-medium text-slate-900 dark:text-white">
                                    {cita.hora} · {nombreVisibleCita(cita)}
                                  </div>
                                  <div className="text-sm text-slate-500 dark:text-slate-400">
                                    {cita.veterinario} · {cita.motivo}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    Tutor: {tutorVisibleCita(cita)}
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <span
                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getEstadoClasses(
                                      cita.estado
                                    )}`}
                                  >
                                    {cita.estado}
                                  </span>

                                  <button
                                    onClick={() => seleccionarCita(cita)}
                                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs dark:border-slate-700"
                                  >
                                    Editar
                                  </button>

                                  {cita.pacientes?.id ? (
                                    <Link
                                      href={`/paciente/${cita.pacientes.id}`}
                                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs dark:border-slate-700"
                                    >
                                      Ver ficha
                                    </Link>
                                  ) : (
                                    <button
                                      onClick={() => crearFichaDesdeCita(cita)}
                                      className="rounded-lg border border-amber-300 px-3 py-1 text-xs text-amber-700 dark:border-amber-700 dark:text-amber-300"
                                    >
                                      Crear ficha
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                      <div className="grid grid-cols-3 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <div>Hora</div>
                        <div>Dra. Colin</div>
                        <div>Dra. Bravo</div>
                      </div>

                      {horasBase.map((horaBloque) => {
                        const citaColin = citasPorVeterinarioYHora('Dra. Colin', horaBloque)
                        const citaBravo = citasPorVeterinarioYHora('Dra. Bravo', horaBloque)

                        const renderBloque = (cita: Cita | undefined, vet: string) => {
                          if (!cita) {
                            return (
                              <button
                                onClick={() => seleccionarBloque(fecha, horaBloque, vet)}
                                className="w-full rounded-xl border border-dashed border-slate-300 p-3 text-left text-slate-400 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-500 dark:hover:bg-slate-800"
                              >
                                Disponible
                              </button>
                            )
                          }

                          return renderCitaCompacta(cita)
                        }

                        return (
                          <div
                            key={horaBloque}
                            className="grid grid-cols-3 border-t border-slate-200 px-5 py-3 text-sm dark:border-slate-800"
                          >
                            <div className="font-medium text-slate-700 dark:text-slate-300">
                              {horaBloque}
                            </div>
                            <div>{renderBloque(citaColin, 'Dra. Colin')}</div>
                            <div>{renderBloque(citaBravo, 'Dra. Bravo')}</div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                {vistaAgenda === 'semana' && (
                  <div className="mt-6 overflow-x-auto">
                    <div className="min-w-[1100px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                      <div className="grid grid-cols-8 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <div>Hora</div>
                        {diasSemana.map((dia) => (
                          <div key={dia}>{formatDateLabel(dia)}</div>
                        ))}
                      </div>

                      {horasBase.map((horaBloque) => (
                        <div
                          key={horaBloque}
                          className="grid grid-cols-8 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800"
                        >
                          <div className="font-medium text-slate-700 dark:text-slate-300">
                            {horaBloque}
                          </div>

                          {diasSemana.map((dia) => {
                            const citasBloque = citas.filter(
                              (c) => c.fecha === dia && c.hora === horaBloque
                            )

                            return (
                              <div key={`${dia}-${horaBloque}`} className="space-y-2">
                                {citasBloque.length > 0 ? (
                                  citasBloque.map((cita) => (
                                    <button
                                      key={cita.id}
                                      onClick={() => seleccionarCita(cita)}
                                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-left transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                                    >
                                      <div className="text-xs font-medium">
                                        {cita.veterinario}
                                      </div>
                                      <div className="text-xs">
                                        {nombreVisibleCita(cita)}
                                      </div>
                                    </button>
                                  ))
                                ) : (
                                  <button
                                    onClick={() => seleccionarBloque(dia, horaBloque, 'Dra. Colin')}
                                    className="w-full rounded-lg border border-dashed border-slate-300 px-2 py-2 text-left text-xs text-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-500 dark:hover:bg-slate-800"
                                  >
                                    Libre
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className={cardClass}>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Fichas de pacientes
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Gestión completa de pacientes y accesos rápidos.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="relative">
              <input
                className={inputClass}
                placeholder="Buscar paciente"
                value={busquedaPacienteInput}
                onFocus={() => setMostrarSugerenciasPaciente(true)}
                onBlur={() => setTimeout(() => setMostrarSugerenciasPaciente(false), 150)}
                onChange={(e) => {
                  setBusquedaPacienteInput(e.target.value)
                  setBusqueda(e.target.value)
                }}
              />

              {mostrarSugerenciasPaciente && sugerenciasPacientes.length > 0 && (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {sugerenciasPacientes.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setBusquedaPacienteInput(p.nombre)
                        setBusqueda(p.nombre)
                        setMostrarSugerenciasPaciente(false)
                      }}
                      className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                    >
                      <span className="font-medium">{p.nombre}</span>
                      <span className="ml-2 text-slate-500">
                        {p.especie} · {p.tutores?.nombre || '-'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <input
                className={inputClass}
                placeholder="Buscar tutor"
                value={busquedaTutorInput}
                onFocus={() => setMostrarSugerenciasTutor(true)}
                onBlur={() => setTimeout(() => setMostrarSugerenciasTutor(false), 150)}
                onChange={(e) => {
                  setBusquedaTutorInput(e.target.value)
                  setBusqueda(e.target.value)
                }}
              />

              {mostrarSugerenciasTutor && sugerenciasTutores.length > 0 && (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {sugerenciasTutores.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setBusquedaTutorInput(t.nombre)
                        setBusqueda(t.nombre)
                        setMostrarSugerenciasTutor(false)
                      }}
                      className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                    >
                      <span className="font-medium">{t.nombre}</span>
                      <span className="ml-2 text-slate-500">
                        {t.telefono || 'Sin teléfono'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={buscarPacientes} className={buttonPrimary}>
              Buscar pacientes
            </button>

            <button
              onClick={() => {
                setBusqueda('')
                setBusquedaPacienteInput('')
                setBusquedaTutorInput('')
                setMostrarSugerenciasPaciente(false)
                setMostrarSugerenciasTutor(false)
              }}
              className={buttonSecondary}
            >
              Limpiar
            </button>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-8 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <div>ID</div>
              <div>Paciente</div>
              <div>Especie</div>
              <div>Edad</div>
              <div>Peso</div>
              <div>Tutor</div>
              <div>Ficha clínica</div>
              <div>Acciones</div>
            </div>

            {pacientesFiltrados.length > 0 ? (
              pacientesFiltrados.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-8 items-center border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800"
                >
                  <div>{p.id}</div>
                  <div className="font-medium">{p.nombre}</div>
                  <div>{p.especie}</div>
                  <div>{p.edad || '-'}</div>
                  <div>
                    {p.peso !== null && p.peso !== undefined ? `${p.peso} kg` : '-'}
                  </div>
                  <div>{p.tutores?.nombre || '-'}</div>
                  <div>
                    <Link
                      href={`/paciente/${p.id}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Ver ficha
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => editarPaciente(p)}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs dark:border-slate-700"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => eliminarPaciente(p)}
                      className="rounded-lg border border-rose-300 px-3 py-1 text-xs text-rose-700 dark:border-rose-700 dark:text-rose-300"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                No hay pacientes para mostrar.
              </div>
            )}
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Lista final de reservas
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Detalle de todas las reservas registradas.
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-7 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <div>Fecha</div>
              <div>Hora</div>
              <div>Paciente</div>
              <div>Especie</div>
              <div>Tutor</div>
              <div>Veterinario</div>
              <div>Estado / Ficha</div>
            </div>

            {cargando ? (
              <div className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
                Cargando...
              </div>
            ) : citas.length > 0 ? (
              citas.map((cita) => (
                <div
                  key={cita.id}
                  className="grid grid-cols-7 items-center border-t border-slate-200 px-5 py-4 text-sm dark:border-slate-800"
                >
                  <div>{cita.fecha}</div>
                  <div>{cita.hora}</div>
                  <div className="font-medium">{nombreVisibleCita(cita)}</div>
                  <div>{especieVisibleCita(cita)}</div>
                  <div>{tutorVisibleCita(cita)}</div>
                  <div>{cita.veterinario}</div>
                  <div className="space-y-2">
                    <button
                      onClick={() => seleccionarCita(cita)}
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getEstadoClasses(
                        cita.estado
                      )}`}
                    >
                      {cita.estado}
                    </button>

                    <div>
                      {cita.pacientes?.id ? (
                        <Link
                          href={`/paciente/${cita.pacientes.id}`}
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Ver ficha
                        </Link>
                      ) : (
                        <button
                          onClick={() => crearFichaDesdeCita(cita)}
                          className="text-amber-700 hover:underline dark:text-amber-300"
                        >
                          Crear ficha
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
                No hay reservas registradas.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}