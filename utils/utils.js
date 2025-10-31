export function getStartTime() {
  const now = new Date();
  const currentHour = now.getHours();

  let targetDate;
  if (currentHour >= 0 && currentHour < 3) {
    targetDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
      3,
      0,
      0,
      0
    );
  } else {
    targetDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      3,
      0,
      0,
      0
    );
  }
  return targetDate.getTime();
}
