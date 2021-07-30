/* 
  Copyright 2019 Google LLC

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
 */

const Buffer = require('safe-buffer').Buffer;
const request = require('request');
const isodate = require('isodate');

/**
 * Pushes an Event to a Webhook whenever a disk snapshot is taken successfully.
 *
 * Expects a PubSub message with JSON-formatted event data.
 *
 * @param {object} event Cloud Function PubSub message event.
 * @param {object} callback Cloud Function PubSub callback indicating
 *  completion.
 */

exports.pushEventsToWebhook = (event, callback) => {
  try {
    // Parses the Pub/Sub message content
    const payload = event.data ?
        JSON.parse(Buffer.from(event.data, 'base64').toString()) : '';

    if (payload != '') {
      // Read the cloud function event's detail from the Pub/Sub message
      const type = payload.resource.type;
      const functionName = payload.resource.labels.function_name;

      const methodName = payload.protoPayload.methodName.split('.').pop();
      let operation = methodName;
      if (payload.protoPayload.request) {
        operation += " Request"
      };

      const authenticationEmail = payload.protoPayload.authenticationInfo.principalEmail;

      const regex = /\.[0-9]{3,9}Z/;  //milli to nano range
      let timestamp = payload.timestamp;
      // remove any subseconds
      timestamp = timestamp.replace(regex, 'Z');
      const dateTime = isodate(timestamp);

      const resourceName = payload.protoPayload.resourceName;
      const projectId = payload.resource.labels.project_id;
      const projectURL = `https://console.cloud.google.com/home/dashboard?project=${projectId}`;

      // According to Discord docs (https://discord.com/developers/docs/resources/webhook#execute-webhook), 
      // you must provide at least one of 'content', 'embeds', or 'file':
      //
      // | content: (string)	the message contents (up to 2000 characters)
      //
      // Building the event's content. The latter will be pushed to the webhook
      eventBody = {
        'content': `${type}: ${functionName}\noperation: ${operation}\nauthentication: ${authenticationEmail}\n${dateTime}\n`
      };
      // Reads Config Parameters
      const WEBHOOK_URL = process.env.WEBHOOK_URL;

      if (WEBHOOK_URL) {
        // Posting the message to the webhook
        request.post(WEBHOOK_URL, {
          json: eventBody,
        }, (err, res, body) => {
          if (err) {
            console.log('An error occured sending the event to the webhook.');
            console.error(err);
            return;
          }
          console.log(`statusCode: ${res.statusCode}`);
          callback(null, `statusCode: ${res.statusCode}`);
          // console.log(body)
        });
      } else {
        const message = `WEBHOOK_URL environment variable is not set`;
        console.log(message);
        callback(null, message);
      }
    } else {
      const message = `Event message's content is empty.`;
      console.log(message);
      callback(null, message);
    }
  } catch (err) {
    console.log(err);
    callback(err);
  }
};
