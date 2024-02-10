/*
* cgm-remote-monitor - web app to broadcast cgm readings
* Copyright (C) 2014 Nightscout contributors.  See the COPYRIGHT file
* at the root directory of this distribution and at
* https://github.com/nightscout/cgm-remote-monitor/blob/master/COPYRIGHT
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as published
* by the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

// Description: Basic web server to display data from Dexcom G4.  Requires a database that contains
// the Dexcom SGV data.
'use strict';
const env = require('./env')( );
const http = require('http');

const interval = 5000; // Set the interval in milliseconds (e.g., 5000 ms = 5 seconds)
const endpoint = env.DM2NSC_SERVER+'/getdata';

function fetchData() {
  http.get(endpoint, (res) => {
    let data = '';

    // A chunk of data has been received.
    res.on('data', (chunk) => {
      data += chunk;
    });

    // The whole response has been received.
    res.on('end', () => {
      console.log(`CRON: Response from ${endpoint}: ${data}`);
    });
  }).on('error', (err) => {
    console.error(`CRON: Error calling ${endpoint}: ${err.message}`);
  });
}

// Set interval to call fetchData
setInterval(fetchData, interval);

require('./lib/server/server');

