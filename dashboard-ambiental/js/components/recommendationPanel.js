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
            const pm2_5 = airQuality ? parseFloat(airQuality.list[0].components.pm2_5) : 10;

            // 1. Recomendaciones basadas en PM2.5
            if (pm2_5 <= 25) {
                recommendations.push({
                    type: 'success',
                    icon: 'fa-check-circle',
                    title: 'CALIDAD DEL AIRE: BUENO (0 – 25 µg/m³)',
                    text: 'Actividades normales al aire libre. Promover movilidad sostenible (bicicleta, caminar). Mantener ventilación natural en espacios cerrados.'
                });
            } else if (pm2_5 <= 50) {
                recommendations.push({
                    type: 'warning',
                    icon: 'fa-exclamation-circle',
                    title: 'CALIDAD DEL AIRE: MODERADO (26 – 50 µg/m³)',
                    text: 'Personas sensibles (niños, adultos mayores, asmáticos) deben: Reducir exposición prolongada. Evitar ejercicio intenso en exteriores. Monitorear continuamente los niveles.'
                });
            } else if (pm2_5 <= 75) {
                recommendations.push({
                    type: 'danger',
                    icon: 'fa-mask',
                    title: 'CALIDAD DEL AIRE: DAÑINO (51 – 75 µg/m³)',
                    text: 'Limitar actividades físicas al aire libre. Uso recomendado de mascarillas (tipo N95 o equivalente). Cerrar ventanas en horas de mayor contaminación. Uso de purificadores de aire en interiores. Priorizar teletrabajo o actividades remotas si es posible.'
                });
            } else {
                recommendations.push({
                    type: 'danger',
                    icon: 'fa-biohazard',
                    title: 'CALIDAD DEL AIRE: PELIGROSO (> 75 µg/m³)',
                    text: 'Evitar salir al exterior salvo necesidad. Suspender actividades deportivas al aire libre. Uso obligatorio de protección respiratoria. Mantener espacios cerrados y sellados. Activar alertas en el sistema (notificaciones, dashboards). Implementar protocolos institucionales de emergencia.'
                });
            }

            // 2. Recomendación General OMS
            recommendations.push({
                type: 'info',
                icon: 'fa-hospital',
                title: 'RECOMENDACIONES GENERALES (OMS)',
                text: 'Reducir la exposición prolongada incluso a niveles moderados. Priorizar la protección de grupos vulnerables. Implementar sistemas de monitoreo continuo. Promover políticas de reducción de emisiones (vehículos, industria). Educar a la población sobre riesgos y prevención.'
            });
        }

        // Renderizado final
        this.container.innerHTML = recommendations.map(rec => `
            <div class="recommendation-card ${rec.type} p-3 animate-fade">
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
