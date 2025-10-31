const VIDEO_LIMIT = 9; // Set to 9 to be safe, as the official limit is 10.
const STORAGE_KEY = 'videoRequestCount';

interface RateLimitData {
  count: number;
  date: string; // 'YYYY-MM-DD'
}

const getToday = (): string => {
  return new Date().toISOString().split('T')[0];
};

const getRateLimitData = (): RateLimitData => {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (!storedData) {
      return { count: 0, date: getToday() };
    }
    const data: RateLimitData = JSON.parse(storedData);
    // Reset if it's a new day
    if (data.date !== getToday()) {
      return { count: 0, date: getToday() };
    }
    return data;
  } catch (e) {
    // If parsing fails, start fresh
    console.error("Could not parse rate limit data from localStorage", e);
    return { count: 0, date: getToday() };
  }
};

export const canMakeVideoRequest = (): boolean => {
  const data = getRateLimitData();
  return data.count < VIDEO_LIMIT;
};

export const getRemainingVideoRequests = (): number => {
    const data = getRateLimitData();
    const remaining = VIDEO_LIMIT - data.count;
    return remaining > 0 ? remaining : 0;
}

export const incrementVideoRequestCount = (): void => {
  let data = getRateLimitData();
  data.count += 1;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch(e) {
    console.error("Could not save rate limit data to localStorage", e);
  }
};
