const axios = require('axios');
const { count } = require('console');
const fs = require('fs').promises;
const utf8 = require('utf8');
const { showInfoEventDetails, saveFileData, getInfoViewed, getEventsByLocationWithPagination, getAllEventsWithPagination, getEventDetails } = require('../core/viagogo.js');

(async () => {
    start();
})();

async function start(){
    finalResult = {
        location: "",
        events: []
      };
      
    // Get config
    const settings = await fs.readFile("config/config.json", 'utf-8');
    jsonConfig = JSON.parse(settings);

    // Get location
    const jsonLocation = JSON.parse(await fs.readFile("config/location.json", 'utf-8'));
    // get location selected
    const currentLocation = jsonLocation.locations[jsonConfig.events_by_location.location_index];

    // Get list events by location
    console.log("Getting list events - "+currentLocation.name);
    const listEvents = await getEventsByLocationWithPagination(jsonConfig.events_by_location, currentLocation);
    finalResult.events = listEvents.events;
    finalResult.location = currentLocation.name;
    // Search event details
    if(listEvents != null && listEvents && listEvents.events){ 
        console.log(listEvents.events.length);
        for(i=0;i<listEvents.events.length;i++){
            finalResult.events[i].viewed = await getInfoViewed(listEvents.events[i].url);
            showTicketInfo(listEvents.events[i]);
            const allEvents = await getAllEventsWithPagination(listEvents.events[i], jsonConfig.all_events);
            if(allEvents && allEvents.Items){
                finalResult.events[i].presentations = allEvents.Items;
                try{
                    console.log(allEvents.TotalItems+" events in all location");
                    for (let c = 0; c < allEvents.Items.length; c++) {
                        const item = allEvents.Items[c];
                        showInfoEvent(item);
                        const eventDetails = await getEventDetails(item, jsonConfig.event_details, 0);
                        if (eventDetails && eventDetails.items) {
                            showInfoEventDetails(eventDetails); 
                            try {
                                delete eventDetails.items;
                                finalResult.events[i].presentations[c].eventDetail = eventDetails;
                            }catch (e) { }
                        }
                    }
                }catch(e){ }
            }
        }
    }else{
        console.log("Events not found for this location");
    }
   saveFileData(finalResult,"result.json");
}


function showTicketInfo(ticket){
    console.log(" --------------------------------------------------------------------- ");
    console.log(" ");
    console.log("Ticket name: ");
    console.log(ticket.url.slice(0, ticket.url.lastIndexOf("/")));
}
function showInfoEvent(event){
    console.log("#####");
    console.log("Event name: "+event.EventName);
    console.log("Date: "+event.LongDateString);
    console.log("Venue name: "+event.VenueName);
    if(event.VenueCapacityString != null && event.VenueCapacityString != ""){
        console.log(event.VenueCapacityString);
    }
    console.log("Available Tickets: "+event.AvailableTickets);
}
