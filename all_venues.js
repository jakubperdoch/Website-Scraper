const fs = require('fs').promises;
const { logInfo, askUserForRetry, getCurrentLocation } = require('./utils.js');
const color = require('colors');
const { firefox } = require('playwright');
const axios = require('axios');
const {
	getVenuesByLocation,
	getEventsByVenueWithPagination,
	saveFileData,
} = require('./core/venues.js');
const { json } = require('stream/consumers');

const defaultHeaders = {
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
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
				console.error('Proxy configuration error:', pe);
			}
		}

		await getCurrentLocation(axiosInstance);

		const browser = await firefox.launch(configBrowser);
		const context = await browser.newContext({
			userAgent:
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
			extraHTTPHeaders: defaultHeaders,
		});

		const result = [];
		const venuesResult = { venues: '', totalEvents: 0 };

		const handleCleanup = async (exitCode = 0) => {
			await saveFileData(
				venuesResult,
				`result_venues_${currentLocation.name}.json`
			);
			await saveFileData(
				joinAllEvents(result, result.length),
				`all_events_${currentLocation.name}.json`
			);
			await browser.close();
			process.exit(exitCode);
		};

		process.on('uncaughtException', async (err) => {
			console.error('Uncaught Exception:', err);
			await handleCleanup(1);
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

			const venuePromises = listVenues
				.slice(0, limitCountVenues === -1 ? listVenues.length : limitCountVenues)
				.map(async (venue) => {
					if (processedVenues.has(venue.venueName)) {
						return;
					}
					processedVenues.add(venue.venueName);

					logInfo(`Searching events in ${color.yellow(venue.venueName)}`);

					const tempR = await getEventsByVenueWithPagination(
						jsonConfig,
						venue,
						currentLocation.name,
						context,
						searchInfoViewed,
						axiosInstance
					);

					if (tempR.length > 0) {
						tempR.forEach((event) => {
							event.venueName = venue.venueName;
						});
						result.push(...tempR);
						venue.events = tempR;
						await saveFileData(
							venuesResult,
							`result_venues_${currentLocation.name}.json`
						);

						await saveFileData(
							joinAllEvents(result, result.length),
							`all_events_${currentLocation.name}.json`
						);
					}

					logInfo(
						`Total events found for ${color.green(venue.venueName)}: ${color.yellow(tempR.length)}`
					);
				});
			await Promise.all(venuePromises);

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
		console.error('File error:', fileError);
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
				quantity: event.eventDetail?.quantity,
				betterValueTickets: event.eventDetail?.betterValueTickets,
				venueName: event.venueName,
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
