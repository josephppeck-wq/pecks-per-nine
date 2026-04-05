export function isBirthday(): boolean {
  const now = new Date();
  return now.getMonth() === 3 && now.getDate() === 5; // April 5
}
