const axios = require('axios');
const fs = require('fs').promises;
const { saveFileData, getDetailsEvent, showInfoEventDetails } = require('../core/viagogo.js');
const {logInfo, logWarn, logError} = require('../utils.js');
const color = require('colors');

async function getEventDetails(jsonConfig){
    const localEvents = JSON.parse(await fs.readFile("./output/top_events.json", 'utf-8'));
    if(localEvents){
        logInfo("This process will check " + color.yellow(localEvents.events.length) + " events");
        console.log("");
        for (i = 0; i < localEvents.events.length; i++) {
            logInfo("Event: " + color.green(localEvents.events[i].name));
            const item = localEvents.events[i];
            const eventDetails = await getDetailsEvent(item.url, jsonConfig.event_details, 0);
            if (eventDetails && eventDetails.items) {
                showInfoEventDetails(eventDetails);
                try {
                    delete eventDetails.items;
                    localEvents.events[i].eventDetail = eventDetails;
                } catch (e) { }
            }   
        }
        return localEvents;
    }else{
        console.log("file top_events.json not exist");
    }
    
}

async function start(){
    const settings = await fs.readFile("./config/config.json", 'utf-8');
    jsonConfig = JSON.parse(settings);

    const events = await getEventDetails(jsonConfig);
    saveFileData(events, "top_events_details.json");
}

(async () => {
    logInfo(`${color.bgCyan(color.white(" viagogo scraper - v.1.0.0 "))}`);
    logInfo(`${color.green("= EVENT DETAILS GENERATOR =")}`);
    logInfo("Started");
    await start();
    logInfo("Finished");
})();