/** Zahlenformat de-DE mit fester Nachkommazahl. */
export function fmt(v: number, digits: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPeriod(days: number): string {
  return days < 1000 ? `${fmt(days, 1)} Tage` : `${fmt(days / 365.25, 2)} Jahre`;
}

export function formatHours(hours: number): string {
  return hours < 48 ? `${fmt(hours, 1)} h` : `${fmt(hours / 24, 1)} Tage`;
}

export function formatMinutes(minutes: number): string {
  return minutes < 120 ? `${fmt(minutes, 1)} min` : `${fmt(minutes / 60, 1)} h`;
}

export function formatKm(km: number): string {
  return km < 1 ? `${fmt(km * 1000, 0)} m` : `${fmt(km, 0)} km`;
}
