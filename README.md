# CalendarToVoice

Copyright (c) 2019, Alan Hagerman
All rights reserved.
Released Under the BSD-3 Clause.
See License.txt


An Alexa Flash briefing skill published via Serverless Framework (serverless.com) that converts events from an icalendar .ICS into a spoken calendar for today.  

To Add a new calendar:
1. Define the calendar in the setupcalendar function
2. Deploy your serverless code which also creates an API
3. Create your Alexa Skill and invoke your API passing the "forcalendar=" querystring parameter and the name of your calendar

Notes:

icstoJson.js is a customization of the node module.  I needed to add some additional fields and make it work with this version of Node



Originally created for the Hampton Roads Bigrade of Code for America  (Code for Hampton Roads)

