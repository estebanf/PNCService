var config = require('./config');
var app = require('express')();

require('./pnc')(app);

app.listen(config.port, () => {
  console.log("Server listening")
});

module.exports = app;
