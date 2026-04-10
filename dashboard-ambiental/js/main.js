/**
 * Main.js
 * App Orchestrator for the Environmental Dashboard.
 */

import { weatherService } from './services/weatherService.js';
import { predictionService } from './services/predictionService.js';
import { mapComponent } from './components/mapComponent.js?v=3.0';
import { dataPanel } from './components/dataPanel.js';
import { predictionPanel } from './components/predictionPanel.js';
import { recommendationPanel } from './components/recommendationPanel.js';

class App {
    async init() {
        console.log('🚀 Initializing Dashboard...');
        
        // 1. Initialize Components
        mapComponent.init();
        
        // 2. Load Initial Data
        await this.refreshData();

        // 3. Setup Listeners
        this.setupEventListeners();
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
        const layers = ['Clima', 'Aire', 'Agua'];
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

        // File Selection (NEW)
        this.setupUploadListener();
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
                
                if (result.success || result.data) {
                    // Update prediction panel with new data
                    predictionPanel.render({
                        labels: result.labels || ['1', '2', '3', '4', '5', '6'],
                        data: result.data || result.predictions,
                        futureTrend: result.futureTrend || 'Datos procesados del archivo'
                    });

                    // NEW: Update recommendations based on ML Analysis
                    const weather = await weatherService.getCurrentWeather();
                    const airQuality = await weatherService.getAirQuality();
                    recommendationPanel.render(weather, airQuality, result.recommendations);
                }
                
                uploadStatus.classList.add('d-none');
                alert(`Archivo "${file.name}" procesado con éxito por el modelo.`);
            });
        }
    }
}

// Start the App
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
