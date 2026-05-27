const os = require('os');

const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./
];

const isPrivateIPv4 = (address = '') => PRIVATE_IPV4_RANGES.some(pattern => pattern.test(address));

const getLocalIPv4 = () => {
  const interfaces = os.networkInterfaces();

  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal && isPrivateIPv4(address.address)) {
        return address.address;
      }
    }
  }

  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }

  return '127.0.0.1';
};

module.exports = { getLocalIPv4, isPrivateIPv4 };
