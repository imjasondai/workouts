import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface WorldFootprintMapProps {
  mapboxToken: string
  dark?: boolean
}

export function WorldFootprintMap({
  mapboxToken,
  dark = true,
}: WorldFootprintMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const map = new mapboxgl.Map({
      container: containerRef.current,
      accessToken: mapboxToken,
      style: dark
        ? 'mapbox://styles/mapbox/dark-v11'
        : 'mapbox://styles/mapbox/light-v11',
      projection: 'globe',
      center: [105, 25],
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

    const observer = new ResizeObserver(() => map.resize())
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      map.remove()
    }
  }, [mapboxToken, dark])

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
