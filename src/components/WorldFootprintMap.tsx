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
  if (!map || !map.getLayer('country-hover-outline')) return

  map.setPaintProperty(
    'country-hover-outline',
    'line-color',
    highlightColor,
  )
}, [highlightColor])

  return (
    <section className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      <div className="px-5 py-4">
        <h2 className="text-base font-semibold">Footprint Map</h2>
      </div>
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: 380 }}
      />
    </section>
  )
}
