const axios = require('axios');
const fs = require('fs').promises;
const {
 getAllEventsWithPagination,
 getLastBuy,
 extractViewedText,
 saveFileData,
 getInfoViewed,
 getEventsByLocationWithPagination,
 getNumberByString,
} = require('../core/viagogo.js');
const { logInfo, logWarn, logError } = require('../utils.js');
const color = require('colors');

async function getNextFileName(baseName, extension) {
 let counter = 1;
 let fileName = `${baseName}_1${extension}`;
 while (await fileExists('./output/london/' + fileName)) {
  counter++;
  fileName = `${baseName}_${counter}${extension}`;
 }
 return fileName;
}

async function fileExists(path) {
 try {
  await fs.access(path);
  return true;
 } catch {
  return false;
 }
}

async function start() {
 const settings = await fs.readFile('./config/config.json', 'utf-8');
 jsonConfig = JSON.parse(settings);

 const jsonLocation = JSON.parse(
  await fs.readFile('./config/location.json', 'utf-8')
 );
 const currentLocation =
  jsonLocation.locations[jsonConfig.top_events.location_index];

 let eventsResult = await getTopEvents(
  jsonConfig.bot.limitTopTo,
  jsonConfig.top_events,
  currentLocation,
  jsonConfig.bot.topNumber,
  true
 );

 let eventsResultFiltered = eventsResult.events.filter(
  (e) => e.numberViewed > 0
 );

 const fileName = await getNextFileName('most_viewed', '.json');
 await saveFileData(eventsResult.events, 'london/all.json');
 await saveFileData(eventsResultFiltered, 'london/' + fileName);
}

async function getTopEvents(
 limitTopTo,
 customParams,
 currentLocation,
 limit = 50
) {
 logInfo(
  `Loading events for: ${color.green(
   currentLocation.name
  )} - TOP ${color.yellow(limit)}`
 );
 const topEvents = await getEventsByLocationWithPagination(
  customParams,
  currentLocation
 );
 logInfo(
  `Total events found for ${color.green(currentLocation.name)}: ${color.yellow(
   topEvents.events.length
  )}`
 );
 logInfo('Checking most viewed events');
 //
 let maxNbr = topEvents.events.length;
 if (limitTopTo !== false) {
  maxNbr = parseInt(limitTopTo);
 }
 //
 for (i = 0; i < maxNbr; i++) {
  topEvents.events[i].extraInfo = await getExtraInfo(
   topEvents.events[i],
   jsonConfig
  );
  topEvents.events[i].lastBuy = await getLastBuy(topEvents.events[i].url);
  let viewed = await getInfoViewed(topEvents.events[i].url);
  if (viewed) {
   topEvents.events[i].viewed = viewed.trim();
   topEvents.events[i].numberViewed = getNumberByString(viewed.trim());
  } else {
   topEvents.events[i].viewed = 'ND';
   topEvents.events[i].numberViewed = 0;
  }
  //
  logInfo(
   `Event ${i + 1} of ${maxNbr}: ${color.green(
    topEvents.events[i].name
   )} - Venue: ${color.blue(
    topEvents.events[i].venueName
   )} - People viewing: ${color.yellow(topEvents.events[i].numberViewed)}`
  );
 }
 return topEvents;
}

async function getExtraInfo(event, jsonConfig) {
 let result = null;
 try {
  const allEvents = await getAllEventsWithPagination(
   event,
   jsonConfig.all_events
  );
  if (allEvents) {
   for (let c = 0; i < allEvents.Items.length; c++) {
    if (allEvents.Items[c].EventId == event.eventId) {
     result = allEvents.Items[c];
     break;
    }
   }
  }
 } catch (_) {}
 return result;
}

(async () => {
 logInfo(`${color.bgCyan(color.white(' viagogo scraper - v.1.0.0 '))}`);
 logInfo(`${color.green('= ALL LONDON EVENTS =')}`);
 const singleEventUrl =
  '/Concert-Tickets/Dance-and-Electronic-Music/J-Hus-Tickets/E-151992563?qty=2';

 logInfo('Checking LastBuy please wait...');
 const lastBuy = await getLastBuy(singleEventUrl);
 if (lastBuy) {
  console.log('LastBuy', lastBuy);
 } else {
  console.log('Not LastBuy detected');
 }

 logInfo('Checking Views please wait...');
 const views = await extractViewedText(singleEventUrl);
 if (views) {
  const viewsNbr = getNumberByString(views.trim());
  console.log('Views', viewsNbr);
 } else {
  console.log('No views detected');
 }
 logInfo('Started');
 await start();
 logInfo('Finished');
})();
