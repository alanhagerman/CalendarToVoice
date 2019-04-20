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

// const ics2json = require('./icsToJson').default;
const ics2json = require('./icsToJson');

const uuid = require('uuid');
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
var eventarray = [];

/*
 * --------------------------------------------------------
 * function: createReturn
 * purpose: creates standard JSON return to alexa
 * --------------------------------------------------------
 */
function createReturn(stscode,responsetext, calobj) {
	
	const jsonDate = calobj.todayDate.toJSON();

	let response = "";

	try {
		response = {
			statusCode: stscode,
			body: JSON.stringify({
				uid: uuid.v4(),
				updateDate: jsonDate,
				titleText: calobj.skilltitle,
				mainText: responsetext
			})
		};
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
function select_todays_events(jdata, thiscal) {

	let arTodaysEvents = [];
	let stdevent = {};

	try {
		// look at each event.  Pull out ones for today AND save the next day that events
		// occur just incase we need it since we're going through them all anyway
		jdata.forEach(function (oneevent) {
				
			if ( oneevent && oneevent.startDate && oneevent.summary ) {
				
				// create our standard event 
				stdevent = new Event()
				stdevent.load(thiscal,oneevent);		

				if ( stdevent.isvalid) {
					console.log("valid event. nextStart date:" + stdevent.nextStart.format() + " for qualifier:" + stdevent.qualifier );

					// if its for today, save it so we can sort it
					if ( stdevent.qualifier ==  stdevent.EVENTSTARTSTODAY  || stdevent.qualifier ==  stdevent.EVENTENDSTODAY || stdevent.qualifier ==  stdevent.EVENTSPANSTODAY ) {
						arTodaysEvents.push(stdevent);
					} 

					// wasnt a today event to be reported, is it a future date? If so is it closer than any other we've seen so far?
					if (  stdevent.qualifier ==  stdevent.EVENTISFUTURE ) {
						let diffToday = thiscal.nextmeetingdate.diff(thiscal.todayDate,'days');
						let diffevent = thiscal.nextmeetingdate.diff(stdevent.nextStart,'days' );
						if ( diffevent < diffToday && diffevent > 0 ) {
							thiscal.nextmeetingdate = stdevent.nextStart.clone();
						}
					}
				} else {  // not a valid event for us but we don't tell user that
					console.log("event entry NOT valid, skipping");
					console.log(util.inspect(oneevent, {showHidden: false, depth: null}));
				} 
			}

		}); // foreach event
	}
	catch (e) {
		console.log("Error setting object:",e)
	}

	return arTodaysEvents;
}

/*
 * --------------------------------------------------------
 * function: process_events.
 * format the events that were selected for responding back 
 * --------------------------------------------------------
 */
function process_events(eventarray, thiscal) {

	let retmessage = "";

	console.log("Processing events for today");
	if ( eventarray.length > 0) {

		// remember sort mutates the object
		eventarray.sort( function(a,b) {
			if ( a.sortkey > b.sortkey) return 1;
			if ( b.sortkey > a.sortkey) return -1;
			return 0;
		});
		
		// build our response table for each event. Remember Flash Briefings do NOT support SSML! 
		// we try to be smart with phrasing to sound more natural but ultimately we are at the mercy 
		// of the source calendar
		// !!! Plain text only!!!
		let cnt = 1;
		let lasteventStartdate = {};

		eventarray.forEach(function (oneevt) {

			console.log(util.inspect(oneevt, {showHidden: false, depth: null}));

			if ( oneevt.qualifier == oneevt.EVENTSPANSTODAY ) {
				retmessage += ". All day ";
				retmessage += ( oneevt.evtEnd == thiscal.todayDate ) ? " until " + oneevt.evtEnd.format('hh:mm A') : "";
				retmessage += " is " + oneevt.summary + " ";
			} else {
				// if we only have a couple events, saying finally seems out of place so lets make sure we have 4
				retmessage +=  ( cnt > 3 && cnt == eventarray.length ) ?	". Finally, " : "";
				retmessage +=  ( lasteventStartdate == oneevt.eventStart.format('hh:mm A') ) ? ". Also at " : ". At ";

				if (oneevt.eventStart.hour() == 0 && oneevt.eventStart.minute() == 0) {
					retmessage += " midnight ";
				} else if (oneevt.eventStart.hour() == 12 && oneevt.eventStart.minute() == 0) {
					retmessage += " noon ";
				} else {
					retmessage += oneevt.eventStart.format('hh:mm A');
				}
			
				retmessage +=  ( thiscal.calendareventtype == 'meeting') ? ", the " + oneevt.summary + " meets. " : ", is " + oneevt.summary + ". ";

			}
			cnt += 1;
			if ( oneevt.qualifier != oneevt.EVENTSPANSTODAY ) {
				lasteventStartdate = oneevt.eventStart.format('hh:mm A')
			}
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

	return retcal;
}

/*
 * --------------------------------------------------------
 * function: main 
 * --------------------------------------------------------
 */
exports.calendar2voice = function(event, context, callback) {

	// log for testing sake
	console.log(util.inspect(event, {showHidden: false, depth: null}));

	var thiscal = init(event);
	
	console.log("getting ice");
	// get the ICS via a promise so that we do not process without one
	thiscal.getICSdata().then( (caldata)  =>  {

		try {
			const jdata = ics2json.icsToJson(caldata);
			eventarray = select_todays_events(jdata, thiscal);
			eventresponse = process_events(eventarray, thiscal);
		}
		catch (e) {
			console.log("error converting data");
			eventresponse = "";
		}
	
		responsetext = thiscal.introtext + "For today, " + thiscal.todayDate.format("dddd, MMMM Do, YYYY") + ". There ";

		if ( eventresponse == "" ) {
			// no meetings fine the next day of meetings after today
			responsetext += " are no ";
			responsetext += ( thiscal.calendareventtype == 'meeting') ? 'meetings' : 'events';
			responsetext +=  ". The next day with ";
			responsetext += ( thiscal.calendareventtype == 'meeting') ? 'meetings' : 'events';
			responsetext += " is " + thiscal.nextmeetingdate.format("dddd, MMMM Do, YYYY");
		} else {
			if ( eventarray.length == 1) {
				responsetext += ( thiscal.calendareventtype == 'meeting') ? " is one meeting." : " is one event.";
			} else { 
				responsetext += " are " + eventarray.length.toString();
				responsetext += ( thiscal.calendareventtype == 'meeting') ? " meetings. " : " events. ";
			}
			responsetext += eventresponse;
		}
		responseJSON = createReturn(200,responsetext, thiscal); 
		console.log(util.inspect(responseJSON, {showHidden: false, depth: null}));
		return callback(null, responseJSON);
	});   
};
