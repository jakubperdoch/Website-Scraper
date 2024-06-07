const fs = require('fs').promises;
const {
 getDetailsEvent,
 saveFileData,
 getPopupsEvent,
} = require('./core/venues.js');

(async () => {
 // Get config
 const settings = await fs.readFile('config/config.json', 'utf-8');
 jsonConfig = JSON.parse(settings);

 // Get location
 const jsonLocation = JSON.parse(
  await fs.readFile('config/location.json', 'utf-8')
 );
 const currentLocation = jsonLocation.locations[2];
 mEvent = {
  name: 'Rock',
  url: 'Concert-Tickets/Dance-and-Electronic-Music/David-Guetta-Tickets/E-152970501?quantity=2',
 };
 r = await getPopupsEvent(mEvent, jsonConfig.event_popups);
 await saveFileData(r, 'tempEvent' + currentLocation.name + '.json');
})();
