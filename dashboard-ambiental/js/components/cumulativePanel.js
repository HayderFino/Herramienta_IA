/**
 * CumulativePanel.js
 * Gráfica de barras agrupadas de PM2.5 por estación.
 * Optimizada para tema claro con umbrales de calidad del aire.
 */

class CumulativePanel {
    constructor() {
        this.chart = null;
        this.ctx = null;

        // Paleta de colores vibrantes para tema claro
        this.stationColors = {
            'CAS Alcaldia': {
                border: '#3B82F6',
                bg: 'rgba(59, 130, 246, 0.75)'
            },
            'CAS Escuela San Silvestre': {
                border: '#10B981',
                bg: 'rgba(16, 185, 129, 0.75)'
            },
            'CAS-SUB Estacion Bomberos': {
                border: '#EF4444',
                bg: 'rgba(239, 68, 68, 0.75)'
            },
            'CAS Universidad Industrial de Santander': {
                border: '#F59E0B',
                bg: 'rgba(245, 158, 11, 0.75)'
            },
            'General': {
                border: '#8B5CF6',
                bg: 'rgba(139, 92, 246, 0.75)'
            }
        };

        this.fallbackColors = [
            { border: '#EC4899', bg: 'rgba(236, 72, 153, 0.75)' },
            { border: '#14B8A6', bg: 'rgba(20, 184, 166, 0.75)' },
            { border: '#F97316', bg: 'rgba(249, 115, 22, 0.75)' },
            { border: '#6366F1', bg: 'rgba(99, 102, 241, 0.75)' }
        ];
        this.fallbackIndex = 0;
    }

    _getColorForStation(stationName) {
        if (this.stationColors[stationName]) {
            return this.stationColors[stationName];
        }
        const color = this.fallbackColors[this.fallbackIndex % this.fallbackColors.length];
        this.stationColors[stationName] = color;
        this.fallbackIndex++;
        return color;
    }

    _shortName(stationName) {
        return stationName
            .replace('CAS Universidad Industrial de Santander', 'UIS')
            .replace('CAS Escuela San Silvestre', 'San Silvestre')
            .replace('CAS-SUB Estacion Bomberos', 'Bomberos')
            .replace('CAS Alcaldia', 'Alcaldía');
    }

    init() {
        this.ctx = document.getElementById('cumulativeChart');
        if (!this.ctx) return;

        // Umbrales de calidad del aire (líneas de referencia)
        const umbralBueno = 25;
        const umbralModerado = 50;
        const umbralDañino = 75;

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
                        align: 'center',
                        labels: {
                            color: '#1D2A34',
                            font: { family: 'Outfit', size: 12, weight: '600' },
                            boxWidth: 12,
                            boxHeight: 12,
                            borderRadius: 3,
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.98)',
                        titleColor: '#1D2A34',
                        bodyColor: '#4A5568',
                        borderColor: '#E2E8F0',
                        borderWidth: 1,
                        titleFont: { size: 13, weight: 'bold', family: 'Outfit' },
                        bodyFont: { size: 12, family: 'Outfit' },
                        padding: 14,
                        cornerRadius: 10,
                        displayColors: true,
                        boxPadding: 6,
                        callbacks: {
                            label: (context) => {
                                const val = context.parsed.y;
                                let calidad = '';
                                if (val <= umbralBueno) calidad = ' ✅ Bueno';
                                else if (val <= umbralModerado) calidad = ' 🟡 Moderado';
                                else if (val <= umbralDañino) calidad = ' 🟠 Dañino';
                                else calidad = ' 🔴 Peligroso';
                                return ` ${context.dataset.label}: ${val.toFixed(1)} µg/m³${calidad}`;
                            },
                            title: (items) => `📅 ${items[0].label}`
                        }
                    },
                    // Plugin personalizado para líneas de umbral
                    annotation: null
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMax: 80,
                        title: {
                            display: true,
                            text: 'PM2.5 (µg/m³)',
                            color: '#64748B',
                            font: { size: 12, weight: '600', family: 'Outfit' }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.06)',
                            lineWidth: 1
                        },
                        ticks: {
                            color: '#4A5568',
                            font: { size: 11, family: 'Outfit' },
                            padding: 8,
                            callback: (val) => `${val} µg/m³`
                        },
                        border: { display: false }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#4A5568',
                            font: { size: 10, family: 'Outfit' },
                            maxRotation: 30,
                            autoSkip: true,
                            maxTicksLimit: 12,
                            padding: 8
                        },
                        border: { color: '#E2E8F0' }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                animation: {
                    duration: 900,
                    easing: 'easeOutQuart'
                },
                layout: {
                    padding: { top: 10, right: 20, bottom: 5, left: 10 }
                }
            },
            // Plugin inline para dibujar líneas de umbral en el canvas
            plugins: [{
                id: 'thresholdLines',
                afterDatasetsDraw(chart) {
                    const { ctx, chartArea, scales } = chart;
                    if (!chartArea) return;

                    const thresholds = [
                        { value: umbralBueno,    color: '#22C55E', label: 'Bueno' },
                        { value: umbralModerado, color: '#F59E0B', label: 'Moderado' },
                        { value: umbralDañino,   color: '#EF4444', label: 'Dañino' }
                    ];

                    thresholds.forEach(t => {
                        const y = scales.y.getPixelForValue(t.value);
                        if (y < chartArea.top || y > chartArea.bottom) return;

                        ctx.save();
                        ctx.setLineDash([6, 4]);
                        ctx.strokeStyle = t.color;
                        ctx.lineWidth = 1.5;
                        ctx.globalAlpha = 0.7;
                        ctx.beginPath();
                        ctx.moveTo(chartArea.left, y);
                        ctx.lineTo(chartArea.right, y);
                        ctx.stroke();

                        // Etiqueta del umbral
                        ctx.globalAlpha = 1;
                        ctx.fillStyle = t.color;
                        ctx.font = 'bold 10px Outfit, sans-serif';
                        ctx.textAlign = 'right';
                        ctx.fillText(`${t.label} (${t.value})`, chartArea.right - 4, y - 4);
                        ctx.restore();
                    });
                }
            }]
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
                // Estado vacío con mensaje claro
                this.chart.data.labels = ['Sin datos disponibles'];
                this.chart.data.datasets = [{
                    label: 'PM2.5 General',
                    data: [0],
                    backgroundColor: 'rgba(245, 158, 11, 0.3)',
                    borderColor: '#F59E0B',
                    borderWidth: 2,
                    borderRadius: 6
                }];
                this.chart.update();
                this._showEmptyState(true);
                return;
            }

            this._showEmptyState(false);

            // Agrupar por estación
            const stationData = {};
            const allTimestamps = [];

            history.forEach(h => {
                const station = h.station || 'General';
                if (!stationData[station]) stationData[station] = [];
                stationData[station].push({ timestamp: h.timestamp, value: parseFloat(h.value) });
                if (!allTimestamps.includes(h.timestamp)) {
                    allTimestamps.push(h.timestamp);
                }
            });

            this.chart.data.labels = allTimestamps;

            // Un dataset por estación (barras)
            const datasets = [];
            Object.keys(stationData).forEach(stationName => {
                const color = this._getColorForStation(stationName);
                const records = stationData[stationName];

                const dataPoints = allTimestamps.map(ts => {
                    const match = records.find(r => r.timestamp === ts);
                    return match ? match.value : null;
                });

                datasets.push({
                    label: this._shortName(stationName),
                    data: dataPoints,
                    borderColor: color.border,
                    backgroundColor: color.bg.replace('0.75', '0.12'),
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    pointBackgroundColor: '#FFFFFF',
                    pointBorderColor: color.border,
                    pointBorderWidth: 2,
                    spanGaps: true
                });
            });

            this.chart.data.datasets = datasets;
            this.chart.update('active');

        } catch { /* Error silencioso en producción */ }
    }

    _showEmptyState(show) {
        const container = this.ctx?.closest('.chart-container');
        if (!container) return;

        let msg = container.querySelector('.chart-empty-msg');
        if (show) {
            if (!msg) {
                msg = document.createElement('div');
                msg.className = 'chart-empty-msg';
                msg.style.cssText = `
                    position: absolute; inset: 0;
                    display: flex; flex-direction: column;
                    align-items: center; justify-content: center;
                    color: #94A3B8; font-family: Outfit, sans-serif;
                    pointer-events: none;
                `;
                msg.innerHTML = `
                    <i class="fas fa-chart-bar" style="font-size:2.5rem;margin-bottom:0.5rem;opacity:0.3;"></i>
                    <p style="font-size:0.9rem;margin:0;font-weight:600;">Sin datos históricos aún</p>
                    <p style="font-size:0.78rem;margin:0;opacity:0.7;">Los datos aparecerán a medida que las estaciones reporten</p>
                `;
                container.style.position = 'relative';
                container.appendChild(msg);
            }
        } else if (msg) {
            msg.remove();
        }
    }
}

export const cumulativePanel = new CumulativePanel();
export default cumulativePanel;
