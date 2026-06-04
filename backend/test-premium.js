try {
  require('./routes/premium.js');
  console.log('premium.js: OK');
} catch(e) {
  console.log('premium.js: ERROR -', e.message);
  console.log('Stack:', e.stack);
}