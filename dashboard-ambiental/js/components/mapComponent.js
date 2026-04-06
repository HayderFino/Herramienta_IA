/**
 * MapComponent.js
 * Manages Leaflet map instance and data layers.
 */

class MapComponent {
    constructor() {
        this.map = null;
        this.layers = {
            clima: L.layerGroup(),
            aire: L.layerGroup(),
            agua: L.layerGroup()
        };
        // Barrancabermeja Coordinates
        this.center = [7.0653, -73.8167];
        this.markers = [];
        this.heatmapInstance = null;
    }

    init() {
        console.log('🗺️ MapComponent: Initializing...');
        this.tileLayer = null;
        this.map = L.map('map', {
            center: this.center,
            zoom: 13,
            attributionControl: false
        });

        // 🎨 Carga el estilo Nature (Voyager) por defecto para combinar con el blanco/verde
        this.changeStyle('voyager');

        L.control.attribution({ position: 'bottomleft' }).addTo(this.map);
        this.layers.clima.addTo(this.map);

        // 🔘 Selector de Estilo - Vinculación Directa
        const styleSelect = document.getElementById('map-style-select');
        if (styleSelect) {
            console.log('✅ Selector de mapa encontrado. Preparando eventos...');
            styleSelect.addEventListener('change', (e) => {
                const style = e.target.value;
                console.log(`📍 Cambiando estilo a: ${style}`);
                this.changeStyle(style);
            });
        } else {
            console.warn('⚠️ Selector de estilo de mapa no encontrado en el DOM.');
        }
    }

    changeStyle(style) {
        console.log(`🛠️ MapComponent: Aplicando capa ${style}...`);
        if (this.tileLayer) {
            this.map.removeLayer(this.tileLayer);
        }

        let url = '';
        switch(style) {
            case 'voyager': // 🍃 Naturaleza (CartoDB Voyager)
                url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
                break;
            case 'satellite': // 🛰️ Satelital (Esri World Imagery)
                url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
                break;
            case 'dark': // 🌑 Modo Noche (CartoDB Dark)
                url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
                break;
            case 'positron': // 🏛️ Minimalista (CartoDB Positron)
                url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
                break;
            default:
                url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
        }

        this.tileLayer = L.tileLayer(url).addTo(this.map);
        console.log('✨ Capa aplicada con éxito.');
    }

    updateMarker(weather) {
        // Clear old markers
        this.markers.forEach(m => m.remove());
        this.markers = [];

        const statusColor = this.getStatusColor(weather);
        
        const marker = L.circleMarker(this.center, {
            radius: 18,
            fillColor: statusColor,
            color: '#FFFFFF',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.95
        }).addTo(this.map);

        const popupContent = `
            <div class="text-center p-2">
                <div class="small text-muted text-uppercase fw-bold mb-1" style="font-size: 0.65rem; letter-spacing: 1.5px; color: #666 !important;">Barrancabermeja</div>
                <div class="prediction-value" style="font-size: 2.5rem !important; margin: 5px 0; color: #1D2A34 !important;">${Math.round(weather.main.temp)}°C</div>
                <div class="small fw-600" style="color: #42545E !important;"><i class="fas fa-cloud me-1"></i> ${weather.weather[0].description}</div>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        this.markers.push(marker);
        marker.openPopup();
    }

    getStatusColor(weather) {
        const temp = weather.main.temp;
        // 🌡️ Umbrales ajustados para Barrancabermeja (Realidad local)
        if (temp > 38) return '#184424'; // Alerta (Verde Bosque Profundo)
        if (temp > 35) return '#006699'; // Riesgo (Azul Institucional)
        if (temp > 31) return '#339933'; // Moderado (Verde Marca)
        return '#3B9A54'; // Excelente (Esmeralda)
    }

    switchLayer(layerName) {
        // Hide all layers
        Object.values(this.layers).forEach(layer => this.map.removeLayer(layer));
        // Show selected layer
        if (this.layers[layerName]) {
            this.layers[layerName].addTo(this.map);
            console.log(`Layer switched to: ${layerName}`);
            
            // Add simulation logic for heatmaps or specific icons here
            this.simulateLayerData(layerName);
        }
    }

    simulateLayerData(layerName) {
        // Mock data logic for different layers
        if (layerName === 'aire') {
            // Show air quality markers
            this.map.setView([7.0653, -73.8167], 14);
        } else if (layerName === 'agua') {
            // Focus on Magdalena river
            this.map.setView([7.070, -73.850], 14);
        }
    }
}

export const mapComponent = new MapComponent();
export default mapComponent;
