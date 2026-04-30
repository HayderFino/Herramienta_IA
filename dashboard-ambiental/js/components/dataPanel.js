/**
 * DataPanel.js
 * Renders real-time weather and environmental data onto the UI.
 */

class DataPanel {
    constructor() {
        this.container = document.getElementById('weather-data-container');
    }

    render(weather, airQuality) {
        if (!this.container) return;

        const { main, wind, weather: weatherInfo } = weather;
        const aqi = airQuality.list[0].main.aqi;
        const pm2_5 = parseFloat(airQuality.list[0].components.pm2_5);
        const pm10 = parseFloat(airQuality.list[0].components.pm10);
        const temp = parseFloat(main.temp);
        
        const config = [
            { label: 'Temperatura', value: `${temp.toFixed(1)}°C`, icon: 'fa-temperature-high', color: 'text-danger' },
            { label: 'Humedad', value: `${Math.round(main.humidity)}%`, icon: 'fa-tint', color: 'text-info' },
            { label: 'Viento', value: `${Math.round(parseFloat(wind.speed))} m/s`, icon: 'fa-wind', color: 'text-white' },
            { label: 'PM10', value: `${pm10.toFixed(1)} µg/m³`, icon: 'fa-smog', color: 'text-warning' },
            { label: 'PM2.5', value: `${pm2_5.toFixed(2)} µg/m³`, icon: 'fa-smog', color: 'text-muted' },
            { label: 'IQA', value: this.getAQILabel(aqi), icon: 'fa-lungs', color: this.getAQIColor(aqi) }
        ];

        this.container.innerHTML = config.map((item, index) => `
            <div class="col-md-4 col-6 mb-3">
                <div class="data-item p-3 text-center h-100" style="animation-delay: ${index * 0.1}s">
                    <i class="fas ${item.icon} ${item.color} mb-2 fa-lg"></i>
                    <p class="text-muted small mb-1">${item.label}</p>
                    <h5 class="mb-0 fw-bold">${item.value}</h5>
                </div>
            </div>
        `).join('');

        // Update single fields for extra emphasis if they exist in HTML
        const tempEl = document.getElementById('temp-val');
        if (tempEl) tempEl.textContent = `${temp.toFixed(1)}°C`;
    }

    getAQILabel(aqi) {
        const labels = ['Muy Bueno', 'Bueno', 'Moderado', 'Pobre', 'Muy Pobre'];
        return labels[aqi - 1] || 'S/D';
    }

    getAQIColor(aqi) {
        const colors = ['text-success', 'text-info', 'text-warning', 'text-danger', 'text-purple'];
        return colors[aqi - 1] || 'text-muted';
    }
}

export const dataPanel = new DataPanel();
export default dataPanel;
