var config = require('./config');
var app = require('express')();
var bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

require('./pnc')(app);

app.listen(config.port, () => {
  console.log("Server listening")
});

module.exports = app;
