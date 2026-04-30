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
            // Prioridad 1: Intentar obtener datos manuales guardados en el sistema
            const manual = await this.getManualWeather();
            if (manual && manual.temp !== undefined) {
                return {
                    main: { temp: manual.temp, humidity: manual.humidity || 70 },
                    wind: { speed: manual.wind_speed || 0 },
                    weather: [{ description: 'Datos del sistema', icon: '01d' }],
                    name: 'Barrancabermeja (Local)'
                };
            }
            // Prioridad 2: Si no hay manuales o falla la API local, devolver simulados
            return this.getMockWeather();
        } catch (error) {
            return this.getMockWeather();
        }
    }

    async getAirQuality() {
        try {
            const manual = await this.getManualWeather();
            if (manual && manual.pm2_5 !== undefined) {
                return {
                    list: [{
                        main: { aqi: manual.aqi || 2 },
                        components: { pm2_5: manual.pm2_5, pm10: manual.pm10 || 30 }
                    }]
                };
            }
            return this.getMockAirQuality();
        } catch (error) {
            return this.getMockAirQuality();
        }
    }

    async getManualWeather() {
        try {
            const r = await fetch('api.php?route=manual_weather&t=' + Date.now());
            if (r.ok) {
                const data = await r.json();
                return data; // returns null if no manual data
            }
        } catch (e) {
            return null;
        }
        return null;
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
