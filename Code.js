const TEAM_CALENDAR_ID = 'REPLACE_ME@group.calendar.google.com';

const PTO_KEYWORD = 'OOO';
const SHIFT_KEYWORD = 'On-Duty';

const INITIAL_TEAM = ['miron4dev@gmail.com'];
const TEAM_NAMES = new Map([
	['miron4dev@gmail.com', 'Evgeny Mironenko'],
])

const SHIFT_EVENT_DESCRIPTION = "FILL ME";

/**
 * Sets up the script to run automatically every monday at 09:00 and process the first 4 weeks immediately.
 */
function setup() {
	const triggers = ScriptApp.getProjectTriggers();
	if (triggers.length > 0) {
		throw new Error('Triggers are already setup.');
	}

	ScriptApp.newTrigger('sync')
		.timeBased()
		.onWeekDay(ScriptApp.WeekDay.MONDAY)
		.atHour(9)
		.create();

	sync(4);
}

/**
 *
 * Check the team's calendar to see if anyone is assigned for the business week starting from the last time the script was executed until {@link weeks}.
 * Skip the week if someone is already assigned.
 *
 * Otherwise, take a teammate who hasn't been assigned for the longest time and check if they are not in PTO.
 * Skip the teammate if they are in PTO, but keep them in the queue {@see retrieveTeam}.
 *
 * Otherwise, assign the teammate and move it to the queue's tail.
 * @param weeks number of weeks to process starting from the last time the script was executed.
 */
function sync(weeks = 1) {
	const lastRun = PropertiesService.getScriptProperties().getProperty('lastRun');

	for (let week = 0; week < weeks; week++) {
		const startDate = lastRun ? new Date(lastRun) : new Date();
		startDate.setDate(startDate.getDate() + week * 7);

		const endDate = new Date(startDate);
		endDate.setDate(endDate.getDate() + 5);

		console.log(`Processing the week between ${startDate} and ${endDate}`);

		const events = findEvents(TEAM_CALENDAR_ID, SHIFT_KEYWORD, startDate, endDate);
		if (events.length > 0) {
			const email = events[0].attendees && events[0].attendees[0].email;

			console.log(`${email} is assigned this week. Skipping`);
		} else {
			const team = retrieveTeam();

			for (let i = 0; i < team.length; i++) {
				if (isUserAvailable(team[i], startDate, endDate)) {
					createEvent(team[i], startDate, endDate);

					// move it from i to the end
					team.push(team.splice(i, 1)[0]);
					break;
				}
			}

			setTeam(team);
		}
	}

	PropertiesService.getScriptProperties().setProperty('lastRun', new Date());
}

function isUserAvailable(user, from, to) {
	console.log(`Checking if ${user} is available between ${from} and ${to}`);

	const events = findEvents(user, PTO_KEYWORD, from, to);
	if (events.length > 0) {
		const event = events[0]
		console.log(`${user} is not available because is OOO from ${event.start.date} to ${event.end.date}`);
		return false;
	}

	console.log(`${user} is available`);
	return true;
}

function findEvents(email, keyword, start, end) {
	const params = {
		q: keyword,
		timeMin: formatDateAsRFC3339(start),
		timeMax: formatDateAsRFC3339(end),
	};
	let pageToken = null;
	let events = [];
	do {
		params.pageToken = pageToken;
		let response;
		try {
			response = Calendar.Events.list(email, params);
		} catch (e) {
			console.error('Error retriving events for %s, %s: %s; skipping',
				email, keyword, e.toString());
			continue;
		}
		events = events.concat(response.items.filter(function (item) {
			return item.summary.indexOf(keyword) >= 0;
		}));
		pageToken = response.nextPageToken;
	} while (pageToken);
	return events;
}

/**
 * Format the date to RFC3339 format. Required by Google API.
 */
function formatDateAsRFC3339(date) {
	return Utilities.formatDate(date, 'UTC', 'yyyy-MM-dd\'T\'HH:mm:ssZ');
}

function createEvent(email, from, to) {
	const name = TEAM_NAMES.get(email) || email;
	const event = CalendarApp.getCalendarById(TEAM_CALENDAR_ID).createAllDayEvent(`[${name}] ${SHIFT_KEYWORD}`,
		from,
		to, {
			description: SHIFT_EVENT_DESCRIPTION,
			guests: email,
			sendInvites: true
		});

	console.log(`Created new ${event.getId()} event for ${email}`);

	// Update the event from Busy to Free. Otherwise, users will have an "In a meeting" status in Slack.
	const eventId = event.getId().replace("@google.com", "");
	Calendar.Events.patch({
		transparency: "transparent"
	}, TEAM_CALENDAR_ID, eventId);
}

function retrieveTeam() {
	const team = PropertiesService.getScriptProperties().getProperty('team')
	if (team) {
		return JSON.parse(team)
	}
	setTeam(INITIAL_TEAM);
	return INITIAL_TEAM;
}

function setTeam(team) {
	PropertiesService.getScriptProperties().setProperty('team', JSON.stringify(team));
}

function addTeamMember(email) {
	console.log(`Adding ${email} to the team`);

	const team = retrieveTeam();

	if (team.indexOf(email) >= 0) {
		console.log('Team member is already in the list. Skipping...');
		return;
	}

	team.push(email);
	setTeam(team);
}

function removeTeamMember(email) {
	console.log(`Removing ${email} from the team`);

	const team = retrieveTeam();
	const emailIndex = team.indexOf(email);

	team.splice(emailIndex, 1);
	setTeam(team)
}
