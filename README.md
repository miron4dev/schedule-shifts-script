# Shifts Scheduler (Google Apps Script)
This script is helpful for anyone who is looking for a simple way to rotate people for a weekly task.

Every Monday at 09:00 am (configurable):
- It checks if anyone is assigned a shift for the **next** business week.
- It looks for a teammate who hasn't been assigned for the longest time, is not in PTO next week, and creates a new event in the team's calendar. 
- Otherwise, it assigns the next free teammate from the queue. 
- It sends an invitation to the assigned teammate.

The script maintains intelligent order. So, the people in PTO will not be moved to the queue's tail but will be assigned next time.

## Prerequisites 

- Create a team's calendar and update `TEAM_CALENDAR_ID`
- Update `INITIAL_TEAM` by the list of emails.
- Update `TEAM_NAMES` by mapping from emails to names.
- Update `SHIFT_EVENT_DESCRIPTION` by the description that will be used for the events.
- Update trigger configuration if necessary.

## How to run

- Create a new project in https://script.google.com/
- Execute `setup` function.
