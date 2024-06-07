const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

let countryData = fs.readFileSync("./config/countries.json","utf-8");
countryData = JSON.parse(countryData);

const settings = fs.readFileSync("./config/config.json", 'utf-8');
jsonConfig = JSON.parse(settings);

function getCurrentTimestamp() {
    return new Date().toISOString();
}

function logInfo(message) {
    const out = `${getCurrentTimestamp()} [info]: ${message}`;
    console.log(out);
}

function logWarn(message) {
    const out = `${getCurrentTimestamp()} [warn]: ${message}`;
    console.log(out);
}

function logError(error) {
    let out = `${getCurrentTimestamp()} [error]: ${error.message}`;
    //
    if (error.stack) {
        out = `${getCurrentTimestamp()} [error]: ${error.stack}`;
    }
    //
    console.error(out);
}

function extractCountry(text) {
    let match = text.match(/flag-(\w+)/);
    if (match && match[1]) {
        let countryCode = match[1].toUpperCase();

        // Buscar el país en countryData
        let country = countryData.find(c => c.Code === countryCode);
        if (country) {
            text = text.replace(/<span class='nudge-t2 flag vmid flag-\w+'><\/span>/, country.Name);
        } else {
            text = text.replace(/<span class='nudge-t2 flag vmid flag-\w+'><\/span>/, countryCode);
        }
    }
    return text;
}

function extractLastBuyDetails(text) {
    const countryRegex = /from (\w+[\w\s]*) bought/;
    const ticketsRegex = /bought (\d+) ticket/;
    const timeRegex = /(\d+ \w+ ago)/;

    let countryMatch = text.match(countryRegex);
    let ticketsMatch = text.match(ticketsRegex);
    let timeMatch = text.match(timeRegex);

    let details = {
        country: countryMatch ? countryMatch[1] : null,
        ticketsBought: ticketsMatch ? parseInt(ticketsMatch[1], 10) : null,
        time: timeMatch ? timeMatch[1] : null
    };

    return details;
}

/**
 * Ask the user for retrying the operation.
 *
 * @returns {Promise} A promise that resolves to the user's response.
 */
async function askUserForRetry(msj = "Press 's' to try again or any other key to skip: ") {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            resolve('o'); 
        }, jsonConfig.bot.timeOut ? jsonConfig.bot.timeOut : 30000);

        rl.question(msj, (answer) => {
            clearTimeout(timer); 
            resolve(answer); 
        });
    });

}
function getCurrentDate(){
    formattedDate = "";
    const today = new Date();
    try{
         const day = today.getDate();
         const month = today.getMonth() + 1;
         const year = today.getFullYear();
         const hour = today.getHours();
         minutes = today.getMinutes();
         seconds = today.getSeconds();
         if(minutes < 10){
            minutes = `0${minutes}`;
         }
         if(seconds < 10){
            seconds = `0${seconds}`;
         }
 
         formattedDate = `${day}/${month}/${year} ${hour}:${minutes}:${seconds}`;
    }catch(_){ }
    return formattedDate;
}

async function getCurrentLocation(axiosInstance){
    result = "";
    try {
        await axiosInstance.post(('https://hidemy.io/api/geoip.php?out=js'))
            .then(response => {
                result = response.data;
                console.log("Conn info: ");
                console.log(result);
            })
            .catch(_ => {});
    } catch (_) { }
    return result;
}

module.exports = { getCurrentTimestamp, logInfo, logWarn, logError, extractCountry, extractLastBuyDetails, askUserForRetry, getCurrentDate, getCurrentLocation };