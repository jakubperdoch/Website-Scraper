const fs = require('fs');
const path = require('path');

function getNumberFromFilename(filename) {
    const match = filename.match(/^most_viewed_(\d+)\.json$/);
    return match ? parseInt(match[1], 10) : null;
}

function updateMasterArray(masterArray, content) {
    content.forEach(item => {
        const existingItem = masterArray.find(e => e.eventId === item.eventId);
        if (existingItem) {
            existingItem.numberViewed += item.numberViewed;
        } else {
            masterArray.push(item);
        }
    });
    return masterArray;
}

async function processFiles() {
    const files = fs.readdirSync('./output/london/').filter(file => file.startsWith('most_viewed_') && file.endsWith('.json'));
    files.sort((a, b) => getNumberFromFilename(a) - getNumberFromFilename(b));

    let masterArray = [];
    for (const file of files) {
        const content = JSON.parse(fs.readFileSync("./output/london/" + file, 'utf8'));
        console.log("Processing file: " + file + " - Events: " + content.length);
        masterArray = updateMasterArray(masterArray, content);
    }

    fs.writeFileSync('./output/london/master.json', JSON.stringify(masterArray, null, 2), 'utf8');
    
    const top100 = masterArray
    .sort((a, b) => b.numberViewed - a.numberViewed)
    .slice(0, 100)
    .map(item => ({ 
        eventId: item.eventId,
        eventName: item.name,
        url: item.url,
        imageUrl: item.imageUrl,
        formattedDateWithoutYear: item.formattedDateWithoutYear,
        venueName: item.venueName,
        price: item.extraInfo?.Price,
        minPrice: item.extraInfo?.MinPriceValue,
        maxPrice: item.extraInfo?.MaxPrice,
        availableTickets: item.extraInfo?.AvailableTicketsNumber,
        views: item.numberViewed,
    }));

    fs.writeFileSync('./output/london/top100.json', JSON.stringify(top100, null, 2), 'utf8');

    console.log('Done!');
}

processFiles();
