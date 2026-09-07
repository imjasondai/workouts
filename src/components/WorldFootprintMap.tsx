import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import chinaProvinces from '../assets/china-provinces.json'

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
  map.addSource('china-highlight', {
    type: 'geojson',
    data: chinaProvinces as unknown as GeoJSON.FeatureCollection,
  })

  map.addLayer({
    id: 'china-highlight-fill',
    type: 'fill',
    source: 'china-highlight',
    paint: {
      'fill-color': highlightColorRef.current,
      'fill-opacity': 0,
      'fill-opacity-transition': {
        duration: 800,
        delay: 0,
      },
    },
  })

  map.once('moveend', () => {
    if (map.getLayer('china-highlight-fill')) {
      map.setPaintProperty('china-highlight-fill', 'fill-opacity', 0.5)
    }
  })

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
  if (!map || !map.getLayer('china-highlight-fill')) return

  map.setPaintProperty(
    'china-highlight-fill',
    'fill-color',
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
