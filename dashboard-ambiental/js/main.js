/**
 * Main.js
 * App Orchestrator for the Environmental Dashboard.
 */

import { weatherService } from './services/weatherService.js?v=20260425';
import { predictionService } from './services/predictionService.js?v=20260425';
import { mapComponent } from './components/mapComponent.js?v=20260425';
import { dataPanel } from './components/dataPanel.js?v=20260425';
import { predictionPanel } from './components/predictionPanel.js?v=20260425';
import { recommendationPanel } from './components/recommendationPanel.js?v=20260425';
import { cumulativePanel } from './components/cumulativePanel.js?v=20260425';

class App {
    async init() {
        console.log('🚀 Initializing Dashboard...');
        
        // 1. Initialize Components
        mapComponent.init();
        cumulativePanel.init();
        
        // 2. Load Initial Data
        await this.refreshData();

        // 3. Apply Configuration
        this.applyDashboardConfig();

        // 4. Handle URL Parameters (Banco Agrario Logic)
        this.handleUrlParameters();

        // 5. Setup Listeners
        this.setupEventListeners();
    }

    applyDashboardConfig() {
        const uri = decodeURI(document.URL.toString());
        const isAdmin = uri.indexOf("admin=1245") > 0;
        
        const config = JSON.parse(localStorage.getItem('dashboardConfig') || '{}');
        const colMain = document.getElementById('col-main');
        const colSide = document.getElementById('col-side');

        if (colMain && colSide) {
            // Lógica: Solo se muestra si es Admin Y la opción está activada en la config.
            // Por defecto (si no es admin o no está activado), se oculta.
            if (isAdmin && config.showPredictiveModel === true) {
                console.log('👁 Admin detectado: Mostrando modelo predictivo lateral.');
                colSide.classList.remove('d-none');
                colMain.classList.remove('col-lg-12');
                colMain.classList.add('col-lg-8');
            } else {
                console.log('🙈 Ocultando modelo predictivo lateral (No admin o desactivado).');
                colSide.classList.add('d-none');
                colMain.classList.remove('col-lg-8');
                colMain.classList.add('col-lg-12');
            }
            
            // Re-render map and markers to adjust to new container size
            if(mapComponent.map) {
                setTimeout(() => {
                    mapComponent.map.invalidateSize();
                }, 300);
            }
        }
    }

    handleUrlParameters() {
        const uri = decodeURI(document.URL.toString());
        const isAdminSession = uri.indexOf("admin=1245") > 0;
        
        const adminBtn = document.getElementById('admin-btn');
        const hdTipoCons = document.getElementById('hdTipoCons');

        if (isAdminSession) {
            console.log('🔓 Admin Session Activated');
            if (adminBtn) adminBtn.classList.remove('d-none');
            if (hdTipoCons) hdTipoCons.value = "Administrador";
        } else {
            if (adminBtn) adminBtn.classList.add('d-none');
            if (hdTipoCons) hdTipoCons.value = "Publico";
        }
    }

    async refreshData() {
        try {
            console.log('🔄 Refreshing data...');
            // In parallel for speed
            const [weather, airQuality, prediction] = await Promise.all([
                weatherService.getCurrentWeather(),
                weatherService.getAirQuality(),
                predictionService.getPredictionTrend()
            ]);

            // Render components
            mapComponent.updateMarker(weather);
            dataPanel.render(weather, airQuality);
            predictionPanel.render(prediction);
            recommendationPanel.render(weather, airQuality);
            cumulativePanel.update();

            console.log('✅ Dashboard updated successfully.');
        } catch (error) {
            console.error('❌ Error updating dashboard:', error);
        }
    }

    setupEventListeners() {
        // Refresh Button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshData());
        }

        // Layer Switches
        const layers = ['Clima', 'Aire', 'Hidro'];
        layers.forEach(l => {
            const btn = document.getElementById(`layer${l}`);
            if (btn) {
                btn.addEventListener('change', () => {
                   mapComponent.switchLayer(l.toLowerCase());
                });
            }
        });

        // Map Style Selection
        const mapStyleSelect = document.getElementById('map-style-select');
        if (mapStyleSelect) {
            mapStyleSelect.addEventListener('change', (e) => {
                const style = e.target.value;
                console.log(`💡 Main App: Solicitando estilo mapa -> ${style}`);
                mapComponent.changeStyle(style);
            });
        }

        // Listen to storage changes (for admin panel config)
        window.addEventListener('storage', () => {
            console.log('🔄 Dashboard: Detectado cambio en localStorage, aplicando config...');
            this.applyDashboardConfig();
            cumulativePanel.update();
            this.refreshData(); // Refresh metrics just in case
        });

        // File Selection (NEW)
        this.setupUploadListener();

        // Admin Access Handshake
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                console.log('🔑 Setting admin access handshake...');
                sessionStorage.setItem('admin_access_handshake', 'true');
            });
        }
    }

    setupUploadListener() {
        const fileInput = document.getElementById('file-input');
        const uploadStatus = document.getElementById('upload-status');

        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                uploadStatus.classList.remove('d-none');
                
                const result = await predictionService.uploadFile(file);
                
                if (result.success) {
                    // Update prediction panel with new data including units
                    predictionPanel.render({
                        labels: result.labels || ['1', '2', '3', '4', '5', '6'],
                        data: result.data || result.predictions,
                        futureTrend: result.futureTrend || 'Datos procesados del archivo',
                        data_unit: result.data_unit,
                        data_label: result.data_label
                    });

                    // Update recommendations based on ML Analysis
                    const weather = await weatherService.getCurrentWeather();
                    const airQuality = await weatherService.getAirQuality();
                    recommendationPanel.render(weather, airQuality, result.recommendations);
                    
                    alert(`Archivo "${file.name}" procesado con éxito por el modelo.`);
                } else {
                    alert(result.message || 'Error al procesar el archivo.');
                }
                
                uploadStatus.classList.add('d-none');
            });
        }
    }
}

// Start the App
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
