const axios = require('axios');
const cities = require('../data/cities');
const {
  getWeatherCondition,
  celsiusToFahrenheit,
  kmhToMph
} = require('../utils/weatherCode');

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * Fetches current weather for a single city from Open-Meteo with retry.
 */
async function fetchCityWeather(city, attempts = 2) {
  const url = `${OPEN_METEO_BASE_URL}?latitude=${city.latitude}&longitude=${city.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&timezone=auto`;

  for (let i = 0; i < attempts; i++) {
    try {
      const response = await axios.get(url, { timeout: 12000 });
      const current = response.data && response.data.current;

      if (!current) {
        throw new Error('No current weather data returned');
      }

      const weatherInfo = getWeatherCondition(current.weather_code);
      const tempF = celsiusToFahrenheit(current.temperature_2m);
      const feelsLikeF = celsiusToFahrenheit(current.apparent_temperature);
      const windSpeedMph = kmhToMph(current.wind_speed_10m);
      const timestamp = Date.now();
      const fetchedAt = new Date().toISOString();

      return {
        success: true,
        id: city.id,
        city: city.name,
        state: city.state,
        stateCode: city.stateCode,
        slug: city.slug,
        latitude: city.latitude,
        longitude: city.longitude,
        timezone: city.timezone,
        temperature: tempF,
        temperatureC: current.temperature_2m,
        feelsLike: feelsLikeF,
        feelsLikeC: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        windSpeed: windSpeedMph,
        windSpeedKmh: current.wind_speed_10m,
        weatherCode: current.weather_code,
        condition: weatherInfo.label,
        category: weatherInfo.category,
        icon: weatherInfo.icon,
        iconName: weatherInfo.iconName,
        timestamp,
        fetchedAt
      };
    } catch (err) {
      if (i === attempts - 1) {
        console.error(`[WeatherService] Error fetching weather for ${city.name}:`, err.message);
        return {
          success: false,
          id: city.id,
          city: city.name,
          state: city.state,
          stateCode: city.stateCode,
          slug: city.slug,
          latitude: city.latitude,
          longitude: city.longitude,
          error: 'Weather unavailable',
          timestamp: Date.now(),
          fetchedAt: new Date().toISOString()
        };
      }
      // Small pause before retry
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

/**
 * Concurrently fetches current weather for all 20 cities using Promise.all().
 */
async function fetchAllCitiesWeather() {
  const promises = cities.map((city) => fetchCityWeather(city));
  const results = await Promise.all(promises);

  const timestamp = Date.now();
  const fetchedAt = new Date().toISOString();

  const summary = calculateWeatherSummary(results);

  return {
    timestamp,
    fetchedAt,
    count: results.length,
    successCount: results.filter((r) => r.success).length,
    data: results,
    summary
  };
}

/**
 * Calculates summary metrics across cities that succeeded.
 */
function calculateWeatherSummary(citiesData) {
  const successful = citiesData.filter((c) => c.success && typeof c.temperature === 'number');

  if (successful.length === 0) {
    return {
      totalCities: citiesData.length,
      successfulCount: 0,
      avgTemperature: null,
      highestTemperature: null,
      lowestTemperature: null,
      hottestCity: null,
      coldestCity: null,
      avgHumidity: null,
      avgWindSpeed: null
    };
  }

  let totalTemp = 0;
  let totalHumidity = 0;
  let totalWind = 0;
  let hottest = successful[0];
  let coldest = successful[0];

  for (const item of successful) {
    totalTemp += item.temperature;
    totalHumidity += item.humidity;
    totalWind += item.windSpeed;

    if (item.temperature > hottest.temperature) {
      hottest = item;
    }
    if (item.temperature < coldest.temperature) {
      coldest = item;
    }
  }

  return {
    totalCities: citiesData.length,
    successfulCount: successful.length,
    avgTemperature: Math.round((totalTemp / successful.length) * 10) / 10,
    highestTemperature: hottest.temperature,
    lowestTemperature: coldest.temperature,
    hottestCity: {
      city: hottest.city,
      stateCode: hottest.stateCode,
      temperature: hottest.temperature
    },
    coldestCity: {
      city: coldest.city,
      stateCode: coldest.stateCode,
      temperature: coldest.temperature
    },
    avgHumidity: Math.round(totalHumidity / successful.length),
    avgWindSpeed: Math.round((totalWind / successful.length) * 10) / 10
  };
}

module.exports = {
  fetchCityWeather,
  fetchAllCitiesWeather,
  calculateWeatherSummary
};
