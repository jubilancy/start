// Open-Meteo access shared by greeting, weather, and sun/moon widgets.
// Docs: https://open-meteo.com/en/docs  ·  https://open-meteo.com/en/docs/geocoding-api
import { settings } from './store.js';
import { cached, fetchJSON } from './util.js';

const CODES = {
  0: ['clear sky', '☀️'], 1: ['mostly clear', '🌤️'], 2: ['partly cloudy', '⛅'], 3: ['overcast', '☁️'],
  45: ['foggy', '🌫️'], 48: ['freezing fog', '🌫️'],
  51: ['light drizzle', '🌦️'], 53: ['drizzle', '🌦️'], 55: ['heavy drizzle', '🌧️'],
  56: ['light freezing drizzle', '🌧️'], 57: ['freezing drizzle', '🌧️'],
  61: ['light rain', '🌦️'], 63: ['rain', '🌧️'], 65: ['heavy rain', '🌧️'],
  66: ['light freezing rain', '🌧️'], 67: ['freezing rain', '🌧️'],
  71: ['light snow', '🌨️'], 73: ['snow', '🌨️'], 75: ['heavy snow', '❄️'], 77: ['snow grains', '❄️'],
  80: ['light showers', '🌦️'], 81: ['showers', '🌧️'], 82: ['heavy showers', '⛈️'],
  85: ['snow showers', '🌨️'], 86: ['heavy snow showers', '❄️'],
  95: ['thunderstorm', '⛈️'], 96: ['thunderstorm with hail', '⛈️'], 99: ['severe thunderstorm', '⛈️'],
};
export const describe = code => (CODES[code] || ['unknown', '❔'])[0];
export const emoji = code => (CODES[code] || ['', '❔'])[1];

/** loc = {lat, lon}; units = 'imperial' | 'metric' */
export function getForecast(loc = settings().location, units = settings().units) {
  const imp = units === 'imperial';
  const q = new URLSearchParams({
    latitude: loc.lat, longitude: loc.lon, timezone: 'auto', forecast_days: 7,
    current: 'temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,uv_index_max',
    temperature_unit: imp ? 'fahrenheit' : 'celsius',
    wind_speed_unit: imp ? 'mph' : 'kmh',
  });
  const key = `wx.${loc.lat},${loc.lon}.${units}`;
  return cached(key, 10 * 60 * 1000, () => fetchJSON(`https://api.open-meteo.com/v1/forecast?${q}`));
}

export async function searchCity(name) {
  const q = new URLSearchParams({ name, count: 6, language: 'en', format: 'json' });
  const d = await fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?${q}`);
  return (d.results || []).map(r => ({
    name: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude, lon: r.longitude,
  }));
}

export function geolocate() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(
      p => res({ lat: +p.coords.latitude.toFixed(4), lon: +p.coords.longitude.toFixed(4) }),
      e => rej(new Error(e.message || 'Location denied')), { timeout: 10000 });
  });
}

export const unitSym = u => (u === 'imperial' ? '°F' : '°C');
