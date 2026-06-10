// set some constants'{"time":{"start":"00:00","end":"23:59","mode":"minutes","interval":5},"period":{"days":1}}'
const weekdays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

createState('ical_events', 0, {
   type: 'string'
});

function formatCalEvents() {
    const events = [[], [], [], [], [], [], []];
    // parse events
    var state = getState('ical.0.data.table').val
    for (let i = 0; i < state.length; i++) {
        const date = new Date(state[i]['_date'])
        var wd = date.getDay()

        var eventStr =  state[i]['event']
        if (state[i]['_allDay'] == false) {
            eventStr = `${date.toLocaleTimeString("de-DE", {timeZone: "CET", hour: "2-digit", minute: "2-digit"})} ${state[i]['event']}`
        }
        events[wd] = events[wd].concat([eventStr])
    }
    
    // format html
    function formatWeekday(weekday) {
        return ''.concat(
                '<td class="weekday '+ weekday.toLowerCase() + '">',
                weekday,
                '</td>',
            )
    }
    function formatEventDetails(details, weekday) {
        details = details.replaceAll('[Geburtstag]', '&#127873').replaceAll('[Hochzeitstag]', '&#x1F48D;').replaceAll('[Müllabfuhr]', '&#x1F477;').replaceAll('Abholung', '&#x1F477;').replaceAll('[Carlotta]', '&#129653;').replaceAll('[Clara]', '&#128156;').replaceAll('[Clea]', '&#129505;')
        return ''.concat(
                '<td class="details '+ weekday.toLowerCase() + '">',
                details,
                '</td>'
        );
    }

    var offset = new Date().getDay() 
    var html = '<table>'
    for (let pos = 0; pos < 7; pos++) {
        var wd = (pos + offset) % 7 // weekday - current date first
        
        html += '<tr>'
        var details = ''
        var unique_events = [...new Set(events[wd])];
        for (let e_num = 0; e_num < unique_events.length; e_num++) {
            details += unique_events[e_num];
            if (e_num < unique_events.length-1) {
                details += '</br>'
            }
        }
        html += ''.concat(
            formatWeekday(weekdays[wd]),
            formatEventDetails(details, weekdays[wd])
        );
        html += '</tr>'
    }    
    html += '</table>'

    setState('ical_events', html);
}

formatCalEvents(); // Skriptstart


schedule("*/5 * * * *", formatCalEvents);  // alle 5 Minuten
