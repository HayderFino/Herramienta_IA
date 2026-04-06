/**
 * WeatherService.js
 * Handles fetching weather and air quality data from OpenWeather API.
 */

class WeatherService {
    constructor() {
        // Replace 'YOUR_API_KEY' with your actual OpenWeatherMap API Key
        this.apiKey = 'TU_API_KEY'; 
        this.baseUrl = 'https://api.openweathermap.org/data/2.5';
        // Barrancabermeja Coordinates
        this.lat = 7.0653;
        this.lon = -73.8167;
    }

    async getCurrentWeather() {
        try {
            const url = `${this.baseUrl}/weather?lat=${this.lat}&lon=${this.lon}&units=metric&lang=es&appid=${this.apiKey}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch weather data');
            return await response.json();
        } catch (error) {
            console.warn('Weather API failed, returning mock data:', error);
            return this.getMockWeather();
        }
    }

    async getAirQuality() {
        try {
            const url = `${this.baseUrl}/air_pollution?lat=${this.lat}&lon=${this.lon}&appid=${this.apiKey}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch air quality data');
            return await response.json();
        } catch (error) {
            console.warn('Air Pollution API failed, returning mock data:', error);
            return this.getMockAirQuality();
        }
    }

    getMockWeather() {
        const baseTemp = 28 + (Math.random() * 8); // Random entre 28 y 36
        const baseHum = 50 + (Math.random() * 30); // Random entre 50 y 80
        return {
            main: { 
                temp: baseTemp, 
                humidity: Math.round(baseHum), 
                feels_like: baseTemp + 3, 
                pressure: 1012 
            },
            wind: { speed: (Math.random() * 10).toFixed(1) },
            weather: [{ description: 'cielo despejado', icon: '01d' }],
            name: 'Barrancabermeja'
        };
    }

    getMockAirQuality() {
        const basePM = 10 + (Math.random() * 40); // Random entre 10 y 50
        const aqi = basePM > 37 ? 3 : (basePM > 15 ? 2 : 1);
        return {
            list: [{ 
                main: { aqi: aqi }, 
                components: { pm2_5: basePM.toFixed(1), pm10: (basePM * 1.5).toFixed(1), no2: 15.2 } 
            }]
        };
    }
}

export const weatherService = new WeatherService();
export default weatherService;
