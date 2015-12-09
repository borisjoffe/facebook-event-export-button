// ==UserScript==
// @name         Facebook Event Exporter
// @namespace    http://boris.joff3.com
// @version      1.0
// @description  Export Facebook events
// @author       Boris Joffe
// @match        https://www.facebook.com/events/*
// @grant        none
// ==/UserScript==
/* jshint -W097 */
/* eslint-disable no-console */
'use strict';

/*
The MIT License (MIT)

Copyright (c) 2015 Boris Joffe

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/


// Util
var
    qs = document.querySelector.bind(document),
    err = console.error.bind(console),
    log = console.log.bind(console),
    euc = encodeURIComponent;

function addExportLink() {
    log('Event Exporter running');

    // Check for export link
    if (document.body.textContent.search('Export Event') !== -1) {
        log('Event already has Export link...exiting');
        return;
    }

    // Event Summary
    var evElm = qs('#event_summary');
    if (!evElm) err('Event summary element doesn\'t exist');

    // Date & Time
    function convertDateString(dateObj) {
        return dateObj.toISOString()
            .replace(/-/g, '')
            .replace(/:/g, '')
            .replace('.000Z', '');
    }
    var sdElm = evElm.querySelector('[itemprop="startDate"]');
    if (!sdElm) err('Start date element doesn\'t exist');
    var sdd = new Date(sdElm.getAttribute('content')),
        edd = new Date(sdd);
    edd.setHours(edd.getHours() + 1); // Add one hour as a default
    var evStartDate = convertDateString(sdd);
    var evEndDate = convertDateString(edd);

    // Location
    var locElm = evElm.querySelector('[data-hovercard]');
    var addrElm = locElm.nextSibling;

    // Description
    var desc = qs('#event_description').querySelector('span').innerText; // use innerText for proper formatting, innerText will ship in Firefox 45

	var ev = {
		title       : document.title,
		startDate   : evStartDate,
		endDate     : evEndDate,
		location    : locElm.textContent,
		address     : addrElm.textContent,
		description : desc
	};

	ev.locationAndAddress = ev.location + ', ' + ev.address;

	for (var prop in ev) if (ev.hasOwnProperty(prop))
			ev[prop] = euc(ev[prop]);

    // Create link, use UTC timezone to be compatible with toISOString()
    var exportUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=[TITLE]&dates=[STARTDATE]/[ENDDATE]&details=[DETAILS]&location=[LOCATION]&ctz=UTC';

    exportUrl = exportUrl
        .replace('[TITLE]', ev.title)
        .replace('[STARTDATE]', ev.startDate)
        .replace('[ENDDATE]', ev.endDate)
        .replace('[LOCATION]', ev.locationAndAddress)
        .replace('[DETAILS]', ev.description);

    var evBarElm = qs('#event_button_bar');
    var exportElm = evBarElm.firstChild.cloneNode();
    exportElm.href = exportUrl;
    exportElm.textContent = 'Export Event';

    // Disable Facebook event listeners (that are attached due to cloning element)
    exportElm.removeAttribute('ajaxify');
    exportElm.removeAttribute('rel');

    // Open in new tab
    exportElm.setAttribute('target', '_blank');

    evBarElm.appendChild(exportElm);
}

function addExportLinkWhenLoaded() {
    if (!qs('#event_button_bar') || !qs('#event_description') || !qs('[itemprop="startDate"]')) {
        // not loaded
        log('page not loaded...');
        setTimeout(addExportLinkWhenLoaded, 1000);
    } else {
        // loaded
        log('page loaded...adding link');
        addExportLink();
    }
}

window.addEventListener('load', addExportLinkWhenLoaded, true);
