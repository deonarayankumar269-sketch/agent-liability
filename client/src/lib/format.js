export const usd = (v, cur = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(Number(v || 0));

export const when = (d) =>
  new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const short = (h, n = 10) => (h ? `${h.slice(0, n)}...${h.slice(-4)}` : '');
