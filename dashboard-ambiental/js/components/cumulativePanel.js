/**
 * CumulativePanel.js
 * Manages the chart showing PM2.5 levels across all stations.
 */

class CumulativePanel {
    constructor() {
        this.chart = null;
        this.ctx = null;
    }

    init() {
        this.ctx = document.getElementById('cumulativeChart');
        if (!this.ctx) return;

        const config = {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Comportamiento General PM2.5 (µg/m³)',
                    data: [],
                    borderColor: '#FFC107',
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#FFC107'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(29, 42, 52, 0.9)',
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: (context) => ` PM2.5: ${context.parsed.y.toFixed(2)} µg/m³`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 11 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: 'rgba(255, 255, 255, 0.8)', font: { size: 11 } }
                    }
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
                this.chart.data.datasets[0].data = [0];
            } else {
                this.chart.data.labels = history.map(h => h.timestamp);
                this.chart.data.datasets[0].data = history.map(h => h.value);
                
                // Color dinámico basado en el último valor
                const lastVal = history[history.length - 1].value;
                const colors = this.getColorForValue(lastVal);
                this.chart.data.datasets[0].borderColor = colors.border;
                this.chart.data.datasets[0].backgroundColor = colors.bg;
                this.chart.data.datasets[0].pointBackgroundColor = colors.border;
            }
            
            this.chart.update();
        } catch (error) {
            console.error('Error fetching PM2.5 history:', error);
        }
    }

    getColorForValue(val) {
        if (val <= 25) return { bg: 'rgba(76, 175, 80, 0.2)', border: '#4CAF50' };
        if (val <= 50) return { bg: 'rgba(255, 193, 7, 0.2)', border: '#FFC107' };
        if (val <= 75) return { bg: 'rgba(255, 152, 0, 0.2)', border: '#FF9800' };
        return { bg: 'rgba(239, 68, 68, 0.2)', border: '#EF4444' };
    }
}

export const cumulativePanel = new CumulativePanel();
export default cumulativePanel;
