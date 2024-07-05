const axios = require('axios');
const fs = require('fs');
const color = require('colors');
const {
 logInfo,
 logError,
 askUserForRetry,
 getCurrentDate,
} = require('../utils.js');
const { firefox } = require('playwright');
const { getLastBuy, getNumberByString } = require('../core/viagogo.js');

async function getVenuesByLocation(
 customParams,
 currentLocation,
 tryNumber = 0
) {
 customParams.lat = btoa(currentLocation.lat);
 customParams.lon = btoa(currentLocation.long);
 let result = null;
 let error = false;
 const customHeaders = {
  headers: {
   'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
  },
 };
 if (tryNumber < 5) {
  const response = await axios.get('https://www.viagogo.com/explore', {
   params: customParams,
   headers: customHeaders,
  });
  result = response.data;

  if (result.events) {
   result = result.events;
  }
  return result;
 } else {
  console.log('Attempt limit for getVenuesByLocation');
  return undefined;
 }
}

async function getEventsByVenue(
 customParams,
 venue,
 locationName,
 tryNumber = 0,
 axiosInstance
) {
 console.log('Getting events - page: ' + customParams.pageIndex);
 try {
  customParams.venueId = venue.venueId;
  let result = [];
  let error = false;
  let currentUrl = await generateUrlVenue(locationName, venue, axiosInstance);
  currentUrl =
   currentUrl +
   `?pageIndex=${customParams.pageIndex}&method=GetFilteredEvents&venueId=${venue.venueId}&to=9999-12-31T23:59:59.999Z&nearbyGridRadius=50`;
  if (tryNumber < 1 && currentUrl) {
   await axiosInstance
    .post(currentUrl)
    .then((response) => {
     result = response.data;
     return result;
    })
    .catch((_) => {
     error = true;
    });

   if (error) {
    return await getEventsByVenue(
     customParams,
     venue,
     locationName,
     tryNumber + 1,
     axiosInstance
    );
   } else {
    return result;
   }
  } else {
   console.log('Attempt limit for getEventsByVenue');
   return [];
  }
 } catch (e) {
  const answer = await askUserForRetry();
  if (answer.toLowerCase() === 's') {
   return await getEventsByVenue(
    customParams,
    venue,
    locationName,
    0,
    axiosInstance
   );
  } else {
   return [];
  }
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
 let customResult = [];
 try {
  while (true) {
   const tempEvents = await getEventsByVenue(
    customParams,
    venue,
    locationName,
    0,
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
 } catch (e) {
  const answer = await askUserForRetry();
  if (answer.toLowerCase() === 's') {
   return await getEventsByVenueWithPagination(
    jsonConfig,
    venue,
    locationName,
    browser,
    searchInfoViewed,
    axiosInstance
   );
  } else {
   return customResult;
  }
 }
 console.log('Total events found for venue:', customResult.length);
 return customResult;
}

async function getEventInfo(listEvents, browser, jsonConfig, axiosInstance) {
 let resultEvents = listEvents;
 try {
  for (let c = 0; c < resultEvents.length; c++) {
   console.log(' ');
   let lastBuy = await getLastBuy(resultEvents[c].url, axiosInstance);
   resultEvents[c].numberRTimeLastBuy = 0;
   resultEvents[c].timeSpread = getCurrentDate();
   if (lastBuy) {
    resultEvents[c].lastBuy = lastBuy;
   } else {
    resultEvents[c].lastBuy = 'ND';
    resultEvents[c].numberLastBuy = 0;
    resultEvents[c].numberTimeLastBuy = 0;
   }
   let eventUrl = await generateEventUrl(resultEvents[c].url, axiosInstance);
   eventUrl = eventUrl + '?qty=1';
   resultEvents[c].url = eventUrl;

   if (searchInfoViewed) {
    let viewed = await listenInfoViewed(browser, eventUrl);
    if (viewed) {
     resultEvents[c].viewed = viewed.trim();
     resultEvents[c].numberViewed = getNumberByString(viewed.trim());
    } else {
     resultEvents[c].viewed = 'ND';
     resultEvents[c].numberViewed = 0;
    }
   }
   resultEvents[c].popups = await getPopupsEvent(
    resultEvents[c],
    jsonConfig.event_popups,
    0,
    axiosInstance
   );
   if (resultEvents[c].popups.LikelyToSellOutMessage.Qualifier) {
    resultEvents[c].popups.LikelyToSellOutMessage.numberQualifier =
     getNumberByString(
      resultEvents[c].popups.LikelyToSellOutMessage.Qualifier.trim()
     );
   } else {
    resultEvents[c].popups.LikelyToSellOutMessage.numberQualifier = 0;
   }
   resultEvents[c].eventDetail = await getDetailsEvent(
    resultEvents[c],
    jsonConfig.event_details,
    0,
    axiosInstance
   );
  }
  console.log(' ');
  return resultEvents;
 } catch (e) {
  const answer = await askUserForRetry();
  if (answer.toLowerCase() === 's') {
   return await getEventInfo(listEvents, page, jsonConfig, axiosInstance);
  } else {
   return resultEvents;
  }
 }
}

async function generateUrlVenue(locationName, venue, axiosInstance) {
 let result = null;
 try {
  await axiosInstance
   .get('https://www.viagogo.com/_V-' + venue.venueId) // Establish maxRedirects to 0 to disable automatic redirects.
   .then((response) => {
    result = response.request.res.responseUrl;
   })
   .catch((error) => {
    let venueName = venue.venueName.replace(/ - /g, '-');
    venueName = venueName.replace(/\s/g, '-');
    venueName = venueName.replace(/---/g, '-');
    venueName = venueName.replace(/,/g, '');
    venueName = venueName.replace(/[()]/g, '');
    venueName = venueName.replace(/"/g, '');
    result =
     'https://www.viagogo.com/' +
     locationName +
     '/' +
     venueName +
     '-Tickets/_V-' +
     venue.venueId;
   });
 } catch (e) {
  console.log('Attempt limit for generateUrlVenue');
 }
 return result;
}

async function generateEventUrl(eventUrl, axiosInstance) {
 let result = 'https://www.viagogo.com' + eventUrl;
 try {
  await axiosInstance
   .get(result)
   .then((response) => {
    result = response.request.res.responseUrl;
   })
   .catch((error) => {
    result = 'https://www.viagogo.com' + eventUrl; // Fallback to constructed URL
   });
 } catch (e) {}
 return result;
}

async function getDetailsEvent(
 event,
 customParams,
 tryNumber = 0,
 axiosInstance
) {
 try {
  console.log('Getting details event[' + event.name + ']...');
  let result = null;
  let error = false;
  let urlEvent = event.url;
  if (tryNumber < 5) {
   if (urlEvent != null || urlEvent != undefined) {
    const customHeaders = {
     headers: {
      'User-Agent':
       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
     },
    };
    await axiosInstance
     .post(urlEvent, customParams, customHeaders)
     .then((response) => {
      result = response.data;
      if (result.items) {
       delete result.items;
      }
     })
     .catch((axioError) => {
      error = true;
     });
    if (error) {
     return await getDetailsEvent(
      event,
      customParams,
      tryNumber + 1,
      axiosInstance
     );
    }
   }
   console.log('done.');
   return result;
  } else {
   console.log('Attempt limit for get event details');
   return null;
  }
 } catch (e) {
  const answer = await askUserForRetry();
  if (answer.toLowerCase() === 's') {
   return await getDetailsEvent(event, customParams, tryNumber, axiosInstance);
  } else {
   return null;
  }
 }
}

async function getPopupsEvent(event, customParams, tryNumber = 0) {
 console.log(`Getting popups event [${event.name}]...`);
 if (tryNumber >= 5) {
  console.log('Attempt limit reached for getPopupsEvent.');
  return null;
 }

 if (!event.url) {
  console.log('Invalid event URL.');
  return null;
 }

 const customHeaders = {
  headers: {
   'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
  },
 };

 try {
  const response = await axios.post(event.url, customParams, customHeaders);
  const resultData = response.data;
  if (resultData.items) {
   delete resultData.items;
  }
  const result = {
   TicketsLeftMessage: resultData.TicketsLeftMessage,
   LikelyToSellOutMessage: resultData.LikelyToSellOutMessage,
   BestValueExplanationMessage: resultData.BestValueExplanationMessage,
   LimitedQuantityRemainingMessage: resultData.LimitedQuantityRemainingMessage,
   NumberOfGridResultsMessage: resultData.NumberOfGridResultsMessage,
  };
  console.log('Request successful.');
  return result;
 } catch (error) {
  return getPopupsEvent(event, customParams, tryNumber + 1);
 }
}

async function saveFileData(jsonData, fileName = 'result_venues.json') {
 const jsonString = JSON.stringify(jsonData, null, 2);
 const directory = './output/';

 if (!fs.existsSync(directory)) {
  fs.mkdirSync(directory, { recursive: true });
 }
 const filePath = directory + fileName;
 await fs.promises
  .writeFile(filePath, jsonString, 'utf8')
  .then(() => {
   logInfo('File saved successfully: ' + color.green(filePath));
   return true;
  })
  .catch((err) => {
   return false;
  });
}

async function listenInfoViewed(browser, url) {
 const page = await browser.newPage();
 try {
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
  console.log('Document loaded');
  await page.waitForLoadState('networkidle');
  const progressBarExists = await page.evaluate(() => {
   return !!document.getElementById('progressbar');
  });
  if (progressBarExists) {
   await page.waitForFunction(
    () => {
     const progressBar = document.getElementById('progressbar');
     if (progressBar) {
      const width = progressBar.style.width;
      return width === '100%';
     }
     return false;
    },
    { timeout: 10000 }
   );
  }
  console.log('Progress bar - 100%');
  return await extractViewedText(page, url);
 } catch (e) {
  const answer = await askUserForRetry();
  if (answer.toLowerCase() === 's') {
   await page.close();
   return await listenInfoViewed(browser, url);
  } else {
   return null;
  }
 } finally {
  await page.close();
 }
}

async function extractViewedText(page, url) {
 console.log('Retrieving information...');
 try {
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
  console.log('Document loaded');
  const htmlContent = await page.content();
  const match = htmlContent.match(/(\d+\speople\sviewed\sthis\sevent)/);
  let result = null;
  if (match && match[1]) {
   result = match[1];
  } else {
   result = '0';
  }
  console.log('*** Result info viewed: ' + result);
  return result;
 } catch (e) {
  const answer = await askUserForRetry();
  if (answer.toLowerCase() === 's') {
   return await extractViewedText(page, url);
  } else {
   return null;
  }
 }
}

module.exports = {
 getVenuesByLocation,
 getEventsByVenueWithPagination,
 saveFileData,
 getDetailsEvent,
 getPopupsEvent,
};
