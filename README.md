# CalendarToVoice

Copyright (c) 2019, Alan Hagerman
All rights reserved.
Released Under the BSD-3 Clause.
See License.txt


An Alexa Flash briefing skill published via Serverless Framework (serverless.com) that converts events from an icalendar .ICS into a spoken calendar for today.  

To Add a new calendar:
1. Define the calendar in config.js
2. Deploy your serverless code which also creates an API.  default stage is "production"
3. Create your Alexa Flash Briefing and invoke your API passing the "forcalendar=" querystring parameter and the name of your calendar.
   Leave fordate parameter off the API call; if not present it defaults to today


Possible issues not yet addressed:
1. In Event.JS there is a TODO for calculating an enddate on an event if intead of a rule we are passed a duration.  I've not seen this yet in a calendar
   but it is in the standard so its possible.
2. can we have a recurring rule on a multi-day event that results in a new event that spans today. At the moment we filter to today or later on 
   the rule generated dates so we might miss it


Testing:
There is a Postman importable test collection that:
    1. has a "Fordate" global variable. Set it for the date you want to run the calendars for
    2. has a 'production' call for each calendar for the fordate variable date.
    3. Saves the result of the production call as a global variable for each calendar
    4. Runs the development version of the API call for the same fordate variable date
    5. compares the result of the dev return to the production return. generally they should match
        unless you tweaked the return


Notes:
icstoJson.js is a customization of the node module.  I needed to add some additional fields and make it work with this version of Node



Originally created for the Hampton Roads Bigrade of Code for America  (Code for Hampton Roads)

