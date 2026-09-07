import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import * as polyline from '@mapbox/polyline'
import type { Activity } from '../types'
import { extractActivityProvince } from '../hooks/useActivities'

const MAPBOX_TOKEN =
  'pk.eyJ1IjoiYmVuLTI5IiwiYSI6ImNrZ3Q4Ym9mMDBqMGYyeXFvODV2dWl6YzQifQ.gSKoWF-fMjhzU67TuDezJQ'

interface RouteMapProps {
  activities: Activity[]
  selectedActivity?: Activity | null
  selectedProvince?: string | null
  dark?: boolean
  onClearSelection?: () => void
}

export function RouteMap({ activities, selectedActivity, selectedProvince, dark, onClearSelection }: RouteMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)

  const style = dark !== false
    ? 'mapbox://styles/mapbox/dark-v11'
    : 'mapbox://styles/mapbox/light-v11'

  useEffect(() => {
    if (!mapContainer.current) return

    if (map.current) {
      map.current.setStyle(style)
      return
    }

    mapboxgl.accessToken = MAPBOX_TOKEN
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style,
      center: [121.4, 31.2],
      zoom: 10,
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right')

    map.current.on('style.load', () => {
      updateRoutes()
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [dark])

  useEffect(() => {
    if (map.current?.isStyleLoaded()) {
      updateRoutes()
    } else {
      map.current?.once('style.load', () => updateRoutes())
    }
  }, [activities, selectedActivity, selectedProvince])

  function updateRoutes() {
    if (!map.current) return

    // Remove existing source/layer
    if (map.current.getLayer('routes')) map.current.removeLayer('routes')
    if (map.current.getSource('routes')) map.current.removeSource('routes')
    if (map.current.getLayer('selected')) map.current.removeLayer('selected')
    if (map.current.getSource('selected')) map.current.removeSource('selected')

    // If a single activity is selected, show only that route highlighted
    if (selectedActivity?.summary_polyline) {
      const coords = polyline
        .decode(selectedActivity.summary_polyline)
        .map(([lat, lng]) => [lng, lat])

      map.current.addSource('selected', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords },
        },
      })

      map.current.addLayer({
        id: 'selected',
        type: 'line',
        source: 'selected',
        paint: {
          'line-color': selectedActivity.type === 'Run' ? '#f97316' : '#3b82f6',
          'line-width': 3,
          'line-opacity': 0.9,
        },
      })

      const bounds = new mapboxgl.LngLatBounds()
      for (const c of coords) bounds.extend(c as [number, number])
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 14 })
      return
    }

    // Otherwise show all routes
    const features = activities
      .filter((a) => a.summary_polyline)
      .map((a) => {
        const coords = polyline
          .decode(a.summary_polyline!)
          .map(([lat, lng]) => [lng, lat])
        return {
          type: 'Feature' as const,
          properties: { type: a.type },
          geometry: {
            type: 'LineString' as const,
            coordinates: coords,
          },
        }
      })

    if (features.length === 0) return

    map.current.addSource('routes', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features,
      },
    })

    map.current.addLayer({
      id: 'routes',
      type: 'line',
      source: 'routes',
      paint: {
        'line-color': [
          'match',
          ['get', 'type'],
          'Run', '#f97316',
          'Ride', '#3b82f6',
          '#a855f7',
        ],
        'line-width': 1.5,
        'line-opacity': 0.6,
      },
    })


    if (selectedProvince) {
  const routeBounds = new mapboxgl.LngLatBounds()

  for (const feature of features) {
    for (const coordinate of feature.geometry.coordinates) {
      routeBounds.extend(coordinate as [number, number])
    }
  }

  if (!routeBounds.isEmpty()) {
    map.current.fitBounds(routeBounds, {
      padding: 30,
      maxZoom: 14,
    })
    return
  }
}
    // Prefer Shanghai routes for the default overview
const shanghaiActivities = activities.filter(
  activity =>
    activity.summary_polyline &&
    extractActivityProvince(activity) === '上海市',
)

const shanghaiRuns = shanghaiActivities.filter(
  activity => activity.type === 'Run',
)

const overviewActivities =
  shanghaiRuns.length > 0
    ? shanghaiRuns
    : shanghaiActivities.length > 0
      ? shanghaiActivities
      : activities

const routes = overviewActivities.flatMap(activity => {
  if (!activity.summary_polyline) return []

  try {
    const coordinates = polyline
      .decode(activity.summary_polyline)
      .map(([lat, lng]): [number, number] => [lng, lat])
      .filter(([lng, lat]) =>
        Number.isFinite(lng) && Number.isFinite(lat),
      )

    return coordinates.length > 1 ? [coordinates] : []
  } catch {
    return []
  }
})

if (routes.length === 0) return

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

const centerLng = median(routes.map(route => route[0][0]))
const centerLat = median(routes.map(route => route[0][1]))
const longitudeScale = Math.cos(centerLat * Math.PI / 180)

function distanceFromCenter(route: [number, number][]): number {
  const dx = (route[0][0] - centerLng) * longitudeScale
  const dy = route[0][1] - centerLat
  return dx * dx + dy * dy
}

// Use the nearest 90% of route starts, then fit their complete routes
const rankedRoutes = [...routes].sort(
  (a, b) => distanceFromCenter(a) - distanceFromCenter(b),
)

const keepCount = Math.max(1, Math.ceil(rankedRoutes.length * 0.9))
const mainRoutes = rankedRoutes.slice(0, keepCount)
const bounds = new mapboxgl.LngLatBounds()

for (const route of mainRoutes) {
  for (const coordinate of route) {
    bounds.extend(coordinate)
  }
}

map.current.fitBounds(bounds, {
  padding: 35,
  maxZoom: 12.5,
  duration: 1200,
})
  }

  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden h-[280px] relative">
      {selectedActivity && (
        <button
          onClick={onClearSelection}
          className="absolute top-3 left-3 z-10 px-3 py-1.5 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg text-xs font-medium shadow-md hover:bg-[var(--color-bg)] transition-colors flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Overview
        </button>
      )}
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  )
}
