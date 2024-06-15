const fs = require('fs').promises;
const https = require('https');
const { logInfo, askUserForRetry, getCurrentLocation } = require('./utils.js');
const color = require('colors');
const { firefox } = require('playwright');
const axios = require('axios');
const {
 getVenuesByLocation,
 getEventsByVenueWithPagination,
 saveFileData,
} = require('./core/venues.js');

async function runScrape(
 locationIndex = 0,
 limitCountVenues = -1,
 showTop100 = true,
 searchInfoViewed = true,
 currentProxy = -1
) {
 // Get config
 const settings = await fs.readFile('config/config.json', 'utf-8');
 jsonConfig = JSON.parse(settings);

 // Get location
 const jsonLocation = JSON.parse(
  await fs.readFile('config/location.json', 'utf-8')
 );
 const currentLocation = jsonLocation.locations[locationIndex];

 // Get proxy
 selectedProxy = null;
 axiosInstance = axios.create();
 configBrowser = {
  headless: true,
 };
 if (currentProxy != -1) {
  try {
   const proxyFile = JSON.parse(
    await fs.readFile('config/proxies.json', 'utf-8')
   );
   selectedProxy = proxyFile[currentProxy];
   axiosInstance = axios.create({
    proxy: selectedProxy,
   });
   configBrowser = {
    headless: true,
    proxy: {
     server: `${selectedProxy.protocol}://${selectedProxy.host}:${selectedProxy.port}`,
     username: selectedProxy.auth.username,
     password: selectedProxy.auth.password,
    },
   };
  } catch (pe) {
   console.log('proxy error.');
  }
 }
 await getCurrentLocation(axiosInstance);

 // prepare browser
 const browser = await firefox.launch(configBrowser);
 const page = await browser.newPage();

 const result = [];
 allEvents = [];
 venuesResult = {
  venues: '',
  totalEvents: 0,
 };

 /**
  * Handle uncaught exceptions to perform cleanup operations before exiting.
  *
  * @param {Error} err - The uncaught exception object.
  * @returns {Promise<void>} A promise that resolves after cleanup operations are completed.
  */
 process.on('uncaughtException', async (err) => {
  console.error('Error - uncaughtException:', err.message);
  await saveFileData(
   venuesResult,
   'result_venues_' + currentLocation.name + '.json'
  );
  await saveFileData(
   joinAllEvents(result, result.length),
   'all_events_' + currentLocation.name + '.json'
  );
  process.exit(1); // Salir con código de error 1 (o cualquier otro código de error que prefieras).
 });

 /**
  * Handle the suspension signal (SIGTSTP) to perform cleanup operations before the process is suspended.
  *
  * The SIGTSTP signal is emitted when the user suspends the process (usually by pressing Ctrl+Z).
  * This handler logs a message, performs cleanup operations, saves data, and exits the process with an error code.
  *
  * @async
  * @function handleSuspensionSignal
  * @returns {Promise<void>} A promise that resolves after cleanup operations are completed.
  */
 process.on('SIGTSTP', async () => {
  console.log('Process suspended by user.');
  await saveFileData(
   venuesResult,
   'result_venues_' + currentLocation.name + '.json'
  );

  await saveFileData(
   joinAllEvents(result, result.length),
   'all_events_' + currentLocation.name + '.json'
  );

  process.exit(1); // Exit with error code 1 or any other preferred error code
 });

 /**
  * Handle the SIGINT signal to gracefully shut down the process.
  *
  * @returns {Promise<void>} A promise that resolves after cleanup operations are completed.
  */
 process.on('SIGINT', async () => {
  console.log('Killing process!');
  await saveFileData(
   venuesResult,
   'result_venues_' + currentLocation.name + '.json'
  );
  await saveFileData(
   joinAllEvents(result, result.length),
   'all_events_' + currentLocation.name + '.json'
  );
  process.exit();
 });

 // Get list events by location
 logInfo(`${color.green('Getting list venues - ' + currentLocation.name)}`);
 const listVenues = await getVenuesByLocation(
  jsonConfig.events_by_location,
  currentLocation,
  0,
  axiosInstance
 );

 if (listVenues) {
  logInfo(`Total venues found: ${color.yellow(listVenues.length)}`);
  venuesResult.venues = listVenues;
  c = 0;
  for (const venue of listVenues) {
   try {
    logInfo(`searching events in ${color.yellow(venue.venueName)}`);
    tempR = await getEventsByVenueWithPagination(
     jsonConfig,
     venue,
     currentLocation.name,
     browser,
     searchInfoViewed,
     axiosInstance
    );
    if (tempR.length > 0) {
     result.push(...tempR);
     venuesResult.venues[c].events = tempR;
    }
    logInfo(
     `Total events found for ${color.green(venue.venueName)}: ${color.yellow(
      tempR.length
     )}`
    );

    console.log(' ------------------------ ');
    // Break when limit
    if (limitCountVenues != -1) {
     c = c + 1;
     if (c >= limitCountVenues) {
      break;
     }
    }
   } catch (_) {}
  }
  await browser.close();
  venuesResult.totalEvents = result.length;
  logInfo(`***Total events ${color.green(result.length)}`);
  // Save json file
  $isSaved = await saveFileData(
   joinAllEvents(result, result.length),
   'all_events_' + currentLocation.name + '.json'
  );

  // GET TOP 100 EVENTS ORDER BY numberViewed AND numberLastBuy - DESC
  try {
   // Read json file or use result
   if (result.length > 0) {
    allEvents = joinAllEvents(result);
    if (showTop100) {
     allEvents = allEvents.slice(0, 100);
     await saveFileData(
      joinAllEvents(result, result.length),
      'top100_events_' + currentLocation.name + '.json'
     );
    } else {
     await saveFileData(
      joinAllEvents(result, result.length),
      'all_events_' + currentLocation.name + '.json'
     );
    }
   } else {
    console.log('No events found');
   }
  } catch (fileError) {
   console.log('Error saving all events: ' + fileError.message);
  }
 }
}

function compareEvents(a, b) {
 // Function to determine sort weight based on lastBuy information
 const lastBuySortWeight = (event) => {
  if (typeof event.lastBuy === 'object') {
   return 0;
  }
  return 1; // lastBuy is 'ND' or absent, prioritize lower
 };

 const weightA = lastBuySortWeight(a);
 const weightB = lastBuySortWeight(b);

 return weightA - weightB;
}

function joinAllEvents(result, venueCount) {
 const groupedEvents = {};
 result.forEach((event) => {
  const artistName = event.name;
  if (!groupedEvents[artistName]) {
   groupedEvents[artistName] = [];
  }
  groupedEvents[artistName].push(event);
 });

 const consolidatedEvents = [];
 for (const artist in groupedEvents) {
  const artistEvents = groupedEvents[artist];
  const uniqueUrls = new Set();

  const uniqueEvents = artistEvents.filter((event) => {
   if (uniqueUrls.has(event.url)) {
    return false;
   }
   uniqueUrls.add(event.url);
   return true;
  });

  consolidatedEvents.push({
   artist,
   events: uniqueEvents.map((event) => ({
    eventName: event.name,
    url: event.url,
    formattedDateWithoutYear: event.formattedDateWithoutYear,
    lastBuy: event.lastBuy,
    minPrice: event.eventDetail?.minPrice,
    maxPrice: event.eventDetail?.maxPrice,
   })),
  });
 }

 const dataToSave = {
  totalEvents: venueCount,
  events: consolidatedEvents.sort((a, b) =>
   compareEvents(a.events[0], b.events[0])
  ),
 };

 return dataToSave;
}

module.exports = { runScrape };
