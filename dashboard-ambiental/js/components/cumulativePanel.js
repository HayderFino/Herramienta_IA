/**
 * CumulativePanel.js
 * Manages the chart showing PM2.5 levels across all stations.
 * Each station gets its own colored line in the chart.
 */

class CumulativePanel {
    constructor() {
        this.chart = null;
        this.ctx = null;

        // Colores asignados por estación
        this.stationColors = {
            'CAS Alcaldia':                        { border: '#63b3ed', bg: 'rgba(99, 179, 237, 0.15)' },
            'CAS Escuela San Silvestre':            { border: '#68d391', bg: 'rgba(104, 211, 145, 0.15)' },
            'CAS-SUB Estacion Bomberos':            { border: '#fc8181', bg: 'rgba(252, 129, 129, 0.15)' },
            'CAS Universidad Industrial de Santander': { border: '#f6c90e', bg: 'rgba(246, 201, 14, 0.15)' },
            'General':                              { border: '#FFC107', bg: 'rgba(255, 193, 7, 0.15)' }
        };

        // Color fallback
        this.fallbackColors = [
            { border: '#9f7aea', bg: 'rgba(159, 122, 234, 0.15)' },
            { border: '#ed64a6', bg: 'rgba(237, 100, 166, 0.15)' },
            { border: '#48bb78', bg: 'rgba(72, 187, 120, 0.15)' },
            { border: '#ecc94b', bg: 'rgba(236, 201, 75, 0.15)' }
        ];
        this.fallbackIndex = 0;
    }

    _getColorForStation(stationName) {
        if (this.stationColors[stationName]) {
            return this.stationColors[stationName];
        }
        // Asignar un color fallback y guardarlo
        const color = this.fallbackColors[this.fallbackIndex % this.fallbackColors.length];
        this.stationColors[stationName] = color;
        this.fallbackIndex++;
        return color;
    }

    init() {
        this.ctx = document.getElementById('cumulativeChart');
        if (!this.ctx) return;

        const config = {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: 'rgba(255, 255, 255, 0.8)',
                            font: { family: 'Outfit', size: 11 },
                            boxWidth: 12,
                            boxHeight: 12,
                            borderRadius: 3,
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(29, 42, 52, 0.95)',
                        titleFont: { size: 13, weight: 'bold', family: 'Outfit' },
                        bodyFont: { size: 12, family: 'Outfit' },
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: true,
                        callbacks: {
                            label: (context) => ` ${context.dataset.label}: ${context.parsed.y.toFixed(2)} µg/m³`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'PM2.5 (µg/m³)',
                            color: 'rgba(255, 255, 255, 0.5)',
                            font: { size: 10 }
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 11 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.8)',
                            font: { size: 10 },
                            maxRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 15
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        };

        this.chart = new Chart(this.ctx, config);
        this.update();
    }

    async update() {
        if (!this.chart) return;

        try {
            const response = await fetch('api.php?route=pm25_history&t=' + Date.now());
            if (!response.ok) return;
            
            const history = await response.json();
            if (!Array.isArray(history) || history.length === 0) {
                // Fallback si no hay historial aún
                this.chart.data.labels = ['Sin datos'];
                this.chart.data.datasets = [{
                    label: 'PM2.5 General',
                    data: [0],
                    borderColor: '#FFC107',
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#FFC107'
                }];
                this.chart.update();
                return;
            }

            // Agrupar por estación
            const stationData = {};
            const allTimestamps = [];

            history.forEach(h => {
                const station = h.station || 'General';
                if (!stationData[station]) {
                    stationData[station] = [];
                }
                stationData[station].push({
                    timestamp: h.timestamp,
                    value: h.value
                });
                if (!allTimestamps.includes(h.timestamp)) {
                    allTimestamps.push(h.timestamp);
                }
            });

            // Los timestamps ya vienen en orden cronológico
            this.chart.data.labels = allTimestamps;

            // Crear un dataset por estación
            const datasets = [];
            Object.keys(stationData).forEach(stationName => {
                const color = this._getColorForStation(stationName);
                const records = stationData[stationName];

                // Mapear valores a las posiciones de timestamp
                const dataPoints = allTimestamps.map(ts => {
                    const match = records.find(r => r.timestamp === ts);
                    return match ? match.value : null;
                });

                // Nombre corto para la leyenda
                let shortName = stationName
                    .replace('CAS Universidad Industrial de Santander', 'UIS')
                    .replace('CAS Escuela San Silvestre', 'San Silvestre')
                    .replace('CAS-SUB Estacion Bomberos', 'CAS-SUB')
                    .replace('CAS Alcaldia', 'Alcaldía');

                datasets.push({
                    label: shortName,
                    data: dataPoints,
                    borderColor: color.border,
                    backgroundColor: color.bg,
                    borderWidth: 2.5,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: color.border,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1.5,
                    spanGaps: true
                });
            });

            this.chart.data.datasets = datasets;
            this.chart.update();

        } catch (error) {
            console.error('Error fetching PM2.5 history:', error);
        }
    }
}

export const cumulativePanel = new CumulativePanel();
export default cumulativePanel;
