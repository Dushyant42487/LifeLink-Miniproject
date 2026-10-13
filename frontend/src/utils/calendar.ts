/**
 * Helper to generate a Google Calendar event-creation URL using actual camp data.
 */
export function generateGoogleCalendarUrl(camp: any): string {
  if (!camp) {
    throw new Error('Valid camp data is required.');
  }

  let startTime = camp.startUtc;
  let endTime = camp.endUtc;

  if (!startTime || !endTime) {
    const startDateStr = camp.startDate || new Date().toISOString().split('T')[0];
    const endDateStr = camp.endDate || startDateStr;
    const startDateObj = new Date(`${startDateStr}T09:00:00Z`);
    const endDateObj = new Date(`${endDateStr}T17:00:00Z`);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      throw new Error('Valid camp start and end times are required.');
    }

    startTime = startDateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    endTime = endDateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  } else {
    const startDateObj = new Date(startTime);
    const endDateObj = new Date(endTime);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      throw new Error('Valid camp start and end times are required.');
    }

    startTime = startDateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    endTime = endDateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';

  const title = camp.title || 'Blood Donation Camp';
  const organizer = camp.organizer || 'LifeLink Network';
  const venue = camp.location || camp.address || '';
  const city = camp.city || '';
  const state = camp.state || '';

  const details =
    `Blood donation camp organized by ${organizer}. ` +
    `Venue: ${venue}. ` +
    `Please carry a valid photo ID and your Digital Donor Pass. Follow pre-donation hydration guidance.`;

  const locationStr = [venue, city, state].filter(Boolean).join(', ');

  const params = new URLSearchParams({
    text: `Blood Donation: ${title}`,
    dates: `${startTime}/${endTime}`,
    details,
    location: locationStr
  });

  return `${baseUrl}&${params.toString()}`;
}

/**
 * Helper to generate and trigger download of a standard .ics calendar invitation file.
 */
export function downloadIcsCalendarFile(camp: any): void {
  if (!camp) return;

  const title = camp.title || 'Blood Donation Camp';
  const organizer = camp.organizer || 'LifeLink Network';
  const location = [camp.location, camp.address, camp.city, camp.state].filter(Boolean).join(', ');
  const details = `Blood donation camp organized by ${organizer}. Please carry photo ID and your Digital Donor Pass.`;
  
  const startDateStr = camp.startDate || new Date().toISOString().split('T')[0];
  const endDateStr = camp.endDate || startDateStr;

  const startUtc = new Date(`${startDateStr}T09:00:00Z`).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const endUtc = new Date(`${endDateStr}T17:00:00Z`).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LifeLink Voluntary Blood Donation//EN',
    'BEGIN:VEVENT',
    `SUMMARY:Blood Donation: ${title}`,
    `DESCRIPTION:${details}`,
    `LOCATION:${location}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
