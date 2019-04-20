/*
 * --------------------------------------------------------
 *
 * --------------------------------------------------------
 */

/* eslint-disable no-underscore-dangle */
// eslint-disable-next-line no-unused-vars
const { DateTime } = require("luxon");
var moment = require('moment-timezone');

// eslint-disable-next-line no-unused-vars
const util = require('util');

const request = require('request');

module.exports = class Calendar {
    constructor() {

        this._isvalid = false;
        this._selectedcalendar = "";
        this._skilltitle = "";
        this._intimezone = 'America/New_York';
        this._icsurl = "";
        this._introtext = "";
        this._windowdays = 30;
        this._calendartype = 'icalendar';
        this._calendareventtype = 'event'; 
            
        this._invokedDate = "";
        this._todayDate = "";
        this._endWindowDate = "";
        this._nextmeetingdate = {};

        this._icsdata = {};
    }

    set isvalid(isvalid) {
        this._isvalid = isvalid;
    }

    get isvalid() {
        return this._isvalid;
    }

    set nextmeetingdate(nextmeetingdate) {
        this._nextmeetingdate = nextmeetingdate;
    }

    get nextmeetingdate() {
        return this._nextmeetingdate;
    }

    set invokedDate(invokedDate) {
        this._invokedDate = invokedDate;
    }

    get invokedDate() {
        return this._invokedDate;
    }

    set todayDate(todayDate) {
        this._todayDate = todayDate;
    }

    get todayDate() {
        return this._todayDate;
    }

    set endWindowDate(endWindowDate) {
        this._endWindowDate = endWindowDate;
    }

    get endWindowDate() {
        return this._endWindowDate;
    }

    set selectedcalendar(selectedcalendars) {
        this._selectedcalendar = selectedcalendars.toLowerCase();
    }

    get selectedcalendar() {
        return this._selectedcalendar;
    }

    set skilltitle(skilltitle) {
        this._skilltitle = skilltitle;
    }

    get skilltitle() {
        return this._skilltitle;
    }

    set intimezone(intimezone) {
        this._intimezone = intimezone;
    }

    get intimezone() {
        return this._intimezone;
    }

    set icsurl(icsurl) {
        this._icsurl = icsurl;
    }

    get icsurl() {
        return this._icsurl;
    }

    set introtext(introtext) {
        this._introtext = introtext;
    }

    get introtext() {
        return this._introtext;
    }

    set windowdays(windowdays) {
        this._windowdays = windowdays;
    }

    get windowdays() {
        return this._windowdays;
    }

    set calendartype(calendartype) {
        this._calendartype = calendartype;
    }

    get calendartype() {
        return this._calendartype;
    }

    set calendareventtype(calendareventtype) {
        this._calendareventtype = calendareventtype;
    }

    get calendareventtype() {
        return this._calendareventtype;
    }

    set icsdata(icsdata) {
        this._icsdata = icsdata;
    }

    get icsdata() {
        return this._icsdata;
    }

    load (jsondata) {
        try {
            this.skilltitle = jsondata.skillTitle;
            this.intimezone = jsondata.inTimezone;
            this.icsurl = jsondata.ICSUrl;
            this.introtext = jsondata.introText;
            this.windowdays = jsondata.windowDays;
            this.calendartype = jsondata.calendarType;
            this.calendareventtype = jsondata.calendarEventType;

            // if we have a timezone we need to reset today to reflect the new timezone.
            // due to midnight rollover.  we won't worry about the endwindow date for now
            if ( this.icsurl.length > 0 ) {
                moment.tz.setDefault(this.intimezone);
                this.todayDate = ( this.invokedDate > '') ? moment.tz(this.invokedDate,this.intimezone) : moment.tz(this.intimezone);
                this.todayDate.startOf('day');
            }

            this.endWindowDate = this.todayDate.clone();
            this.endWindowDate.add(this.windowdays,'days');
            this.endWindowDate.startOf('day');

            this.nextmeetingdate = this.endWindowDate.clone();

            this.isvalid = true;

        }
        catch (e) {
            console.log("Unable to load calendar from definition:", e);
        }

        console.log(util.inspect(this, {showHidden: false, depth: null}));

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
    getICSdata() {
	
        return new Promise((resolve,reject) => {
            request.get(this.icsurl, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    let ical = body;
                    resolve(ical);
                } else {
                    console.log("request.get failed", error);
                    console.log(util.inspect(response, {showHidden: false, depth: null}));
                    reject("Error getting ICS");
                }
            });

        });
    }
}
