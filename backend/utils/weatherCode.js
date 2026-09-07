/**
 * Maps WMO Weather interpretation codes (Open-Meteo) to condition labels, categories, and icons.
 */
const weatherCodeMap = {
  0: {
    label: 'Clear Sky',
    category: 'Clear',
    icon: '☀️',
    iconName: 'sun'
  },
  1: {
    label: 'Mainly Clear',
    category: 'Clear',
    icon: '🌤️',
    iconName: 'cloud-sun'
  },
  2: {
    label: 'Partly Cloudy',
    category: 'Cloudy',
    icon: '⛅',
    iconName: 'cloud-sun'
  },
  3: {
    label: 'Overcast',
    category: 'Cloudy',
    icon: '☁️',
    iconName: 'cloud'
  },
  45: {
    label: 'Fog',
    category: 'Fog',
    icon: '🌫️',
    iconName: 'smog'
  },
  48: {
    label: 'Depositing Rime Fog',
    category: 'Fog',
    icon: '🌫️',
    iconName: 'smog'
  },
  51: {
    label: 'Light Drizzle',
    category: 'Rain',
    icon: '🌦️',
    iconName: 'cloud-drizzle'
  },
  53: {
    label: 'Moderate Drizzle',
    category: 'Rain',
    icon: '🌧️',
    iconName: 'cloud-drizzle'
  },
  55: {
    label: 'Dense Drizzle',
    category: 'Rain',
    icon: '🌧️',
    iconName: 'cloud-drizzle'
  },
  56: {
    label: 'Light Freezing Drizzle',
    category: 'Rain',
    icon: '🌧️',
    iconName: 'cloud-snow'
  },
  57: {
    label: 'Dense Freezing Drizzle',
    category: 'Rain',
    icon: '🌧️',
    iconName: 'cloud-snow'
  },
  61: {
    label: 'Slight Rain',
    category: 'Rain',
    icon: '🌧️',
    iconName: 'cloud-rain'
  },
  63: {
    label: 'Moderate Rain',
    category: 'Rain',
    icon: '🌧️',
    iconName: 'cloud-rain'
  },
  65: {
    label: 'Heavy Rain',
    category: 'Rain',
    icon: '🌧️',
    iconName: 'cloud-rain'
  },
  66: {
    label: 'Light Freezing Rain',
    category: 'Rain',
    icon: '🌧️',
    iconName: 'cloud-snow'
  },
  67: {
    label: 'Heavy Freezing Rain',
    category: 'Rain',
    icon: '🌧️',
    iconName: 'cloud-snow'
  },
  71: {
    label: 'Slight Snow Fall',
    category: 'Snow',
    icon: '❄️',
    iconName: 'snowflake'
  },
  73: {
    label: 'Moderate Snow Fall',
    category: 'Snow',
    icon: '❄️',
    iconName: 'snowflake'
  },
  75: {
    label: 'Heavy Snow Fall',
    category: 'Snow',
    icon: '❄️',
    iconName: 'snowflake'
  },
  77: {
    label: 'Snow Grains',
    category: 'Snow',
    icon: '🌨️',
    iconName: 'snowflake'
  },
  80: {
    label: 'Slight Rain Showers',
    category: 'Rain',
    icon: '🌦️',
    iconName: 'cloud-sun-rain'
  },
  81: {
    label: 'Moderate Rain Showers',
    category: 'Rain',
    icon: '🌧️',
    iconName: 'cloud-showers-heavy'
  },
  82: {
    label: 'Violent Rain Showers',
    category: 'Rain',
    icon: '⛈️',
    iconName: 'cloud-showers-heavy'
  },
  85: {
    label: 'Slight Snow Showers',
    category: 'Snow',
    icon: '🌨️',
    iconName: 'snowflake'
  },
  86: {
    label: 'Heavy Snow Showers',
    category: 'Snow',
    icon: '🌨️',
    iconName: 'snowflake'
  },
  95: {
    label: 'Thunderstorm',
    category: 'Thunderstorm',
    icon: '⚡',
    iconName: 'bolt'
  },
  96: {
    label: 'Thunderstorm with Slight Hail',
    category: 'Thunderstorm',
    icon: '⛈️',
    iconName: 'bolt-hail'
  },
  99: {
    label: 'Thunderstorm with Heavy Hail',
    category: 'Thunderstorm',
    icon: '⛈️',
    iconName: 'bolt-hail'
  }
};

function getWeatherCondition(code) {
  if (weatherCodeMap[code]) {
    return weatherCodeMap[code];
  }
  return {
    label: 'Unknown',
    category: 'Other',
    icon: '❓',
    iconName: 'help'
  };
}

/**
 * Converts Celsius to Fahrenheit rounded to 1 decimal place.
 */
function celsiusToFahrenheit(c) {
  if (typeof c !== 'number' || isNaN(c)) return null;
  return Math.round(((c * 9) / 5 + 32) * 10) / 10;
}

/**
 * Converts km/h to mph rounded to 1 decimal place.
 */
function kmhToMph(kmh) {
  if (typeof kmh !== 'number' || isNaN(kmh)) return null;
  return Math.round((kmh * 0.621371) * 10) / 10;
}

module.exports = {
  weatherCodeMap,
  getWeatherCondition,
  celsiusToFahrenheit,
  kmhToMph
};
