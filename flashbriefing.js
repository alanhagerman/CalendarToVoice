'use strict';

/*
 * --------------------------------------------------------
 * Calendar2Voice 
 * 
 * Purpose: A flash briefing that given an ICS url to a public 
 *    calendar, will find any events for today and return them 
 *    to be read.  If there are no meetings for today, it will 
 *    read the next day that has meetings.
 * --------------------------------------------------------
 */

const ics2json = require('./icsToJson');
const uuid = require('uuid');
const rrule = require('rrule');

// eslint-disable-next-line no-unused-vars
const util = require('util');

// this module is used internally by the moment timeszone
// eslint-disable-next-line no-unused-vars  
const { DateTime } = require("luxon");
var moment = require('moment-timezone');

// these are potentially passed a invocation variables
// defaults
var selectedCalendar = "cityofvb";
var SKILLTITLE = 'Virginia Beach Public Meetings';
var TIMEZONELIT = 'America/New_York';
var ICSURL = 'https://calendar.google.com/calendar/ical/codeforamerica.org_25s5sf8i4kkgdd3u7m6bnmsli0%40group.calendar.google.com/public/basic.ics';
var INTRO = " ";
var WINDOWDAYS = 30;
var CALTYPE = 'icalendar';

// calendar types we support
const CALTYPEICAL = 'icalendar';

/*
 * --------------------------------------------------------
 * Set the timezone and some dates globally off it. We only look
 * at dates between todayDate and endWindowDate
 * 
 * --------------------------------------------------------
 */

if ( TIMEZONELIT.length > 0 ) {
	moment.tz.setDefault(TIMEZONELIT);
}

var todayDate = moment.tz(TIMEZONELIT);
todayDate.startOf('day');

var endWindowDate = moment.tz(TIMEZONELIT);
endWindowDate.add(WINDOWDAYS,'days');
endWindowDate.startOf('day');

console.log("INIT todayDate:" + todayDate.format() + " , endWindowDate:" + endWindowDate.format() + ", timezone:" + TIMEZONELIT);

/*
 * --------------------------------------------------------
 * function: setupcalendar
 * purpose: at the moment we specifically add calenders so we can
 * verify they work and for convenience.  There's nothing stopping
 * these from coming the invocation other than probably not good for
 * security.
 * --------------------------------------------------------
 */
function setupcalendar(whichcalendar) {

	console.log("Setting up calendar:" + whichcalendar) ;

	switch (whichcalendar.toLowerCase() ) {
		case "cityofvb":
		default:
			SKILLTITLE = 'Virginia Beach Public Meetings';
			TIMEZONELIT = 'America/New_York';
			ICSURL = 'https://calendar.google.com/calendar/ical/codeforamerica.org_25s5sf8i4kkgdd3u7m6bnmsli0%40group.calendar.google.com/public/basic.ics';
			INTRO = "Public meetings for the City of Virginia Beach. "
			WINDOWDAYS = 30;
			CALTYPE = 'icalendar';
	}

}

/*
 * --------------------------------------------------------
 * function: isEventToday
 * purpose: process the event date if legal and return moments
 * --------------------------------------------------------
 */
function isEventToday(momentobj) {
	return  ( momentobj.year() == todayDate.year() && momentobj.month() == todayDate.month() && momentobj.date() == todayDate.date() );
}

/*
 * --------------------------------------------------------
 * function: returnnexteventdate
 * purpose: return the calculated eventdate - either the
 *    date from the ical event or one based on the icaleventdate
 *    and the rule
 * --------------------------------------------------------
 */
function returnnexteventdate(usedate,evtjson) {

	var eRule = {};
	var retDate = usedate;
	var ltime = {};

	if (evtjson.rrule) {

		// var userule = "DTSTART:" + usedate + "\ntzid:" + TIMEZONELIT + "\nRRULE:" + evtjson.rrule;
		var userule = "DTSTART;TZID=" + TIMEZONELIT + ":" + usedate + "\nRRULE:" + evtjson.rrule;
		console.log("Event Rule being processed:" + userule);

		try {
			eRule = rrule.rrulestr(userule);
			let aeventdates = eRule.between(todayDate.toDate(), endWindowDate.toDate());

			// eRUle always returns UTC times so we need to maybe convert depending on the source

			if ( aeventdates.length > 0 ) {
				retDate = aeventdates[0].toString();
				//console.log("usedate:]" + usedate + "[,  retDate:]" + retDate + "[");

				// if the original date ended in Z then its a UTC Date, otherwise its local
				if ( ! usedate.endsWith('Z') ) {
					// original time was NOT UTC, Need to convert to local time
					ltime = moment.utc(retDate).tz(TIMEZONELIT);
					// console.log("Converted retDate:" + retDate + " to:" + ltime );
					retDate = ltime.format();
				}

			}
		}
		catch (e) {
			console.log("error processing rule:", e);
		}
	} else {
		// no rule, so use the date given. It's always local time even if it has a Z on the end
		ltime = moment(usedate);
		retDate = ltime.format();
		console.log("Converted usedate:" + usedate + " to moment:" + retDate + " without rule")
	}

	console.log("Setting event date based on rule to:",retDate);
	return retDate; 

}

/*
 * --------------------------------------------------------
 * function: fmt_icalendar
 * purpose: update a standard event object from icalendar json
 * 
 * NOTE: recuring events in iCalendars have a start date and a 
 * recurring RULE.  We need to apply the rule to the event and then
 * see if it occurs today or within the next 30 days.  The first 
 * occurence of the event within that window becomes the eventdate.
 * --------------------------------------------------------
 */
function fmt_icalendar(calobj, evtjson) {
	
	// var usedate = "";
	var retobj = calobj;
	
	// console.log("initial object");
	// console.log(util.inspect(retobj, {showHidden: false, depth: null}));

	if ( evtjson && evtjson.startDate && evtjson.summary ) {
		// probably an calendar event

		try {

			// usedate = evtjson.startDate;
			console.log("createevent startdate:" + evtjson.startDate + ", summary=" + evtjson.summary);
	
			if ( moment(evtjson.startDate,'YYYYMMDDTHHmmss').isValid() ) {

				let nexteventdate = returnnexteventdate(evtjson.startDate,evtjson);

				var momentdate =  moment.tz(nexteventdate,'YYYY-MM-DDTHHmmss',TIMEZONELIT);
				var momentdatenotime = moment.tz(nexteventdate,'YYYY-MM-DDTHHmmss',TIMEZONELIT);
				momentdatenotime.startOf('day');
				
				let uidtouse = uuid.v1();
				let evtistoday = isEventToday(momentdatenotime);
				let lrule = ( evtjson.rrule ) ? evtjson.rrule : "";
				
				let sortkey = momentdate.format('HH:mm') + ":" + evtjson.summary + ":" + uidtouse;

				// set the object
				try {
					retobj.eventdatetime = nexteventdate;
					retobj.summary = evtjson.summary;
					retobj.uid = uidtouse;
					retobj.rrule = lrule;
					retobj.eventdate = momentdate;
					retobj.eventdatenotime = momentdatenotime;
					retobj.sortkey = sortkey;
					retobj.istoday = evtistoday;
					retobj.isvalid = true;
				}
				catch (e) {
					console.log("Error settibg object:",e)
				}
			}
		}
		catch(e) {
			console.log("error in object creation:",e);
		}
	
	} else {
		console.log("invalid ical format - no eventdate");
	}

	// console.log("returning object");
	// console.log(util.inspect(retobj, {showHidden: false, depth: null}));

	return retobj;

}


/*
 * --------------------------------------------------------
 * function: createeventobj
 * purpose: process the eventjson based on the format and return
 * a standardized event obj.  This lets us handle not only icalendar
 * but also other event formats in the future
 * --------------------------------------------------------
 */
function createeventobj(evtformat, evtjson) {

	// our standard event object returned
	var retobj = {
		isvalid:false,
		istoday:false,
		uid:"",
		rrule:"",
		summary:"",
		sortkey:"",
		eventdatetime:"",
		eventrule:"",
		eventdate:"",
		eventdatenotime:"",
		}

	switch (evtformat) {

		case CALTYPEICAL:
			return fmt_icalendar(retobj, evtjson);
	}

	// return the empty object
	return retobj;
}

/*
 * --------------------------------------------------------
 * function: getICS
 * purpose: retrieve an ICS file from an URL.
 * Uses retrieve and therefore a bunch of dependencies.  its
 * also async but we need to wait since we can't do anything
 * without the file.
 * --------------------------------------------------------
 */
function getICS() {
	
	var request = require('request');

	return new Promise((resolve,reject) => {
		console.log ("Getting ICS");

		request.get(ICSURL, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				var iCal = body;
				resolve(iCal);
			} else {
				reject("Error getting ICS");
			}
		});
	});
}

/*
 * --------------------------------------------------------
 * function: main function
 * purpose: 
 * --------------------------------------------------------
 */
exports.calendar2voice = function(event, context, callback) {

	// log for testing sake
	console.log(JSON.stringify(event));

	// see if we got a 'fordate off the API invocation
	if ( event && event.queryStringParameters && event.queryStringParameters.fordate && event.queryStringParameters.fordate > '' && moment(event.queryStringParameters.fordate,'YYYY-MM-DD').isValid() ) {

		todayDate = moment.tz(event.queryStringParameters.fordate,TIMEZONELIT);
		todayDate.startOf('day');
		
		endWindowDate = moment.tz(event.queryStringParameters.fordate,TIMEZONELIT);
		endWindowDate.add(WINDOWDAYS,'days');
		endWindowDate.startOf('day');

		console.log("passed date - revised to todayDate:" + todayDate.format() + " , endWindowDate:" + endWindowDate.format() + ", timezone:" + TIMEZONELIT);
	}

	if ( event && event.queryStringParameters && event.queryStringParameters.forcalendar  && event.queryStringParameters.forcalendar > '' ) {
		selectedCalendar = event.queryStringParameters.forcalendar;
	}

	switch ( selectedCalendar.toLowerCase() ) {
		case "cityofvb":
			setupcalendar(selectedCalendar);
			break;

		default:
			selectedCalendar = "cityofvb";
			setupcalendar(selectedCalendar);
	}

	// the response eventually returned to Alexa
	var responsetext = "";

	// text we build up of each event to later return to Alexa
	var eventresponse = "";

	// get the ICS via a promise so that we do not process without one
	getICS().then( (caldata)  =>  {

		// convert the ical event into a JSON structure
		const jdata = ics2json.icsToJson(caldata);

		// as we go through all the events, we may not have an event for today.  In that case we want to tell the 
		// humanoid that the next day with meetings is and give them the next day.
		var nextmeetingdate = endWindowDate;
		
		// events are not sorted in the ics so we will need to support events for today by time
		var aEventTimes = [];

		// save the collection of objects that are todays events
		var cTodaysEvents = {};
		var stdevent = {};

		// console.log("Starting event processing loop for today:", todayDate.format());

		jdata.forEach(function (oneevent) {
			
			if ( oneevent && oneevent.startDate && oneevent.summary ) {
				// create our standard event 
				stdevent = createeventobj(CALTYPE,oneevent);
				
				if ( stdevent.isvalid) {

					// if its for today, save it so we can sort it
					if ( stdevent.istoday) {
						console.log("is a today event");
						aEventTimes.push(stdevent.sortkey);
						cTodaysEvents[stdevent.sortkey] = stdevent;
					} 
					else if ( stdevent.eventdatenotime > todayDate && stdevent.eventdatenotime < nextmeetingdate ) {
						// closer day to today with events they we previously had. keep it
						nextmeetingdate = stdevent.eventdatenotime;
					}

				} else {
					console.log("event entry NOT valid:");
					console.log(util.inspect(oneevent, {showHidden: false, depth: null}));
				} 
			}

		}); // foreachevent

		// if we have events from today, sort them and give them back as decent engrish
		if ( aEventTimes.length > 0 ) {

			aEventTimes.sort( function(a,b) { 
				if (a > b) {
					return 1;
				} else if (b > a) {
					return -1;
				} else {
					return 0;
				}
			});
			
			// build our response table for each event. Remember Flash Briefings do NOT support SSML! 
			// Plain text only!
			let cnt = 1;
			let lasteventdate = {};

			aEventTimes.forEach(function (t) {
				let oneevt = cTodaysEvents[t];
				// console.log(util.inspect(oneevt, {showHidden: false, depth: null}));
				if ( lasteventdate ==  oneevt.eventdate.format('hh:mm A') ) {
					eventresponse += "Also at ";
				} else if ( cnt > 1 && cnt == aEventTimes.length ) {
					eventresponse += "Finally, at "
				} else {
					eventresponse += "At ";
				}
				eventresponse += oneevt.eventdate.format('hh:mm A') + ", the " + oneevt.summary + " meets. ";
				cnt += 1;
				lasteventdate = oneevt.eventdate.format('hh:mm A')
			});
		}

		responsetext = INTRO + "For today, " + todayDate.format("dddd, MMMM Do, YYYY") + " there ";

		if ( eventresponse == "" ) {
			// no meetings fine the next day of meetings after today
			responsetext += " are no meetings. The next day with meetings is " + nextmeetingdate.format("dddd, MMMM Do, YYYY");
		} else {
			if ( aEventTimes.length == 1) {
				responsetext += " is one meeting.";
			} else { 
				responsetext += " are " + aEventTimes.length.toString() + " meetings. ";
			}
			responsetext += eventresponse;
		}

		const jsonDate = todayDate.toJSON();

		const response = {
			statusCode: 200,
			body: JSON.stringify({
				uid: uuid.v4(),
				updateDate: jsonDate,
				titleText: SKILLTITLE,
				mainText: responsetext
			})
		};

		callback(null, response);
	});   
};
