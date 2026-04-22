/**
 * MapComponent.js
 * Manages Leaflet map instance and data layers.
 */

class MapComponent {
    constructor() {
        this.map = null;
        this.layers = {};     // se inicializan dentro de init()
        this.tileLayer = null;
        this.centerMarker = null;

        // Centro por defecto: Barrancabermeja
        this.center = [7.0653, -73.8167];

        // ── Estaciones de Monitoreo ──────────────────────────────────────────
        this.stations = {
            clima: [
                { name: "PIRMA-3 HATO", coords: [6.520736, -73.366447], type: "Hidrologica (IDEAM)" },
                { name: "PIRMA-2 ENCINO", coords: [6.135536, -73.112619], type: "Hidrologica (IDEAM)" },
                { name: "PIRMA-1 CURITI", coords: [6.606756, -73.073383], type: "Hidrologica (IDEAM)" }
            ],
            aire: [
                { name: "CAS Alcaldia", short: "Alcaldia", coords: [7.06079, -73.87267], type: "Calidad de Aire" },
                { name: "CAS Escuela San Silvestre", short: "San Silvestre", coords: [7.0834, -73.83934], type: "Calidad de Aire" },
                { name: "CAS-SUB Estacion Bomberos", short: "CAS-SUB", coords: [7.0719, -73.8342], type: "Calidad de Aire" },
                { name: "CAS Universidad Industrial de Santander", short: "UIS", coords: [7.0695, -73.8518], type: "Calidad de Aire" }
            ]
        };

        // Estilos visuales por categoria
        this.categoryStyle = {
            clima: { color: '#3B9A54', icon: 'fa-cloud-sun' },
            aire: { color: '#3399CC', icon: 'fa-wind' }
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
            aire: L.layerGroup()
        };

        // 3. Poblar cada layer con marcadores
        this._buildStationLayers();

        // 4. Mostrar capa inicial y encuadrar
        this.currentLayer = 'clima';
        this.layers.clima.addTo(this.map);
        this._fitToLayer('clima');
        this._renderCards();
        this._updateLegend('clima');

        // 5. Selector de estilo de mapa
        const styleSelect = document.getElementById('map-style-select');
        if (styleSelect) {
            styleSelect.addEventListener('change', (e) => this.changeStyle(e.target.value));
        }

        // 6. Escuchar cambios del admin panel en tiempo real
        window.addEventListener('storage', (e) => {
            if (e.key === 'manualStationData') {
                console.log("Detectado cambio en datos manuales, regenerando marcadores...");
                Object.values(this.layers).forEach(layer => layer.clearLayers());
                this._buildStationLayers();
                this._renderCards();
            }
        });

        // 7. Cargar datos persistentes del servidor Python
        fetch('http://localhost:8000/api/manual_data?t=' + Date.now())
            .then(r => r.json())
            .then(data => {
                localStorage.setItem('manualStationData', JSON.stringify(data));
                let ev = new Event('storage');
                ev.key = 'manualStationData';
                window.dispatchEvent(ev);
            })
            .catch(e => console.warn("No se pudo cargar datos persistentes", e));
    }

    /** Helper para determinar color basado en el número **/
    _getColorForValue(category, indicatorStr, fallbackColor) {
        if (!indicatorStr) return fallbackColor;
        const val = parseFloat(indicatorStr);
        if (isNaN(val)) return fallbackColor;

        if (category === 'aire') {
            if (val <= 25) return '#4CAF50';
            if (val <= 50) return '#FFC107';
            if (val <= 75) return '#FF9800';
            return '#EF4444';
        } else if (category === 'clima') {
            if (val <= 28) return '#3B9A54';
            if (val <= 33) return '#FFC107';
            if (val <= 38) return '#FF9800';
            return '#EF4444';
        }
        return fallbackColor;
    }

    /** Actualiza la leyenda del mapa superpuesta (ICA, Temperatura, pH) */
    _updateLegend(layerName) {
        const legend = document.getElementById('map-legend');
        if (!legend) return;

        let html = '';
        if (layerName === 'aire') {
            html = `
                <div class="legend-header d-flex justify-content-between align-items-center mb-2">
                    <h6 class="mb-0">Escalas de Calidad de Aire</h6>
                    <span class="badge bg-info text-white" style="font-size:0.6rem;">Marco de referencia</span>
                </div>
                <div class="row g-2">
                    <div class="col-6">
                        <div class="small fw-bold mb-1" style="font-size:0.65rem; color:#666;">PARTÍCULAS (PM5 / PM10)</div>
                        <div class="legend-items">
                            <div class="legend-item"><span class="color-box" style="background-color:#4CAF50; width:15px; height:10px;"></span> 0 - 25 <small class="ms-1">Bueno</small></div>
                            <div class="legend-item"><span class="color-box" style="background-color:#FFC107; width:15px; height:10px;"></span> 26 - 50 <small class="ms-1">Mod.</small></div>
                            <div class="legend-item"><span class="color-box" style="background-color:#FF9800; width:15px; height:10px;"></span> 51 - 75 <small class="ms-1">Dañino</small></div>
                            <div class="legend-item"><span class="color-box" style="background-color:#EF4444; width:15px; height:10px;"></span> > 75 <small class="ms-1">Peligro</small></div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="small fw-bold mb-1" style="font-size:0.65rem; color:#666;">TEMPERATURA (°C)</div>
                        <div class="legend-items">
                            <div class="legend-item"><span class="color-box" style="background-color:#3B9A54; width:15px; height:10px;"></span> < 28 <small class="ms-1">Estable</small></div>
                            <div class="legend-item"><span class="color-box" style="background-color:#FFC107; width:15px; height:10px;"></span> 28-33 <small class="ms-1">Cálido</small></div>
                            <div class="legend-item"><span class="color-box" style="background-color:#FF9800; width:15px; height:10px;"></span> 34-38 <small class="ms-1">Extremo</small></div>
                            <div class="legend-item"><span class="color-box" style="background-color:#EF4444; width:15px; height:10px;"></span> > 38 <small class="ms-1">Peligro</small></div>
                        </div>
                    </div>
                    <div class="col-6 mt-2">
                        <div class="small fw-bold mb-1" style="font-size:0.65rem; color:#666;">HUMEDAD (%)</div>
                        <div class="legend-items">
                            <div class="legend-item"><span class="color-box" style="background-color:#4CAF50; width:15px; height:10px;"></span> 40-70 <small class="ms-1">Ideal</small></div>
                            <div class="legend-item"><span class="color-box" style="background-color:#FFC107; width:15px; height:10px;"></span> > 70 <small class="ms-1">Húmedo</small></div>
                            <div class="legend-item"><span class="color-box" style="background-color:#FF9800; width:15px; height:10px;"></span> < 40 <small class="ms-1">Seco</small></div>
                        </div>
                    </div>
                    <div class="col-6 mt-2">
                        <div class="small fw-bold mb-1" style="font-size:0.65rem; color:#666;">VIENTO (m/s)</div>
                        <div class="legend-items">
                            <div class="legend-item"><span class="color-box" style="background-color:#4CAF50; width:15px; height:10px;"></span> < 5 <small class="ms-1">Calma</small></div>
                            <div class="legend-item"><span class="color-box" style="background-color:#FFC107; width:15px; height:10px;"></span> 5-15 <small class="ms-1">Brisa</small></div>
                            <div class="legend-item"><span class="color-box" style="background-color:#EF4444; width:15px; height:10px;"></span> > 15 <small class="ms-1">Fuerte</small></div>
                        </div>
                    </div>
                </div>`;
        } else if (layerName === 'clima') {
            html = `
                <h6>Escala de Temperatura (°C)</h6>
                <div class="legend-items">
                    <div class="legend-item"><span class="color-box" style="background-color:#3B9A54"></span> <strong>ESTABLE</strong> < 28°</div>
                    <div class="legend-item"><span class="color-box" style="background-color:#FFC107"></span> <strong>CÁLIDO</strong> 28-33°</div>
                    <div class="legend-item"><span class="color-box" style="background-color:#FF9800"></span> <strong>EXTREMO</strong> 34-38°</div>
                    <div class="legend-item"><span class="color-box" style="background-color:#EF4444"></span> <strong>PELIGROSO</strong> >38°</div>
                </div>`;
        }
        legend.innerHTML = html;
        this._updateGlobalStats(layerName);
    }

    _getVarStatus(name, value) {
        const val = parseFloat(value);
        if (isNaN(val)) return 'status-neutral';

        if (name === 'pm5' || name === 'pm2.5') {
            if (val <= 12) return 'status-good';
            if (val <= 35) return 'status-warn';
            return 'status-danger';
        }
        if (name === 'pm10') {
            if (val <= 25) return 'status-good';
            if (val <= 50) return 'status-warn';
            return 'status-danger';
        }
        if (name === 'tem') {
            if (val <= 28) return 'status-good';
            if (val <= 33) return 'status-warn';
            return 'status-danger';
        }
        if (name === 'hum') {
            if (val >= 40 && val <= 70) return 'status-good';
            return 'status-warn';
        }
        if (name === 'vel') {
            if (val <= 5) return 'status-good';
            if (val <= 15) return 'status-warn';
            return 'status-danger';
        }
        return 'status-neutral';
    }

    _updateGlobalStats(layerName) {
        const manualData = JSON.parse(localStorage.getItem('manualStationData') || '{}');
        const stations = this.stations[layerName] || [];
        if (stations.length === 0) return;

        let totalVal = 0, count = 0, alerts = 0;
        stations.forEach(s => {
            const override = manualData[s.name] || manualData[s.short];
            if (override) {
                const v = parseFloat(override.indicator);
                if (!isNaN(v)) { totalVal += v; count++; }
                if (override.status === 'Alerta' || override.status === 'Precaución') alerts++;
            }
        });

        const avg = count > 0 ? (totalVal / count).toFixed(1) : '--';

        // Buscamos elementos en el DOM para actualizar estadísticas globales
        const avgEl = document.getElementById('global-avg-val');
        const alertEl = document.getElementById('global-alert-count');
        const statusEl = document.getElementById('global-status-text');

        if (avgEl) avgEl.textContent = avg;
        if (alertEl) alertEl.textContent = alerts;
        if (statusEl) {
            statusEl.textContent = alerts > 0 ? 'Estado Crítico' : 'Estado Estable';
            statusEl.className = alerts > 0 ? 'text-danger fw-bold' : 'text-success fw-bold';
        }
    }

    /** Crea los circleMarkers y los agrega al LayerGroup correspondiente */
    _buildStationLayers() {
        Object.keys(this.stations).forEach(category => {
            const style = this.categoryStyle[category];

            this.stations[category].forEach(station => {
                // Read manual override if present
                const manualData = JSON.parse(localStorage.getItem('manualStationData') || '{}');
                const override = manualData[station.name] || manualData[station.short];

                let dynamicColor = style.color;
                if (override && override.indicator) {
                    dynamicColor = this._getColorForValue(category, override.indicator, style.color);
                }

                const marker = L.circleMarker(station.coords, {
                    radius: 13,
                    fillColor: dynamicColor,
                    color: '#FFFFFF',
                    weight: 2.5,
                    opacity: 1,
                    fillOpacity: 1
                });

                let indicatorHTML = '';
                let statusName = 'Estacion Activa';
                let statusColor = dynamicColor;

                if (override) {
                    statusName = `Inyectado/Man.: ${override.status}`;
                    indicatorHTML = `<div class="fw-bold fs-5 mt-1" style="color:${dynamicColor}">${override.indicator}</div>`;
                    if (override.status === 'Offline') statusColor = '#6c757d';
                }

                marker.bindPopup(`
                    <div class="text-center p-2">
                        <div class="small fw-bold text-uppercase mb-1"
                             style="font-size:0.6rem;letter-spacing:1px;color:#888;">
                            ${station.type}
                        </div>
                        <div class="fw-bold" style="color:#1D2A34;font-size:0.9rem;">
                            ${station.name}
                        </div>
                        ${indicatorHTML}
                        <div class="mt-2 small" style="color:${statusColor};">
                            <i class="fas ${style.icon} me-1"></i> ${statusName}
                        </div>
                    </div>
                `);

                const displayName = station.short || station.name;
                let tooltipContent = `<strong>${displayName}</strong>`;
                if (override && override.indicator) {
                    // Muestra el valor de color resaltado, para que destaque en el mapa permanentemente
                    tooltipContent += `<br><span style="color:${dynamicColor}; font-weight:900; font-size:1.3em; background:rgba(255,255,255,0.9); padding:1px 4px; border-radius:4px; display:inline-block; margin-top:2px;">${override.indicator}</span>`;
                }

                marker.bindTooltip(
                    tooltipContent,
                    {
                        permanent: true,
                        direction: 'right',
                        className: 'station-permanent-tooltip',
                        offset: [10, 0]
                    }
                );

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
            voyager: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
            satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            positron: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
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
            this.currentLayer = layerName;
            this._fitToLayer(layerName);
            this._renderCards();
            this._updateLegend(layerName);
            console.log(`Layer switched to: ${layerName}`);
        }
    }

    /** Muestra tarjetas con info actual debajo del mapa */
    _renderCards() {
        const container = document.getElementById('station-cards-container');
        if (!container || !this.currentLayer) return;

        const list = this.stations[this.currentLayer] || [];
        const manualData = JSON.parse(localStorage.getItem('manualStationData') || '{}');
        const style = this.categoryStyle[this.currentLayer];

        container.innerHTML = list.map(station => {
            const override = manualData[station.name] || manualData[station.short];
            let indicator = '--';
            let status = 'Estable';

            if (override) {
                indicator = override.indicator || '--';
                status = override.status;
            } else {
                indicator = (this.currentLayer === 'aire') ? '15 µg/m³' : (this.currentLayer === 'clima' ? '28 °C' : '7.0 pH');
            }

            let statusColor = this._getColorForValue(this.currentLayer, indicator, style.color);
            if (override && override.status === 'Offline') statusColor = '#6c757d';

            // Si no hay datos manuales, simulamos algunos para las variables secundarias
            let d = (override && override.allData) ? override.allData : null;
            if (!d) {
                if (this.currentLayer === 'aire') {
                    d = { pm5: '8.4', pm10: '15', tem: '31', hum: '65', vel: '2.1' };
                } else if (this.currentLayer === 'clima') {
                    d = { tem: '32', hum: '62', vel: '3.5' };
                }
            }

            let extraInfo = '';
            if (d) {
                if (this.currentLayer === 'aire') {
                    extraInfo = `
                        <div class="variables-grid mt-2 mb-3">
                            <div class="row g-2 text-center">
                                <div class="col-4"><div class="var-box ${this._getVarStatus('pm5', d.pm5)}"><span>PM5</span><strong>${d.pm5 || '--'}</strong></div></div>
                                <div class="col-4"><div class="var-box ${this._getVarStatus('pm10', d.pm10)}"><span>PM10</span><strong>${d.pm10 || '--'}</strong></div></div>
                                <div class="col-4"><div class="var-box ${this._getVarStatus('tem', d.tem)}"><span>TEM</span><strong>${d.tem || '--'}°</strong></div></div>
                                <div class="col-6"><div class="var-box ${this._getVarStatus('hum', d.hum)}"><span>HUM</span><strong>${d.hum || '--'}%</strong></div></div>
                                <div class="col-6"><div class="var-box ${this._getVarStatus('vel', d.vel)}"><span>VEL</span><strong>${d.vel || '--'} <small>m/s</small></strong></div></div>
                            </div>
                        </div>
                    `;
                } else if (this.currentLayer === 'clima') {
                    extraInfo = `
                        <div class="variables-grid mt-2 mb-3">
                            <div class="row g-2 text-center">
                                <div class="col-4"><div class="var-box ${this._getVarStatus('tem', d.tem)}"><span>TEM</span><strong>${d.tem || '--'}°</strong></div></div>
                                <div class="col-4"><div class="var-box ${this._getVarStatus('hum', d.hum)}"><span>HUM</span><strong>${d.hum || '--'}%</strong></div></div>
                                <div class="col-4"><div class="var-box ${this._getVarStatus('vel', d.vel)}"><span>VEL</span><strong>${d.vel || '--'} <small>m/s</small></strong></div></div>
                            </div>
                        </div>
                    `;
                }
            }

            return `
                <div class="col-lg-3 col-md-4 col-sm-6 mb-3">
                    <div class="card glass h-100 border-0" style="border-top: 4px solid ${statusColor} !important;">
                        <div class="card-body p-3 d-flex flex-column">
                            <div class="small fw-bold text-muted mb-1 text-uppercase" style="font-size:0.7rem;">${station.type}</div>
                            <h6 class="mb-2 fw-bold" style="color:var(--dark-text); min-height: 2.4rem;">${station.name}</h6>
                            
                            ${extraInfo}

                            <div class="d-flex justify-content-between align-items-center mt-auto pt-3">
                                <span class="badge" style="background-color: ${statusColor}20; color: ${statusColor}; border: 1px solid ${statusColor}40;">
                                    <i class="fas ${style.icon} me-1"></i> ${status}
                                </span>
                                <span class="fw-bold fs-5" style="color:${statusColor}">${indicator}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

export const mapComponent = new MapComponent();
export default mapComponent;
