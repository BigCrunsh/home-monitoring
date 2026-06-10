// https://api.openweathermap.org/data/3.0/onecall?lat=52.5200592&lon=13.4906688&appid=e22e0baa954d29ee27ff40700f8d7e0d&units=metric&lang=de&exclude=minutely

const axios = require('axios'); // Stelle sicher, dass axios installiert ist
 
const apiUrl = "https://api.openweathermap.org/data/3.0/onecall";
const apiParams = {
    lat: 52.5200592, 
    lon: 13.4906688,
    appid: "e22e0baa954d29ee27ff40700f8d7e0d",
    units: "metric",
    lang: "de",
    exclude: "minutely"
};
 
const basePath = "javascript.0.Variablen.Wetter.Openweathermap.";
 
// Funktion, um Wetterdaten abzurufen
async function fetchWeatherData() {
    try {
        const response = await axios.get(apiUrl, { params: apiParams });
        const weatherData = response.data;
 
        // Erstelle Datenpunkte und schreibe die aktuellen Daten in ioBroker
        createAndSetState(`${basePath}current.temp`, weatherData.current.temp, "number", "°C");
        createAndSetState(`${basePath}current.humidity`, weatherData.current.humidity, "number", "%");
        createAndSetState(`${basePath}current.weather`, weatherData.current.weather[0].description, "string");
        createAndSetState(`${basePath}current.wind_speed`, weatherData.current.wind_speed, "number", "m/s");
        createAndSetState(`${basePath}current.wind_gust`, weatherData.current.wind_gust || 0, "number", "m/s");
        //******** Zusätzliche Daten
        createAndSetState(`${basePath}current.icon`, weatherData.current.weather[0].icon, "string");
        createAndSetState(`${basePath}current.clouds`, weatherData.current.clouds, "number", "%");
 
        // Prüfen, ob die Wetterbeschreibung "rain" enthält, und den booleschen Datenpunkt setzen
        const isRaining = weatherData.current.weather[0].description.toLowerCase().includes("rain");
        createAndSetState(`${basePath}current.raining`, isRaining, "boolean");
 
        // Tägliche Daten speichern (min, max und Niederschlag)
        weatherData.daily.forEach((day, index) => {
            createAndSetState(`${basePath}daily.${index}.temp.min`, day.temp.min, "number", "°C");
            createAndSetState(`${basePath}daily.${index}.temp.max`, day.temp.max, "number", "°C");
 
            // Setze Regen auf 0, wenn keine neuen Werte geliefert werden
            createAndSetState(`${basePath}daily.${index}.rain`, day.rain !== undefined ? day.rain : 0, "number", "mm");
 
            // Setze Schnee auf 0, wenn keine neuen Werte geliefert werden
            createAndSetState(`${basePath}daily.${index}.snow`, day.snow !== undefined ? day.snow : 0, "number", "mm");
 
            //******** Zusätzliche Daten
            createAndSetState(`${basePath}daily.${index}.icon`, day.weather[0].icon, "string");
            createAndSetState(`${basePath}daily.${index}.weather`, day.weather[0].description, "string");
            createAndSetState(`${basePath}daily.${index}.wind_speed`, day.wind_speed, "number", "m/s");
            createAndSetState(`${basePath}daily.${index}.wind_gust`, day.wind_gust || 0, "number", "m/s");
            createAndSetState(`${basePath}daily.${index}.clouds`, day.clouds || 0, "number", "%");
        });

        // Stuendliche Daten speichern (clouds)
        weatherData.hourly.forEach((hour, index) => {
            createAndSetState(`${basePath}hourly.${index}.clouds`, hour.clouds || 0, "number", "%");
        });
    } catch (error) {
        // Logge einen Fehler, wenn die API nicht erreichbar ist
        console.error("Fehler beim Abrufen der Wetterdaten: ", error.message);
    }
}
 
// Funktion, um Datenpunkte zu erstellen und zu setzen
function createAndSetState(id, value, type, unit = "") {
    if (!existsState(id)) {
        createState(id, value, {
            type: type,
            unit: unit,
            read: true,
            write: false
        });
    }
    setState(id, value, true);
}
 
// Scheduler: Alle 5 Minuten ausführen
schedule("*/5 * * * *", function () {
    fetchWeatherData();
});
