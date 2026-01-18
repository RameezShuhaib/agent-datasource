/**
 * Simple CSV Parser (Handles quoted strings)
 */
export const parseCSV = (text: string): { headers: string[], rows: any[] } => {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string) => {
    const result = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        result.push(cur);
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur);
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = parseLine(line);
    const obj: any = {};
    headers.forEach((h, i) => {
      obj[h] = values[i]?.trim();
    });
    return obj;
  });

  return { headers, rows };
};
