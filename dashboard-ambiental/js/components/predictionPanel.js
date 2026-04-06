/**
 * PredictionPanel.js
 * Manages Chart.js instance and predictive risk indicators.
 */

class PredictionPanel {
    constructor() {
        this.chartInstance = null;
        this.ctx = document.getElementById('predictionChart');
    }

    render(prediction) {
        if (!this.ctx) return;

        // Update Text Elements
        const mainRiskEl = document.getElementById('main-prediction-value');
        const trendMsgEl = document.getElementById('prediction-msg');
        
        if (mainRiskEl) {
            mainRiskEl.innerHTML = `<div class="prediction-value text-gradient-purple">${prediction.data[prediction.data.length - 1]}°C</div>`;
        }
        
        if (trendMsgEl) {
            trendMsgEl.innerHTML = `<span class="status-badge-ml"><i class="fas fa-microchip me-2"></i>${prediction.futureTrend}</span>`;
        }

        // (Re)initialize Chart
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        this.chartInstance = new Chart(this.ctx, {
            type: 'line',
            data: {
                labels: prediction.labels,
                datasets: [{
                    label: 'Pronóstico Temperatura (°C)',
                    data: prediction.data,
                    borderColor: '#f5576c',
                    backgroundColor: 'rgba(245, 87, 108, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#fff',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    }
}

export const predictionPanel = new PredictionPanel();
export default predictionPanel;
