// 'use strict';

/*
 * --------------------------------------------------------
 * Calendar2Voice 
 * 
 * Purpose: A flash briefing that given an ICS url to a public 
 *    calendar, will find any events for today and return them 
 *    to be read.  If there are no events for today, it will 
 *    return the next day that has events.
 * 
 * see config.js for the data for this.  
 * --------------------------------------------------------
 */

const ics2json = require('./icsToJson');

const cfg = require('config');
const Calendar = require('containers/calendar');
const Event = require('containers/event');

// eslint-disable-next-line no-unused-vars
const util = require('util');

// this module is used internally by the moment timeszone
// eslint-disable-next-line no-unused-vars  
const { DateTime } = require("luxon");
var moment = require('moment-timezone');

// text we build up of each event to later return to Alexa
var responsetext = "";
var eventresponse = "";
var responseJSON = "";
// var eventarray = [];

/*
 * --------------------------------------------------------
 * function: createReturn
 * purpose: creates standard JSON return to alexa
 * --------------------------------------------------------
 */
// eslint-disable-next-line no-unused-vars
function createReturn(stscode,responsetext, calobj) {
	
	let response = "";

	try {
		response = {
			statusCode: stscode,
			body: responsetext
		}
	}
	catch (e) {
		console.log("Error createing response return!",e);
	}

	return response;
}

/*
 * --------------------------------------------------------
 * function: select_todays_events
 * purpose: convert the iCS JSON for the calendar into a series
 * of standard event objects and for the ones that are today, 
 * push to a collecton that can be later sorted and reported
 * --------------------------------------------------------
 */
function select_audited_events(jdata, thiscal) {

	let arSelectedEvents = [];
	let arEvents = [];
	let stdevent = {};

	// console.log("Selecting events:" + JSON.stringify(jdata));

	try {
		// look at each event.  Pull out ones for today AND save the next day that events
		// occur just incase we need it since we're going through them all anyway
		jdata.forEach(function (oneevent) {
				
			if ( oneevent && oneevent.startDate && oneevent.summary ) {
				
				// create our standard event 
				stdevent = new Event()
				stdevent.load(thiscal,oneevent);		

				if ( stdevent.isvalid ) { 
					stdevent.msg = "";

					if ( stdevent.eventStart.hour() == 0 && stdevent.eventStart.minute() == 0) {
						var Midev = new Event();
						Midev.load(thiscal,oneevent);
						Midev.msg = ( Midev.isalldayevent) ? "All-day event" : "Midnight event";
						// console.log("$$$ all or midnight:" + JSON.stringify(Midev) );
						arSelectedEvents.push(Midev);
					}
					
					if ( stdevent.ismultidayevent ) {
						var mulEv = new Event();
						mulEv.load(thiscal,oneevent);
						mulEv.msg = "Muilt-day event";
						// console.log("$$$ Multil:" + JSON.stringify(mulEv) );
						arSelectedEvents.push(mulEv);
					}

					let data = arEvents.find( ( o ) => o.summary === stdevent.summary && o.eventStartString == stdevent.eventStartString);

					if ( data) {
						var dupEv = new Event();
						dupEv.load(thiscal,oneevent);
						dupEv.msg = "Duplicate event";
						arSelectedEvents.push(dupEv);
					} else {
						arEvents.push(stdevent);
					}
	
				} else {  // not a valid event for us but we don't tell user that
					console.log("event entry NOT valid, skipping");
					console.log(util.inspect(stdevent, {showHidden: false, depth: null}));
				} 

			}
		}); // foreach event
	}
	catch (e) {
		console.log("Error setting object:",e)
	}

	return arSelectedEvents;
}

/*
 * --------------------------------------------------------
 * function: process_events.
 * format the events that were selected for responding back 
 * --------------------------------------------------------
 */

// eslint-disable-next-line no-unused-vars
function process_events(eventarray, thiscal) {

	let retmessage = "";

	console.log("Processing selected events");
	if ( eventarray.length > 0) {

		// remember sort mutates the object
		eventarray.sort( function(a,b) {
			if ( a.sortkey(0) > b.sortkey(0) ) return 1;
			if ( b.sortkey(0) > a.sortkey(0) ) return -1;
			return 0;
		});
		
		// we're building basic HTML response rows in a table
		eventarray.forEach(function (oneevt) {
			console.log(util.inspect(oneevt, {showHidden: false, depth: null}));
			// retmessage += "<tr><td>" + oneevt.msg + "</td><td>" + oneevt.summary + "</td><td>" + oneevt.eventStart.format('hh:mm A') + "</td></tr>";
			retmessage += "'" + oneevt.msg + "','" + oneevt.summary + "','" + oneevt.eventStartString + "' \n";
		});
	}

	return retmessage;

}

/*
 * --------------------------------------------------------
 * function: init 
 * --------------------------------------------------------
 */
function init(event) {

	const evtpointer = ( event && event.queryStringParameters ) ?  event.queryStringParameters : event;

	var retcal = new Calendar();

	responsetext = "";
	eventresponse = "";
	responseJSON = "";

	// we can get fordate and forcalendar off the passed API params
	if ( evtpointer.fordate && evtpointer.fordate > '' && moment(evtpointer.fordate,'YYYY-MM-DD').isValid() ) {
		retcal.invokedDate = evtpointer.fordate;
	}

	if ( evtpointer.forcalendar  && evtpointer.forcalendar > '' ) {
		retcal.selectedcalendar = evtpointer.forcalendar.toLowerCase();
	} 

	try {
		console.log("Searching for:" + retcal.selectedcalendar);
		let data = cfg.calendars.find( ( o ) => o.calendarName === retcal.selectedcalendar);
		retcal.load(data);
	}
	catch (e) {
		console.log("error loading calendar",e);
	}

	console.log("returning:" + JSON.stringify(retcal));
	return retcal;
}

function selectevents(caldata, thiscal) {

	let eventarray = [];

	try {
		const jdata = ics2json.icsToJson(caldata);
		eventarray = select_audited_events(jdata, thiscal);
	}
	catch (e) {
		console.log("error converting data",e);
		eventresponse = "";
	}

	console.log("selectevents returning:" + JSON.stringify(eventarray));
	return eventarray;

}


function getevents(thiscal) {

	return new Promise((resolve) => {
		console.log("getevents for:" + thiscal.calendarname);

		let evarray = [];
		let evarraynext = [];
		let evarrayret = [];

		if (thiscal.calendarname == "startwheelhr" ) {

			var currentDate = moment().startOf('month');
			var futureMonth = moment(currentDate).add(1, 'M');
			let nexturl = "https://startwheel.org/events/?ical=1&tribe_display=month&tribe-bar-date=" + futureMonth.format('YYYY') + "-" +futureMonth.format('MM')
			console.log("Nextmonth url = " + nexturl);

			return thiscal.getICSdata().then( (caldata)  =>  {
				try {
					console.log("ICS curmonth returned:" + JSON.stringify(caldata));
					evarray = selectevents(caldata,thiscal);
					return thiscal.getICSdata(nexturl).then( (caldatanext)  =>  {
						console.log("ICS nextmonth returned:" + JSON.stringify(caldata));
						evarraynext = selectevents(caldatanext,thiscal);
						evarrayret = evarray.concat(evarraynext)
						resolve(evarrayret);
					});
				}
				catch (e) {
					console.log("error converting data",e);
					eventresponse = "";
					resolve(evarrayret);
				}
			});
		} else {
			return thiscal.getICSdata().then( (caldata)  =>  {
				console.log("ICS curmonth returned:" + JSON.stringify(caldata));
				let evarrayret = selectevents(caldata,thiscal);
				resolve(evarrayret);
			});
		}

	});

}


/*
 * --------------------------------------------------------
 * function: main 
 * --------------------------------------------------------
 */
exports.auditevents = function(event, context, callback) {

	// log for testing sake
	console.log(util.inspect(event, {showHidden: false, depth: null}));

	var thiscal = init(event);
	console.log("cali is:" + JSON.stringify(thiscal));

	if ( thiscal.isvalid ) {
		console.log("getting ICS for:" + thiscal.calendarname);

		getevents(thiscal).then( (eventarray)  =>  {
			try {
				eventresponse = process_events(eventarray, thiscal);
			}
			catch (e) {
				console.log("error converting data",e);
				eventresponse = "";
			}
		
			//responsetext = "<html><head></head><body><h1>Events that failed audit</h1><table><tr><th>Error Message</th><th>Event Summary</th><th>Event Startdate</th></tr>" + eventresponse + "</table></body></html>";
			responsetext = eventresponse + "\n";
		
			responseJSON = createReturn(200,responsetext, thiscal); 
			console.log(util.inspect(responseJSON, {showHidden: false, depth: null}));
			return callback(null, responseJSON);
		});   

	} else {
		console.log("Calendar was not valid");
	}

};
