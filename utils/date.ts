export const formatDateInputValue = (date: Date): string => {
  const safeDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return safeDate.toISOString().split("T")[0];
};

export const parseReceiptDate = (value: string): Date => {
  if (!value) {
    return new Date(NaN);
  }
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const day = Number(dayStr);
  return new Date(year, month, day);
};

export const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

export const formatReceiptDisplayDate = (value: string, locale?: string): string => {
  const date = parseReceiptDate(value);
  if (!isValidDate(date)) {
    return value;
  }
  try {
    return date.toLocaleDateString(locale);
  } catch {
    return value;
  }
};
