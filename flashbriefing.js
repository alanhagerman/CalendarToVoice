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
var SELECTEDCALENDAR = "";
var SKILLTITLE = "";
var TIMEZONELIT = 'America/New_York';
var ICSURL = "";
var INTRO = "";
var WINDOWDAYS = 30;
var CALTYPE = 'icalendar';
var CALEVENTTYPE = 'event';  // used to tailor response phrasing.  event or meeting

var invokedDate = "";
var todayDate = "";
var endWindowDate = ""

// calendar types we support
const CALTYPEICAL = 'icalendar';

// text we build up of each event to later return to Alexa
var responsetext = "";
var eventresponse = "";
var responseJSON = "";
var eventarray = [];

// while looping through event snag the next day in future with events in case its needed
var nextmeetingdate = {};

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

		case "startwheelhr":
			SKILLTITLE = 'StartWheel Hampton Roads';
			TIMEZONELIT = 'America/New_York';
			ICSURL = 'https://startwheel.org/events/?ical=1&tribe_display=month';
			INTRO = "Business events in Hampton Roads ";
			WINDOWDAYS = 30;
			CALTYPE = 'icalendar';
			CALEVENTTYPE = 'event';
			break;

		case "cityofnorfolk":
			SKILLTITLE = 'Norfolk Public Meetings';
			TIMEZONELIT = 'America/New_York';
			ICSURL = 'http://www.norfolk.gov/common/modules/iCalendar/iCalendar.aspx?catID=25&feed=calendar';
			INTRO = "Public meetings for the City of Norfolk. "
			WINDOWDAYS = 30;
			CALTYPE = 'icalendar';
			CALEVENTTYPE = 'meeting';
			break;

		case "cityofvb":
		default:
			SKILLTITLE = 'Virginia Beach Public Meetings';
			TIMEZONELIT = 'America/New_York';
			ICSURL = 'https://calendar.google.com/calendar/ical/codeforamerica.org_25s5sf8i4kkgdd3u7m6bnmsli0%40group.calendar.google.com/public/basic.ics';
			INTRO = "Public meetings for the City of Virginia Beach. "
			WINDOWDAYS = 30;
			CALTYPE = 'icalendar';
			CALEVENTTYPE = 'meeting';
	}

	moment.tz.setDefault(TIMEZONELIT);
	todayDate = ( invokedDate > '') ? moment.tz(invokedDate,TIMEZONELIT) : moment.tz(TIMEZONELIT);
	todayDate.startOf('day');
}

/*
 * --------------------------------------------------------
 * function: eventTimeQualifier
 * purpose: if start date is today OR if start date < today but end date is today or later
 * --------------------------------------------------------
 */

const EVENTISPAST = 1
const EVENTISFUTURE = 2
const EVENTSTARTSTODAY = 3
const EVENTENDSTODAY = 4
const EVENTSPANSTODAY = 5

function eventTimeQualifier(startmomentobj,endmomentobj) {

	var endDiffinDays, startDiffinDays;

	var startNoTime = startmomentobj.clone();
	var endNoTime = endmomentobj.clone();

	try {
		// no time  is considered for this
		startNoTime.startOf('day');
		startDiffinDays = startNoTime.diff(todayDate,'days');

		endNoTime.startOf('day');
		endDiffinDays = endNoTime.diff(todayDate,'days');
	}
	// eslint-disable-next-line no-catch-shadow
	catch (e) {
		startDiffinDays = -1;
		endDiffinDays = -1;
		console.log("Diff error:", e);
	}
	// console.log("Diff in days is:" + startDiffinDays  + " and end:" + endDiffinDays + " with today:" + todayDate.format());

	if ( startDiffinDays > 0 ) {
		return EVENTISFUTURE;
	} else if ( startDiffinDays < 0 && endDiffinDays < 0 ) {
		return EVENTISPAST;
	} else if ( startDiffinDays == 0 ) {
		if ( startmomentobj.hour() == 0 && startmomentobj.minute() < 5 && 
			(  (endmomentobj.hour() == 23 && endmomentobj.minute() > 54 ) || endDiffinDays > 0 ) ) {
			return EVENTSPANSTODAY;
		} else {
			return EVENTSTARTSTODAY;  // all same day events that start today actually
		}
	} else if ( startDiffinDays < 0 &&  endDiffinDays == 0  ) {
		return EVENTENDSTODAY;
	} else if ( startDiffinDays < 0 &&  endDiffinDays > 0 ) {
		return EVENTSPANSTODAY;
	}

	// have no clue
	return 0;
}

/*
 * --------------------------------------------------------
 * function: returnNextEventDateFromRule
 * purpose: return the calculated eventStartdate - either the
 *    date from the ical event or one based on the icaleventStartdate
 *    and the rule
 * --------------------------------------------------------
 */
function returnNextEventDateFromRule(usedate,evtjson) {

	var eRule = {};
	var retDate = usedate;
	var ltime = {};

	if (evtjson.rrule) {

		// var userule = "DTSTART:" + usedate + "\ntzid:" + TIMEZONELIT + "\nRRULE:" + evtjson.rrule;
		var userule = "DTSTART;TZID=" + TIMEZONELIT + ":" + usedate + "\nRRULE:" + evtjson.rrule;
		// console.log("Event Rule being processed:" + userule);

		try {
			eRule = rrule.rrulestr(userule);
			let aeventStartdates = eRule.between(todayDate.toDate(), endWindowDate.toDate());

			// eRUle always returns UTC times so we need to maybe convert depending on the source

			if ( aeventStartdates.length > 0 ) {
				retDate = aeventStartdates[0].toString();

				// if the original date ended in Z then its a UTC Date, otherwise its local
				if ( ! usedate.endsWith('Z') ) {
					// original time was NOT UTC, Need to convert to local time
					ltime = moment.utc(retDate).tz(TIMEZONELIT);
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
		// console.log("Converted usedate:" + usedate + " to moment:" + retDate + " without rule")
	}

	// console.log("Setting event date based on rule to:",retDate);
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
 * occurence of the event within that window becomes the eventStartdate.
 * 
 *	we also need the DTEND to calculate the length of the event since it could
 * span hours or days.  DTEND is NOT required. The spec says if the DTSTART is a date only
 * the the default DTEND is 1 day later. if the DTSTART has a time component,  the DTEND 
 * default is the exact same time
 * 
 * if we have a single event (no RRULE) we have a dtstart and dtend easy peasy
 * if we have an RRULE, we need to get the next event date based on the rrule that is 
 * today or later and then we need to calculate the end date for that next event based
 * on the relationshp from the original start/end dates 
 * --------------------------------------------------------
 */
function fmt_icalendar(calobj, evtjson) {
	
	var retobj = calobj;
	var evtEnd, evtLength, evtQualifier, evtStart, lrule, momentNextEndDate, momentNextStartDate, nexteventStartdate;

	// need the evtjosn AND we need a summmary which describes the event otherwise skip it
	if ( !evtjson || !evtjson.summary) {
		console.log("Invalid event to format)");
		return retobj; 
	}

	if ( evtjson.startDate && ( moment(evtjson.startDate,'YYYYMMDDTHHmmss').isValid() || moment(evtjson.startDate,'YYYYMMDD').isValid() ) ) {
		evtStart = moment.tz(evtjson.startDate,'YYYYMMDDTHHmmss',TIMEZONELIT);
		
	} else {
		console.log("Invalid start date");
		return retobj; 
	}

	try {

		if ( evtjson.endDate && moment(evtjson.endDate,'YYYYMMDDTHHmmss').isValid() ) {
			evtEnd =  moment.tz(evtjson.endDate,'YYYYMMDDTHHmmss',TIMEZONELIT);
		} else {
			// no enddate.  
			evtEnd = evtStart.clone();
			// eslint-disable-next-line no-warning-comments
			// TODO: if we have a duration, calculate it

			// otherwise Spec says if startdate is dateonly duration is 1 day otherwise 0 days
			if ( ! moment(evtjson.startDate,'YYYYMMDDTHHmmss').isValid() ) {
				evtEnd.add(1,'day');
			}
		}

		// calculate the length
		evtLength = evtEnd.diff(evtStart,'minutes');

		// usedate = evtjson.startDate;
		console.log("createevent start:" + evtStart.format() + ",  end:" + evtEnd.format() + ", summary=" + evtjson.summary);

		// eslint-disable-next-line no-warning-comments
		// TODO: possible bug, can we have a recurring rule on a multi-day event that results in a new event that spans today
		// at the moment we filter to today or later on the rule generated dates so we might miss it
		if ( evtjson.rrule ) {
			nexteventStartdate = returnNextEventDateFromRule(evtjson.startDate,evtjson);
			lrule = evtjson.rrule;
			momentNextStartDate =  moment.tz(nexteventStartdate,'YYYY-MM-DDTHHmmss',TIMEZONELIT);
			momentNextEndDate =  momentNextStartDate.add(evtLength,'minutes');
			evtQualifier = eventTimeQualifier(momentNextStartDate,momentNextEndDate);
		} else {
			// no recurring rule so check to see if it spans today
			evtQualifier = eventTimeQualifier(evtStart,evtEnd);
			lrule = "";
			if ( evtQualifier == EVENTSTARTSTODAY || evtQualifier == EVENTISPAST || evtQualifier == EVENTISFUTURE ) {
				momentNextStartDate = evtStart.clone();
			} else {
				// must span or end today so it started at midnight
				momentNextStartDate = todayDate; 
			}
			momentNextEndDate = evtEnd;
		}

		let uidtouse = uuid.v4();
		let sortkey = momentNextStartDate.format('HH:mm') + ":" + evtjson.summary + ":" + uidtouse;

		// set the object
		try {
			retobj.summary = evtjson.summary;
			retobj.qualifier = evtQualifier;
			retobj.isvalid = true;
			retobj.uid = uidtouse;
			retobj.rrule = lrule;
			retobj.eventStart = evtStart;
			retobj.eventEnd = evtEnd;
			retobj.nextStart = momentNextStartDate;
			retobj.nextEnd = momentNextEndDate;
			retobj.sortkey = sortkey;
		}
		catch (e) {
			console.log("Error setting object:",e)
		}
	}
	catch(e) {
		console.log("error in object creation:",e);
	}
	
	// console.log("returning object");
	console.log(util.inspect(retobj, {showHidden: false, depth: null}));

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
		summary:"",
		qualifier:0,
		isvalid:false,
		uid:"",
		rrule:"",
		eventStart:"",
		eventEnd:"",
		nextStart:"",
		nextEnd:"",
		sortkey:"",
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
function getICS(fromurl) {
	
	var request = require('request');

	return new Promise((resolve,reject) => {
		console.log ("Getting ICS");

		request.get(fromurl, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				var iCal = body;
				resolve(iCal);
			} else {
				console.log("request.get failed", error);
				console.log(util.inspect(response, {showHidden: false, depth: null}));
				reject("Error getting ICS");
			}
		});

	});
}

/*
 * --------------------------------------------------------
 * function: createReturn
 * purpose: creates standard JSON return
 * --------------------------------------------------------
 */
function createReturn(stscode,responsetext) {
	
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

	return response;
}

/*
 * --------------------------------------------------------
 * function: select_todays_events
 * purpose: select onlyt standard event objects for today
 * --------------------------------------------------------
 */
function select_todays_events(jdata) {

	let arTodaysEvents = [];
	let stdevent = {};

	try {
		// look at each event.  Pull out ones for today AND save the next day that events
		// occur just incase we need it since we're going through them all anyway
		jdata.forEach(function (oneevent) {
				
			if ( oneevent && oneevent.startDate && oneevent.summary ) {
				
				// create our standard event 
				stdevent = createeventobj(CALTYPE,oneevent); 

				if ( stdevent.isvalid) {
					console.log("valid event. nextStart date:" + stdevent.nextStart.format() + " for qualifier:" + stdevent.qualifier );

					// if its for today, save it so we can sort it
					if ( stdevent.qualifier ==  EVENTSTARTSTODAY  || stdevent.qualifier ==  EVENTENDSTODAY || stdevent.qualifier ==  EVENTSPANSTODAY ) {
						arTodaysEvents.push(stdevent);
					} 

					// wasnt a today event to be reported, is it a future date? If so is it closer than any other we've seen so far?
					// nextmeetingdate is GLOBAL and was set based on the window we use for this calendar already
					if (  stdevent.qualifier ==  EVENTISFUTURE ) {
						let diffToday = nextmeetingdate.diff(todayDate,'days');
						let diffevent = nextmeetingdate.diff(stdevent.nextStart,'days' );
						if ( diffevent < diffToday && diffevent > 0 ) {
							nextmeetingdate = stdevent.nextStart.clone();
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
 * 
 * Pick only the events that start/span/end on today to sort for reading back
 *
 * --------------------------------------------------------
 */
function process_events(eventarray) {

	let retmessage = "";

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

			if ( oneevt.qualifier == EVENTSPANSTODAY ) {
				retmessage += "All day ";
				retmessage += ( oneevt.evtEnd == todayDate ) ? " until " + oneevt.evtEnd.format('hh:mm A') : "";
				retmessage += " is " + oneevt.summary + " ";
			} else {
				retmessage +=  ( cnt > 1 && cnt == eventarray.length ) ?	"Finally, " : "";
				retmessage +=  ( lasteventStartdate == oneevt.eventStart.format('hh:mm A') ) ? "Also at " : "At ";

				if (oneevt.eventStart.hour() == 0 && oneevt.eventStart.minute() == 0) {
					retmessage += " midnight ";
				} else if (oneevt.eventStart.hour() == 12 && oneevt.eventStart.minute() == 0) {
					retmessage += " noon ";
				} else {
					retmessage += oneevt.eventStart.format('hh:mm A');
				}
			
				retmessage +=  ( CALEVENTTYPE == 'meeting') ? ", the " + oneevt.summary + " meets. " : ", is " + oneevt.summary + ". ";

			}
			cnt += 1;
			if ( oneevt.qualifier != EVENTSPANSTODAY ) {
				lasteventStartdate = oneevt.eventStart.format('hh:mm A')
			}
		});
	}

	return retmessage;

}

/*
 * --------------------------------------------------------
 * function: init
 * purpose: grab passed params and init items
 * 
 * This is mostly needed for testing since AWS node caches
 * and you end up with values loaded from previous runs
 * --------------------------------------------------------
 */
function init(event) {

	const evtpointer = ( event && event.queryStringParameters ) ?  event.queryStringParameters : event;

	responsetext = "";
	eventresponse = "";
	responseJSON = "";
	nextmeetingdate = {};
	invokedDate = "";
	SELECTEDCALENDAR = "";
	SELECTEDCALENDAR = "";
	SKILLTITLE = "";
	TIMEZONELIT = 'America/New_York';
	ICSURL = "";
	INTRO = "";
	WINDOWDAYS = 30;
	CALTYPE = 'icalendar';
	CALEVENTTYPE = 'event';

	// for testing, see if we got a 'fordate off the API invocation
	if ( evtpointer.fordate && evtpointer.fordate > '' && moment(evtpointer.fordate,'YYYY-MM-DD').isValid() ) {
		
		invokedDate = evtpointer.fordate;
	
		todayDate = moment.tz(evtpointer.fordate,TIMEZONELIT);
		todayDate.startOf('day');
		
		endWindowDate = moment.tz(evtpointer.fordate,TIMEZONELIT);
		endWindowDate.add(WINDOWDAYS,'days');
		endWindowDate.startOf('day');

	} else {
		// default to the actual today date
		todayDate = moment.tz(TIMEZONELIT);
		endWindowDate = todayDate.clone();
		endWindowDate.add(WINDOWDAYS,'days');
	}

	// set to midnight for both
	todayDate.startOf('day');
	endWindowDate.startOf('day');

	// grab the desired calendar off the api
	if ( evtpointer.forcalendar  && evtpointer.forcalendar > '' ) {
		SELECTEDCALENDAR = evtpointer.forcalendar;
	} 

	if ( TIMEZONELIT.length > 0 ) {
		moment.tz.setDefault(TIMEZONELIT);
	}

	// default it for the loop
	nextmeetingdate = endWindowDate;

	console.log("INIT todayDate:" + todayDate.format() + " , endWindowDate:" + endWindowDate.format() + ", timezone:" + TIMEZONELIT + ", for calendar:" + SELECTEDCALENDAR);

}

/*
 * --------------------------------------------------------
 * function: main function
 * purpose: 
 * --------------------------------------------------------
 */
exports.calendar2voice = function(event, context, callback) {

	// log for testing sake
	console.log(util.inspect(event, {showHidden: false, depth: null}));

	init(event);

	responseJSON = createReturn(200,'The requested calendar is not available');

	switch ( SELECTEDCALENDAR.toLowerCase() ) {
		case "cityofvb":
			setupcalendar(SELECTEDCALENDAR);
			break;
		
		case "startwheelhr":
			setupcalendar(SELECTEDCALENDAR);
			break;

		default:
			// eslint-disable-next-line callback-return
			callback(null, responseJSON);
			return;

	}

	// get the ICS via a promise so that we do not process without one
	getICS(ICSURL).then( (caldata)  =>  {

		try {
			const jdata = ics2json.icsToJson(caldata);
			eventarray = select_todays_events(jdata);
			eventresponse = process_events(eventarray);
		}
		catch (e) {
			eventresponse = "";
		}
	
		responsetext = INTRO + "For today, " + todayDate.format("dddd, MMMM Do, YYYY") + ". There ";

		if ( eventresponse == "" ) {
			// no meetings fine the next day of meetings after today
			responsetext += " are no ";
			responsetext += ( CALEVENTTYPE == 'meeting') ? 'meetings' : 'events';
			responsetext +=  ". The next day with ";
			responsetext += ( CALEVENTTYPE == 'meeting') ? 'meetings' : 'events';
			responsetext += " is " + nextmeetingdate.format("dddd, MMMM Do, YYYY");
		} else {
			if ( eventarray.length == 1) {
				responsetext += ( CALEVENTTYPE == 'meeting') ? " is one meeting." : " is one event.";
			} else { 
				responsetext += " are " + eventarray.length.toString();
				responsetext += ( CALEVENTTYPE == 'meeting') ? " meetings. " : " events. ";
			}
			responsetext += eventresponse;
		}

		responseJSON = createReturn(200,responsetext);

		callback(null, responseJSON);
	});   
};
