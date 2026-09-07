import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface WorldFootprintMapProps {
  mapboxToken: string
  dark?: boolean
  filter?: string
}

export function WorldFootprintMap({
  mapboxToken,
  dark = true,
  filter = 'all',
}: WorldFootprintMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sportColors: Record<string, string> = {
  all: '#a855f7',
  Run: '#f97316',
  Ride: '#3b82f6',
  Hike: '#22c55e',
  Swim: '#06b6d4',
  Gym: '#c026d3',
}

const highlightColor = sportColors[filter] ?? sportColors.all
const highlightColorRef = useRef(highlightColor)
highlightColorRef.current = highlightColor
const mapRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const map = new mapboxgl.Map({
      container: containerRef.current,
      accessToken: mapboxToken,
      style: dark
        ? 'mapbox://styles/mapbox/dark-v11'
        : 'mapbox://styles/mapbox/light-v11',
      projection: 'globe',
      center: [15, 20],
      zoom: 1.2,
      minZoom: 0,
      maxZoom: 12,
      attributionControl: true,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.on('style.load', () => {
      map.setFog({
        color: dark ? '#242b40' : '#dce9f5',
        'high-color': dark ? '#101426' : '#87b5df',
        'space-color': dark ? '#080c18' : '#e9f2fa',
        'horizon-blend': 0.15,
        'star-intensity': dark ? 0.35 : 0,
      })
    })

    mapRef.current = map

map.once('load', () => {
  map.addSource('world-countries', {
  type: 'geojson',
  data: `${import.meta.env.BASE_URL}world-countries.geojson`,
  generateId: true,
})

// Transparent layer for detecting the country under the mouse
map.addLayer({
  id: 'country-hover-target',
  type: 'fill',
  source: 'world-countries',
  paint: {
    'fill-color': '#ffffff',
    'fill-opacity': 0,
  },
})

// Show only the hovered country's outline
map.addLayer({
  id: 'country-hover-outline',
  type: 'line',
  source: 'world-countries',
  paint: {
    'line-color': highlightColorRef.current,
    'line-width': 2,
    'line-opacity': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      1,
      0,
    ],
  },
})

  let hoveredCountryId: string | number | null = null

function clearCountryHover() {
  if (hoveredCountryId !== null) {
    map.setFeatureState(
      { source: 'world-countries', id: hoveredCountryId },
      { hover: false },
    )
    hoveredCountryId = null
  }

  map.getCanvas().style.cursor = ''
}

map.on('mousemove', 'country-hover-target', event => {
  if (map.isMoving()) return

  const country = event.features?.[0]
  const countryId = country?.id

  if (countryId === undefined) {
    clearCountryHover()
    return
  }

  if (countryId !== hoveredCountryId) {
    clearCountryHover()
    hoveredCountryId = countryId

    map.setFeatureState(
      { source: 'world-countries', id: countryId },
      { hover: true },
    )
  }

  map.getCanvas().style.cursor = 'pointer'
})

  function ensureProvinceLayers() {
  if (map.getSource('world-provinces')) return

  map.addSource('world-provinces', {
    type: 'geojson',
    data: `${import.meta.env.BASE_URL}world-provinces.geojson`,
    generateId: true,
  })

  map.addLayer({
    id: 'province-hover-target',
    type: 'fill',
    source: 'world-provinces',
    filter: ['==', ['get', 'adm0_a3'], ''],
    paint: {
      'fill-opacity': 0,
    },
  })

  map.addLayer({
    id: 'province-boundaries',
    type: 'line',
    source: 'world-provinces',
    filter: ['==', ['get', 'adm0_a3'], ''],
    paint: {
      'line-color': highlightColorRef.current,
      'line-width': 1,
      'line-opacity': 0.65,
    },
  })
}
  map.on('click', 'country-hover-target', event => {
  const country = event.features?.[0]
  if (!country) return
    const countryCode = country.properties?.ADM0_A3
if (typeof countryCode !== 'string') return

ensureProvinceLayers()

map.setFilter('province-hover-target', [
  '==',
  ['get', 'adm0_a3'],
  countryCode,
])

map.setFilter('province-boundaries', [
  '==',
  ['get', 'adm0_a3'],
  countryCode,
])

  const geometry = country.geometry
  if (
    geometry.type !== 'Polygon' &&
    geometry.type !== 'MultiPolygon'
  ) {
    return
  }

  const bounds = new mapboxgl.LngLatBounds()
  const clickedLongitude = event.lngLat.lng

  function extendBounds(value: unknown): void {
    if (!Array.isArray(value)) return

    if (
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      let longitude = value[0]

      while (longitude - clickedLongitude > 180) longitude -= 360
      while (longitude - clickedLongitude < -180) longitude += 360

      bounds.extend([longitude, value[1]])
      return
    }

    for (const child of value) {
      extendBounds(child)
    }
  }

  extendBounds(geometry.coordinates)
  if (bounds.isEmpty()) return

  clearCountryHover()

  map.fitBounds(bounds, {
    padding: 35,
    maxZoom: 7,
    duration: 2000,
    bearing: 0,
    pitch: 0,
  })
})
  
map.on('mouseleave', 'country-hover-target', clearCountryHover)
map.on('movestart', clearCountryHover)

  map.flyTo({
    center: [105, 35],
    zoom: 1.5,
    bearing: 0,
    pitch: 0,
    duration: 3000,
    curve: 1,
  })
})
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(containerRef.current)

    return () => {
  observer.disconnect()
  mapRef.current = null
  map.remove()
}
  }, [mapboxToken, dark])
  useEffect(() => {
  const map = mapRef.current
  if (!map) return

  for (const layerId of [
    'country-hover-outline',
    'province-boundaries',
  ]) {
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, 'line-color', highlightColor)
    }
  }
}, [highlightColor])

  return (
    <section className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      <div className="px-5 py-4">
        <h2 className="text-base font-semibold">Footprint Map</h2>
      </div>
      <div className="relative">
  <div
    ref={containerRef}
    className="w-full"
    style={{ height: 380 }}
  />

  <button
    type="button"
    title="Back to globe"
    aria-label="Back to globe"
    className="absolute top-[10px] left-[10px] z-10 flex items-center justify-center bg-white text-black cursor-pointer hover:bg-gray-200 active:bg-gray-300 active:scale-95 transition-colors duration-150"
    style={{
      width: 29,
      height: 29,
      borderRadius: 4,
      boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.1)',
    }}
    onClick={() => {
  const map = mapRef.current
  if (!map) return

  if (map.getLayer('province-hover-target')) {
    map.setFilter('province-hover-target', [
      '==', ['get', 'adm0_a3'], '',
    ])
  }

  if (map.getLayer('province-boundaries')) {
    map.setFilter('province-boundaries', [
      '==', ['get', 'adm0_a3'], '',
    ])
  }

  map.flyTo({
        center: [105, 25],
        zoom: 1.2,
        bearing: 0,
        pitch: 0,
        duration: 1500,
      })
    }}
  >
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </svg>
  </button>
</div>
    </section>
  )
}
