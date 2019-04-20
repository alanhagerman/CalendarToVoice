/* eslint-disable no-underscore-dangle */
/* eslint-disable class-methods-use-this */
/*
 * --------------------------------------------------------
 *
 * --------------------------------------------------------
 */

 // this module is used internally by the moment timeszone
// eslint-disable-next-line no-unused-vars  
const { DateTime } = require("luxon");
var moment = require('moment-timezone');
const uuid = require('uuid');
const rrule = require('rrule');

// eslint-disable-next-line no-unused-vars
const util = require('util');

module.exports = class Event {
    constructor() {

        this._isvalid = false;

        this._summary = "";
        this._qualifier = 0;
        this._uid = "";
        this._rrule = "";
        this._eventStart = "";
        this._eventEnd = "";
        this._eventlength = 0;
        this._nextStart = "";
        this._nextEnd = "";
        this._sortkey = "";
                    
        this._EVENTISPAST = 1
        this._EVENTISFUTURE = 2
        this._EVENTSTARTSTODAY = 3
        this._EVENTENDSTODAY = 4
        this._EVENTSPANSTODAY = 5
    }

    get EVENTISPAST () {
        return this._EVENTISPAST;
    }  

    get EVENTISFUTURE () {
        return this._EVENTISFUTURE;
    }  

    get EVENTSTARTSTODAY () {
        return this._EVENTSTARTSTODAY;
    }  

    get EVENTENDSTODAY () {
        return this._EVENTENDSTODAY;
    }  

    get EVENTSPANSTODAY () {
        return this._EVENTSPANSTODAY;
    }  

    set summary(summary) {
        this._summary = summary;
    }

    get summary() {
        return this._summary;
    }

    set qualifier(qualifier) {
        this._qualifier = qualifier;
    }

    get qualifier() {
        return this._qualifier;
    }

    set isvalid(isvalid) {
        this._isvalid = isvalid;
    }

    get isvalid() {
        return this._isvalid;
    }

    set uid(uid) {
        this._uid = uid;
    }

    get uid() {
        return this._uid;
    }

    set rrule(rrule) {
        this._rrule = rrule;
    }

    get rrule() {
        return this._rrule;
    }

    set eventStart(eventStart) {
        this._eventStart = eventStart;
    }

    get eventStart() {
        return this._eventStart;
    }

    set eventEnd(eventEnd) {
        this._eventEnd = eventEnd;
    }

    get eventEnd() {
        return this._eventEnd;
    }

    set nextStart(nextStart) {
        this._nextStart = nextStart;
    }

    get nextStart() {
        return this._nextStart;
    }

    set nextEnd(nextEnd) {
        this._nextEnd = nextEnd;
    }

    get nextEnd() {
        return this._nextEnd;
    }

    set sortkey(sortkey) {
        this._sortkey = sortkey;
    }

    get sortkey() {
        return this._sortkey;
    }

    setcleansummary(calobj, summarytext) {

        console.log("start text:" + summarytext);
        // need to clean the summary to keep alexa speaking ok.  for some special characters we replace
        // with the english word. whats left should just be letters, digts, comma, colon, semi-colon, space, quote since flash briefings
        // have to be plain text.

        try {
            let pat757 = /([0-9]{3})( |-|\.)*([a-zA-Z])/ug;

            this.summary = summarytext.replace("&"," and ");
            console.log("summary1:" + this.summary);

            this.summary = this.summary.replace(/\//gu,' and ');
            console.log("summary2:" + this.summary);
            
            if (calobj.selectedcalendar == "startwheelhr") {
                // in startwheel, we have a number of 757Angels and 757this or 757that
                // for these we want it talked out not treated as sevenhundredfiftyseven
                if ( this.summary.match(pat757) ) {
                    this.summary = this.summary.replace(/757/gu,' seven five seven ');
                    console.log("summary3:" + this.summary);

                }
            }
           this.summary  = this.summary.replace(/([^A-Za-z0-9,'.:;$% ]+)/giu, '');
           console.log("summary4:" + this.summary);

        }
        catch (e) {
            console.log("Unable toload summary:",e);
        }
    }

    /*
    * --------------------------------------------------------
    * function: eventTimeQualifier
    * purpose: if start date is today OR if start date < today but end date is today or later
    * --------------------------------------------------------
    */
    eventTimeQualifier(calobj,startmomentobj,endmomentobj) {

        var endDiffinDays, startDiffinDays;

        var startNoTime = startmomentobj.clone();
        var endNoTime = endmomentobj.clone();

        try {
            // no time  is considered for this
            startNoTime.startOf('day');
            startDiffinDays = startNoTime.diff(calobj.todayDate,'days');

            endNoTime.startOf('day');
            endDiffinDays = endNoTime.diff(calobj.todayDate,'days');
        }
        // eslint-disable-next-line no-catch-shadow
        catch (e) {
            startDiffinDays = -1;
            endDiffinDays = -1;
            console.log("Diff error:", e);
        }
        // console.log("Diff in days is:" + startDiffinDays  + " and end:" + endDiffinDays + " with today:" + todayDate.format());

        if ( startDiffinDays > 0 ) {
            return this.EVENTISFUTURE;
        } else if ( startDiffinDays < 0 && endDiffinDays < 0 ) {
            return this.EVENTISPAST;
        } else if ( startDiffinDays == 0 ) {
            if ( startmomentobj.hour() == 0 && startmomentobj.minute() < 5 && 
                (  (endmomentobj.hour() == 23 && endmomentobj.minute() > 54 ) || endDiffinDays > 0 ) ) {
                return this.EVENTSPANSTODAY;
            } else {
                return this.EVENTSTARTSTODAY;  // all same day events that start today actually
            }
        } else if ( startDiffinDays < 0 &&  endDiffinDays == 0  ) {
            return this.EVENTENDSTODAY;
        } else if ( startDiffinDays < 0 &&  endDiffinDays > 0 ) {
            return this.EVENTSPANSTODAY;
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
    returnNextEventDateFromRule(calobj,usedate,evtjson,) {

        var eRule = {};
        var retDate = usedate;
        var ltime = {};

        if (evtjson.rrule) {

            // var userule = "DTSTART:" + usedate + "\ntzid:" + intimezone + "\nRRULE:" + evtjson.rrule;
            var userule = "DTSTART;TZID=" + calobj.intimezone + ":" + usedate + "\nRRULE:" + evtjson.rrule;
            // console.log("Event Rule being processed:" + userule);

            try {
                eRule = rrule.rrulestr(userule);
                let aeventStartdates = eRule.between(calobj.todayDate.toDate(), calobj.endWindowDate.toDate());

                // eRUle always returns UTC times so we need to maybe convert depending on the source

                if ( aeventStartdates.length > 0 ) {
                    retDate = aeventStartdates[0].toString();

                    // if the original date ended in Z then its a UTC Date, otherwise its local
                    if ( ! usedate.endsWith('Z') ) {
                        // original time was NOT UTC, Need to convert to local time
                        ltime = moment.utc(retDate).tz(calobj.intimezone);
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

    // remember isvalid is false to start
    fmt_icalendar (calobj, evtjson) {
    
        console.log(util.inspect(calobj, {showHidden: false, depth: null}));

        console.log(util.inspect(evtjson, {showHidden: false, depth: null}));

        // var retobj = calobj;
        var evtQualifier, lrule, momentNextEndDate, momentNextStartDate, nexteventStartdate;

        // need the evtjosn AND we need a summmary which describes the event otherwise skip it
        try {
            if ( !evtjson || !evtjson.summary) {
                console.log("Invalid event to format)");
                return; 
            }
    
            if ( evtjson.startDate && ( moment(evtjson.startDate,'YYYYMMDDTHHmmss').isValid() || moment(evtjson.startDate,'YYYYMMDD').isValid() ) ) {
                this.eventStart = moment.tz(evtjson.startDate,calobj.intimezone);
            } else {
                console.log("Invalid start date");
                return; 
            }

            if ( evtjson.endDate && moment(evtjson.endDate,'YYYYMMDDTHHmmss').isValid() ) {
                this.eventEnd =  moment.tz(evtjson.endDate,calobj.intimezone);
            } else {
                // no enddate.  
                this.eventEnd = this.eventStart.clone();
                // eslint-disable-next-line no-warning-comments
                // TODO: if we have a duration, calculate it

                // otherwise Spec says if startdate is dateonly duration is 1 day otherwise 0 days
                if ( ! moment(evtjson.startDate,'YYYYMMDDTHHmmss').isValid() ) {
                    this.eventEnd.add(1,'day');
                }
            }

            // calculate the length
            this.eventlength = this.eventEnd.diff(this.eventStart,'minutes');

            this.setcleansummary(calobj, evtjson.summary);
            
            // usedate = evtjson.startDate;
            console.log("createevent start:" + this.eventStart.format() + ",  end:" + this.eventEnd.format() + ", summary=" + this.summary);

            // eslint-disable-next-line no-warning-comments
            // TODO: possible bug, can we have a recurring rule on a multi-day event that results in a new event that spans today
            // at the moment we filter to today or later on the rule generated dates so we might miss it
            if ( evtjson.rrule ) {
                nexteventStartdate = this.returnNextEventDateFromRule(calobj, evtjson.startDate,evtjson);
                lrule = evtjson.rrule;
                momentNextStartDate =  moment.tz(nexteventStartdate,'YYYY-MM-DDTHHmmss',calobj.intimezone);
                momentNextEndDate =  momentNextStartDate.add(this.eventlength,'minutes');
                evtQualifier = this.eventTimeQualifier(calobj, momentNextStartDate,momentNextEndDate);
            } else {
                // no recurring rule so check to see if it spans today
                evtQualifier = this.eventTimeQualifier(calobj, this.eventStart,this.eventEnd);
                lrule = "";
                if ( evtQualifier == this.EVENTSTARTSTODAY || evtQualifier == this.EVENTISPAST || evtQualifier == this.EVENTISFUTURE ) {
                    momentNextStartDate = this.eventStart.clone();
                } else {
                    // must span or end today so it started at midnight
                    momentNextStartDate = calobj.todayDate; 
                }
                momentNextEndDate = this.eventEnd;
            }

            let uidtouse = uuid.v4();
            //let sortkey = momentNextStartDate.format('HH:mm') + ":" + summary + ":" + uidtouse;
            let sortkey = this.eventStart.format('HH:mm') + ":" + this.summary + ":" + uidtouse;

            this.qualifier = evtQualifier;
            this.uid = uidtouse;
            this.rrule = lrule;
            this.nextStart = momentNextStartDate;
            this.nextEnd = momentNextEndDate;
            this.sortkey = sortkey;

            this.isvalid = true;

        }
        catch(e) {
            console.log("error in object creation:",e);
        }
        
    }

    load (calendar,oneevent) {

        switch (calendar.calendartype) {
			
            case 'icalendar':
                this.fmt_icalendar(calendar,oneevent);
        }

    }
}
