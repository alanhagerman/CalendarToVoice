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
tablename='voice_schedule'
sourcefile='schedule_data.json'

session = boto3.Session(profile_name="alexadevh3llc")
dynamodb = session.resource('dynamodb', region_name=rgn)

try:
    table = dynamodb.create_table(
        TableName=tablename,
        KeySchema=[
            {
                'AttributeName': 'dow',
                'KeyType': 'HASH'  #Partition key
            },
        ],
        AttributeDefinitions=[
            {
                'AttributeName': 'dow',
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
    textdows = json.load(json_file, parse_float = decimal.Decimal)

    for onedow in textdows:
        if onedow['dow'] != "comment":
            sched = json.dumps(onedow['schedule'])

            table.put_item(
            Item={
                'dow': onedow['dow'],
                'localecode': onedow['localecode'],
                'schedule': sched
                }
            )