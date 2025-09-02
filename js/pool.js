import { getDatabase, ref, onValue, push, query, orderByChild, limitToLast, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

class PoolAnalysisManager {
    constructor() {
        this.auth = getAuth();
        this.db = getDatabase();
        this.poolDataRef = ref(this.db, 'poolData');
        this.chart = null;
        this.currentTimeRange = '24h';
        this.deviceIp = localStorage.getItem('poolLabIp') || '';
        this.apiKey = '634715076a8ddc3f6f691255c70b3317a933f299df73594783536463cf539b84a4231aaec7385294';

        // Pool parameters and their optimal ranges
        this.parameters = {
            pH: { 
                icon: 'fas fa-flask',
                unit: '',
                optimalRange: [7.2, 7.6],
                warningRange: [6.8, 8.0],
                title: 'pH Level'
            },
            chlorine: {
                icon: 'fas fa-vial',
                unit: 'mg/L',
                optimalRange: [1, 3],
                warningRange: [0.5, 5],
                title: 'Free Chlorine'
            },
            temperature: {
                icon: 'fas fa-thermometer-half',
                unit: '°C',
                optimalRange: [26, 30],
                warningRange: [24, 32],
                title: 'Temperature'
            },
            alkalinity: {
                icon: 'fas fa-tint',
                unit: 'mg/L',
                optimalRange: [80, 120],
                warningRange: [60, 180],
                title: 'Total Alkalinity'
            },
            tds: {
                icon: 'fas fa-water',
                unit: 'ppm',
                optimalRange: [0, 1500],
                warningRange: [0, 2000],
                title: 'Total Dissolved Solids'
            }
        };

        this.initializeEventListeners();
        this.setupDeviceConnection();
        this.setupRealtimeUpdates();
    }

    initializeEventListeners() {
        // Refresh button
        document.getElementById('refreshData').addEventListener('click', () => {
            this.refreshData();
        });

        // Time range selector
        document.querySelectorAll('.time-range-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.time-range-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTimeRange = btn.dataset.range;
                this.updateChart();
            });
        });

        // Device IP setup
        document.getElementById('setupDevice').addEventListener('click', () => {
            this.showDeviceSetupModal();
        });
    }

    showDeviceSetupModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>PoolLab Device Setup</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="deviceIp">Device IP Address:</label>
                        <input type="text" id="deviceIp" value="${this.deviceIp}" placeholder="192.168.1.xxx">
                        <p class="form-help">Enter the IP address of your PoolLab device</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="cancelSetup">Cancel</button>
                    <button class="btn btn-primary" id="saveSetup">Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Show modal
        setTimeout(() => modal.classList.add('show'), 10);

        // Event listeners
        const closeBtn = modal.querySelector('.close-modal');
        const cancelBtn = modal.querySelector('#cancelSetup');
        const saveBtn = modal.querySelector('#saveSetup');
        
        const closeModal = () => {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        saveBtn.addEventListener('click', () => {
            const newIp = document.getElementById('deviceIp').value.trim();
            if (newIp) {
                this.deviceIp = newIp;
                localStorage.setItem('poolLabIp', newIp);
                this.setupDeviceConnection();
            }
            closeModal();
        });
    }

    async setupDeviceConnection() {
        if (!this.deviceIp) {
            console.log('No device IP configured');
            this.showDeviceSetupModal();
            return;
        }

        try {
            const response = await fetch(`http://${this.deviceIp}/status`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error('Device connection failed');
            }

            const status = await response.json();
            console.log('Connected to PoolLab device:', status);
            this.loadInitialData();

        } catch (error) {
            console.error('Error connecting to PoolLab device:', error);
            // Fall back to mock data for testing
            this.loadMockData();
        }
    }

    async loadInitialData() {
        try {
            const response = await fetch(`http://${this.deviceIp}/measurements/latest`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch initial data');
            }

            const data = await response.json();
            await push(this.poolDataRef, {
                ...data,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error loading initial data:', error);
            this.loadMockData();
        }
    }

    loadMockData() {
        // Generate mock data for testing
        const mockData = {
            pH: 7.4,
            chlorine: 2.0,
            temperature: 28,
            alkalinity: 100,
            tds: 1000
        };
        this.updateMetrics(mockData);
    }

    setupRealtimeUpdates() {
        // Listen for real-time updates from Firebase
        onValue(this.poolDataRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const latestEntry = Object.values(data).pop();
                this.updateMetrics(latestEntry);
                this.updateChart();
            }
        });
    }

    async refreshData() {
        const refreshBtn = document.getElementById('refreshData');
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';

        try {
            if (this.deviceIp) {
                const response = await fetch(`http://${this.deviceIp}/measurements/current`, {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch data from device');
                }

                const data = await response.json();
                await push(this.poolDataRef, {
                    ...data,
                    timestamp: new Date().toISOString()
                });
            } else {
                // Use mock data if no device is connected
                const newData = {
                    pH: 7.4 + (Math.random() * 0.4 - 0.2),
                    chlorine: 2.0 + (Math.random() * 1.0 - 0.5),
                    temperature: 28 + (Math.random() * 2 - 1),
                    alkalinity: 100 + (Math.random() * 20 - 10),
                    tds: 1000 + (Math.random() * 200 - 100),
                    timestamp: new Date().toISOString()
                };
                await push(this.poolDataRef, newData);
            }

        } catch (error) {
            console.error('Error refreshing data:', error);
            // Show error notification
            this.showNotification('Error refreshing data. Please check device connection.', 'error');
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Data';
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    updateMetrics(data) {
        const metricsContainer = document.getElementById('poolMetrics');
        metricsContainer.innerHTML = '';

        for (const [key, value] of Object.entries(data)) {
            if (key === 'timestamp') continue;

            const param = this.parameters[key];
            if (!param) continue;

            const status = this.getParameterStatus(value, param.optimalRange, param.warningRange);
            
            const metricCard = document.createElement('div');
            metricCard.className = 'metric-card';
            metricCard.innerHTML = `
                <div class="metric-header">
                    <div class="metric-icon">
                        <i class="${param.icon}"></i>
                    </div>
                    <h3 class="metric-title">${param.title}</h3>
                </div>
                <div class="metric-value">
                    ${value.toFixed(1)}
                    <span class="metric-unit">${param.unit}</span>
                </div>
                <div class="status-indicator status-${status.toLowerCase()}">
                    <i class="fas fa-${this.getStatusIcon(status)}"></i>
                    ${status}
                </div>
                <div class="last-updated">
                    <i class="far fa-clock"></i>
                    ${this.formatLastUpdated(data.timestamp)}
                </div>
            `;

            metricsContainer.appendChild(metricCard);
        }
    }

    getParameterStatus(value, optimalRange, warningRange) {
        if (value >= optimalRange[0] && value <= optimalRange[1]) {
            return 'Optimal';
        } else if (value >= warningRange[0] && value <= warningRange[1]) {
            return 'Warning';
        } else {
            return 'Critical';
        }
    }

    getStatusIcon(status) {
        switch (status) {
            case 'Optimal': return 'check-circle';
            case 'Warning': return 'exclamation-triangle';
            case 'Critical': return 'times-circle';
            default: return 'question-circle';
        }
    }

    formatLastUpdated(timestamp) {
        if (!timestamp) return 'Not available';
        const date = new Date(timestamp);
        return date.toLocaleString();
    }

    async updateChart() {
        // Convert time range to hours
        const hours = {
            '24h': 24,
            '7d': 168,
            '30d': 720
        }[this.currentTimeRange];

        // Calculate start time
        const startTime = new Date();
        startTime.setHours(startTime.getHours() - hours);

        // Query Firebase for historical data
        const historyRef = query(
            this.poolDataRef,
            orderByChild('timestamp'),
            limitToLast(100) // Adjust based on your needs
        );

        try {
            const snapshot = await get(historyRef);
            if (!snapshot.exists()) return;

            const data = [];
            snapshot.forEach(child => {
                const entry = child.val();
                if (new Date(entry.timestamp) >= startTime) {
                    data.push(entry);
                }
            });

            this.renderChart(data);

        } catch (error) {
            console.error('Error fetching historical data:', error);
        }
    }

    renderChart(data) {
        const ctx = document.getElementById('historyChart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (this.chart) {
            this.chart.destroy();
        }

        // Prepare datasets
        const datasets = Object.keys(this.parameters).map(param => ({
            label: this.parameters[param].title,
            data: data.map(entry => ({
                x: new Date(entry.timestamp),
                y: entry[param]
            })),
            borderColor: this.getParameterColor(param),
            tension: 0.4,
            fill: false
        }));

        this.chart = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: this.currentTimeRange === '24h' ? 'hour' : 'day',
                            tooltipFormat: 'PP p'
                        },
                        adapters: {
                            date: {
                                locale: 'en'
                            }
                        }
                    },
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                }
            }
        });
    }

    getParameterColor(param) {
        const colors = {
            pH: '#2196F3',
            chlorine: '#4CAF50',
            temperature: '#F44336',
            alkalinity: '#9C27B0',
            tds: '#FF9800'
        };
        return colors[param] || '#999';
    }
}

// Initialize the Pool Analysis Manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.poolAnalysisManager = new PoolAnalysisManager();
});