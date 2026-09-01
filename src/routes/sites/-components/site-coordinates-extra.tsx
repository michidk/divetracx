import { CoordinatePicker } from '@/components/coordinate-picker'
import type { EditorValue, EditorValues } from '@/modules/data/entities'

export function renderSiteCoordinatesExtra(
  section: string,
  values: EditorValues,
  setValue: (key: string, value: EditorValue) => void,
) {
  if (section !== 'Coordinates') return null
  return (
    <CoordinatePicker
      latitude={typeof values.latitude === 'string' ? values.latitude : ''}
      longitude={typeof values.longitude === 'string' ? values.longitude : ''}
      onChange={(latitude, longitude) => {
        setValue('latitude', latitude)
        setValue('longitude', longitude)
      }}
    />
  )
}
