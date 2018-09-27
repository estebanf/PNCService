var config = require('./config');
var request = require('request-promise-native');
var _  = require('lodash');
var archive = require('./archive');
module.exports = {
  getFileContent: function(cs_uid,token){
    return request({
      uri: config.fa + '/storage/api/files/'+ cs_uid + '/content',
      headers:{
        'Authorization':'Bearer ' + token,
        'Accept':'application/octet-stream'
      }
    });
  },
  getFile:function(cs_uid){
    return request({
      uri: config.solr + '/select?q=cs_uid:' + cs_uid,
      json:true
    })
  },
  authenticate: function(user,pass){
    var options = {
      uri: config.fa + '/uaa/oauth/token',
      method:'POST',
      headers:{
        'Authorization':'Basic d2ViX2FwcDo=',
        'Accept':'application/json'
      },
      json:true,
      form:{
        grant_type:'password',
        username:user,
        password:pass
      }
    }
    return request(options);
  },
  getTaggedFiles: function(tag,cb){
    request.get({
      uri: config.solr + '/select?rows=1000&fl=cs_uid,repositoryId,fileName,folderPath,content_type,fileSize&q=tags:' + tag,
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
  },
  getDuplicates: function(cb){
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
}
