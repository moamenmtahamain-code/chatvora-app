const routeFiles = [
  './routes/auth', './routes/user', './routes/conversation',
  './routes/message', './routes/upload', './routes/call',
  './routes/story', './routes/notification', './routes/admin',
  './routes/group', './routes/ai', './routes/premium'
];

for (const file of routeFiles) {
  try {
    require(file);
    console.log(file + ': OK');
  } catch(e) {
    console.log(file + ': ERROR - ' + e.message);
  }
}