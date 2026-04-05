export function isBirthday(): boolean {
  // Use Central Time (America/Chicago) for birthday detection
  const now = new Date();
  const ctFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = ctFormatter.formatToParts(now);
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0');
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
  return month === 4 && day === 5; // April 5 in CT
}
