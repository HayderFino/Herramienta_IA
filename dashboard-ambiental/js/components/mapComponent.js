/**
 * MapComponent.js
 * Manages Leaflet map instance and data layers.
 */

class MapComponent {
    constructor() {
        this.map        = null;
        this.layers     = {};     // se inicializan dentro de init()
        this.tileLayer  = null;
        this.centerMarker = null;

        // Centro por defecto: Barrancabermeja
        this.center = [7.0653, -73.8167];

        // ── Estaciones de Monitoreo ──────────────────────────────────────────
        this.stations = {
            agua: [
                { name: "Piscícola San Silvestre S.A.",                    coords: [7.107734,  -73.856188],  type: "Calidad de Agua" },
                { name: "UNIPAZ",                                           coords: [7.063519,  -73.748394],  type: "Calidad de Agua" },
                { name: "Aguas de Barrancabermeja \u2013 Cienaga San Silvestre", coords: [7.092257,  -73.827468],  type: "Calidad de Agua" }
            ],
            clima: [
                { name: "PIRMA-3 HATO",   coords: [6.520736, -73.366447], type: "Hidrologica (IDEAM)" },
                { name: "PIRMA-2 ENCINO", coords: [6.135536, -73.112619], type: "Hidrologica (IDEAM)" },
                { name: "PIRMA-1 CURITI", coords: [6.606756, -73.073383], type: "Hidrologica (IDEAM)" }
            ],
            aire: [
                { name: "CAS Alcaldia",                            short: "Alcaldia",      coords: [7.06079, -73.87267], type: "Calidad de Aire" },
                { name: "CAS Escuela San Silvestre",               short: "San Silvestre",  coords: [7.0834,  -73.83934], type: "Calidad de Aire" },
                { name: "CAS-SUB Estacion Bomberos",               short: "CAS-SUB",        coords: [7.0719,  -73.8342],  type: "Calidad de Aire" },
                { name: "CAS Universidad Industrial de Santander", short: "UIS",            coords: [7.0695,  -73.8518],  type: "Calidad de Aire" }
            ]
        };

        // Estilos visuales por categoria
        this.categoryStyle = {
            agua:  { color: '#006699', icon: 'fa-water'     },
            clima: { color: '#3B9A54', icon: 'fa-cloud-sun' },
            aire:  { color: '#3399CC', icon: 'fa-wind'      }
        };
    }

    init() {
        console.log('Initializing MapComponent...');

        // 1. Crear el mapa Leaflet
        this.map = L.map('map', {
            center: this.center,
            zoom: 12,
            attributionControl: false
        });

        this.changeStyle('voyager');
        L.control.attribution({ position: 'bottomleft' }).addTo(this.map);

        // 2. Crear los LayerGroups AHORA que el mapa existe
        this.layers = {
            clima: L.layerGroup(),
            aire:  L.layerGroup(),
            agua:  L.layerGroup()
        };

        // 3. Poblar cada layer con marcadores
        this._buildStationLayers();

        // 4. Mostrar capa inicial y encuadrar
        this.layers.clima.addTo(this.map);
        this._fitToLayer('clima');

        // 5. Selector de estilo de mapa
        const styleSelect = document.getElementById('map-style-select');
        if (styleSelect) {
            styleSelect.addEventListener('change', (e) => this.changeStyle(e.target.value));
        }
    }

    /** Crea los circleMarkers y los agrega al LayerGroup correspondiente */
    _buildStationLayers() {
        Object.keys(this.stations).forEach(category => {
            const style = this.categoryStyle[category];

            this.stations[category].forEach(station => {
                const marker = L.circleMarker(station.coords, {
                    radius:      11,
                    fillColor:   style.color,
                    color:       '#FFFFFF',
                    weight:      2.5,
                    opacity:     1,
                    fillOpacity: 0.9
                });

                marker.bindPopup(`
                    <div class="text-center p-2">
                        <div class="small fw-bold text-uppercase mb-1"
                             style="font-size:0.6rem;letter-spacing:1px;color:#888;">
                            ${station.type}
                        </div>
                        <div class="fw-bold" style="color:#1D2A34;font-size:0.9rem;">
                            ${station.name}
                        </div>
                        <div class="mt-2 small" style="color:${style.color};">
                            <i class="fas ${style.icon} me-1"></i> Estacion Activa
                        </div>
                    </div>
                `);

                marker.addTo(this.layers[category]);
            });
        });

        console.log('Station layers built successfully.');
    }

    /** Ajusta el zoom/paneo para mostrar todas las estaciones de la capa indicada */
    _fitToLayer(layerName) {
        const list = this.stations[layerName];
        if (!list || list.length === 0) return;
        const bounds = L.latLngBounds(list.map(s => s.coords));
        this.map.fitBounds(bounds, { padding: [60, 60] });
    }

    changeStyle(style) {
        if (this.tileLayer) this.map.removeLayer(this.tileLayer);

        const urls = {
            voyager:   'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
            satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            dark:      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            positron:  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        };

        this.tileLayer = L.tileLayer(urls[style] || urls.voyager).addTo(this.map);
    }

    /** Muestra el marcador de temperatura en el centro del mapa */
    updateMarker(weather) {
        if (this.centerMarker) this.centerMarker.remove();

        const temp = Math.round(weather.main.temp);
        const desc = weather.weather[0].description;

        this.centerMarker = L.circleMarker(this.center, {
            radius: 14, fillColor: '#3B9A54',
            color: '#FFF', weight: 3, fillOpacity: 0.95
        }).addTo(this.map);

        this.centerMarker.bindPopup(`
            <div class="text-center p-2">
                <div class="small fw-bold text-uppercase mb-1"
                     style="font-size:0.65rem;letter-spacing:1.5px;color:#666;">
                    Barrancabermeja
                </div>
                <div style="font-size:2rem;font-weight:700;color:#1D2A34;">${temp}&deg;C</div>
                <div class="small" style="color:#42545E;">
                    <i class="fas fa-cloud me-1"></i>${desc}
                </div>
            </div>
        `).openPopup();
    }

    /** Alterna la capa visible en el mapa y encuadra sobre sus estaciones */
    switchLayer(layerName) {
        // Ocultar todas las capas
        Object.values(this.layers).forEach(layer => {
            if (this.map.hasLayer(layer)) this.map.removeLayer(layer);
        });

        // Mostrar la capa seleccionada
        if (this.layers[layerName]) {
            this.layers[layerName].addTo(this.map);
            this._fitToLayer(layerName);
            console.log(`Layer switched to: ${layerName}`);
        }
    }
}

export const mapComponent = new MapComponent();
export default mapComponent;
