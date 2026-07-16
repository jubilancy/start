// Fetch weather data using Open-Meteo API (free, no key required)
// Default location: Alexandria, Virginia
// You can customize latitude/longitude

async function fetchWeather() {
  try {
    // Get user's location or use default
    let lat = 38.8048;
    let lon = -77.0469;
    
    // Try to get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function(position) {
          lat = position.coords.latitude;
          lon = position.coords.longitude;
          getWeatherData(lat, lon);
        },
        function() {
          // Use default if permission denied
          getWeatherData(lat, lon);
        }
      );
    } else {
      getWeatherData(lat, lon);
    }
  } catch (error) {
    console.error('Weather error:', error);
    document.getElementById('status').innerHTML = 'unavailable';
  }
}

async function getWeatherData(lat, lon) {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,relative_humidity_2m&temperature_unit=fahrenheit`
    );
    const data = await response.json();
    const current = data.current;
    
    const temp = Math.round(current.temperature_2m);
    const description = getWeatherDescription(current.weather_code);
    
    document.getElementById('status').textContent = `${description} (${temp}°F)`;
    document.querySelector('.weather img:last-child').style.display = 'none';
    
  } catch (error) {
    console.error('Weather fetch error:', error);
    document.getElementById('status').textContent = 'unavailable';
  }
}

// WMO Weather interpretation codes
function getWeatherDescription(code) {
  const weatherCodes = {
    0: 'clear sky',
    1: 'mostly clear',
    2: 'partly cloudy',
    3: 'overcast',
    45: 'foggy',
    48: 'foggy',
    51: 'light drizzle',
    53: 'drizzle',
    55: 'heavy drizzle',
    61: 'light rain',
    63: 'rain',
    65: 'heavy rain',
    71: 'light snow',
    73: 'snow',
    75: 'heavy snow',
    80: 'light showers',
    81: 'showers',
    82: 'heavy showers',
    85: 'snow showers',
    86: 'heavy snow showers',
    95: 'thunderstorm',
    96: 'thunderstorm with hail',
    99: 'severe thunderstorm',
  };
  
  return weatherCodes[code] || 'unknown';
}

// Fetch on load
document.addEventListener('DOMContentLoaded', fetchWeather);

// Refresh every 10 minutes
setInterval(fetchWeather, 600000);
