/**
 * RecommendationPanel.js
 * Generates and displays contextual recommendations.
 */

class RecommendationPanel {
    constructor() {
        this.container = document.getElementById('recommendations-container');
    }

    render(weather, airQuality, mlRecommendations = []) {
        if (!this.container) return;

        let recommendations = [];

        // PRIORIDAD: Si hay recomendaciones del Modelo ML, mostrar esas
        if (mlRecommendations && mlRecommendations.length > 0) {
            recommendations = mlRecommendations;
        } else {
            // LÓGICA BASADA EN NORMATIVA COLOMBIANA (Res. 2254/2017)
            const temp = weather.main.temp;
            const pm2_5 = airQuality ? airQuality.list[0].components.pm2_5 : 10;
            const aqi = airQuality ? airQuality.list[0].main.aqi : 1;

            // 1. Recomendación Térmica (Ajustada a Barrancabermeja)
            if (temp > 38) {
                recommendations.push({
                    type: 'danger', // #184424
                    icon: 'fa-thermometer-full',
                    title: '¡ALERTA TÉRMICA!',
                    text: `Temperatura crítica de ${Math.round(temp)}°C. Riesgo de estrés térmico elevado.`
                });
            } else if (temp > 35) {
                recommendations.push({
                    type: 'warning', // #006699 (Azul Institucional en CSS)
                    icon: 'fa-sun',
                    title: 'Riesgo Térmico',
                    text: `Condiciones de ${Math.round(temp)}°C. Se recomienda precaución en exteriores.`
                });
            } else {
                recommendations.push({
                    type: 'success', // #339933
                    icon: 'fa-temperature-low',
                    title: 'Clima Moderado',
                    text: 'Temperatura dentro de los rangos normales para la región.'
                });
            }

            // 2. Recomendación Calidad Aire (Res. 2254 de 2017 Col)
            if (pm2_5 > 37) {
                recommendations.push({
                    type: 'danger',
                    icon: 'fa-head-side-mask',
                    title: 'SUPERACIÓN NORMA COL.',
                    text: `PM2.5 en ${Math.round(pm2_5)} µg/m³. Excede el límite legal diario permitido en Colombia.`
                });
            } else if (pm2_5 > 15) {
                recommendations.push({
                    type: 'warning',
                    icon: 'fa-smog',
                    title: 'Norma: Prevención',
                    text: `Calidad del aire aceptable (${Math.round(pm2_5)} µg/m³), pero bajo vigilancia ambiental.`
                });
            } else {
                 recommendations.push({
                    type: 'success',
                    icon: 'fa-leaf',
                    title: 'Día Saludable',
                    text: 'Calidad del aire excelente. Cumple con los estándares de la Resolución 2254 de 2017.'
                });
            }
        }

        // Renderizado final
        this.container.innerHTML = recommendations.map(rec => `
            <div class="recommendation-card ${rec.type} p-3 mb-3 animate-fade">
                <div class="d-flex align-items-center mb-1">
                    <i class="fas ${rec.icon} me-2 text-${rec.type === 'danger' ? 'danger' : rec.type === 'warning' ? 'warning' : 'success'}"></i>
                    <strong class="small uppercase font-weight-bold">${rec.title}</strong>
                </div>
                <p class="mb-0 small text-muted">${rec.text}</p>
            </div>
        `).join('');
    }
}

export const recommendationPanel = new RecommendationPanel();
export default recommendationPanel;
