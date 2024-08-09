const axios = require('axios');
const fs = require('fs');
const color = require('colors');
const {
 logInfo,
 logError,
 askUserForRetry,
 getCurrentDate,
} = require('../utils.js');
const { getLastBuy, getNumberByString } = require('../core/viagogo.js');

const MAX_RETRIES = 5;

async function getVenuesByLocation(customParams, currentLocation) {
 customParams.lat = btoa(currentLocation.lat);
 customParams.lon = btoa(currentLocation.long);

 try {
  const response = await axios.get('https://www.viagogo.com/explore', {
   params: customParams,
   headers: {
    'User-Agent':
     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
   },
  });
  return response.data.events || null;
 } catch (error) {
  console.log('Error fetching venues:', error);
  return null;
 }
}

async function getEventsByVenue(
 customParams,
 venue,
 locationName,
 axiosInstance
) {
 console.log('Getting events - page: ' + customParams.pageIndex);
 customParams.venueId = venue.venueId;

 const currentUrl = await generateUrlVenue(locationName, venue, axiosInstance);
 if (!currentUrl) return [];

 const url = `${currentUrl}?pageIndex=${customParams.pageIndex}&method=GetFilteredEvents&venueId=${venue.venueId}&to=9999-12-31T23:59:59.999Z&nearbyGridRadius=50`;

 try {
  const response = await axiosInstance.post(url);
  return response.data;
 } catch (error) {
  return [];
 }
}

async function getEventsByVenueWithPagination(
 jsonConfig,
 venue,
 locationName,
 browser,
 searchInfoViewed,
 axiosInstance
) {
 const customParams = {
  ...jsonConfig.venue_items,
  venueId: venue.venueId,
  pageIndex: 0,
 };
 const customResult = [];

 while (true) {
  const tempEvents = await getEventsByVenue(
   customParams,
   venue,
   locationName,
   axiosInstance
  );
  if (tempEvents && tempEvents.items && tempEvents.items.length > 0) {
   logInfo(
    `Events found on page ${customParams.pageIndex}: ${color.yellow(tempEvents.items.length)}`
   );
   const events = await getEventInfo(
    tempEvents.items,
    browser,
    jsonConfig,
    axiosInstance
   );
   customResult.push(...events);
   customParams.pageIndex++;
  } else {
   console.log('No more events found, moving to next venue.');
   break;
  }
 }
 console.log('Total events found for venue:', customResult.length);
 return customResult;
}

async function getEventInfo(listEvents, browser, jsonConfig, axiosInstance) {
 try {
  return await Promise.all(
   listEvents.map(async (event) => {
    console.log('Processing event:', event.name);
    const lastBuy = await getLastBuy(event.url, axiosInstance);
    const eventUrl =
     (await generateEventUrl(event.url, axiosInstance)) + '?qty=1';

    const viewed = searchInfoViewed
     ? await listenInfoViewed(browser, eventUrl)
     : 'ND';

    const popups = await getPopupsEvent(event, jsonConfig.event_popups);
    const eventDetail = await getDetailsEvent(
     event,
     jsonConfig.event_details,
     axiosInstance
    );

    return {
     ...event,
     lastBuy: lastBuy || 'ND',
     numberRTimeLastBuy: 0,
     timeSpread: getCurrentDate(),
     viewed: viewed || 'ND',
     numberViewed: getNumberByString(viewed || 'ND'),
     popups,
     eventDetail,
     url: eventUrl,
    };
   })
  );
 } catch (error) {
  console.log('Error fetching event info:', error);
  return [];
 }
}

async function generateUrlVenue(locationName, venue, axiosInstance) {
 try {
  const response = await axiosInstance.get(
   `https://www.viagogo.com/_V-${venue.venueId}`
  );
  return response.request.res.responseUrl;
 } catch (error) {
  const venueName = venue.venueName.replace(/ - |---|[\s,()"]/g, '-');
  return `https://www.viagogo.com/${locationName}/${venueName}-Tickets/_V-${venue.venueId}`;
 }
}

async function generateEventUrl(eventUrl, axiosInstance) {
 try {
  const response = await axiosInstance.get(eventUrl);
  return response.request.res.responseUrl;
 } catch (error) {
  return eventUrl; // Fallback to constructed URL
 }
}

async function getDetailsEvent(event, customParams, axiosInstance) {
 console.log('Getting details for event:', event.name);
 if (!event.url) return null;

 try {
  const response = await axiosInstance.post(event.url, customParams, {
   headers: {
    'User-Agent':
     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
   },
  });
  const result = response.data;
  delete result.items;
  return result;
 } catch (error) {
  console.log('Error fetching event details:', error);
  return null;
 }
}

async function getPopupsEvent(event, customParams) {
 console.log(`Getting popups for event [${event.name}]...`);
 if (!event.url) {
  console.log('Invalid event URL.');
  return null;
 }

 try {
  const response = await axios.post(event.url, customParams, {
   headers: {
    'User-Agent':
     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
   },
  });
  const resultData = response.data;
  delete resultData.items;
  return {
   TicketsLeftMessage: resultData.TicketsLeftMessage,
   LikelyToSellOutMessage: resultData.LikelyToSellOutMessage,
   BestValueExplanationMessage: resultData.BestValueExplanationMessage,
   LimitedQuantityRemainingMessage: resultData.LimitedQuantityRemainingMessage,
   NumberOfGridResultsMessage: resultData.NumberOfGridResultsMessage,
  };
 } catch (error) {
  console.log('Error fetching popups event:', error);
  return null;
 }
}

async function saveFileData(jsonData, fileName = 'result_venues.json') {
 const jsonString = JSON.stringify(jsonData, null, 2);
 const directory = './output/';

 if (!fs.existsSync(directory)) {
  fs.mkdirSync(directory, { recursive: true });
 }
 const filePath = `${directory}${fileName}`;

 try {
  await fs.promises.writeFile(filePath, jsonString, 'utf8');
  logInfo('File saved successfully: ' + color.green(filePath));
 } catch (err) {
  logError('Error saving file:', err);
 }
}

async function listenInfoViewed(browser, url) {
 const page = await browser.newPage();
 try {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  const progressBarExists = await page.evaluate(
   () => !!document.getElementById('progressbar')
  );

  if (progressBarExists) {
   await page.waitForFunction(
    () => {
     const progressBar = document.getElementById('progressbar');
     return progressBar && progressBar.style.width === '100%';
    },
    { timeout: 10000 }
   );
  }
  return await extractViewedText(page);
 } catch (error) {
  console.log('Error in listenInfoViewed:', error);
  return null;
 } finally {
  await page.close();
 }
}

async function extractViewedText(page) {
 console.log('Retrieving information...');
 try {
  const htmlContent = await page.content();
  const match = htmlContent.match(/(\d+\speople\sviewed\sthis\sevent)/);
  return match ? match[1] : '0';
 } catch (error) {
  console.log('Error extracting viewed text:', error);
  return '0';
 }
}

module.exports = {
 getVenuesByLocation,
 getEventsByVenueWithPagination,
 saveFileData,
 getDetailsEvent,
 getPopupsEvent,
};
