var kue = require('kue')
  , queue = kue.createQueue();
// queue.on('job complete',function(id,result){
//   console.log(id);
// })
var _ = require('lodash');
var faClient = require('./faclient');
var fs = require('fs');
var path = require('path');
var config = require('./config');
var dom = require('xmldom').DOMParser;
var serializer = require('xmldom').XMLSerializer;

var processFile = function(job,done){
  var data = job.data.vars
  faClient.authenticate('admin','admin')
    .then((authResult) => {
      console.log('here')

      faClient.getFile(data)
        .then((getFileResult) => {
          var fileMetadata = getFileResult.response.docs[0];
          var xmlFilePath = path.join(config.archivePath,'xml',job.id + '.xml')

          var actualFilePath = path.join(config.archivePath,'files',fileMetadata.fileName);
          faClient.getFileContent(data,authResult.access_token)
            .pipe(fs.createWriteStream(actualFilePath))
          fileMetadata.file = actualFilePath;
          var xmldoc = new dom().parseFromString("<record/>");
          var s = new serializer();
          var baseNode = xmldoc.firstChild;
          _.each(fileMetadata,(value,key) => {
              if(_.includes(['file','cs_uid','repositoryId','fileName','date','cs_allow','cs_type','created','lastAccessed','lastModified','folder','content_type','fileType'],key)){
                var dataChild = xmldoc.createElement('data');
                dataChild.setAttribute("name",key);
                dataChild.appendChild(xmldoc.createTextNode(value));
                baseNode.appendChild(dataChild);
              }
          });
          fs.writeFileSync(xmlFilePath,s.serializeToString(xmldoc));

          done();
        })
    })

}

function getXmlFiles(){
  return new Promise(function(resolve,reject){
    fs.readdir(path.join(config.archivePath,'xml'),(err,files) => {
      var xmlFiles = _.filter(files,function(f) {
        return f.endsWith(".xml");
      })
      resolve(xmlFiles);
    });
  })
}
function getFileNode(file){
  return new Promise(function(resolve,reject){
    fs.readFile(path.join(config.archivePath,'xml',file),'utf8',(err,contents) =>{
      var fdoc = new dom().parseFromString(contents);
      resolve(fdoc.firstChild);
    });
  });
}
var finishJob = function(job,done){
  var files = [];
  getXmlFiles()
    .then(function(result){
      files = _.map(result,(file) => {
        return path.join(config.archivePath,'xml',file)
      })
      var promises = _.map(result,(file) => {
        return getFileNode(file);
      });
      return Promise.all(promises);
    })
    .then(function(data){
      var xmldoc = new dom().parseFromString("<records/>");
      var baseNode = xmldoc.firstChild;
      _.each(data,(node)=>{
        baseNode.appendChild(node);
      })
      return xmldoc;
    })
    .then(function(doc){
      var s = new serializer();
      return new Promise((resolve,reject) => {
        fs.writeFile(path.join(config.archivePath,'xml','input.xml'),s.serializeToString(doc),function(err){
          if(err){
            reject(err);
          }
          resolve()
        });
      });
    })
    .then(function(){
      _.each(files,(file) => {
        fs.unlinkSync(file);
      })
      done();
    })
  // var s = new serializer();
  // var xmldoc = new dom().parseFromString("<records/>");
  // var baseNode = xmldoc.firstChild;
  // fs.readdir(path.join(config.archivePath,'xml'),(err,files) => {
  //   var xmlFiles = _.filter(files,function(f) {
  //     return f.endsWith(".xml");
  //   })
  //   _.each(xmlFiles,(file) => {
  //     fs.readFile(path.join(config.archivePath,'xml',file),'utf8',(err,contents) =>{
  //       var fdoc = new dom().parseFromString(contents);
  //       baseNode.appendChild(fdoc.firstChild);
  //     })
  //   })
  //   fs.writeFileSync(path.join(config.archivePath,'xml','input.xml'),s.serializeToString(xmldoc));
  //   _.each(xmlFiles,(file) => {
  //     fs.unlinkSync(path.join(config.archivePath,'xml',file));
  //   });
  //   done();
  // })
}

module.exports = function(ids){
  var jobs = []
  _.each(ids,(obj) => {
    var job = queue.create('fa_archive',{type:'file', vars: obj})
      .save((err) => {
        if(err){
          console.log(job.id)
          console.log(err);
        }
        else{
          console.log(job.id);
          jobs.push(job.id)
        }
      })
  });
  var finalJob = queue.create('fa_archive',{type:'finish', vars:jobs}).save((err) => {
    if(err){
      console.log(job.id)
      console.log(err);
    }
  })

  queue.process('fa_archive',(job,done) => {
    if(job.data.type == 'file'){
      processFile(job,done);
    }
    else{
      finishJob(job,done);
    }
  })
}
