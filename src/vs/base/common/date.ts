/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from './nls.js';
import { LANGUAGE_DEFAULT } from './platform.js';

interface ILocalizeInfo {
	key: string;
	comment?: string[];
}

const minute = 60;
const hour = minute * 60;
const day = hour * 24;
const week = day * 7;
const month = day * 30;
const year = day * 365;

/**
 * Create a localized difference of the time between now and the specified date.
 * @param date The date to generate the difference from.
 * @param appendAgoLabel Whether to append the " ago" to the end.
 * @param useFullTimeWords Whether to use full words (eg. seconds) instead of
 * shortened (eg. secs).
 * @param disallowNow Whether to disallow the string "now" when the difference
 * is less than 30 seconds.
 */
export function fromNow(date: number | Date, appendAgoLabel?: boolean, useFullTimeWords?: boolean, disallowNow?: boolean): string {
	if (typeof date !== 'number') {
		date = date.getTime();
	}

	const seconds = Math.round((new Date().getTime() - date) / 1000);
	if (seconds < -30) {
		return localize({ key: 'date.fromNow.in' }, 'in {0}', fromNow(new Date().getTime() + seconds * 1000, false));
	}
	if (!disallowNow && seconds < 30) {
		return localize({ key: 'date.fromNow.now' }, 'now');
	}

	let value: number;
	if (seconds < minute) {
		value = seconds;

		if (appendAgoLabel) {
			if (value === 1) {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.seconds.singular.ago.fullWord', comment: ['refers to 1 second ago'] }, '{0} second ago', value)
					: localize({ key: 'date.fromNow.seconds.singular.ago', comment: ['refers to 1 sec ago'] }, '{0} sec ago', value);
			} else {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.seconds.plural.ago.fullWord', comment: ['refers to multiple seconds ago'] }, '{0} seconds ago', value)
					: localize({ key: 'date.fromNow.seconds.plural.ago', comment: ['refers to multiple secs ago'] }, '{0} secs ago', value);
			}
		} else {
			if (value === 1) {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.seconds.singular.fullWord', comment: ['refers to 1 second'] }, '{0} second', value)
					: localize({ key: 'date.fromNow.seconds.singular', comment: ['refers to 1 sec'] }, '{0} sec', value);
			} else {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.seconds.plural.fullWord', comment: ['refers to multiple seconds'] }, '{0} seconds', value)
					: localize({ key: 'date.fromNow.seconds.plural', comment: ['refers to multiple secs'] }, '{0} secs', value);
			}
		}
	}

	if (seconds < hour) {
		value = Math.floor(seconds / minute);
		if (appendAgoLabel) {
			if (value === 1) {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.minutes.singular.ago.fullWord', comment: ['refers to 1 minute ago'] }, '{0} minute ago', value)
					: localize({ key: 'date.fromNow.minutes.singular.ago', comment: ['refers to 1 min ago'] }, '{0} min ago', value);
			} else {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.minutes.plural.ago.fullWord', comment: ['refers to multiple minutes ago'] }, '{0} minutes ago', value)
					: localize({ key: 'date.fromNow.minutes.plural.ago', comment: ['refers to multiple mins ago'] }, '{0} mins ago', value);
			}
		} else {
			if (value === 1) {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.minutes.singular.fullWord', comment: ['refers to 1 minute'] }, '{0} minute', value)
					: localize({ key: 'date.fromNow.minutes.singular', comment: ['refers to 1 min'] }, '{0} min', value);
			} else {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.minutes.plural.fullWord', comment: ['refers to multiple minutes'] }, '{0} minutes', value)
					: localize({ key: 'date.fromNow.minutes.plural', comment: ['refers to multiple mins'] }, '{0} mins', value);
			}
		}
	}

	if (seconds < day) {
		value = Math.floor(seconds / hour);
		if (appendAgoLabel) {
			if (value === 1) {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.hours.singular.ago.fullWord', comment: ['refers to 1 hour ago'] }, '{0} hour ago', value)
					: localize({ key: 'date.fromNow.hours.singular.ago', comment: ['refers to 1 hr ago'] }, '{0} hr ago', value);
			} else {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.hours.plural.ago.fullWord', comment: ['refers to multiple hours ago'] }, '{0} hours ago', value)
					: localize({ key: 'date.fromNow.hours.plural.ago', comment: ['refers to multiple hrs ago'] }, '{0} hrs ago', value);
			}
		} else {
			if (value === 1) {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.hours.singular.fullWord', comment: ['refers to 1 hour'] }, '{0} hour', value)
					: localize({ key: 'date.fromNow.hours.singular', comment: ['refers to 1 hr'] }, '{0} hr', value);
			} else {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.hours.plural.fullWord', comment: ['refers to multiple hours'] }, '{0} hours', value)
					: localize({ key: 'date.fromNow.hours.plural', comment: ['refers to multiple hrs'] }, '{0} hrs', value);
			}
		}
	}

	if (seconds < week) {
		value = Math.floor(seconds / day);
		if (appendAgoLabel) {
			return value === 1
				? localize({ key: 'date.fromNow.days.singular.ago', comment: ['refers to 1 day ago'] }, '{0} day ago', value)
				: localize({ key: 'date.fromNow.days.plural.ago', comment: ['refers to multiple days ago'] }, '{0} days ago', value);
		} else {
			return value === 1
				? localize({ key: 'date.fromNow.days.singular', comment: ['refers to 1 day'] }, '{0} day', value)
				: localize({ key: 'date.fromNow.days.plural', comment: ['refers to multiple days'] }, '{0} days', value);
		}
	}

	if (seconds < month) {
		value = Math.floor(seconds / week);
		if (appendAgoLabel) {
			if (value === 1) {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.weeks.singular.ago.fullWord', comment: ['refers to 1 week ago'] }, '{0} week ago', value)
					: localize({ key: 'date.fromNow.weeks.singular.ago', comment: ['refers to 1 wk ago'] }, '{0} wk ago', value);
			} else {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.weeks.plural.ago.fullWord', comment: ['refers to multiple weeks ago'] }, '{0} weeks ago', value)
					: localize({ key: 'date.fromNow.weeks.plural.ago', comment: ['refers to multiple wks ago'] }, '{0} wks ago', value);
			}
		} else {
			if (value === 1) {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.weeks.singular.fullWord', comment: ['refers to 1 week'] }, '{0} week', value)
					: localize({ key: 'date.fromNow.weeks.singular', comment: ['refers to 1 wk'] }, '{0} wk', value);
			} else {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.weeks.plural.fullWord', comment: ['refers to multiple weeks'] }, '{0} weeks', value)
					: localize({ key: 'date.fromNow.weeks.plural', comment: ['refers to multiple wks'] }, '{0} wks', value);
			}
		}
	}

	if (seconds < year) {
		value = Math.floor(seconds / month);
		if (appendAgoLabel) {
			if (value === 1) {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.months.singular.ago.fullWord' }, '{0} month ago', value)
					: localize({ key: 'date.fromNow.months.singular.ago' }, '{0} mo ago', value);
			} else {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.months.plural.ago.fullWord' }, '{0} months ago', value)
					: localize({ key: 'date.fromNow.months.plural.ago' }, '{0} mos ago', value);
			}
		} else {
			if (value === 1) {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.months.singular.fullWord' }, '{0} month', value)
					: localize({ key: 'date.fromNow.months.singular' }, '{0} mo', value);
			} else {
				return useFullTimeWords
					? localize({ key: 'date.fromNow.months.plural.fullWord' }, '{0} months', value)
					: localize({ key: 'date.fromNow.months.plural' }, '{0} mos', value);
			}
		}
	}

	value = Math.floor(seconds / year);
	if (appendAgoLabel) {
		if (value === 1) {
			return useFullTimeWords
				? localize({ key: 'date.fromNow.years.singular.ago.fullWord' }, '{0} year ago', value)
				: localize({ key: 'date.fromNow.years.singular.ago' }, '{0} yr ago', value);
		} else {
			return useFullTimeWords
				? localize({ key: 'date.fromNow.years.plural.ago.fullWord' }, '{0} years ago', value)
				: localize({ key: 'date.fromNow.years.plural.ago' }, '{0} yrs ago', value);
		}
	} else {
		if (value === 1) {
			return useFullTimeWords
				? localize({ key: 'date.fromNow.years.singular.fullWord' }, '{0} year', value)
				: localize({ key: 'date.fromNow.years.singular' }, '{0} yr', value);
		} else {
			return useFullTimeWords
				? localize({ key: 'date.fromNow.years.plural.fullWord' }, '{0} years', value)
				: localize({ key: 'date.fromNow.years.plural' }, '{0} yrs', value);
		}
	}
}

export function fromNowByDay(date: number | Date, appendAgoLabel?: boolean, useFullTimeWords?: boolean): string {
	if (typeof date !== 'number') {
		date = date.getTime();
	}

	const todayMidnightTime = new Date();
	todayMidnightTime.setHours(0, 0, 0, 0);
	const yesterdayMidnightTime = new Date(todayMidnightTime.getTime());
	yesterdayMidnightTime.setDate(yesterdayMidnightTime.getDate() - 1);

	if (date > todayMidnightTime.getTime()) {
		return localize({ key: 'today' }, 'Today');
	}

	if (date > yesterdayMidnightTime.getTime()) {
		return localize({ key: 'yesterday' }, 'Yesterday');
	}

	return fromNow(date, appendAgoLabel, useFullTimeWords);
}

/**
 * Gets a readable duration with intelligent/lossy precision. For example "40ms" or "3.040s")
 * @param ms The duration to get in milliseconds.
 * @param useFullTimeWords Whether to use full words (eg. seconds) instead of
 * shortened (eg. secs).
 */
export function getDurationString(ms: number, useFullTimeWords?: boolean) {
	const seconds = Math.abs(ms / 1000);
	if (seconds < 1) {
		return useFullTimeWords
			? localize({ key: 'duration.ms.full' }, '{0} milliseconds', ms)
			: localize({ key: 'duration.ms' }, '{0}ms', ms);
	}
	if (seconds < minute) {
		return useFullTimeWords
			? localize({ key: 'duration.s.full' }, '{0} seconds', Math.round(ms) / 1000)
			: localize({ key: 'duration.s' }, '{0}s', Math.round(ms) / 1000);
	}
	if (seconds < hour) {
		return useFullTimeWords
			? localize({ key: 'duration.m.full' }, '{0} minutes', Math.round(ms / (1000 * minute)))
			: localize({ key: 'duration.m' }, '{0} mins', Math.round(ms / (1000 * minute)));
	}
	if (seconds < day) {
		return useFullTimeWords
			? localize({ key: 'duration.h.full' }, '{0} hours', Math.round(ms / (1000 * hour)))
			: localize({ key: 'duration.h' }, '{0} hrs', Math.round(ms / (1000 * hour)));
	}
	return localize({ key: 'duration.d' }, '{0} days', Math.round(ms / (1000 * day)));
}

export function toLocalISOString(date: Date): string {
	return date.getFullYear() +
		'-' + String(date.getMonth() + 1).padStart(2, '0') +
		'-' + String(date.getDate()).padStart(2, '0') +
		'T' + String(date.getHours()).padStart(2, '0') +
		':' + String(date.getMinutes()).padStart(2, '0') +
		':' + String(date.getSeconds()).padStart(2, '0') +
		'.' + (date.getMilliseconds() / 1000).toFixed(3).slice(2, 5) +
		'Z';
}

export const safeIntl = {
	DateTimeFormat(locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
		try {
			return new Intl.DateTimeFormat(locales, options);
		} catch {
			return new Intl.DateTimeFormat(undefined, options);
		}
	},
	Collator(locales?: Intl.LocalesArgument, options?: Intl.CollatorOptions): Intl.Collator {
		try {
			return new Intl.Collator(locales, options);
		} catch {
			return new Intl.Collator(undefined, options);
		}
	},
	Locale(tag: Intl.Locale | string, options?: Intl.LocaleOptions): Intl.Locale {
		try {
			return new Intl.Locale(tag, options);
		} catch {
			return new Intl.Locale(LANGUAGE_DEFAULT, options);
		}
	}
};
