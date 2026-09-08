import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { Activity } from '../types'
import * as polyline from '@mapbox/polyline'

function pointInProvince(
  point: [number, number],
  geometry: GeoJSON.Geometry,
): boolean {
  function insideRing(ring: number[][]): boolean {
    const [x, y] = point
    let inside = false

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]

      if (
        (yi > y) !== (yj > y) &&
        x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
      ) {
        inside = !inside
      }
    }

    return inside
  }

  function insidePolygon(rings: number[][][]): boolean {
    if (!rings.length || !insideRing(rings[0])) return false
    return !rings.slice(1).some(insideRing)
  }

  if (geometry.type === 'Polygon') {
    return insidePolygon(geometry.coordinates)
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some(insidePolygon)
  }

  return false
}
let provinceDataPromise: Promise<GeoJSON.FeatureCollection> | null = null

function loadProvinceData(): Promise<GeoJSON.FeatureCollection> {
  if (!provinceDataPromise) {
    provinceDataPromise = fetch(
      `${import.meta.env.BASE_URL}world-provinces.geojson`,
    )
      .then(async response => {
        if (!response.ok) {
          throw new Error('Unable to load province boundaries')
        }

        return await response.json() as GeoJSON.FeatureCollection
      })
      .catch(error => {
        provinceDataPromise = null
        throw error
      })
  }

  return provinceDataPromise
}
let countryDataPromise: Promise<GeoJSON.FeatureCollection> | null = null

function loadCountryData(): Promise<GeoJSON.FeatureCollection> {
  if (!countryDataPromise) {
    countryDataPromise = fetch(
      `${import.meta.env.BASE_URL}world-countries.geojson`,
    )
      .then(async response => {
        if (!response.ok) {
          throw new Error('Unable to load country boundaries')
        }

        return await response.json() as GeoJSON.FeatureCollection
      })
      .catch(error => {
        countryDataPromise = null
        throw error
      })
  }

  return countryDataPromise
}
interface WorldFootprintMapProps {
  mapboxToken: string
  dark?: boolean
  filter?: string
  activities?: Activity[]
  onGeographyStatsChange?: (stats: {
    level: 'countries' | 'provinces'
    count: number | null
  }) => void
}

export function WorldFootprintMap({
  mapboxToken,
  dark = true,
  filter = 'all',
  activities = [],
  onGeographyStatsChange,
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
  const activitiesRef = useRef(activities)
activitiesRef.current = activities
  const geographyStatsCallbackRef = useRef(onGeographyStatsChange)
geographyStatsCallbackRef.current = onGeographyStatsChange
  const selectedCountryRef = useRef<string | null>(null)
const countryAnimationDoneRef = useRef(false)
const highlightRequestRef = useRef(0)
const refreshProvinceHighlightRef = useRef<(() => void) | null>(null)
  const countryStatsRequestRef = useRef(0)
const refreshCountryStatsRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const useTouchGestures = window.matchMedia(
  '(pointer: coarse)',
).matches
    const map = new mapboxgl.Map({
      container: containerRef.current,
      accessToken: mapboxToken,
      style: dark
        ? 'mapbox://styles/mapbox/dark-v11'
        : 'mapbox://styles/mapbox/light-v11',
      projection: 'globe',
      center: [104, 35],
zoom: 2.4,
      minZoom: 0,
      maxZoom: 12,
      attributionControl: true,
      cooperativeGestures: useTouchGestures,
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

  refreshCountryStatsRef.current = async () => {
  const requestId = ++countryStatsRequestRef.current
  if (selectedCountryRef.current !== null) return

  geographyStatsCallbackRef.current?.({
    level: 'countries',
    count: null,
  })

  try {
    const data = await loadCountryData()

    if (
      requestId !== countryStatsRequestRef.current ||
      mapRef.current !== map ||
      selectedCountryRef.current !== null
    ) {
      return
    }

    const visitedCountries = new Set<string>()

    for (const activity of activitiesRef.current) {
      if (!activity.summary_polyline) continue

      try {
        const firstPoint = polyline.decode(activity.summary_polyline)[0]
        if (!firstPoint) continue

        const point: [number, number] = [firstPoint[1], firstPoint[0]]
        const country = data.features.find(
          feature => pointInProvince(point, feature.geometry),
        )

        const code = country?.properties?.ADM0_A3
        if (typeof code === 'string') visitedCountries.add(code)
      } catch {
        // Skip invalid routes
      }
    }

    geographyStatsCallbackRef.current?.({
      level: 'countries',
      count: visitedCountries.size,
    })
  } catch (error) {
    console.error('Country statistics failed:', error)
  }
}
  refreshProvinceHighlightRef.current = async () => {
  const requestId = ++highlightRequestRef.current
  const countryCode = selectedCountryRef.current

  if (
    !countryCode ||
    !countryAnimationDoneRef.current ||
    !map.getLayer('province-visited-fill')
  ) {
    return
  }

  try {
    const data = await loadProvinceData()

    if (
      requestId !== highlightRequestRef.current ||
      mapRef.current !== map ||
      selectedCountryRef.current !== countryCode ||
      !countryAnimationDoneRef.current
    ) {
      return
    }

    const provinces = data.features.filter(
      feature => feature.properties?.adm0_a3 === countryCode,
    )

    const visitedCodes = new Set<string>()

    for (const activity of activitiesRef.current) {
      if (!activity.summary_polyline) continue

      try {
        const firstPoint = polyline.decode(activity.summary_polyline)[0]
        if (!firstPoint) continue

        const point: [number, number] = [firstPoint[1], firstPoint[0]]
        const province = provinces.find(
          feature => pointInProvince(point, feature.geometry),
        )

        const code = province?.properties?.adm1_code
        if (typeof code === 'string') visitedCodes.add(code)
      } catch {
        // Skip invalid routes
      }
    }

    map.setFilter('province-visited-fill', [
      'all',
      ['==', ['get', 'adm0_a3'], countryCode],
      ['in', ['get', 'adm1_code'], ['literal', [...visitedCodes]]],
    ])

    map.setPaintProperty(
      'province-visited-fill',
      'fill-color',
      highlightColorRef.current,
    )

    map.setPaintProperty('province-visited-fill', 'fill-opacity', 0.45)
    geographyStatsCallbackRef.current?.({
  level: 'provinces',
  count: visitedCodes.size,
})
  } catch (error) {
    console.error('Province highlight failed:', error)
  }
}
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
  id: 'province-visited-fill',
  type: 'fill',
  source: 'world-provinces',
  filter: ['==', ['get', 'adm0_a3'], ''],
  paint: {
    'fill-color': highlightColorRef.current,
    'fill-opacity': 0,
    'fill-opacity-transition': {
      duration: 800,
      delay: 0,
    },
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
    selectedCountryRef.current = countryCode
    countryStatsRequestRef.current += 1
countryAnimationDoneRef.current = false
    geographyStatsCallbackRef.current?.({
  level: 'provinces',
  count: null,
})
highlightRequestRef.current += 1

map.setPaintProperty('province-visited-fill', 'fill-opacity', 0)
map.setFilter('province-visited-fill', [
  '==',
  ['get', 'adm0_a3'],
  '',
])

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

    const animationRequest = highlightRequestRef.current

map.once('moveend', () => {
  if (
    selectedCountryRef.current !== countryCode ||
    highlightRequestRef.current !== animationRequest
  ) {
    return
  }

  countryAnimationDoneRef.current = true
  refreshProvinceHighlightRef.current?.()
})
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
  const defaultCountryCode = 'CHN'

ensureProvinceLayers()

selectedCountryRef.current = defaultCountryCode
countryAnimationDoneRef.current = true
countryStatsRequestRef.current += 1
highlightRequestRef.current += 1

geographyStatsCallbackRef.current?.({
  level: 'provinces',
  count: null,
})

map.setFilter('province-hover-target', [
  '==',
  ['get', 'adm0_a3'],
  defaultCountryCode,
])

map.setFilter('province-boundaries', [
  '==',
  ['get', 'adm0_a3'],
  defaultCountryCode,
])

map.setFilter('province-visited-fill', [
  '==',
  ['get', 'adm0_a3'],
  '',
])

void loadCountryData()
  .then(data => {
    if (
      mapRef.current !== map ||
      selectedCountryRef.current !== defaultCountryCode
    ) {
      return
    }

    const china = data.features.find(
      feature => feature.properties?.ADM0_A3 === defaultCountryCode,
    )

    if (!china) return

    const bounds = new mapboxgl.LngLatBounds()

    function extendChinaBounds(value: unknown): void {
      if (!Array.isArray(value)) return

      if (
        value.length >= 2 &&
        typeof value[0] === 'number' &&
        typeof value[1] === 'number'
      ) {
        bounds.extend([value[0], value[1]])
        return
      }

      for (const child of value) {
        extendChinaBounds(child)
      }
    }

    const chinaGeometry = china.geometry

if (
  chinaGeometry.type !== 'Polygon' &&
  chinaGeometry.type !== 'MultiPolygon'
) {
  return
}

extendChinaBounds(chinaGeometry.coordinates)

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: 20,
        maxZoom: 4,
        duration: 0,
        bearing: 0,
        pitch: 0,
      })
    }
  })
  .catch(error => {
    console.error('Unable to focus China:', error)
  })

refreshProvinceHighlightRef.current?.()
  })
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(containerRef.current)

    return () => {
  observer.disconnect()
  highlightRequestRef.current += 1
      countryStatsRequestRef.current += 1
refreshCountryStatsRef.current = null
  selectedCountryRef.current = null
  countryAnimationDoneRef.current = false
  refreshProvinceHighlightRef.current = null
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
  useEffect(() => {
  if (selectedCountryRef.current === null) {
    refreshCountryStatsRef.current?.()
  } else if (countryAnimationDoneRef.current) {
    geographyStatsCallbackRef.current?.({
      level: 'provinces',
      count: null,
    })
    refreshProvinceHighlightRef.current?.()
  }
}, [activities, filter])

  return (
    <section className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="relative [@media(pointer:coarse)]:[--globe-control-size:44px]">
  <div
    ref={containerRef}
    className="w-full"
    style={{ height: 280 }}
  />

  <button
    type="button"
    title="Back to globe"
    aria-label="Back to globe"
    className="absolute top-[10px] left-[10px] z-10 flex items-center justify-center bg-white text-black cursor-pointer hover:bg-gray-200 active:bg-gray-300 active:scale-95 transition-colors duration-150"
    style={{
      width: 'var(--globe-control-size, 29px)',
height: 'var(--globe-control-size, 29px)',
      borderRadius: 4,
      boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.1)',
    }}
    onClick={() => {
  const map = mapRef.current
  if (!map) return
selectedCountryRef.current = null
countryAnimationDoneRef.current = false
highlightRequestRef.current += 1

if (map.getLayer('province-visited-fill')) {
  map.setPaintProperty('province-visited-fill', 'fill-opacity', 0)
  map.setFilter('province-visited-fill', [
    '==',
    ['get', 'adm0_a3'],
    '',
  ])
}
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

      refreshCountryStatsRef.current?.()
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
