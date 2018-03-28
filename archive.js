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
var request = require('request-promise');


var processFile = function(job,done){
  var data = job.data.vars
  console.log("processing " + data)
  faClient.authenticate('admin','admin')
    .then((authResult) => {
      faClient.getFile(data)
        .then((getFileResult) => {
          var fileMetadata = getFileResult.response.docs[0];
          var xmlFilePath = path.join(config.archivePath,'xml',job.id + '.xml')

          var actualFilePath = path.join(config.archivePath,'files',fileMetadata.fileName);
          faClient.getFileContent(data,authResult.access_token)
            .pipe(fs.createWriteStream(actualFilePath))
          var xmldoc = new dom().parseFromString("<record/>");
          var s = new serializer();
          var baseNode = xmldoc.firstChild;
          _.each(fileMetadata,(value,key) => {
              if(_.includes(['cs_uid','repositoryId','fileName','date','cs_allow','cs_type','created','lastAccessed','lastModified','folder','content_type','fileType'],key)){
                var dataChild = xmldoc.createElement('data');
                dataChild.setAttribute("name",key);
                dataChild.appendChild(xmldoc.createTextNode(value));
                baseNode.appendChild(dataChild);
              }
          });
          var fileChild = xmldoc.createElement('file');
          fileChild.appendChild(xmldoc.createTextNode(actualFilePath));
          baseNode.appendChild(fileChild);
          fs.writeFileSync(xmlFilePath,s.serializeToString(xmldoc));

          done();
        })
    })

}

function getXmlFiles(){
  console.log("Getting xml files");
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
  var xmldoc = new dom().parseFromString("<records/>");
  var baseNode = xmldoc.firstChild;
  getXmlFiles()
    .then(function(result){
      console.log('Reading files')
      files = _.map(result,(file) => {
        return path.join(config.archivePath,'xml',file)
      })
      var promises = _.map(result,(file) => {
        return getFileNode(file);
      });
      return Promise.all(promises);
    })
    .then(function(data){
      console.log('Appending nodes')
      var promises = _.map(data,(node)=>{
        return new Promise((resolve,reject) => {
          baseNode.appendChild(node);
          resolve();
        })
      })
      return Promise.all(promises);
    })
    .then(function(){
      console.log('Writing input.xml')
      var s = new serializer();
      return new Promise((resolve,reject) => {
        fs.writeFile(path.join(config.archivePath,'xml','input.xml'),s.serializeToString(xmldoc),function(err){
          if(err){
            reject(err);
          }
          else{
            resolve()
          }
        });
      });
    })
    .then(function(){
      var promises = _.map(files,(file) => {
        return new Promise(function(resolve,reject){
          console.log('Deleting ' + file)
          fs.unlink(file,(err) => {
            if(err){
              reject(err);
            }
            else{
              resolve()
            }
          });

        })
      })
      return Promise.all(promises);
    })
  .then(function(){
    return request({
              uri: 'http://work.everteam.us:8080/et_dev/Capture?Action=Run&Cmd=Submit&Name=FA_ARCHIVE_JOB&Param=FromURL=true&Param=Name=FA_ARCHIVE_JOB&user_token=3c3848679c88cea7395217e9131fd8d754649d77e0f1489a370c934daee91e1c57a370e759ebbb94c6f173fac33b4faf',
              method:'POST',
            })
  })
  .then(function(response){
    console.log(response);
    console.log('Waiting for archive');
    return new Promise((resolve,reject) =>{
      setTimeout(() => {
        resolve()
      },60000)
    })
  })
  .then(function(){
    console.log('Deleting start')
    return new Promise((resolve,reject)=> {
      fs.access(path.join(config.archivePath,'xml','start'), fs.constants.R_OK | fs.constants.W_OK, (err) => {
        if(err){
          reject(err);
        }
        else{
          fs.unlink(path.join(config.archivePath,'xml','start'),(err2) => {
            if(err2){
              reject(err2);
            }
            else{
              resolve();
            }
          });
        }
      });
    });
  })
  .then(function(){
    console.log('done')
    done();
  })
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
