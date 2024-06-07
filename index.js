const { runScrape } = require('./all_venues.js');

(async () => {
 // Define settings, check config/location.json
 locationIndex = 2;
 // Set limit venues (default -1 to process all venues) / you can set 2 or 3 to quick test
 limitVenues = -1;
 // Generate a json file with the top100 events ordered by numberViews and NumberLastBuy
 showTop100 = false;
 // Seach info about viewed
 searchInfoViewed = false;
 // Proxy ( set -1 to disable)
 currentProxy = -1;

 runScrape(
  locationIndex,
  limitVenues,
  showTop100,
  searchInfoViewed,
  currentProxy
 );
})();
