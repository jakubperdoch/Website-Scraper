const fs = require('fs').promises;
const { logInfo } = require('./utils.js');
const color = require('colors');
const { getVenuesByLocation, getEventsByVenueWithPagination, saveFileData } = require('./core/venues.js');

(async () => {
  start();
})();


async function start() {
  // Get config
  const settings = await fs.readFile("config/config.json", 'utf-8');
  jsonConfig = JSON.parse(settings);

  // Get location
  const jsonLocation = JSON.parse(await fs.readFile("config/location.json", 'utf-8'));
  // get location selected
  const currentLocation = jsonLocation.locations[jsonConfig.venue_items.location_index];

  // Get list events by location
  logInfo(`${color.green("Getting list venues - "+currentLocation.name)}`);
  const listVenues = await getVenuesByLocation(jsonConfig.events_by_location, currentLocation);
  const result = [];
  venuesResult = {
    "venues": "",
    "totalEvents": 0
  };
  if (listVenues) {
    logInfo(`Total venues found: ${color.yellow(listVenues.length)}`);
    venuesResult.venues = listVenues;
    c = 0;
    for (const venue of listVenues) {
      try {
        logInfo(`searching events in ${color.yellow(venue.venueName)}`);
        tempR = await getEventsByVenueWithPagination(jsonConfig, venue, currentLocation.name);
        if (tempR.length > 0) {
          result.push(...tempR);
          venuesResult.venues[c].events = tempR;
        }
        logInfo(`Total events found for ${color.green(venue.venueName)}: ${color.yellow(tempR.length)}`);

        console.log(" ------------------------ ")
        // Break to test
        /*c = c + 1;
        if (c >= 2) {
          break;
        }*/
      } catch (_) { }
    }
    venuesResult.totalEvents = result.length;
    logInfo(`***Total events ${color.green(result.length)}`);
    // Save json file
    $isSaved = saveFileData(venuesResult, "result_venues_"+currentLocation.name+".json");


    // GET TOP 100 EVENTS ORDER BY numberViewed AND numberLastBuy - DESC
    try{
      if($isSaved){
        // Read json file or use result
        if(result.length > 0){
           allEvents = [];
           // Check all events
           if(result.length > 0){
             // Order events
             allEvents = result
               //.sort((a, b) => b.numberViewed - a.numberViewed)
               .sort((a, b) => {
                  if (a.numberViewed !== 0 && b.numberViewed !== 0) {
                    return b.numberViewed - a.numberViewed;
                  } else {
                    return b.numberLastBuy - a.numberLastBuy;
                  }
               })
               .slice(0, 100)
               .map(item => ({ 
                eventId: item.eventId,
                eventName: item.name,
                url: item.url,
                dayOfWeek: item.dayOfWeek,
                formattedDateWithoutYear: item.formattedDateWithoutYear,
                venueId : item.venueId,
                venueName: item.venueName,
                formattedVenueLocation: item.formattedVenueLocation,
                eventCountdownMessage: item.eventCountdownMessage ? item.eventCountdownMessage : '',
                price: item.formattedMinPrice ? item.formattedMinPrice : '',
                minPrice: item.eventDetail?.minPrice,
                maxPrice: item.eventDetail?.maxPrice,
                ticketsLeftForEventMessage : item.ticketsLeftForEventMessage ? item.ticketsLeftForEventMessage : null,
                //availableTickets: item.eventDetail?.ticketsLeftForEventMessage,
                lastBuy: item.lastBuy,
                numberLastBuy: item.numberLastBuy,
                viewsLabel: item.viewed,
                views: item.numberViewed,
             }));
             saveFileData(allEvents, "top_events"+currentLocation.name+".json");
           }else{
             console.log("No events found in all venues");
           }
 
        }else{
         console.log("No events found");
        }
     }
    }catch(_){}


  }
}