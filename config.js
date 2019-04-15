
/*
 * --------------------------------------------------------
 * Calendar2Voice 
 * 
 * Data array.  To add a new flash briefing:
 *  1. Add the desired calendar information here
 *  2. Push to AWS
 *  3. Clone an existing fash briefing and change the API to
 *     be passed the name of the new calendar
 * --------------------------------------------------------
 */

var calendars = [
        {
            "calendarName": "cityofhamptonvirginia",
            "calendarEventType": "meeting",
            "calendarType": "icalendar",
            "ICSUrl": "http://hampton.gov/common/modules/iCalendar/iCalendar.aspx?catID=86&feed=calendar",
            "inTimezone": "America/New_York",
            "introText": "Public meetings    ",
            "skillTitle": "Hampton Virginia Public Meetings",
            "windowDays": 30
          },
          {
            "calendarName": "cityofnewportnewsvirginia",
            "calendarEventType": "meeting",
            "calendarType": "icalendar",
            "ICSUrl": "http://www.nnva.gov/common/modules/iCalendar/iCalendar.aspx?catID=34&feed=calendar",
            "inTimezone": "America/New_York",
            "introText": "Public meetings  ",
            "skillTitle": "Newport News Virginia Public Meetings",
            "windowDays": 30
          },
          {
            "calendarName": "cityofnorfolkvirginia",
            "calendarEventType": "meeting",
            "calendarType": "icalendar",
            "ICSUrl": "http://www.norfolk.gov/common/modules/iCalendar/iCalendar.aspx?catID=73&feed=calendar",
            "inTimezone": "America/New_York",
            "introText": "City Council meetings  ",
            "skillTitle": "Norfolk Virginia City Council Meetings",
            "windowDays": 30
          },
          {
            "calendarName": "cityofportsmouthvirginia",
            "calendarEventType": "meeting",
            "calendarType": "icalendar",
            "ICSUrl": "http://www.portsmouthva.gov/common/modules/iCalendar/iCalendar.aspx?catID=14&feed=calendar",
            "inTimezone": "America/New_York",
            "introText": "Public meetings ",
            "skillTitle": "Portsmouth Virginia Public Meetings",
            "windowDays": 30
          },
          {
            "calendarName": "cityofvirginiabeachvirginia",
            "calendarEventType": "meeting",
            "calendarType": "icalendar",
            "ICSUrl": "https://calendar.google.com/calendar/ical/codeforamerica.org_25s5sf8i4kkgdd3u7m6bnmsli0%40group.calendar.google.com/public/basic.ics",
            "inTimezone": "America/New_York",
            "introText": "Public meetings ",
            "skillTitle": "Virginia Beach Virginia Public Meetings",
            "windowDays": 30
          },
          {
            "calendarName": "hamptonroadsplanningdistrictcommission",
            "calendarEventType": "event",
            "calendarType": "icalendar",
            "ICSUrl": "http://www.hrpdcva.gov/events/index/export/type/save",
            "inTimezone": "America/New_York",
            "introText": "Here are the Hampton Roads Planning District Commission events",
            "skillTitle": "Hampton Roads Planning District Commission Events",
            "windowDays": 30
          },
          {
            "calendarName": "startwheelhr",
            "calendarEventType": "event",
            "calendarType": "icalendar",
            "ICSUrl": "https://startwheel.org/events/?ical=1&tribe_display=month",
            "inTimezone": "America/New_York",
            "introText": "Business events in Hampton Roads ",
            "skillTitle": "StartWheel Hampton Roads",
            "windowDays": 30
          }
    ];

module.exports = {
    calendars
}