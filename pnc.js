var config = require('./config');
var request = require('request-promise');
var _  = require('lodash');
// require('request-debug')(request);


var tags = ['ROT','EOL','eTrash']

function authenticate(user,pass){
  var options = {
    uri: 'http://fa.everteam.us:8080/uaa/oauth/token',
    method:'POST',
    headers:{
      'Authorization':'Basic d2ViX2FwcDo=',
      'Accept':'application/json'
    },
    form:{
      grant_type:'password',
      username:user,
      password:pass
    }
  }
  return request(options);
}

function getTaggedFiles(tag, cb){
  request.get({
    uri: config.solr + '/select?rows=1000&fl=cs_uid,repositoryId,fileName,folderPath,content_type,fileSize&q=user_action:' + tag,
    json:true
  })
  .then(function(data){
    var docs = data.response.docs;
    _.each(docs, function(doc){
      doc.filePath = '/' + _.replace(_.join(doc.folderPath,'/'),/\d\d-/,"") + '/' + doc.fileName;
      delete doc.folderPath;
      delete doc.fileName;
    })
    if(cb){
      cb(docs);
    }
  })
  .catch(function(err){
    console.log(err);
  })
}

function getDuplicates(cb){
  request.get({
    uri: config.solr + '/select?facet.field=checksum&facet=on&q=*&rows=0&facet.mincount=2',
    json:true
  })
  .then(function(data) {
    var checksums = []
    _.each(data.facet_counts.facet_fields.checksum,function(obj,index){
      if(!(index % 2)){
        checksums.push(obj);
      }
    })
    request.get({
      uri: config.solr + '/select?q=checksum:(' + _.join(checksums, ' OR ') + ')',
      json:true
    })
      .then(function(results){
        var rDocs = []
        var docs = results.response.docs;
        var checks = _.union(_.map(docs,(obj) => { return obj.checksum}));
        var groupedDocs = _.groupBy(docs,(obj) => { return obj.checksum });
        _.each(checks,(obj) => {
          var currentGroup = groupedDocs[obj];
          var currentDoc = {}
          _.each(currentGroup, (item,index) =>{
            if(index == 0){
              currentDoc = item;
              currentDoc.duplicates = [];
            }
            else{
              currentDoc.duplicates.push(item)
            }
          })
          rDocs.push(currentDoc);
        })
        if(cb){
          cb(rDocs);
        }
      })
  });
}

module.exports = function(app){
  _.each(tags,function(tag){
    app.get('/' + tag,(req,res) => {
      res.setHeader("Content-type","application/json");
      getTaggedFiles(tag,function(data){
        res.status(200).send(data);
      })

    })

  })
  app.get('/duplicates',(req,res) => {
    res.setHeader("Content-type","application/json");
    getDuplicates(function(data){
      res.status(200).send(data);
    })
  })
  app.post('/delete',(req,res) => {
    var data = req.body.cs_uid;
    authenticate('admin','admin')
      .then(function(body){
        var token = JSON.parse(body).access_token
        request({
          uri: encodeURI('http://fa.everteam.us:8080/storage/api/files/delete?ids=' + JSON.stringify(data)),
          method:'POST',
          headers:{
            'Authorization':'Bearer ' + token,
            'Accept':'application/json',
            'Contenty-Type':'application/json'
          },
          json:true
        })
          .then(function(result){
            // console.log(result);
            res.status(200).send({status:"ok"});
          })
      })

  })
}
