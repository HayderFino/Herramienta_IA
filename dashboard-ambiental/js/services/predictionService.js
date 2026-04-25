/**
 * PredictionService.js
 * Mock service to simulate environmental predictions.
 * Can be easily integrated with a real ML API later.
 */

class PredictionService {
    constructor() {
        // En Laragon/Producción usamos el puente api.php para evitar problemas de CORS
        this.apiUrl = 'api.php?route=predict'; 
    }

    async getPredictionTrend() {
        try {
            const response = await fetch(this.apiUrl);
            if (!response.ok) throw new Error('API unstable');
            return await response.json();
        } catch (error) {
            console.warn('Real ML API not available, falling back to minimal local view.');
            return {
                labels: ['Ahora', '+1h', '+2h', '+3h', '+4h', '+5h'],
                data: [0, 0, 0, 0, 0, 0],
                mainRisk: 'Sin Servicio',
                probability: 0,
                futureTrend: 'Servicio de análisis (api_bridge.py) no activo.',
                data_unit: 'µg/m³',
                data_label: 'PM2.5',
                serviceOffline: true
            };
        }
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            // Usamos el parámetro route=upload para que api.php lo maneje
            const response = await fetch(`api.php?route=upload`, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Error al subir archivo');
            return await response.json();
        } catch (error) {
            console.error('ML Analysis service is DOWN:', error);
            return {
                success: false,
                message: "Servicio de análisis IA no activo. Ejecuta api_bridge.py primero.",
                serviceOffline: true
            };
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
