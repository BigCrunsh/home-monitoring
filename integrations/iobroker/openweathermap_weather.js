// Fetches OpenWeatherMap One Call data, stores states, and renders the hourly
// forecast strip (weather_hourly_forecast SVG state) for a vis HTML widget.
//
// The API key is read from the ioBroker state below (set on the Pi, NOT committed):
//   iobroker state set javascript.0.owm_apikey "<key>"
// The key was previously hardcoded and is in git history — rotate it at
// openweathermap.org.

const axios = require('axios');

const apiUrl = 'https://api.openweathermap.org/data/3.0/onecall';
const KEY_STATE = 'owm_apikey';
const FORECAST_STATE = 'weather_hourly_forecast';
const FORECAST_HOURS = 12;

const basePath = 'javascript.0.Variablen.Wetter.Openweathermap.';

createState(KEY_STATE, '', { type: 'string', read: true, write: true, desc: 'OpenWeatherMap API key (set on the Pi, not in git)' });
createState(FORECAST_STATE, '', { type: 'string', role: 'html', desc: 'Stundenvorhersage (SVG)' });

// OWM icon code -> emoji
function emoji(icon) {
    var c = (icon || '').slice(0, 2);
    var night = (icon || '').slice(2) === 'n';
    if (c === '01') return night ? '🌙' : '☀';
    if (c === '02') return night ? '☁' : '🌤';
    if (c === '03' || c === '04') return '☁';
    if (c === '09' || c === '10') return '🌧';
    if (c === '11') return '⛈';
    if (c === '13') return '❄';
    if (c === '50') return '🌫';
    return '·';
}

function berlinHour(dtSeconds) {
    return new Date(dtSeconds * 1000).toLocaleString('de-DE', {
        timeZone: 'Europe/Berlin', hour: '2-digit', hour12: false,
    }).replace(/\D/g, '').slice(0, 2);
}

function renderForecast(hours) {
    var W = 620, H = 170;
    var BG = 'var(--color-panel)', FG = '#e8e8e8', MUTE = '#9a9a9a';
    var TEMPC = '#F1BE3D', RAIN = '#5b9bd5';
    var p = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '">'];
    p.push('<rect width="' + W + '" height="' + H + '" rx="12" fill="' + BG + '"/>');
    p.push('<text x="16" y="26" fill="' + FG + '" font-size="16" font-weight="bold">Stundenvorhersage</text>');
    p.push('<text x="' + (W - 16) + '" y="26" fill="' + MUTE + '" font-size="11" text-anchor="end">nächste ' + hours.length + ' h · 🌡 Temp · ☁ Wolken · ▮ Regen</text>');
    if (!hours.length) {
        p.push('<text x="' + (W / 2) + '" y="95" fill="' + MUTE + '" font-size="14" text-anchor="middle">keine Vorhersage verfügbar</text></svg>');
        return p.join('');
    }
    var n = hours.length, cw = W / n;
    var temps = hours.map(function (h) { return h.temp; });
    var tmin = Math.min.apply(null, temps), tmax = Math.max.apply(null, temps);
    var top = 46, bot = 86;
    function ty(t) { return bot - (t - tmin) / Math.max(tmax - tmin, 1) * (bot - top); }
    var CLOUD = '#bfc8d0';
    var b0 = 152, b1 = 132;  // rain band (shorter, leaves room for the sun % line)
    hours.forEach(function (h, i) {
        var cx = i * cw + cw / 2;
        if (h.pop > 0) {
            var bh = (h.pop / 100) * (b0 - b1);
            p.push('<rect x="' + (cx - 9).toFixed(1) + '" y="' + (b0 - bh).toFixed(1)
                + '" width="18" height="' + bh.toFixed(1) + '" rx="2" fill="' + RAIN + '" opacity="0.85"/>');
        }
        p.push('<text x="' + cx.toFixed(1) + '" y="167" fill="' + MUTE + '" font-size="11" text-anchor="middle">' + h.hour + '</text>');
    });
    var pts = hours.map(function (h, i) { return (i * cw + cw / 2).toFixed(1) + ',' + ty(h.temp).toFixed(1); }).join(' ');
    p.push('<polyline points="' + pts + '" fill="none" stroke="' + TEMPC + '" stroke-width="2"/>');
    hours.forEach(function (h, i) {
        var cx = i * cw + cw / 2;
        p.push('<circle cx="' + cx.toFixed(1) + '" cy="' + ty(h.temp).toFixed(1) + '" r="2.5" fill="' + TEMPC + '"/>');
        p.push('<text x="' + cx.toFixed(1) + '" y="' + (ty(h.temp) - 7).toFixed(1) + '" fill="' + FG + '" font-size="11" text-anchor="middle">' + Math.round(h.temp) + '°</text>');
        p.push('<text x="' + cx.toFixed(1) + '" y="104" font-size="14" text-anchor="middle">' + h.emoji + '</text>');
        // cloudiness % (meaningful day and night; low = good PV by day)
        p.push('<text x="' + cx.toFixed(1) + '" y="121" fill="' + CLOUD + '" font-size="10" text-anchor="middle">☁' + h.clouds + '%</text>');
    });
    p.push('</svg>');
    return p.join('');
}

async function fetchWeatherData() {
    var keyState = getState(KEY_STATE);
    var apiKey = keyState && keyState.val ? keyState.val : '';
    if (!apiKey) {
        console.error('OWM API key not set — run: iobroker state set javascript.0.owm_apikey "<key>"');
        return;
    }
    try {
        const response = await axios.get(apiUrl, {
            params: {
                lat: 52.5200592, lon: 13.4906688, appid: apiKey,
                units: 'metric', lang: 'de', exclude: 'minutely',
            },
        });
        const weatherData = response.data;

        createAndSetState(`${basePath}current.temp`, weatherData.current.temp, 'number', '°C');
        createAndSetState(`${basePath}current.humidity`, weatherData.current.humidity, 'number', '%');
        createAndSetState(`${basePath}current.weather`, weatherData.current.weather[0].description, 'string');
        createAndSetState(`${basePath}current.wind_speed`, weatherData.current.wind_speed, 'number', 'm/s');
        createAndSetState(`${basePath}current.wind_gust`, weatherData.current.wind_gust || 0, 'number', 'm/s');
        createAndSetState(`${basePath}current.icon`, weatherData.current.weather[0].icon, 'string');
        createAndSetState(`${basePath}current.clouds`, weatherData.current.clouds, 'number', '%');
        const isRaining = weatherData.current.weather[0].description.toLowerCase().includes('rain');
        createAndSetState(`${basePath}current.raining`, isRaining, 'boolean');

        weatherData.daily.forEach((day, index) => {
            createAndSetState(`${basePath}daily.${index}.temp.min`, day.temp.min, 'number', '°C');
            createAndSetState(`${basePath}daily.${index}.temp.max`, day.temp.max, 'number', '°C');
            createAndSetState(`${basePath}daily.${index}.rain`, day.rain !== undefined ? day.rain : 0, 'number', 'mm');
            createAndSetState(`${basePath}daily.${index}.snow`, day.snow !== undefined ? day.snow : 0, 'number', 'mm');
            createAndSetState(`${basePath}daily.${index}.icon`, day.weather[0].icon, 'string');
            createAndSetState(`${basePath}daily.${index}.weather`, day.weather[0].description, 'string');
            createAndSetState(`${basePath}daily.${index}.wind_speed`, day.wind_speed, 'number', 'm/s');
            createAndSetState(`${basePath}daily.${index}.wind_gust`, day.wind_gust || 0, 'number', 'm/s');
            createAndSetState(`${basePath}daily.${index}.clouds`, day.clouds || 0, 'number', '%');
        });

        // Hourly: store the useful fields + build the forecast strip
        const hours = [];
        weatherData.hourly.forEach((hour, index) => {
            createAndSetState(`${basePath}hourly.${index}.clouds`, hour.clouds || 0, 'number', '%');
            if (index < FORECAST_HOURS) {
                createAndSetState(`${basePath}hourly.${index}.temp`, hour.temp, 'number', '°C');
                createAndSetState(`${basePath}hourly.${index}.pop`, Math.round((hour.pop || 0) * 100), 'number', '%');
                createAndSetState(`${basePath}hourly.${index}.icon`, hour.weather[0].icon, 'string');
                hours.push({
                    hour: berlinHour(hour.dt),
                    temp: hour.temp,
                    pop: Math.round((hour.pop || 0) * 100),
                    clouds: Math.round(hour.clouds || 0),
                    emoji: emoji(hour.weather[0].icon),
                });
            }
        });
        setState(FORECAST_STATE, renderForecast(hours), true);
    } catch (error) {
        console.error('Fehler beim Abrufen der Wetterdaten: ', error.message);
    }
}

function createAndSetState(id, value, type, unit = '') {
    if (!existsState(id)) {
        createState(id, value, { type: type, unit: unit, read: true, write: false });
    }
    setState(id, value, true);
}

schedule('*/5 * * * *', function () { fetchWeatherData(); });
setTimeout(fetchWeatherData, 2000);
