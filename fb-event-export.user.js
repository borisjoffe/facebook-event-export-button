// ==UserScript==
// @name         Facebook Event Exporter
// @namespace    http://boris.joff3.com
// @version      1.2.2
// @description  Export Facebook events
// @author       Boris Joffe
// @match        https://www.facebook.com/*
// @grant        none
// ==/UserScript==
/* jshint -W097 */
/* eslint-disable no-console, no-unused-vars */
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
	qsa = document.querySelectorAll.bind(document),
	err = console.error.bind(console),
	log = console.log.bind(console),
	euc = encodeURIComponent;

var DEBUG = false;
function dbg() {
  if (DEBUG)
	  console.log.apply(console, arguments);

  return arguments[0];
}

function qsv(elmStr, parent) {
	var elm = parent ? parent.querySelector(elmStr) : qs(elmStr);
	if (!elm) err('(qs) Could not get element -', elmStr);
	return elm;
}

function qsav(elmStr, parent) {
	var elm = parent ? parent.querySelectorAll(elmStr) : qsa(elmStr);
	if (!elm) err('(qsa) Could not get element -', elmStr);
	return elm;
}

function setProp(parent, path, val) {
	if (!parent || typeof parent !== 'object')
		return;
	path = Array.isArray(path) ? Array.from(path) : path.split('.');
	var child, prop;
	while (path.length > 1) {
		prop = path.shift();
		child = parent[prop];
		if (!child || typeof child !== 'object')
			parent[prop] = {};
		parent = parent[prop];
	}
	parent[path.shift()] = val;
}

function getProp(obj, path, defaultValue) {
	path = Array.isArray(path) ? Array.from(path) : path.split('.');
	var prop = obj;

	while (path.length && obj && obj !== null) {
		prop = obj[path.shift()];
	}

	return prop != null ? prop : defaultValue;
}

function addExportLink() {
	log('Event Exporter running');

	// Event Summary
	var evElm = qsv('#event_summary');

	// Date & Time
	// TODO: convert to local time instead of UTC
	function convertDateString(dateObj) {
		return dateObj.toISOString()
	                  .replace(/-/g, '')
	                  .replace(/:/g, '')
	                  .replace('.000Z', '');
	}

	var sdElm = qsv('[itemprop="startDate"]', evElm);
	var sdd = new Date(sdElm.getAttribute('content')),
		edd = new Date(sdd);
	edd.setHours(edd.getHours() + 1); // Add one hour as a default
	var evStartDate = convertDateString(sdd);
	var evEndDate = convertDateString(edd);

	// Location
	var locElm = qsv('[data-hovercard]', evElm) || {};
	var addrElm = getProp(locElm, 'nextSibling', {});

	// Description
	var descElm = qs('#event_description').querySelector('span'),
		desc;

	// use innerText for proper formatting, innerText will ship in Firefox 45
	if (descElm.innerText) {
		// Show full event text so that innerText sees it
		setProp(qs('.text_exposed_show', descElm), 'style.display', 'inline');
		setProp(qs('.text_exposed_link', descElm), 'style.display', 'none');
		desc = descElm.innerText;
	} else {
		// fallback, HTML encoded entities will appear broken
		desc = descElm.innerHTML
		              .replace(/<br>\s*/g, '\n') // fix newlines
		              .replace(/<a href="([^"]*)"[^>]*>/g, '[$1] ') // show link urls
		              .replace(/<[^>]*>/g, '');  // strip html tags
}

	var ev = {
		title       : document.title,
		startDate   : evStartDate,
		endDate     : evEndDate,
		location    : locElm.textContent || '',
		address     : addrElm.textContent || 'No address specified',
		description : location.href + '\n\n' + desc
	};

	ev.locationAndAddress = ev.location ?
	                        ev.location + ', ' + ev.address :
	                        ev.address;

	for (var prop in ev) if (ev.hasOwnProperty(prop))
		ev[prop] = euc(dbg(ev[prop], ' - ' + prop));

	// Create link, use UTC timezone to be compatible with toISOString()
	var exportUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=[TITLE]&dates=[STARTDATE]/[ENDDATE]&details=[DETAILS]&location=[LOCATION]&ctz=UTC';

	exportUrl = exportUrl
	                     .replace('[TITLE]', ev.title)
	                     .replace('[STARTDATE]', ev.startDate)
	                     .replace('[ENDDATE]', ev.endDate)
	                     .replace('[LOCATION]', ev.locationAndAddress)
	                     .replace('[DETAILS]', ev.description);

	dbg(exportUrl, ' - Export URL');

	var
		evBarElm = qsv('#event_button_bar'),
		exportElmLink = qsv('a', evBarElm),
		exportElmParent = exportElmLink.parentNode;

	exportElmLink = exportElmLink.cloneNode();
	exportElmLink.href = exportUrl;
	exportElmLink.textContent = 'Export Event';

	// Disable Facebook event listeners (that are attached due to cloning element)
	exportElmLink.removeAttribute('ajaxify');
	exportElmLink.removeAttribute('rel');

	// Open in new tab
	exportElmLink.setAttribute('target', '_blank');

	exportElmParent.appendChild(exportElmLink);

	var evBarLinks = document.querySelectorAll('#event_button_bar a');
	Array.from(evBarLinks).forEach(function (a) {
		// fix styles
		a.style.display = 'inline-block';
	});
}

(function (oldPushState) {
	// monkey patch pushState so that script works when navigating around Facebook
    window.history.pushState = function () {
        oldPushState.apply(window.history, arguments);
        setTimeout(addExportLinkWhenLoaded, 1000);
    };
})(window.history.pushState);

function addExportLinkWhenLoaded() {
	if (location.href.indexOf('/events/') === -1) {
		return;
	} else if (!qs('#event_button_bar') || !qs('#event_description') || !qs('[itemprop="startDate"]')) {
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
