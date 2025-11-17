![Example Dashboard](static/grafana.png)

# Home Monitoring

A centralized monitoring system for smart home devices and services. This project provides a unified interface to collect, store, and visualize metrics from various smart home systems using InfluxDB and Grafana.

## Supported Systems

- [Netatmo](https://www.netatmo.com/en-eu) - Smart home weather station
- [SolarEdge](https://www.solaredge.com/) - Solar inverter and PV monitoring
- [Gardena](https://www.gardena.com/de/produkte/smart/) - Smart gardening system
- [Tankerkoenig](https://creativecommons.tankerkoenig.de/) - Gas station price monitoring
- [Tibber](https://tibber.com/) - Smart energy monitoring
- Techem Compat V - Energy meter monitoring via nanoCUL USB Stick

## Installation

### Prerequisites

- Python 3.12.3 or higher
- Docker and Docker Compose
- Git

### Setup Development Environment

1. Clone the repository:
```bash
git clone https://github.com/bigcrunsh/home-monitoring.git
cd home-monitoring
```

2. Create and activate a virtual environment:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -e ".[dev]"
```

4. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

### Infrastructure Setup

Use Docker Compose to set up the monitoring infrastructure:

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

Services:
- InfluxDB: Time-series database (port 8086)
- Grafana: Visualization dashboard (port 3000)

#### Grafana Configuration

1. Access Grafana at http://localhost:3000
2. Default login: admin/admin
3. Add InfluxDB as a data source:
   - URL: http://influxdb:8086
   - Database: home_monitoring
   - (Optional) Add credentials if configured

#### SSL Setup

For HTTPS support:

1. Generate SSL certificates:
```bash
openssl req -x509 -newkey rsa:4096 -keyout grafana.key -out grafana.crt -days 365 -nodes
```

2. Update docker-compose.yml with SSL configuration:
```yaml
services:
  grafana:
    environment:
      - GF_SERVER_PROTOCOL=https
      - GF_SERVER_CERT_FILE=/etc/grafana/grafana.crt
      - GF_SERVER_CERT_KEY=/etc/grafana/grafana.key
    volumes:
      - ./grafana.crt:/etc/grafana/grafana.crt
      - ./grafana.key:/etc/grafana/grafana.key
```

## Data Collection

### Configuration

All services are configured via environment variables. See `.env.example` for required variables.

### Running Data Collectors

Data collectors and utilities are located in the `scripts/` directory and can be run manually or scheduled:

```bash
# Data Collection
scripts/collect_netatmo_data.py -v
scripts/collect_solaredge_data.py -v
scripts/collect_gardena_data.py -v
scripts/collect_tankerkoenig_data.py --cache-dir /path/to/cache -v
scripts/collect_tibber_data.py -v
scripts/collect_techem_data.py -v

# DNS Updates
scripts/update_dns.py -v
```

Common options supported by all scripts:
- `-v, --verbose`: Enable verbose logging

Additional options for specific collectors:
- `collect_tankerkoenig_data.py`: 
  - `--cache-dir`: Directory to cache station details
  - `--force-update`: Force update of station details from API

### Scheduling Collections

Create a crontab entry (`crontab -e`):

```bash
# Load environment variables
set -a; source /path/to/your/.env; set +a

# Create log directory
LOG_DIR=/var/log/home_monitoring
mkdir -p $LOG_DIR

# Set script directory
SCRIPT_DIR=/path/to/home-monitoring/scripts

# Collect data every 5 minutes
*/5 * * * * $SCRIPT_DIR/collect_netatmo_data.py -v >> $LOG_DIR/netatmo.log 2>&1
*/5 * * * * $SCRIPT_DIR/collect_solaredge_data.py -v >> $LOG_DIR/solaredge.log 2>&1
*/5 * * * * $SCRIPT_DIR/collect_tankerkoenig_data.py --cache-dir /path/to/cache -v >> $LOG_DIR/tankerkoenig.log 2>&1
*/30 * * * * $SCRIPT_DIR/collect_gardena_data.py -v >> $LOG_DIR/gardena.log 2>&1
*/15 * * * * $SCRIPT_DIR/collect_tibber_data.py -v >> $LOG_DIR/tibber.log 2>&1
0 1 * * * $SCRIPT_DIR/collect_techem_data.py -v >> $LOG_DIR/techem.log 2>&1

# Update DNS every hour
0 * * * * $SCRIPT_DIR/update_dns.py -v >> $LOG_DIR/update_dns.log 2>&1
```

Make sure the scripts are executable:
```bash
chmod +x scripts/collect_*.py
```
## Development

### Project Structure

```
src/
├── home_monitoring/
│   ├── api/          # API endpoints
│   ├── core/         # Core business logic
│   ├── models/       # Data models
│   ├── services/     # Service integrations
│   └── utils/        # Utility functions
tests/
├── unit/            # Unit tests
└── integration/     # Integration tests
```

### Running Tests

```bash
# Run all tests
python -m pytest

# Run with coverage
python -m pytest --cov=home_monitoring

# Run specific test file
python -m pytest tests/unit/test_service.py
```

### Code Quality

```bash
# Format code
black src/ tests/

# Lint code
ruff check src/ tests/

# Type checking
mypy src/
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License - see LICENSE file

## References

- [InfluxDB Documentation](https://docs.influxdata.com/influxdb/v1.8/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Python asyncio](https://docs.python.org/3/library/asyncio.html)
