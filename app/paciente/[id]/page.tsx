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
  sexo?: string | null
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
    telefono?: string | null
    direccion?: string | null
    firma_url?: string | null
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

type Producto = {
  id: number
  nombre: string
  codigo_barras: string | null
  categoria: string | null
  unidad: string | null
  precio: number | null
  stock: number | null
  stock_minimo: number | null
  activo: boolean | null
}

type ItemVentaAtencion = {
  id: string
  productoId: string
  nombre: string
  categoria: string
  cantidad: string
  precioUnitario: string
  afectaInventario: boolean
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

function esperarFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

function crearItemVenta(): ItemVentaAtencion {
  return {
    id: crypto.randomUUID(),
    productoId: '',
    nombre: '',
    categoria: 'Procedimiento',
    cantidad: '1',
    precioUnitario: '',
    afectaInventario: false,
  }
}

function numeroDesdeInput(valor: string, fallback = 0) {
  const normalizado = valor.replace(',', '.')
  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : fallback
}

function formatoCLP(valor: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(valor)
}

export default function FichaPacientePage() {
  const params = useParams()
  const id = params.id as string

  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [atenciones, setAtenciones] = useState<Atencion[]>([])
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [veterinarios, setVeterinarios] = useState<Veterinario[]>([])
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])

  const [motivoVisita, setMotivoVisita] = useState('')
  const [anamnesis, setAnamnesis] = useState('')
  const [examenClinico, setExamenClinico] = useState('')
  const [inyectablesProcedimientos, setInyectablesProcedimientos] = useState('')
  const [suministrosComprasAtencion, setSuministrosComprasAtencion] = useState('')
  const [itemsVentaAtencion, setItemsVentaAtencion] = useState<ItemVentaAtencion[]>([])
  const [codigoBarrasVenta, setCodigoBarrasVenta] = useState('')
  const [familiaVentaActiva, setFamiliaVentaActiva] = useState('')
  const [sugerenciasVentaAbiertas, setSugerenciasVentaAbiertas] = useState<string | null>(null)
  const [tratamientoAtencion, setTratamientoAtencion] = useState('')
  const [indicacionesAtencion, setIndicacionesAtencion] = useState('')
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [mostrarReceta, setMostrarReceta] = useState(false)
  const [guardandoReceta, setGuardandoReceta] = useState(false)

  const [fechaReceta, setFechaReceta] = useState(fechaHoyISO())
  const [veterinarioId, setVeterinarioId] = useState('')
  const [pinIngresado, setPinIngresado] = useState('')
  const [tratamiento, setTratamiento] = useState('')
  const [indicacionControl, setIndicacionControl] = useState('')

  const [recetaGenerada, setRecetaGenerada] = useState(false)
  const [ultimaRecetaId, setUltimaRecetaId] = useState<number | null>(null)
  const [recetaVista, setRecetaVista] = useState<Receta | null>(null)

  const recetaRef = useRef<HTMLDivElement | null>(null)
  const recetaSectionRef = useRef<HTMLDivElement | null>(null)

  const cardClass =
    'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900'
  const inputClass =
    'w-full min-w-0 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-500 dark:focus:ring-slate-800'

  const veterinarioSeleccionado = useMemo(() => {
    return veterinarios.find((v) => String(v.id) === veterinarioId) || null
  }, [veterinarioId, veterinarios])

  const veterinarioRecetaVisible = recetaVista?.veterinarios || veterinarioSeleccionado
  const fechaRecetaVisible = recetaVista?.fecha || fechaReceta
  const rpVisible = recetaVista?.tratamiento || tratamiento
  const indicacionControlVisible = recetaVista?.indicaciones || indicacionControl
  const recetaIdVisible = recetaVista?.id || ultimaRecetaId
  const itemsVentaValidos = useMemo(() => {
    return itemsVentaAtencion
      .map((item) => {
        const cantidad = Math.max(numeroDesdeInput(item.cantidad, 1), 0)
        const precioUnitario = Math.max(numeroDesdeInput(item.precioUnitario), 0)

        return {
          ...item,
          productoId: item.productoId,
          nombre: item.nombre.trim(),
          cantidad,
          precioUnitario,
          total: cantidad * precioUnitario,
        }
      })
      .filter((item) => item.nombre)
  }, [itemsVentaAtencion])
  const totalVentaAtencion = useMemo(() => {
    return itemsVentaValidos.reduce((total, item) => total + item.total, 0)
  }, [itemsVentaValidos])
  const familiasProductos = useMemo(() => {
    return Array.from(
      new Set(productos.map((producto) => producto.categoria || 'Sin categoría'))
    ).sort((a, b) => a.localeCompare(b, 'es'))
  }, [productos])

  const actualizarItemVenta = (
    itemId: string,
    campo: keyof Omit<ItemVentaAtencion, 'id'>,
    valor: string | boolean
  ) => {
    setItemsVentaAtencion((items) =>
      items.map((item) => (item.id === itemId ? { ...item, [campo]: valor } : item))
    )
  }

  const quitarItemVenta = (itemId: string) => {
    setItemsVentaAtencion((items) => items.filter((item) => item.id !== itemId))
  }

  const seleccionarProductoVentaDesdeBusqueda = (itemId: string, producto: Producto) => {
    setItemsVentaAtencion((items) =>
      items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              productoId: String(producto.id),
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

  const sugerenciasProductoVenta = (item: ItemVentaAtencion) => {
    const texto = item.nombre.trim().toLowerCase()
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

  const itemDesdeProducto = (producto: Producto): ItemVentaAtencion => ({
    id: crypto.randomUUID(),
    productoId: String(producto.id),
    nombre: producto.nombre,
    categoria: producto.categoria || 'Producto',
    cantidad: '1',
    precioUnitario: producto.precio ? String(Math.round(Number(producto.precio))) : '',
    afectaInventario: true,
  })

  const agregarProductoPorCodigo = () => {
    const codigo = codigoBarrasVenta.trim()
    if (!codigo) return

    const producto = productos.find((p) => p.codigo_barras === codigo)

    if (!producto) {
      alert(`No encontré un producto con código ${codigo}`)
      setCodigoBarrasVenta('')
      return
    }

    setItemsVentaAtencion((items) => [...items, itemDesdeProducto(producto)])
    setCodigoBarrasVenta('')
  }

  const irAReceta = () => {
    setTimeout(() => {
      recetaSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 100)
  }

  const verRecetaEmitida = (receta: Receta) => {
    setRecetaVista(receta)
    setMostrarReceta(true)
    setRecetaGenerada(false)
    setUltimaRecetaId(receta.id)
    setFechaReceta(receta.fecha)
    setTratamiento(receta.tratamiento)
    setIndicacionControl(receta.indicaciones || '')
    setVeterinarioId('')
    setPinIngresado('')
    irAReceta()
  }

  const cargarPaciente = async () => {
    const { data, error } = await supabase
      .from('pacientes')
      .select('*, tutores ( nombre, telefono )')
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
          rut,
          telefono,
          direccion,
          firma_url
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

  const cargarProductos = async () => {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('activo', true)
      .order('nombre', { ascending: true })

    if (error) {
      console.error('Error cargando productos:', error)
      setProductos([])
      return
    }

    setProductos(data ? (((data ?? []) as unknown) as Producto[]) : [])
  }

const guardarAtencion = async () => {
  const detalleItemsVenta = itemsVentaValidos
    .map((item) => {
      const total = item.total > 0 ? ` - ${formatoCLP(item.total)}` : ''
      return `- ${item.nombre} (${item.categoria}) x ${item.cantidad}${total}`
    })
    .join('\n')

  const descripcionFinal = `
Motivo de visita:
${motivoVisita.trim()}

Anamnesis:
${anamnesis.trim()}

Examen clínico:
${examenClinico.trim()}

Inyectables / procedimientos:
${inyectablesProcedimientos.trim()}

Suministros / compras asociadas:
${suministrosComprasAtencion.trim()}
${detalleItemsVenta ? `\n${detalleItemsVenta}` : ''}

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

  const { data: atencionCreada, error } = await supabase
    .from('atenciones')
    .insert([
      {
        paciente_id: Number(id),
        descripcion: descripcionFinal,
      },
    ])
    .select('id')
    .single()

  if (error) {
    setGuardando(false)
    console.error(error)
    alert('Error guardando atención')
    return
  }

  if (itemsVentaValidos.length > 0) {
    const { data: ventaCreada, error: errorVenta } = await supabase
      .from('ventas')
      .insert([
        {
          paciente_id: Number(id),
          atencion_id: atencionCreada?.id ?? null,
          fecha: fechaHoyISO(),
          origen: 'atencion',
          estado: 'pendiente',
          notas: suministrosComprasAtencion.trim() || null,
          total: totalVentaAtencion,
        },
      ])
      .select('id')
      .single()

    if (errorVenta) {
      setGuardando(false)
      console.error(errorVenta)
      alert(
        'La atención quedó guardada, pero falta activar las tablas de ventas en Supabase para vincular los productos.'
      )
      await cargarAtenciones()
      return
    }

    const ventaItems = itemsVentaValidos.map((item) => ({
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
      setGuardando(false)
      console.error(errorItems)
      alert('La atención y la venta quedaron creadas, pero hubo un problema guardando el detalle.')
      await cargarAtenciones()
      return
    }

    await Promise.all(
      itemsVentaValidos
        .filter((item) => item.afectaInventario && item.productoId)
        .map(async (item) => {
          const producto = productos.find((p) => String(p.id) === item.productoId)
          if (!producto) return

          const stockActual = Number(producto.stock || 0)
          const nuevoStock = Math.max(stockActual - item.cantidad, 0)
          const { error: errorStock } = await supabase
            .from('productos')
            .update({ stock: nuevoStock })
            .eq('id', Number(item.productoId))

          if (errorStock) {
            console.error('Error actualizando stock:', errorStock)
          }
        })
    )

    await cargarProductos()
  }

  setGuardando(false)

  setMotivoVisita('')
  setAnamnesis('')
  setExamenClinico('')
  setInyectablesProcedimientos('')
  setSuministrosComprasAtencion('')
  setItemsVentaAtencion([])
  setTratamientoAtencion('')
  setIndicacionesAtencion('')

  await cargarAtenciones()
}

  const limpiarFormularioReceta = () => {
    setFechaReceta(fechaHoyISO())
    setVeterinarioId('')
    setPinIngresado('')
    setTratamiento('')
    setIndicacionControl('')
    setRecetaGenerada(false)
    setUltimaRecetaId(null)
    setRecetaVista(null)
  }

  const generarReceta = async () => {
    if (!veterinarioId || !tratamiento.trim()) {
      alert('Debes seleccionar veterinario y escribir la receta')
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
          diagnostico: null,
          tratamiento: tratamiento.trim(),
          indicaciones: indicacionControl.trim() || null,
          observaciones: null,
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
    setRecetaVista(null)
    await cargarRecetas()
  }

  const prepararRecetaParaExportar = () => {
    if (!recetaRef.current) return null

    const elemento = recetaRef.current

    const prevBackground = elemento.style.background
    const prevColor = elemento.style.color
    const prevBoxShadow = elemento.style.boxShadow
    const prevBorder = elemento.style.border
    const prevWidth = elemento.style.width
    const prevMinWidth = elemento.style.minWidth
    const prevMaxWidth = elemento.style.maxWidth
    const prevBoxSizing = elemento.style.boxSizing

    elemento.style.background = '#ffffff'
    elemento.style.color = '#111827'
    elemento.style.boxShadow = 'none'
    elemento.style.border = '1px solid #e5e7eb'
    elemento.style.width = '800px'
    elemento.style.minWidth = '800px'
    elemento.style.maxWidth = '800px'
    elemento.style.boxSizing = 'border-box'

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
      elemento.style.width = prevWidth
      elemento.style.minWidth = prevMinWidth
      elemento.style.maxWidth = prevMaxWidth
      elemento.style.boxSizing = prevBoxSizing

      anteriores.forEach(({ el, color, background, borderColor }) => {
        el.style.color = color
        el.style.background = background
        el.style.borderColor = borderColor
      })
    }
  }

  const crearCanvasReceta = async () => {
    if (!recetaRef.current) {
      throw new Error('No se encontró la receta para exportar')
    }

    await esperarFrame()

    const exportWidth = 800
    const exportHeight = recetaRef.current.scrollHeight

    return html2canvas(recetaRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      width: exportWidth,
      height: exportHeight,
      windowWidth: exportWidth,
      windowHeight: exportHeight,
      scrollX: 0,
      scrollY: 0,
    })
  }

  const descargarImagen = async () => {
    if (!recetaRef.current) {
      alert('No se encontró la receta para exportar')
      return
    }

    const restaurar = prepararRecetaParaExportar()

    try {
      const canvas = await crearCanvasReceta()

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
      const canvas = await crearCanvasReceta()

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pdfWidth = 210
      const pdfHeight = 297
      const margin = 10
      const usableWidth = pdfWidth - margin * 2
      const usableHeight = pdfHeight - margin * 2
      const pagePixelHeight = Math.floor((canvas.width * usableHeight) / usableWidth)

      let sourceY = 0
      let pageIndex = 0

      while (sourceY < canvas.height) {
        const sliceHeight = Math.min(pagePixelHeight, canvas.height - sourceY)
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = canvas.width
        pageCanvas.height = sliceHeight

        const ctx = pageCanvas.getContext('2d')
        if (!ctx) {
          throw new Error('No se pudo preparar la página del PDF')
        }

        ctx.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        )

        if (pageIndex > 0) {
          pdf.addPage()
        }

        const sliceData = pageCanvas.toDataURL('image/png', 1.0)
        const sliceHeightMm = (sliceHeight * usableWidth) / canvas.width
        pdf.addImage(sliceData, 'PNG', margin, margin, usableWidth, sliceHeightMm)

        sourceY += sliceHeight
        pageIndex += 1
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
      const canvas = await crearCanvasReceta()

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
        cargarProductos(),
      ])
      setLoading(false)
    }

    cargar()
  }, [id])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-5 sm:p-6 dark:bg-slate-950">
        <div className="mx-auto max-w-5xl pt-14 text-slate-600 sm:pt-12 dark:text-slate-300">
          Cargando ficha...
        </div>
      </main>
    )
  }

  if (!paciente) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-5 sm:p-6 dark:bg-slate-950">
        <div className="mx-auto max-w-5xl pt-14 sm:pt-12">
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
    <main className="min-h-screen bg-slate-100 px-4 py-5 sm:p-6 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl space-y-6 pt-14 sm:pt-12">
        <Link
          href="/dashboard"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Volver al dashboard
        </Link>

        <div className={cardClass}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
                Ficha clínica de {paciente.nombre}
              </h1>

              <div className="mt-6 grid grid-cols-1 gap-4 text-slate-700 dark:text-slate-300 md:grid-cols-2">
                <div className="space-y-2">
                  <p><strong>ID:</strong> {paciente.id}</p>
                  <p><strong>Nombre:</strong> {paciente.nombre}</p>
                  <p><strong>Especie:</strong> {paciente.especie}</p>
                  <p><strong>Sexo:</strong> {paciente.sexo || '-'}</p>
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
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-center font-medium text-white transition hover:bg-slate-800 sm:w-auto dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
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
        Suministros / compras asociadas
      </label>
      <textarea
        className={`${inputClass} min-h-[100px]`}
        placeholder="Ej: vacuna séxtuple, antiparasitario, collar, alimento, procedimiento vendido..."
        value={suministrosComprasAtencion}
        onChange={(e) => setSuministrosComprasAtencion(e.target.value)}
      />
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Queda en la ficha clínica y nos deja preparada la conexión con ventas e inventario.
      </p>
    </div>

    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Venta asociada a esta atención
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Agrega medicamentos, procedimientos o productos comprados durante la consulta.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setItemsVentaAtencion((items) => [...items, crearItemVenta()])}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Agregar ítem
        </button>
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Lector de código de barras
        </label>
        <input
          className={inputClass}
          placeholder="Escanea o escribe el código y presiona Enter"
          value={codigoBarrasVenta}
          onChange={(e) => setCodigoBarrasVenta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') agregarProductoPorCodigo()
          }}
        />
      </div>

      <div className="mt-3 max-w-xs">
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

      {itemsVentaAtencion.length > 0 ? (
        <div className="mt-4 space-y-3">
          {itemsVentaAtencion.map((item) => {
            const cantidad = Math.max(numeroDesdeInput(item.cantidad, 1), 0)
            const precioUnitario = Math.max(numeroDesdeInput(item.precioUnitario), 0)
            const total = cantidad * precioUnitario
            const sugerencias = sugerenciasProductoVenta(item)

            return (
              <div
                key={item.id}
                className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950 md:grid-cols-[1.4fr_1fr_0.6fr_0.8fr_auto]"
              >
                <div className="relative md:col-span-5">
                  <input
                    className={inputClass}
                    placeholder="Escribe producto o servicio"
                    value={item.nombre}
                    onChange={(e) => {
                      actualizarItemVenta(item.id, 'nombre', e.target.value)
                      actualizarItemVenta(item.id, 'productoId', '')
                      actualizarItemVenta(item.id, 'afectaInventario', false)
                      setSugerenciasVentaAbiertas(item.id)
                    }}
                    onFocus={() => setSugerenciasVentaAbiertas(item.id)}
                    onBlur={() => {
                      setTimeout(() => setSugerenciasVentaAbiertas(null), 120)
                    }}
                  />
                  {sugerenciasVentaAbiertas === item.id &&
                    item.nombre.trim() &&
                    sugerencias.length > 0 && (
                    <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
                      {sugerencias.map((producto) => (
                        <button
                          type="button"
                          key={producto.id}
                          onClick={() =>
                            seleccionarProductoVentaDesdeBusqueda(item.id, producto)
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
                <select
                  className={inputClass}
                  value={item.categoria}
                  onChange={(e) => actualizarItemVenta(item.id, 'categoria', e.target.value)}
                >
                  <option>Procedimiento</option>
                  <option>Medicamento</option>
                  <option>Vacuna</option>
                  <option>Producto</option>
                  <option>Alimento</option>
                  <option>Otro</option>
                </select>
                <input
                  className={inputClass}
                  placeholder="Cant."
                  inputMode="decimal"
                  value={item.cantidad}
                  onChange={(e) => actualizarItemVenta(item.id, 'cantidad', e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="Precio"
                  inputMode="numeric"
                  value={item.precioUnitario}
                  onChange={(e) =>
                    actualizarItemVenta(item.id, 'precioUnitario', e.target.value)
                  }
                />
                <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatoCLP(total)}
                  </div>
                  <button
                    type="button"
                    onClick={() => quitarItemVenta(item.id)}
                    className="text-sm font-medium text-rose-600 dark:text-rose-300"
                  >
                    Quitar
                  </button>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 md:col-span-5">
                  <input
                    type="checkbox"
                    checked={item.afectaInventario}
                    onChange={(e) =>
                      actualizarItemVenta(item.id, 'afectaInventario', e.target.checked)
                    }
                  />
                  Descontar de inventario al guardar
                </label>
              </div>
            )
          })}

          <div className="flex justify-end text-lg font-bold text-slate-900 dark:text-white">
            Total: {formatoCLP(totalVentaAtencion)}
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
          Sin venta asociada para esta atención.
        </p>
      )}
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
    className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-center font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 sm:w-auto dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
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
                    <div className="mt-2 whitespace-pre-wrap"><strong>Rp:</strong> {r.tratamiento}</div>
                    {r.indicaciones ? (
                      <div className="mt-2 whitespace-pre-wrap"><strong>Indicación/Control:</strong> {r.indicaciones}</div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => verRecetaEmitida(r)}
                      className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-700"
                    >
                      Ver receta
                    </button>
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
                {recetaVista ? 'Receta emitida' : 'Emitir receta médica'}
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

            {!recetaVista && (
            <>
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
              <textarea
                className={`${inputClass} min-h-[160px]`}
                placeholder="Rp"
                value={tratamiento}
                onChange={(e) => setTratamiento(e.target.value)}
              />
            </div>

            <div className="mt-3">
              <textarea
                className={`${inputClass} min-h-[120px]`}
                placeholder="Indicación/Control"
                value={indicacionControl}
                onChange={(e) => setIndicacionControl(e.target.value)}
              />
            </div>
            </>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              {!recetaVista && (
                <button
                  onClick={generarReceta}
                  disabled={guardandoReceta}
                  className="rounded-xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  {guardandoReceta ? 'Generando...' : 'Generar receta'}
                </button>
              )}

              {(recetaGenerada || recetaVista) && (
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

            {(recetaGenerada || recetaVista) && (
              <div className="mt-6 overflow-x-auto pb-2">
                <div
                  ref={recetaRef}
                  className="mx-auto w-[800px] max-w-none rounded-2xl bg-white p-8 text-slate-800"
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
	                      <div><strong>Dr/a.</strong> {veterinarioRecetaVisible?.nombre || '-'}</div>
	                      <div><strong>Cargo:</strong> {veterinarioRecetaVisible?.cargo || '-'}</div>
	                      <div><strong>RUT:</strong> {veterinarioRecetaVisible?.rut || '-'}</div>
	                      <div><strong>Teléfono:</strong> {veterinarioRecetaVisible?.telefono || '-'}</div>
	                      <div><strong>Dirección:</strong> {veterinarioRecetaVisible?.direccion || '-'}</div>
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
                    <div>
                      <div className="font-bold text-indigo-700">Rp</div>
                      <div className="mt-1 whitespace-pre-wrap">{rpVisible}</div>
                    </div>
                    {indicacionControlVisible ? (
                      <div>
                        <div className="font-bold text-indigo-700">Indicación/Control</div>
                        <div className="mt-1 whitespace-pre-wrap">{indicacionControlVisible}</div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-16 flex items-end justify-between">
                    <div>
                      <div className="font-bold text-indigo-700">Fecha</div>
                      <div>{formatFecha(fechaRecetaVisible)}</div>
                    </div>

<div className="text-right">
	  {veterinarioRecetaVisible?.firma_url ? (
	    <img
	      src={veterinarioRecetaVisible.firma_url}
	      alt="Firma veterinario"
	      className="mb-4 ml-auto h-32 object-contain"
	    />
  ) : (
    <div className="mb-6 text-4xl text-indigo-600">✍️</div>
  )}

  <div className="border-t border-indigo-400 pt-2 font-bold text-indigo-700">
	    {veterinarioRecetaVisible?.nombre || '-'}
	  </div>

	  <div>{veterinarioRecetaVisible?.rut || '-'}</div>
</div>
                  </div>

	                  {recetaIdVisible ? (
	                    <div className="mt-8 text-xs text-slate-400">
	                      N° receta: {recetaIdVisible}
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
