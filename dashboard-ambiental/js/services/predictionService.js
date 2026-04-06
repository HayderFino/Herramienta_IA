/**
 * PredictionService.js
 * Mock service to simulate environmental predictions.
 * Can be easily integrated with a real ML API later.
 */

class PredictionService {
    constructor() {
        this.apiUrl = 'http://localhost:8000/api/predict'; // Real endpoint for future ML integration
    }

    async getPredictionTrend() {
        try {
            // Future integration with real ML API:
            // const response = await fetch(this.apiUrl);
            // return await response.json();
            
            // Simulation for now
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({
                        labels: ['1h', '2h', '3h', '4h', '5h', '6h'],
                        data: [31, 32, 34, 36, 35, 33],
                        mainRisk: 'Moderado',
                        probability: 65.5,
                        futureTrend: 'Aumento progresivo de calor'
                    });
                }, 1000);
            });
        } catch (error) {
            console.error('Error fetching prediction:', error);
            // Return simulation data if real API is down
            return {
                labels: ['1h', '2h', '3h', '4h', '5h', '6h'],
                data: [32, 34, 36, 35, 33, 31],
                mainRisk: 'Simulado',
                probability: 0,
                futureTrend: 'Modo Offline: Datos simulados'
            };
        }
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${this.apiUrl}/upload`, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Error al subir archivo');
            return await response.json();
        } catch (error) {
            console.error('Upload failed, falling back to simulation:', error);
            // Simulate processing time
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve({
                        success: true,
                        message: "Archivo procesado (Simulación)",
                        predictions: [28, 30, 32, 35, 34, 32],
                        recommendations: [
                            { type: 'danger', icon: 'fa-robot', title: 'ML: Riesgo Calor', text: 'El modelo simulado proyecta aumento térmico súbito.' },
                            { type: 'success', icon: 'fa-check', title: 'ML: Estabilidad Aire', text: 'Nivel PM2.5 dentro de parámetros normales según análisis.' }
                        ],
                        futureTrend: "Simulación de tendencia ML activada"
                    });
                }, 2000);
            });
        }
    }

    getWaterQualityMock() {
        return {
            ph: 7.2,
            turbidity: 4.5,
            dissolvedOxygen: 6.8,
            status: 'Estable'
        }
    }
}

export const predictionService = new PredictionService();
export default predictionService;
