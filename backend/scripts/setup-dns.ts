import dns from 'dns';

// Fix c-ares DNS on Windows — system DNS isn't auto-detected in the c-ares library.
const DNS_SERVERS = (process.env.DNS_SERVERS || '192.168.1.1,8.8.8.8,1.1.1.1')
  .split(',').map(s => s.trim()).filter(Boolean);
dns.setServers(DNS_SERVERS);
