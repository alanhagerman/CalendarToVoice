# ------------------------------------------------------------------------
# Radio Voice Resource Loader  - Resources
#
# Does a put-item for entries not already in the table
#
# ------------------------------------------------------------------------

from __future__ import print_function # Python 2/3 compatibility

import boto3
import json
import decimal

rgn='us-east-1'
tablename='calendar2Voice_data'
sourcefile='calendars_data.json'

session = boto3.Session(profile_name="alexadevh3llc")
dynamodb = session.resource('dynamodb', region_name=rgn)

try:
    table = dynamodb.create_table(
        TableName=tablename,
        KeySchema=[
            {
                'AttributeName': 'calendarname',
                'KeyType': 'HASH'  #Partition key
            },
        ],
        AttributeDefinitions=[
            {
                'AttributeName': 'calendarname',
                'AttributeType': 'S'
            },
        ],
        ProvisionedThroughput={
            'ReadCapacityUnits': 2,
            'WriteCapacityUnits': 2
        }
    )
except:
    pass


table = dynamodb.Table(tablename)

with open(sourcefile) as json_file:
    textcals = json.load(json_file, parse_float = decimal.Decimal)

    for onecal in textcals:
        if onecal['calendarname'] != "comment":
            table.put_item(
            Item={
                'calendarname': onecal['calendarname'],
                'SKILLTITLE': onecal['SKILLTITLE'],
                'ICSURL': onecal['ICSURL'],
                'INTRO': onecal['INTRO'],
                'TIMEZONELIT': onecal['TIMEZONELIT'],
                'WINDOWDAYS': onecal['WINDOWDAYS'],
                'CALTYPE': onecal['CALTYPE'],
                'CALEVENTTYPE': onecal['CALEVENTTYPE']
                }
            )