const axios = require('axios');
const { count } = require('console');
const { exit } = require('process');
const fs = require('fs').promises;
const fsSync = require('fs');
const utf8 = require('utf8');
const color = require('colors');
const { JSDOM } = require('jsdom');
const {
 logInfo,
 logWarn,
 logError,
 extractCountry,
 extractLastBuyDetails,
} = require('../utils.js');
const { firefox } = require('playwright');

async function getEventsByLocation(
 customParams,
 currentLocation,
 tryNumber = 0
) {
 //encode lat and long
 customParams.lat = btoa(currentLocation.lat);
 customParams.lon = btoa(currentLocation.long);
 let result = null;
 error = false;
 /** CONFIG */
 const customHeaders = {
  headers: {
   'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
  },
 };
 if (tryNumber < 3) {
  await axios
   .get('https://www.viagogo.com/explore', {
    params: customParams,
    headers: customHeaders,
   })
   .then((response) => {
    result = response.data;
    if (result.venues) {
     delete result.venues;
    }
    if (result.total) {
     delete result.total;
    }
    if (result.remaining) {
     delete result.remaining;
    }
   })
   .catch((_) => {
    error = true;
   });

  if (error == true) {
   getEventsByLocation(customParams, currentLocation, tryNumber + 1);
  } else {
   return result;
  }
 } else {
  console.log('attempt limit for getEventsByLocation for ' + event.EventName);
  return undefined;
 }
}

async function getEventsByLocationWithPagination(
 customParams,
 currentLocation
) {
 let result = null;
 let lastEvents = [];
 customParams.page = 0;
 try {
  do {
   let temp = await getEventsByLocation(customParams, currentLocation);
   if (temp) {
    lastEvents = temp.events;
    if (customParams.page == 0) {
     result = temp;
    } else {
     result.events = result.events.concat(temp.events);
     result.remaining = temp.remaining;
    }
   } else {
    break;
   }
   customParams.page = customParams.page + 1;
  } while (
   result != undefined &&
   result.events != undefined &&
   lastEvents.length > 0
  );
  //logInfo("Events found for " + currentLocation.name + ": " + result.events.length);
 } catch (e) {}
 return result;
}

function showProgress(msj) {
 process.stdout.write('\b'.repeat(msj.length));
 process.stdout.write(msj);
}

async function getEventDetails(event, customParams, tryNumber = 0) {
 result = undefined;
 error = false;
 if (tryNumber < 3) {
  if (event.EventUrl != null || event.EventUrl != undefined) {
   /** CONFIG */
   const customHeaders = {
    headers: {
     'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    },
   };
   await axios
    .post(
     'https://www.viagogo.com/' + event.EventUrl,
     customParams,
     customHeaders
    )
    .then((response) => {
     result = response.data;
    })
    .catch((axioError) => {
     error = true;
    });
   if (error == true) {
    getEventDetails(event, customParams, tryNumber + 1);
   }
  }
  return result;
 } else {
  console.log('attempt limit for get all events for ' + event.EventName);
  return undefined;
 }
}
async function getDetailsEvent(urlEvent, customParams, tryNumber = 0) {
 result = undefined;
 error = false;
 if (tryNumber < 3) {
  if (urlEvent != null || urlEvent != undefined) {
   /** CONFIG */
   const customHeaders = {
    headers: {
     'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    },
   };
   await axios
    .post('https://www.viagogo.com/' + urlEvent, customParams, customHeaders)
    .then((response) => {
     result = response.data;
    })
    .catch((axioError) => {
     error = true;
    });
   if (error == true) {
    getEventDetails(event, customParams, tryNumber + 1);
   }
  }
  return result;
 } else {
  console.log('attempt limit for get event details');
  return undefined;
 }
}

async function getAllEvents(event, customParams, tryNumber = 0) {
 result = undefined;
 error = false;
 if (tryNumber < 3) {
  if (event.url != null || event.url != undefined) {
   /** CONFIG */
   const customHeaders = {
    headers: {
     'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    },
   };
   const urlEvent = event.url.slice(0, event.url.lastIndexOf('/') + 1);
   await axios
    .post('https://www.viagogo.com/' + urlEvent, customParams, customHeaders)
    .then((response) => {
     result = response.data;
    })
    .catch((error) => {
     error = true;
    });
   if (error == true) {
    getAllEvents(event, customParams, tryNumber + 1);
   }
  }
  return result;
 } else {
  console.log('attempt limit for get all events for ' + event.name);
  return undefined;
 }
}

async function getAllEventsWithPagination(event, customParams) {
 let result = null;
 customParams.CurrentPage = 0;
 do {
  customParams.CurrentPage = customParams.CurrentPage + 1;
  let tempEvents = await getAllEvents(event, customParams);
  if (customParams.CurrentPage == 1) {
   result = tempEvents;
  } else {
   result.Items = result.Items.concat(tempEvents.Items);
  }
 } while (
  result != undefined &&
  result.Items != undefined &&
  customParams.CurrentPage < result.NumPages
 );
 return result;
}

async function getInfoViewed(eventUrl, isRelative = true, cookie = '') {
 result = undefined;
 try {
  /*axios.interceptors.request.use((config) => {
            console.log('Configuración de la solicitud Axios:', config);
            return config;
          });*/
  if (eventUrl != null || eventUrl != undefined) {
   if (cookie === '') {
    cookie = fsSync.readFileSync('./cookie.txt', 'utf-8');
   }
   //console.log(cookie);
   /** CONFIG */
   const customHeaders = {
    'User-Agent':
     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    Cookie: cookie,
    Referer: 'https://www.viagogo.com/',
    Origin: 'https://www.viagogo.com',
   };
   /* Need to open the specific URL, not the parent to get the views */
   urlEvent = '';
   if (isRelative) {
    urlEvent = 'https://www.viagogo.com/' + urlEvent;
   } else {
    urlEvent = eventUrl;
   }
   //eventUrl.slice(0, eventUrl.lastIndexOf("/") + 1);
   //console.log(urlEvent);
   await axios
    .get(urlEvent, { headers: customHeaders })
    .then((response) => {
     try {
      fsSync.writeFileSync('./event.html', response.data, 'utf-8');
      //const regex = /(\d+\speople viewed this event)/;
      const regex = /(\d+\speople\sviewed\sthis\sevent)/;
      const match = response.data.match(regex);
      result = match ? match[1] : null;
     } catch (e) {
      console.error(e);
     }
    })
    .catch((_) => {
     console.error(_);
    });
  }
 } catch (ee) {}

 if (result != null || result != undefined) {
  //console.log(utf8.encode(result));
 }

 console.log('result views', result == undefined ? 0 : result);
 return result;
}

async function extractViewedText(url) {
 const browser = await firefox.launch();
 const page = await browser.newPage();
 await page.goto('https://www.viagogo.com/' + url);

 await page.click('.sc-1k5itcc-0');

 await page.click('.dropdown__row[data-q-val="1"]');

 await page.click('.js-edq-seated-continue');

 await page.waitForSelector('#venueMapContainer');

 const htmlContent = await page.content();
 const match = htmlContent.match(/(\d+\speople viewed this event)/);

 await browser.close();

 let result;
 if (match && match[1]) {
  result = match[1];
 } else {
  result = 'No match found';
 }

 return result;
}

async function saveFileData(jsonData, fileName = 'result.json') {
 const jsonString = JSON.stringify(jsonData, null, 2);
 const directory = './output/';

 const filePath = directory + fileName;
 fs.writeFile(filePath, jsonString, 'utf8', (err) => {
  if (err) {
   logError('Error while saving the file: ' + color.red(err));
  } else {
   logInfo('File saved successfully: ' + color.green(filePath));
  }
 });
 logInfo('File saved successfully: ' + color.green(filePath));
}

function getNumberByString(text) {
 try {
  nValue = text.match(/\d+/);
  if (nValue) {
   nValue = parseInt(nValue[0]);
  } else {
   nValue = null;
  }
  return nValue;
 } catch (_) {
  return null;
 }
}

function showInfoEventDetails(eventDetails) {
 logInfo('Low Price: ' + color.yellow(eventDetails.lowPrice));
 logInfo('High Price: ' + color.yellow(eventDetails.highPrice));
 logInfo('Available Sections: ' + color.yellow(eventDetails.totalCount));
 console.log(' ');
}

async function getLastBuy(urlEvent, axiosInstance = null) {
 let result = null;
 if (urlEvent) {
  // Configuration
  const customHeaders = {
   headers: {
    'User-Agent':
     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
   },
  };


  const currentAxios = axiosInstance || axios.create();

  try {
   const response = await currentAxios.get(
    'https://www.viagogo.com/' + urlEvent,
    { headers: customHeaders }
   );

   const dom = new JSDOM(response.data);
   const scriptContent =
    dom.window.document.querySelector('#index-data').textContent;
   const jsonData = JSON.parse(scriptContent);

   const items = jsonData.grid.items;
   items.forEach((item) => {
    if (item.soldXTimeAgoSiteMessage && item.soldXTimeAgoSiteMessage.hasValue) {
     const message = item.soldXTimeAgoSiteMessage.message;
     const qualifier = item.soldXTimeAgoSiteMessage.qualifier;

     result = { message: message, qualifier: qualifier };
    }
   });
  } catch (err) {
   console.error('Error: ', err);
  }
 }
 return result;
}


module.exports = {
 extractViewedText,
 getLastBuy,
 showInfoEventDetails,
 getDetailsEvent,
 getEventsByLocation,
 getEventsByLocationWithPagination,
 showProgress,
 getEventDetails,
 getAllEvents,
 getAllEventsWithPagination,
 getInfoViewed,
 saveFileData,
 getNumberByString,
};
