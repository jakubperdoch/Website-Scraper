const axios = require('axios');
const fs = require('fs').promises;
const {getAllEventsWithPagination, getLastBuy, saveFileData, getInfoViewed, getEventsByLocationWithPagination, getNumberByString } = require('../core/viagogo.js');
const {logInfo, logWarn, logError} = require('../utils.js');
const color = require('colors');

async function start(){
    const settings = await fs.readFile("./config/config.json", 'utf-8');
    jsonConfig = JSON.parse(settings);

    const jsonLocation = JSON.parse(await fs.readFile("./config/location.json", 'utf-8'));
    const currentLocation = jsonLocation.locations[jsonConfig.top_events.location_index];

    const eventsResult = await getTopEvents(jsonConfig.bot.limitTopTo, jsonConfig.top_events, currentLocation, jsonConfig.bot.topNumber, true);
    await saveFileData(eventsResult, "top_events.json");
}

async function getTopEvents(limitTopTo, customParams, currentLocation, limit = 50){
    logInfo(`Loading events for: ${color.green(currentLocation.name)} - TOP ${color.yellow(limit)}`);
    const topEvents = await getEventsByLocationWithPagination(customParams, currentLocation);
    logInfo(`Total events found for ${color.green(currentLocation.name)}: ${color.yellow(topEvents.events.length)}`);
    logInfo("Checking most viewed events");
    //
    let maxNbr = topEvents.events.length;
    if (limitTopTo !== false) {
        maxNbr = parseInt(limitTopTo);
    }
    //
    for(i=0;i<maxNbr;i++){
        topEvents.events[i].extraInfo = await getExtraInfo(topEvents.events[i], jsonConfig);
        topEvents.events[i].lastBuy = await getLastBuy(topEvents.events[i].url);
        let viewed = await getInfoViewed(topEvents.events[i].url);
        if(viewed){
            topEvents.events[i].viewed = viewed.trim();
            topEvents.events[i].numberViewed = getNumberByString(viewed.trim());
        }else{
            topEvents.events[i].viewed = "ND";
            topEvents.events[i].numberViewed = 0;
        }
        //
        logInfo(`Event: ${color.green(topEvents.events[i].name)} - Venue: ${color.blue(topEvents.events[i].venueName)} - People viewing: ${color.yellow(topEvents.events[i].numberViewed)}`);
    }
    // order events by number viewed
    try{
        topEvents.events.sort((a, b) => b.numberViewed - a.numberViewed);
        if(topEvents.events.length < limit){
            limit = topEvents.events.length;
        }
        topEvents.events = topEvents.events.slice(0,limit);
    }catch(_){}
    return topEvents;
}

async function getExtraInfo(event, jsonConfig){
    let result = null;
    try{
        const allEvents = await getAllEventsWithPagination(event, jsonConfig.all_events);
        if(allEvents){
            for(let c=0;i<allEvents.Items.length;c++){
                if(allEvents.Items[c].EventId == event.eventId){
                    result = allEvents.Items[c];
                    break;
                }
            }
        }
    }catch(_){}
    return result;
}

(async () => {
    logInfo(`${color.bgCyan(color.white(" viagogo scraper - v.1.0.0 "))}`);
    logInfo(`${color.green("= TOP EVENTS GENERATOR =")}`);
    logInfo("Started");
    await start();
    logInfo("Finished");
})();