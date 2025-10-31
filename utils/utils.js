export default function getYesterdayAt3AM() {
  const now = new Date();
  const yesterdayAt3AM = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
    3,
    0,
    0,
    0
  );
  return yesterdayAt3AM.getTime();
}
