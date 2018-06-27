var config = require('./config');
var request = require('request-promise');
var _  = require('lodash');
var archive = require('./archive');
var w2 = require('./w2.js');
var faClient = require('./faclient');
// require('request-debug')(request);


var tags = ['ROT','EOL','eTrash']

module.exports = function(app){
  _.each(tags,function(tag){
    app.get('/' + tag,(req,res) => {
      res.setHeader("Content-type","application/json");
      faClient.getTaggedFiles(tag,function(data){
        res.status(200).send(data);
      })

    })

  })
  app.get('/duplicates',(req,res) => {
    res.setHeader("Content-type","application/json");
    faClient.getDuplicates(function(data){
      res.status(200).send(data);
    })
  })
  app.post('/delete',(req,res) => {
    var data = req.body.cs_uid;
    faClient.authenticate('admin','admin')
      .then(function(body){
        console.log(body);
	//var token = JSON.parse(body).access_token
        var token =body.access_token
	request({
          uri: encodeURI('http://discover.everteam.us:8080/storage/api/files/delete?ids=' + JSON.stringify(data)),
          method:'POST',
          headers:{
            'Authorization':'Bearer ' + token,
            'Accept':'application/json',
            'Content-Type':'application/json'
          },
          json:true
        })
          .then(function(result){
            // console.log(result);
            res.status(200).send({status:"ok"});
          })
      })

  })
  app.post('/archive',(req,res) => {
    var data = req.body;
    var keys = _.keys(data);
    var ids = [];
    _.each(keys, function(key){
      if(data[key]) {
        ids.push(key);
      }
    })
    archive(ids);
    res.status(200).send({status:"ok"});
  })
  app.post('/w2',(req,res) => {
    // console.log(JSON.stringify(req.body));
    var data = req.body;
    w2(data);
    res.status(200).send({status:"ok"});
  });

}
