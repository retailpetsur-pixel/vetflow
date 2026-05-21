'use client'

import Link from 'next/link'
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
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
  sexo?: string | null
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
    sexo?: string | null
    edad?: string | null
    peso?: number | null
    tutores?: {
      nombre: string
      telefono?: string | null
    } | null
  } | null
}

type VentaItem = {
  id: number
  nombre: string
  categoria: string | null
  cantidad: number
  precio_unitario: number
  total: number
  afecta_inventario: boolean
}

type Venta = {
  id: number
  paciente_id: number | null
  atencion_id: number | null
  fecha: string
  origen: string
  estado: string
  notas: string | null
  total: number
  created_at: string
  pacientes?: {
    nombre: string
    especie: string
    tutores?: {
      nombre: string
    } | null
  } | null
  venta_items?: VentaItem[]
}

type Producto = {
  id: number
  nombre: string
  codigo_barras: string | null
  categoria: string | null
  unidad: string | null
  coste: number | null
  precio: number | null
  stock: number | null
  stock_minimo: number | null
  activo: boolean | null
}

type Configuracion = {
  nombre_clinica: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
  logo_url: string | null
}

type ItemVentaManual = {
  id: string
  productoId: string
  busqueda: string
  nombre: string
  categoria: string
  cantidad: string
  precioUnitario: string
  afectaInventario: boolean
}

type VistaAgenda = 'dia' | 'semana' | 'mes'
type ModoReserva = 'existente' | 'nuevo'
type SeccionDashboard =
  | 'inicio'
  | 'agenda'
  | 'pacientes'
  | 'fichas'
  | 'recordatorios'
  | 'ventas'
  | 'inventario'

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

function formatoCLP(valor: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(valor || 0)
}

function numeroDesdeInput(valor: string, fallback = 0) {
  const normalizado = valor.replace(',', '.')
  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : fallback
}

function parseCSV(texto: string) {
  const filas: string[][] = []
  let fila: string[] = []
  let celda = ''
  let entreComillas = false

  for (let i = 0; i < texto.length; i++) {
    const caracter = texto[i]
    const siguiente = texto[i + 1]

    if (entreComillas) {
      if (caracter === '"' && siguiente === '"') {
        celda += '"'
        i++
      } else if (caracter === '"') {
        entreComillas = false
      } else {
        celda += caracter
      }
    } else if (caracter === '"') {
      entreComillas = true
    } else if (caracter === ',') {
      fila.push(celda)
      celda = ''
    } else if (caracter === '\n') {
      fila.push(celda)
      filas.push(fila)
      fila = []
      celda = ''
    } else if (caracter !== '\r') {
      celda += caracter
    }
  }

  if (celda || fila.length) {
    fila.push(celda)
    filas.push(fila)
  }

  return filas
}

function valorColumna(fila: string[], indices: Record<string, number>, nombre: string) {
  const indice = indices[nombre]
  return indice === undefined ? '' : (fila[indice] || '').trim()
}

function crearItemVentaManual(): ItemVentaManual {
  return {
    id: crypto.randomUUID(),
    productoId: '',
    busqueda: '',
    nombre: '',
    categoria: 'Producto',
    cantidad: '1',
    precioUnitario: '',
    afectaInventario: false,
  }
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
  const [ventas, setVentas] = useState<Venta[]>([])
  const [ventasDisponibles, setVentasDisponibles] = useState(true)
  const [productos, setProductos] = useState<Producto[]>([])
  const [inventarioDisponible, setInventarioDisponible] = useState(true)
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null)

  const [busqueda, setBusqueda] = useState('')
  const [busquedaPacienteInput, setBusquedaPacienteInput] = useState('')
  const [busquedaTutorInput, setBusquedaTutorInput] = useState('')
  const [mostrarSugerenciasPaciente, setMostrarSugerenciasPaciente] = useState(false)
  const [mostrarSugerenciasTutor, setMostrarSugerenciasTutor] = useState(false)

  const [nombrePaciente, setNombrePaciente] = useState('')
  const [especie, setEspecie] = useState('')
  const [especieOtra, setEspecieOtra] = useState('')
  const [sexoPaciente, setSexoPaciente] = useState('')
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

  const [nombreProducto, setNombreProducto] = useState('')
  const [codigoBarrasProducto, setCodigoBarrasProducto] = useState('')
  const [categoriaProducto, setCategoriaProducto] = useState('Producto')
  const [unidadProducto, setUnidadProducto] = useState('unidad')
  const [precioProducto, setPrecioProducto] = useState('')
  const [costeProducto, setCosteProducto] = useState('')
  const [stockProducto, setStockProducto] = useState('')
  const [stockMinimoProducto, setStockMinimoProducto] = useState('')
  const [guardandoProducto, setGuardandoProducto] = useState(false)
  const [importandoLoyverse, setImportandoLoyverse] = useState(false)
  const [itemsVentaManual, setItemsVentaManual] = useState<ItemVentaManual[]>([
    crearItemVentaManual(),
  ])
  const [codigoBarrasVentaManual, setCodigoBarrasVentaManual] = useState('')
  const [familiaVentaActiva, setFamiliaVentaActiva] = useState('')
  const [metodoPagoVenta, setMetodoPagoVenta] = useState('Tarjeta')
  const [pieReciboVenta, setPieReciboVenta] = useState('Gracias por su compra.')
  const [emitirReciboVenta, setEmitirReciboVenta] = useState(true)
  const [guardandoVentaManual, setGuardandoVentaManual] = useState(false)
  const [reciboVenta, setReciboVenta] = useState<Venta | null>(null)
  const [sugerenciasVentaAbiertas, setSugerenciasVentaAbiertas] = useState<string | null>(null)

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
  const [agendaContraida, setAgendaContraida] = useState(true)
  const [seccionActiva, setSeccionActiva] = useState<SeccionDashboard>('inicio')

  const agendaRef = useRef<HTMLDivElement | null>(null)
  const nuevoPacienteRef = useRef<HTMLDivElement | null>(null)
  const fichasRef = useRef<HTMLDivElement | null>(null)
  const reservasRef = useRef<HTMLDivElement | null>(null)

  const inputClass =
    'w-full min-w-0 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-500 dark:focus:ring-slate-800'

  const cardClass =
    'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900'

  const buttonPrimary =
    'inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-center font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 sm:w-auto dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200'

  const buttonSecondary =
    'inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'

  const moduleCardClass =
    'group min-h-[160px] rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md sm:min-h-[190px] sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'

  const especieFinal = especie === 'Otro' ? especieOtra.trim() : especie
  const motivoFinal = motivoTipo === 'Otro' ? motivoOtro.trim() : motivoTipo
  const especieReservaFinal =
    especieReserva === 'Otro' ? especieReservaOtra.trim() : especieReserva

  const toggleExpandirCita = (id: number) => {
    setCitasExpandidas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const abrirSeccion = (seccion: SeccionDashboard) => {
    setSeccionActiva(seccion)
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 50)
  }

  const irAAgenda = () => {
    abrirSeccion('agenda')
  }

  const irANuevoPaciente = () => {
    abrirSeccion('pacientes')
  }

  const irAFichas = () => {
    abrirSeccion('fichas')
  }

  const irAReservas = () => {
    abrirSeccion('recordatorios')
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
      .select('*, tutores ( nombre, telefono )')
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
        pacientes (*, tutores ( nombre, telefono ))
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

  const cargarVentas = async () => {
    const { data, error } = await supabase
      .from('ventas')
      .select(`
        id,
        paciente_id,
        atencion_id,
        fecha,
        origen,
        estado,
        notas,
        total,
        created_at,
        pacientes ( nombre, especie, tutores ( nombre ) ),
        venta_items (
          id,
          nombre,
          categoria,
          cantidad,
          precio_unitario,
          total,
          afecta_inventario
        )
      `)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      setVentasDisponibles(false)
      setVentas([])
      return
    }

    setVentasDisponibles(true)
    setVentas(data ? (((data ?? []) as unknown) as Venta[]) : [])
  }

  const cargarProductos = async () => {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('activo', true)
      .order('nombre', { ascending: true })

    if (error) {
      console.error(error)
      setInventarioDisponible(false)
      setProductos([])
      return
    }

    setInventarioDisponible(true)
    setProductos(data ? (((data ?? []) as unknown) as Producto[]) : [])
  }

  const cargarConfiguracion = async () => {
    const { data, error } = await supabase
      .from('configuracion')
      .select('*')
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error(error)
      setConfiguracion(null)
      return
    }

    setConfiguracion(data ? ((data as unknown) as Configuracion) : null)
  }

  useEffect(() => {
    const cargar = async () => {
      setCargando(true)
      await Promise.all([
        cargarTutores(),
        cargarPacientes(),
        cargarCitas(),
        cargarVentas(),
        cargarProductos(),
        cargarConfiguracion(),
      ])
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
    setSexoPaciente('')
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
        sexo: sexoPaciente.trim() || null,
        edad: edadPaciente.trim() || null,
        peso: pesoPaciente.trim() ? Number(pesoPaciente) : null,
        tutor_id: tutorId,
      }
      const payloadSinSexo = {
        nombre: payload.nombre,
        especie: payload.especie,
        edad: payload.edad,
        peso: payload.peso,
        tutor_id: payload.tutor_id,
      }

      let nuevoPacienteId: number | null = null

      if (editandoPacienteId) {
        const { error } = await supabase
          .from('pacientes')
          .update(payload)
          .eq('id', editandoPacienteId)

        if (error && String(error.message || '').includes('sexo')) {
          const { error: errorSinSexo } = await supabase
            .from('pacientes')
            .update(payloadSinSexo)
            .eq('id', editandoPacienteId)

          if (errorSinSexo) throw errorSinSexo
        } else if (error) {
          throw error
        }
        nuevoPacienteId = editandoPacienteId
      } else {
        const { data, error } = await supabase
          .from('pacientes')
          .insert([payload])
          .select()
          .single()

        if (error && String(error.message || '').includes('sexo')) {
          const { data: dataSinSexo, error: errorSinSexo } = await supabase
            .from('pacientes')
            .insert([payloadSinSexo])
            .select()
            .single()

          if (errorSinSexo) throw errorSinSexo
          nuevoPacienteId = dataSinSexo?.id ?? null
        } else {
          if (error) throw error
          nuevoPacienteId = data?.id ?? null
        }
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

  const guardarProducto = async () => {
    if (!nombreProducto.trim()) {
      alert('Ingresa nombre del producto')
      return
    }

    setGuardandoProducto(true)

    const payloadProducto = {
      nombre: nombreProducto.trim(),
      codigo_barras: codigoBarrasProducto.trim() || null,
      categoria: categoriaProducto.trim() || null,
      unidad: unidadProducto.trim() || null,
      precio: numeroDesdeInput(precioProducto),
      coste: numeroDesdeInput(costeProducto),
      stock: numeroDesdeInput(stockProducto),
      stock_minimo: numeroDesdeInput(stockMinimoProducto),
      activo: true,
    }

    const payloadSinCodigo = {
      nombre: payloadProducto.nombre,
      categoria: payloadProducto.categoria,
      unidad: payloadProducto.unidad,
      precio: payloadProducto.precio,
      coste: payloadProducto.coste,
      stock: payloadProducto.stock,
      stock_minimo: payloadProducto.stock_minimo,
      activo: payloadProducto.activo,
    }

    const { error } = await supabase.from('productos').insert([payloadProducto])

    let errorFinal = error

    if (error && String(error.message || '').includes('codigo_barras')) {
      const { error: errorSinCodigo } = await supabase
        .from('productos')
        .insert([payloadSinCodigo])

      errorFinal = errorSinCodigo
    }

    setGuardandoProducto(false)

    if (errorFinal) {
      console.error(errorFinal)
      alert(`Error guardando producto: ${errorFinal.message || 'revisa permisos o esquema en Supabase'}`)
      return
    }

    setNombreProducto('')
    setCodigoBarrasProducto('')
    setCategoriaProducto('Producto')
    setUnidadProducto('unidad')
    setPrecioProducto('')
    setCosteProducto('')
    setStockProducto('')
    setStockMinimoProducto('')
    await cargarProductos()
  }

  const importarLoyverse = async (event: ChangeEvent<HTMLInputElement>) => {
    const archivo = event.target.files?.[0]
    if (!archivo) return

    setImportandoLoyverse(true)

    try {
      const texto = await archivo.text()
      const filas = parseCSV(texto).filter((fila) => fila.some((celda) => celda.trim()))
      const encabezados = filas[0] || []
      const indices = Object.fromEntries(encabezados.map((encabezado, index) => [encabezado, index]))
      const existentes = new Set(
        productos.map((producto) => {
          const codigo = producto.codigo_barras?.trim()
          if (codigo) return `codigo:${codigo}`
          return `nombre:${producto.nombre.trim().toLowerCase()}|${producto.categoria || ''}`
        })
      )

      const nuevos = filas.slice(1).flatMap((fila) => {
        const nombre = valorColumna(fila, indices, 'Nombre')
        if (!nombre) return []

        const codigoBarras = valorColumna(fila, indices, 'Codigo de barras')
        const categoria = valorColumna(fila, indices, 'Categoria') || null
        const precioTexto = valorColumna(fila, indices, 'Precio [Petsur Victoria]')
        const precio = precioTexto.toLowerCase() === 'variable' ? 0 : numeroDesdeInput(precioTexto)
        const coste = numeroDesdeInput(valorColumna(fila, indices, 'Coste'))
        const stock = numeroDesdeInput(valorColumna(fila, indices, 'En inventario [Petsur Victoria]'))
        const stockMinimo = numeroDesdeInput(
          valorColumna(fila, indices, 'Existencias bajas [Petsur Victoria]')
        )
        const llave = codigoBarras
          ? `codigo:${codigoBarras}`
          : `nombre:${nombre.trim().toLowerCase()}|${categoria || ''}`

        if (existentes.has(llave)) return []
        existentes.add(llave)

        return [
          {
            nombre,
            codigo_barras: codigoBarras || null,
            categoria,
            unidad: valorColumna(fila, indices, 'Vendido por peso') === 'Y' ? 'kg' : 'unidad',
            precio,
            coste,
            stock,
            stock_minimo: stockMinimo,
            activo: valorColumna(fila, indices, 'Disponibles para la venta [Petsur Victoria]') !== 'N',
          },
        ]
      })

      if (nuevos.length === 0) {
        alert('No encontré productos nuevos para importar')
        return
      }

      const { error } = await supabase.from('productos').insert(nuevos)

      if (error) {
        console.error(error)
        alert(`Error importando Loyverse: ${error.message}`)
        return
      }

      alert(`Importación lista: ${nuevos.length} productos agregados`)
      await cargarProductos()
    } catch (error) {
      console.error(error)
      alert('No pude leer el CSV de Loyverse')
    } finally {
      setImportandoLoyverse(false)
      event.target.value = ''
    }
  }

  const actualizarItemVentaManual = (
    itemId: string,
    campo: keyof Omit<ItemVentaManual, 'id'>,
    valor: string | boolean
  ) => {
    setItemsVentaManual((items) =>
      items.map((item) => (item.id === itemId ? { ...item, [campo]: valor } : item))
    )
  }

  const seleccionarProductoVentaManual = (itemId: string, producto: Producto) => {
    setItemsVentaManual((items) =>
      items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              productoId: String(producto.id),
              busqueda: producto.nombre,
              nombre: producto.nombre,
              categoria: producto.categoria || 'Producto',
              precioUnitario: producto.precio ? String(Math.round(Number(producto.precio))) : '',
              afectaInventario: true,
            }
          : item
      )
    )
    setSugerenciasVentaAbiertas(null)
  }

  const sugerenciasProductoVenta = (item: ItemVentaManual) => {
    const texto = item.busqueda.trim().toLowerCase()
    const familia = familiaVentaActiva.trim()

    return productos
      .filter((producto) => {
        const coincideFamilia = !familia || (producto.categoria || 'Sin categoría') === familia
        if (!coincideFamilia) return false
        if (!texto) return true

        return (
          producto.nombre.toLowerCase().includes(texto) ||
          (producto.codigo_barras || '').includes(texto)
        )
      })
      .slice(0, 8)
  }

  const agregarProductoManualPorCodigo = () => {
    const codigo = codigoBarrasVentaManual.trim()
    if (!codigo) return

    const producto = productos.find((p) => p.codigo_barras === codigo)
    if (!producto) {
      alert(`No encontré un producto con código ${codigo}`)
      setCodigoBarrasVentaManual('')
      return
    }

    setItemsVentaManual((items) => [
      ...items.filter((item) => item.nombre || item.busqueda),
      {
        id: crypto.randomUUID(),
        productoId: String(producto.id),
        busqueda: producto.nombre,
        nombre: producto.nombre,
        categoria: producto.categoria || 'Producto',
        cantidad: '1',
        precioUnitario: producto.precio ? String(Math.round(Number(producto.precio))) : '',
        afectaInventario: true,
      },
      crearItemVentaManual(),
    ])
    setCodigoBarrasVentaManual('')
  }

  const quitarItemVentaManual = (itemId: string) => {
    setItemsVentaManual((items) => {
      const restantes = items.filter((item) => item.id !== itemId)
      return restantes.length > 0 ? restantes : [crearItemVentaManual()]
    })
  }

  const guardarVentaManual = async () => {
    if (itemsVentaManualValidos.length === 0) {
      alert('Agrega al menos un producto o servicio')
      return
    }

    setGuardandoVentaManual(true)

    try {
      const { data: ventaCreada, error: errorVenta } = await supabase
        .from('ventas')
        .insert([
          {
            paciente_id: null,
            atencion_id: null,
            fecha: hoyLocalISO(),
            origen: 'venta',
            estado: metodoPagoVenta,
            notas: pieReciboVenta.trim() || null,
            total: totalVentaManual,
          },
        ])
        .select('id,paciente_id,atencion_id,fecha,origen,estado,notas,total,created_at')
        .single()

      if (errorVenta) {
        console.error(errorVenta)
        alert(`Error guardando venta: ${errorVenta.message}`)
        return
      }

      const ventaItems = itemsVentaManualValidos.map((item) => ({
        venta_id: ventaCreada.id,
        producto_id: item.productoId ? Number(item.productoId) : null,
        nombre: item.nombre,
        categoria: item.categoria,
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
        total: item.total,
        afecta_inventario: item.afectaInventario,
      }))

      const { error: errorItems } = await supabase.from('venta_items').insert(ventaItems)

      if (errorItems) {
        console.error(errorItems)
        alert(`Venta creada, pero falló el detalle: ${errorItems.message}`)
        return
      }

      await Promise.all(
        itemsVentaManualValidos
          .filter((item) => item.afectaInventario && item.productoId)
          .map(async (item) => {
            const producto = productos.find((p) => String(p.id) === item.productoId)
            if (!producto) return

            const nuevoStock = Math.max(Number(producto.stock || 0) - item.cantidad, 0)
            const { error } = await supabase
              .from('productos')
              .update({ stock: nuevoStock })
              .eq('id', Number(item.productoId))

            if (error) console.error(error)
          })
      )

      const ventaCompleta: Venta = {
        ...((ventaCreada as unknown) as Venta),
        venta_items: ventaItems.map((item, index) => ({
          id: index + 1,
          nombre: item.nombre,
          categoria: item.categoria,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          total: item.total,
          afecta_inventario: item.afecta_inventario,
        })),
      }

      setItemsVentaManual([crearItemVentaManual()])
      setReciboVenta(emitirReciboVenta ? ventaCompleta : null)
      await Promise.all([cargarVentas(), cargarProductos()])
    } catch (error) {
      console.error(error)
      alert('No se pudo guardar la venta. Revisa la conexión a internet y vuelve a intentar.')
    } finally {
      setGuardandoVentaManual(false)
    }
  }

  const editarPaciente = (paciente: Paciente) => {
    abrirSeccion('pacientes')
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
    setSexoPaciente(paciente.sexo || '')
    setPesoPaciente(
      paciente.peso !== null && paciente.peso !== undefined ? String(paciente.peso) : ''
    )
    setNombreTutor(paciente.tutores?.nombre || '')
    setTelefonoTutor(paciente.tutores?.telefono || '')
    setCitaPendienteCrearFichaId(null)
    irANuevoPaciente()
  }

  const crearFichaDesdeCita = (cita: Cita) => {
    abrirSeccion('pacientes')
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
    setSexoPaciente('')
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
    if (!fecha || !hora) {
      alert('Completa fecha y hora')
      return
    }

    if (modoReserva === 'existente' && !pacienteId) {
      alert('Selecciona un paciente')
      return
    }

    if (modoReserva === 'nuevo') {
      if (
        !nombreMascotaReserva.trim() ||
        !especieReservaFinal
      ) {
        alert('Completa nombre de mascota y especie para la reserva')
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
            motivo: motivoFinal || 'Atención',
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
            motivo: motivoFinal || 'Atención',
            estado,
            es_paciente_nuevo: true,
            nombre_tutor: nombreTutorReserva.trim() || null,
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
    abrirSeccion('agenda')
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
    abrirSeccion('agenda')
    setEditandoCitaId(null)
    setFecha(fechaSeleccionada)
    setHora(horaSeleccionada)
    setVeterinario(vet)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const citasDelDia = useMemo(() => {
    return citas.filter((c) => c.fecha === fecha)
  }, [citas, fecha])

  const citasHoy = useMemo(() => {
    const hoy = hoyLocalISO()
    return citas.filter((c) => c.fecha === hoy)
  }, [citas])

  const proximasCitas = useMemo(() => {
    const ahora = hoyLocalISO()
    return citas.filter((c) => c.fecha >= ahora).slice(0, 5)
  }, [citas])

  const controlesHoy = useMemo(() => {
    return citasHoy.filter((c) => c.motivo.toLowerCase().includes('control'))
  }, [citasHoy])

  const cirugiasHoy = useMemo(() => {
    return citasHoy.filter((c) => c.motivo.toLowerCase().includes('cirug'))
  }, [citasHoy])

  const citasPendientes = useMemo(() => {
    return citas.filter((c) =>
      ['Agendada', 'Confirmada', 'En espera'].includes(c.estado)
    )
  }, [citas])

  const ventasHoy = useMemo(() => {
    const hoy = hoyLocalISO()
    return ventas.filter((venta) => venta.fecha === hoy)
  }, [ventas])

  const totalVentasHoy = useMemo(() => {
    return ventasHoy.reduce((total, venta) => total + Number(venta.total || 0), 0)
  }, [ventasHoy])

  const productosBajoStock = useMemo(() => {
    return productos.filter((producto) => {
      const stock = Number(producto.stock || 0)
      const minimo = Number(producto.stock_minimo || 0)
      return minimo > 0 && stock <= minimo
    })
  }, [productos])

  const familiasProductos = useMemo(() => {
    return Array.from(
      new Set(productos.map((producto) => producto.categoria || 'Sin categoría'))
    ).sort((a, b) => a.localeCompare(b, 'es'))
  }, [productos])

  const itemsVentaManualValidos = useMemo(() => {
    return itemsVentaManual
      .map((item) => {
        const cantidad = Math.max(numeroDesdeInput(item.cantidad, 1), 0)
        const precioUnitario = Math.max(numeroDesdeInput(item.precioUnitario), 0)

        return {
          ...item,
          nombre: item.nombre.trim(),
          cantidad,
          precioUnitario,
          total: cantidad * precioUnitario,
        }
      })
      .filter((item) => item.nombre)
  }, [itemsVentaManual])

  const totalVentaManual = useMemo(() => {
    return itemsVentaManualValidos.reduce((total, item) => total + item.total, 0)
  }, [itemsVentaManualValidos])

  const ivaVentaManual = useMemo(() => {
    return Math.round(totalVentaManual - totalVentaManual / 1.19)
  }, [totalVentaManual])

  const valorInventarioVenta = useMemo(() => {
    return productos.reduce(
      (total, producto) => total + Number(producto.stock || 0) * Number(producto.precio || 0),
      0
    )
  }, [productos])

  const valorInventarioCosto = useMemo(() => {
    return productos.reduce(
      (total, producto) => total + Number(producto.stock || 0) * Number(producto.coste || 0),
      0
    )
  }, [productos])

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
    <main className="min-h-screen bg-slate-100 px-4 py-5 sm:p-6 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
<div className="pt-14 flex flex-col gap-4 sm:pt-12 md:flex-row md:items-start md:justify-between">
  <div>
    <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
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
    className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
  >
    ⚙️ Configuración
  </Link>
</div>

        {seccionActiva !== 'inicio' && (
          <button
            onClick={() => setSeccionActiva('inicio')}
            className={buttonSecondary}
          >
            ← Volver al dashboard
          </button>
        )}

        {seccionActiva === 'inicio' && (
          <>
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <button onClick={irAAgenda} className={moduleCardClass}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                  Agenda
                </div>
                <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                  {citasHoy.length}
                </div>
              </div>
              <div className="rounded-2xl bg-sky-100 px-4 py-3 text-3xl dark:bg-sky-900/40">
                🗓️
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Citas para hoy y calendario clínico.
            </p>
            <div className="mt-4 text-sm font-medium text-sky-700 dark:text-sky-300">
              Abrir agenda
            </div>
          </button>

          <button onClick={irANuevoPaciente} className={moduleCardClass}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                  Pacientes
                </div>
                <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                  {pacientes.length}
                </div>
              </div>
              <div className="rounded-2xl bg-emerald-100 px-4 py-3 text-3xl dark:bg-emerald-900/40">
                🐾
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Crear paciente, buscar tutor y vincular reservas.
            </p>
            <div className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Nuevo paciente
            </div>
          </button>

          <button onClick={irAFichas} className={moduleCardClass}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                  Fichas
                </div>
                <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                  {pacientes.length}
                </div>
              </div>
              <div className="rounded-2xl bg-indigo-100 px-4 py-3 text-3xl dark:bg-indigo-900/40">
                📋
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Historial clínico, atenciones y recetas.
            </p>
            <div className="mt-4 text-sm font-medium text-indigo-700 dark:text-indigo-300">
              Ver fichas
            </div>
          </button>

          <Link href="/configuracion" className={moduleCardClass}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                  Clínica
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                  Activa
                </div>
              </div>
              <div className="rounded-2xl bg-violet-100 px-4 py-3 text-3xl dark:bg-violet-900/40">
                ⚙️
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Datos de clínica, veterinarios, firmas y recetas.
            </p>
            <div className="mt-4 text-sm font-medium text-violet-700 dark:text-violet-300">
              Configurar
            </div>
          </Link>

          <button onClick={irAReservas} className={moduleCardClass}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                  Recordatorios
                </div>
                <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                  0
                </div>
              </div>
              <div className="rounded-2xl bg-amber-100 px-4 py-3 text-3xl dark:bg-amber-900/40">
                🔔
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Próximo módulo: controles por correo y WhatsApp.
            </p>
            <div className="mt-4 text-sm font-medium text-amber-700 dark:text-amber-300">
              Preparar controles
            </div>
          </button>

          <button onClick={() => abrirSeccion('ventas')} className={moduleCardClass}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xl font-semibold text-slate-700 dark:text-slate-200">
                  Ventas
                </div>
                <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                  {ventas.length}
                </div>
              </div>
              <div className="rounded-2xl bg-rose-100 px-4 py-3 text-3xl dark:bg-rose-900/40">
                🧾
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Boletas, servicios y productos vendidos.
            </p>
            <div className="mt-4 text-sm font-medium text-rose-700 dark:text-rose-300">
              Hoy: {formatoCLP(totalVentasHoy)}
            </div>
          </button>

          <button onClick={() => abrirSeccion('inventario')} className={moduleCardClass}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xl font-semibold text-slate-700 dark:text-slate-200">
                  Inventario
                </div>
                <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                  {productos.length}
                </div>
              </div>
              <div className="rounded-2xl bg-teal-100 px-4 py-3 text-3xl dark:bg-teal-900/40">
                📦
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Stock, vencimientos y alertas de reposición.
            </p>
            <div className="mt-4 text-sm font-medium text-teal-700 dark:text-teal-300">
              Bajo stock: {productosBajoStock.length}
            </div>
          </button>

          <div className={moduleCardClass}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xl font-semibold text-slate-700 dark:text-slate-200">
                  Próximas citas
                </div>
                <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                  {proximasCitas.length}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-3xl dark:bg-slate-800">
                ⏱️
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Vista rápida de la operación de los próximos días.
            </p>
            <div className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">
              {proximasCitas[0]
                ? `${proximasCitas[0].fecha} · ${proximasCitas[0].hora}`
                : 'Sin citas próximas'}
            </div>
          </div>
        </section>

        <section className={cardClass}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Resumen importante
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Vista rápida para recepción y clínica.
              </p>
            </div>
            <button onClick={() => abrirSeccion('agenda')} className={buttonSecondary}>
              Ver agenda
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Cirugías hoy
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {cirugiasHoy.length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Controles hoy
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {controlesHoy.length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Citas pendientes
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {citasPendientes.length}
              </div>
            </div>
          </div>
        </section>
          </>
        )}

        {(seccionActiva === 'pacientes' || seccionActiva === 'agenda') && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {seccionActiva === 'pacientes' && (
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

              <select
                className={inputClass}
                value={sexoPaciente}
                onChange={(e) => setSexoPaciente(e.target.value)}
              >
                <option value="">Sexo (opcional)</option>
                <option value="Hembra">Hembra</option>
                <option value="Macho">Macho</option>
                <option value="No informado">No informado</option>
              </select>

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
          )}

          {seccionActiva === 'agenda' && (
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
                      placeholder="Nombre tutor (opcional)"
                      value={nombreTutorReserva}
                      onChange={(e) => setNombreTutorReserva(e.target.value)}
                    />

                    <input
                      className={inputClass}
                      placeholder="Teléfono (opcional)"
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

                    <div className="overflow-x-auto pb-2">
                    <div className="grid min-w-[720px] grid-cols-7 gap-3 text-sm">
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

                    <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                      <div className="min-w-[640px]">
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
          )}
        </div>
        )}

        {seccionActiva === 'fichas' && (
        <div ref={fichasRef} className={cardClass}>
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

          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="min-w-[980px]">
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
        </div>
        )}

        {seccionActiva === 'recordatorios' && (
        <div ref={reservasRef} className={cardClass}>
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

  <div className="overflow-x-auto">
    <div className="min-w-[900px]">

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
        </div>
        )}

        {seccionActiva === 'ventas' && (
          <section className={cardClass}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Ventas
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Servicios, procedimientos y productos vinculados a atenciones clínicas.
                </p>
              </div>
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-right dark:bg-rose-950/40">
                <div className="text-xs font-medium uppercase text-rose-600 dark:text-rose-300">
                  Total de hoy
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {formatoCLP(totalVentasHoy)}
                </div>
              </div>
            </div>

            {!ventasDisponibles ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                Para activar este módulo, ejecuta el SQL de{' '}
                <span className="font-semibold">supabase/ventas_atenciones.sql</span> en Supabase.
                Las atenciones se seguirán guardando aunque ventas todavía no esté activado.
              </div>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_0.65fr]">
                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          Nueva venta
                        </h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          Busca por nombre, familia o código de barras.
                        </p>
                      </div>
                      <input
                        className={`${inputClass} md:max-w-sm`}
                        placeholder="Escanear código y presionar Enter"
                        value={codigoBarrasVentaManual}
                        onChange={(e) => setCodigoBarrasVentaManual(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') agregarProductoManualPorCodigo()
                        }}
                      />
                    </div>

                    <div className="mt-4 max-w-xs">
                      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Familia
                      </label>
                      <select
                        className={inputClass}
                        value={familiaVentaActiva}
                        onChange={(e) => setFamiliaVentaActiva(e.target.value)}
                      >
                        <option value="">Todas</option>
                        {familiasProductos.map((familia) => (
                          <option key={familia} value={familia}>
                            {familia}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-4 space-y-3">
                      {itemsVentaManual.map((item) => {
                        const cantidad = Math.max(numeroDesdeInput(item.cantidad, 1), 0)
                        const precioUnitario = Math.max(numeroDesdeInput(item.precioUnitario), 0)
                        const total = cantidad * precioUnitario
                        const sugerencias = sugerenciasProductoVenta(item)

                        return (
                          <div
                            key={item.id}
                            className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"
                          >
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_0.55fr_0.7fr_auto]">
                              <div className="relative">
                                <input
                                  className={inputClass}
                                  placeholder="Producto o servicio"
                                  value={item.busqueda}
                                  onChange={(e) => {
                                    actualizarItemVentaManual(item.id, 'busqueda', e.target.value)
                                    actualizarItemVentaManual(item.id, 'nombre', e.target.value)
                                    actualizarItemVentaManual(item.id, 'productoId', '')
                                    actualizarItemVentaManual(item.id, 'afectaInventario', false)
                                    setSugerenciasVentaAbiertas(item.id)
                                  }}
                                  onFocus={() => setSugerenciasVentaAbiertas(item.id)}
                                  onBlur={() => {
                                    setTimeout(() => setSugerenciasVentaAbiertas(null), 120)
                                  }}
                                />
                                {sugerenciasVentaAbiertas === item.id &&
                                item.busqueda.trim() &&
                                sugerencias.length > 0 && (
                                  <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
                                    {sugerencias.map((producto) => (
                                      <button
                                        type="button"
                                        key={producto.id}
                                        onClick={() =>
                                          seleccionarProductoVentaManual(item.id, producto)
                                        }
                                        className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                                      >
                                        <div className="font-medium text-slate-900 dark:text-white">
                                          {producto.nombre}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                          {producto.categoria || 'Sin categoría'} ·{' '}
                                          {producto.codigo_barras || 'sin código'} · stock{' '}
                                          {Number(producto.stock || 0)} ·{' '}
                                          {formatoCLP(Number(producto.precio || 0))}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <input
                                className={inputClass}
                                placeholder="Cant."
                                inputMode="decimal"
                                value={item.cantidad}
                                onChange={(e) =>
                                  actualizarItemVentaManual(item.id, 'cantidad', e.target.value)
                                }
                              />
                              <input
                                className={inputClass}
                                placeholder="Precio"
                                inputMode="numeric"
                                value={item.precioUnitario}
                                onChange={(e) =>
                                  actualizarItemVentaManual(
                                    item.id,
                                    'precioUnitario',
                                    e.target.value
                                  )
                                }
                              />
                              <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {formatoCLP(total)}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => quitarItemVentaManual(item.id)}
                                  className="text-sm font-medium text-rose-600 dark:text-rose-300"
                                >
                                  Quitar
                                </button>
                              </div>
                            </div>
                            <label className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                              <input
                                type="checkbox"
                                checked={item.afectaInventario}
                                onChange={(e) =>
                                  actualizarItemVentaManual(
                                    item.id,
                                    'afectaInventario',
                                    e.target.checked
                                  )
                                }
                              />
                              Descontar de inventario
                            </label>
                          </div>
                        )
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setItemsVentaManual((items) => [...items, crearItemVentaManual()])
                      }
                      className="mt-4 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium dark:border-slate-700"
                    >
                      Agregar línea
                    </button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      Total
                    </div>
                    <div className="mt-1 text-5xl font-bold text-slate-900 dark:text-white">
                      {formatoCLP(totalVentaManual)}
                    </div>
                    <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      IVA incluido: {formatoCLP(ivaVentaManual)}
                    </div>

                    <div className="mt-5 space-y-3">
                      <select
                        className={inputClass}
                        value={metodoPagoVenta}
                        onChange={(e) => setMetodoPagoVenta(e.target.value)}
                      >
                        <option>Tarjeta</option>
                        <option>Efectivo</option>
                        <option>Transferencia</option>
                        <option>Mixto</option>
                      </select>
                      <textarea
                        className={`${inputClass} min-h-[90px]`}
                        placeholder="Mensaje al pie del recibo"
                        value={pieReciboVenta}
                        onChange={(e) => setPieReciboVenta(e.target.value)}
                      />
                      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={emitirReciboVenta}
                          onChange={(e) => setEmitirReciboVenta(e.target.checked)}
                        />
                        Mostrar recibo al guardar
                      </label>
                      <button
                        type="button"
                        onClick={guardarVentaManual}
                        disabled={guardandoVentaManual}
                        className={buttonPrimary}
                      >
                        {guardandoVentaManual ? 'Guardando...' : 'Guardar venta'}
                      </button>
                    </div>
                  </div>
                </div>

                {reciboVenta && (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          Recibo de venta
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Puedes imprimirlo o guardarlo como PDF desde el navegador.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className={buttonSecondary}
                      >
                        Imprimir
                      </button>
                    </div>

                    <div className="mx-auto mt-5 max-w-md rounded-xl bg-white p-6 text-slate-900 shadow-sm print:shadow-none">
                      <div className="text-center">
                        <div className="text-sm font-semibold">
                          {configuracion?.nombre_clinica || 'VetFlow'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {configuracion?.direccion || ''}
                        </div>
                        <div className="text-xs text-slate-500">
                          {configuracion?.telefono || ''}
                        </div>
                        <div className="mt-4 text-5xl font-light">
                          {formatoCLP(Number(reciboVenta.total || 0))}
                        </div>
                        <div>Total</div>
                      </div>

                      <div className="my-5 border-t border-slate-200" />
                      <div className="text-sm">
                        <div>Empleado: Propietario</div>
                        <div>TPV: Clínica</div>
                      </div>
                      <div className="my-5 border-t border-slate-200" />

                      <div className="space-y-4">
                        {(reciboVenta.venta_items || []).map((item) => (
                          <div key={`${item.nombre}-${item.total}`} className="flex gap-4">
                            <div className="flex-1">
                              <div className="font-medium">{item.nombre}</div>
                              <div className="text-sm text-slate-500">
                                {item.cantidad} x {formatoCLP(Number(item.precio_unitario || 0))}
                              </div>
                            </div>
                            <div className="font-medium">
                              {formatoCLP(Number(item.total || 0))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="my-5 border-t border-slate-200" />
                      <div className="space-y-2">
                        <div className="flex justify-between font-bold">
                          <span>Total</span>
                          <span>{formatoCLP(Number(reciboVenta.total || 0))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>IVA19%</span>
                          <span>
                            {formatoCLP(Math.round(Number(reciboVenta.total || 0) - Number(reciboVenta.total || 0) / 1.19))}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>{reciboVenta.estado}</span>
                          <span>{formatoCLP(Number(reciboVenta.total || 0))}</span>
                        </div>
                      </div>

                      <div className="my-5 border-t border-slate-200" />
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>{new Date(reciboVenta.created_at).toLocaleString('es-CL')}</span>
                        <span>N° {String(reciboVenta.id).padStart(5, '0')}</span>
                      </div>
                      {pieReciboVenta.trim() && (
                        <div className="mt-5 text-center text-sm text-slate-500">
                          {pieReciboVenta}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {ventas.length > 0 && (
                  <div className="mt-5 overflow-x-auto">
                    <div className="min-w-[760px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                      <div className="grid grid-cols-[1fr_1.2fr_1.2fr_0.8fr_0.8fr] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                        <div>Fecha</div>
                        <div>Paciente</div>
                        <div>Detalle</div>
                        <div>Estado</div>
                        <div className="text-right">Total</div>
                      </div>
                      {ventas.slice(0, 20).map((venta) => (
                        <div
                          key={venta.id}
                          className="grid grid-cols-[1fr_1.2fr_1.2fr_0.8fr_0.8fr] border-t border-slate-200 px-4 py-4 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200"
                        >
                          <div>{formatDateLabel(venta.fecha)}</div>
                          <div>
                            <div className="font-medium">
                              {venta.pacientes?.nombre || 'Venta directa'}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {venta.pacientes?.especie || venta.origen}
                            </div>
                          </div>
                          <div className="space-y-1">
                            {(venta.venta_items || []).slice(0, 3).map((item) => (
                              <div key={item.id}>
                                {item.nombre} x {item.cantidad}
                              </div>
                            ))}
                          </div>
                          <div>{venta.estado}</div>
                          <div className="text-right font-semibold">
                            {formatoCLP(Number(venta.total || 0))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {seccionActiva === 'inventario' && (
          <section className={cardClass}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Inventario
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Productos y servicios que pueden venderse desde una atención clínica.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                  {importandoLoyverse ? 'Importando...' : 'Importar Loyverse'}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={importarLoyverse}
                    disabled={importandoLoyverse}
                    className="hidden"
                  />
                </label>
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-right dark:bg-emerald-950/40">
                  <div className="text-xs font-medium uppercase text-emerald-600 dark:text-emerald-300">
                    Valorizado venta
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {formatoCLP(valorInventarioVenta)}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right dark:bg-slate-950">
                  <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                    Costo
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {formatoCLP(valorInventarioCosto)}
                  </div>
                </div>
                <div className="rounded-2xl bg-teal-50 px-4 py-3 text-right dark:bg-teal-950/40">
                  <div className="text-xs font-medium uppercase text-teal-600 dark:text-teal-300">
                    Bajo stock
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {productosBajoStock.length}
                  </div>
                </div>
              </div>
            </div>

            {!inventarioDisponible ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                Falta activar la tabla de productos en Supabase. Ya está incluida en
                <span className="font-semibold"> supabase/ventas_atenciones.sql</span>.
              </div>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-6">
                  <input
                    className={`${inputClass} md:col-span-2`}
                    placeholder="Nombre producto o servicio"
                    value={nombreProducto}
                    onChange={(e) => setNombreProducto(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    placeholder="Código de barras"
                    value={codigoBarrasProducto}
                    onChange={(e) => setCodigoBarrasProducto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') guardarProducto()
                    }}
                  />
                  <select
                    className={inputClass}
                    value={categoriaProducto}
                    onChange={(e) => setCategoriaProducto(e.target.value)}
                  >
                    <option>Producto</option>
                    <option>Medicamento</option>
                    <option>Vacuna</option>
                    <option>Alimento</option>
                    <option>Procedimiento</option>
                    <option>Otro</option>
                  </select>
                  <input
                    className={inputClass}
                    placeholder="Precio"
                    inputMode="numeric"
                    value={precioProducto}
                    onChange={(e) => setPrecioProducto(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    placeholder="Costo"
                    inputMode="numeric"
                    value={costeProducto}
                    onChange={(e) => setCosteProducto(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={guardarProducto}
                    disabled={guardandoProducto}
                    className={buttonPrimary}
                  >
                    {guardandoProducto ? 'Guardando...' : 'Agregar'}
                  </button>
                  <input
                    className={inputClass}
                    placeholder="Unidad"
                    value={unidadProducto}
                    onChange={(e) => setUnidadProducto(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    placeholder="Stock"
                    inputMode="decimal"
                    value={stockProducto}
                    onChange={(e) => setStockProducto(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    placeholder="Stock mínimo"
                    inputMode="decimal"
                    value={stockMinimoProducto}
                    onChange={(e) => setStockMinimoProducto(e.target.value)}
                  />
                </div>

                <div className="mt-5 overflow-x-auto">
                  <div className="min-w-[1100px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="grid grid-cols-[1.4fr_1fr_1fr_0.7fr_0.8fr_0.8fr_0.7fr_0.9fr_0.9fr_0.8fr_0.8fr] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                      <div>Nombre</div>
                      <div>Código</div>
                      <div>Categoría</div>
                      <div>Unidad</div>
                      <div>Costo</div>
                      <div>Precio</div>
                      <div>Stock</div>
                      <div>Valor costo</div>
                      <div>Valor venta</div>
                      <div>Margen</div>
                      <div>Alerta</div>
                    </div>
                    {productos.length > 0 ? (
                      productos.map((producto) => {
                        const stock = Number(producto.stock || 0)
                        const minimo = Number(producto.stock_minimo || 0)
                        const coste = Number(producto.coste || 0)
                        const precio = Number(producto.precio || 0)
                        const valorCosto = stock * coste
                        const valorVenta = stock * precio
                        const margen = valorVenta - valorCosto
                        const bajoStock = minimo > 0 && stock <= minimo

                        return (
                          <div
                            key={producto.id}
                            className="grid grid-cols-[1.4fr_1fr_1fr_0.7fr_0.8fr_0.8fr_0.7fr_0.9fr_0.9fr_0.8fr_0.8fr] border-t border-slate-200 px-4 py-4 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200"
                          >
                            <div className="font-medium">{producto.nombre}</div>
                            <div>{producto.codigo_barras || '-'}</div>
                            <div>{producto.categoria || '-'}</div>
                            <div>{producto.unidad || '-'}</div>
                            <div>{formatoCLP(coste)}</div>
                            <div>{formatoCLP(precio)}</div>
                            <div>{stock}</div>
                            <div>{formatoCLP(valorCosto)}</div>
                            <div>{formatoCLP(valorVenta)}</div>
                            <div>{formatoCLP(margen)}</div>
                            <div>
                              {bajoStock ? (
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                  Reponer
                                </span>
                              ) : (
                                <span className="text-slate-400">OK</span>
                              )}
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="border-t border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        Aún no hay productos. Agrega el primero para usarlo desde la ficha clínica.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
