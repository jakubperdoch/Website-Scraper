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

const userAgentList = [
 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
];

const getRandomUserAgent = () =>
 userAgentList[Math.floor(Math.random() * userAgentList.length)];

const defaultHeaders = {
 'User-Agent': getRandomUserAgent(),
 'Accept-Language': 'en-US,en;q=0.9',
 Accept:
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
 'Cache-Control': 'no-cache',
 Connection: 'keep-alive',
 'Accept-Encoding': 'gzip, deflate, br',
};

async function runScrape(
 locationIndex = 0,
 limitCountVenues = -1,
 showTop100 = true,
 searchInfoViewed = true,
 currentProxy = -1
) {
 try {
  const [settings, jsonLocation] = await Promise.all([
   fs.readFile('config/config.json', 'utf-8'),
   fs.readFile('config/location.json', 'utf-8'),
  ]);
  const jsonConfig = JSON.parse(settings);
  const locationConfig = JSON.parse(jsonLocation);
  const currentLocation = locationConfig.locations[locationIndex];

  let selectedProxy = null;
  let axiosInstance = axios.create({ headers: defaultHeaders });
  let configBrowser = { headless: true };
  if (currentProxy !== -1) {
   try {
    const proxyFile = JSON.parse(
     await fs.readFile('config/proxies.json', 'utf-8')
    );
    selectedProxy = proxyFile[currentProxy];
    axiosInstance = axios.create({
     proxy: selectedProxy,
     headers: defaultHeaders,
    });
    configBrowser.proxy = {
     server: `${selectedProxy.protocol}://${selectedProxy.host}:${selectedProxy.port}`,
     username: selectedProxy.auth.username,
     password: selectedProxy.auth.password,
    };
   } catch (pe) {
    console.log('proxy error.');
   }
  }

  await getCurrentLocation(axiosInstance);

  const browser = await firefox.launch(configBrowser);
  const context = await browser.newContext({
   userAgent: getRandomUserAgent(),
   extraHTTPHeaders: defaultHeaders,
  });
  const page = await context.newPage();

  const result = [];
  const venuesResult = { venues: '', totalEvents: 0 };

  const handleCleanup = async () => {
   await saveFileData(
    venuesResult,
    `result_venues_${currentLocation.name}.json`
   );
   await saveFileData(
    joinAllEvents(result, result.length),
    `all_events_${currentLocation.name}.json`
   );
   process.exit(1);
  };

  process.on('uncaughtException', async (err) => {
   console.error('Error - uncaughtException:', err.message);
   await handleCleanup();
  });

  process.on('SIGTSTP', async () => {
   console.log('Process suspended by user.');
   await handleCleanup();
  });

  process.on('SIGINT', async () => {
   console.log('Killing process!');
   await handleCleanup();
  });

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

   const processedVenues = new Set();

   for (const [index, venue] of listVenues.entries()) {
    if (limitCountVenues !== -1 && index >= limitCountVenues) break;

    if (processedVenues.has(venue.venueName)) {
     logInfo(
      `Skipping already processed venue: ${color.yellow(venue.venueName)}`
     );
     continue;
    }
    processedVenues.add(venue.venueName);

    logInfo(`searching events in ${color.yellow(venue.venueName)}`);

    const tempR = await getEventsByVenueWithPagination(
     jsonConfig,
     venue,
     currentLocation.name,
     browser,
     searchInfoViewed,
     axiosInstance
    );

    if (tempR.length > 0) {
     result.push(...tempR);
     venue.events = tempR;
    }

    logInfo(
     `Total events found for ${color.green(venue.venueName)}: ${color.yellow(tempR.length)}`
    );
   }

   await browser.close();
   venuesResult.totalEvents = result.length;
   logInfo(`***Total events ${color.green(result.length)}`);

   if (result.length > 0) {
    const allEvents = showTop100
     ? joinAllEvents(result).slice(0, 100)
     : joinAllEvents(result);
    const fileName = showTop100
     ? `top100_events_${currentLocation.name}.json`
     : `all_events_${currentLocation.name}.json`;
    await saveFileData(allEvents, fileName);
   } else {
    console.log('No events found');
   }
  }
 } catch (fileError) {
  console.log('Error: ' + fileError.message);
 }
}

function compareEvents(a, b) {
 const lastBuySortWeight = (event) =>
  typeof event.lastBuy === 'object' ? 0 : 1;
 return lastBuySortWeight(a) - lastBuySortWeight(b);
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
   if (uniqueUrls.has(event.url)) return false;
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

 return {
  totalEvents: venueCount,
  events: consolidatedEvents.sort((a, b) =>
   compareEvents(a.events[0], b.events[0])
  ),
 };
}

module.exports = { runScrape };
