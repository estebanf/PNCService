var kue = require('kue')
  , queue = kue.createQueue();

const uuidv4 = require('uuid/v4');

var _ = require('lodash');
var faClient = require('./faclient');
var fs = require('fs');
var path = require('path');
var config = require('./config');
var dom = require('xmldom').DOMParser;
var serializer = require('xmldom').XMLSerializer;
var request = require('request-promise');

var inputFile = path.join(config.archivePath,'xml','input.xml');
var startFile = path.join(config.archivePath,'xml','start');

function writeFileContent(data){
  console.log("writeFileContent " + data.archive_file)
  var filename = data.archive_file.substring(data.archive_file.lastIndexOf('/')+1);
  return new Promise((resolve,reject) => {
    var stream = request({
      uri: data.archive_file,
      headers:{
        'Accept':'application/octet-stream'
      }
    })
      .pipe(fs.createWriteStream(path.join(config.archivePath,'files',filename)))
    stream.on('finish',() => {
      resolve(data);
    });
  });
}
function createRecord(data) {
  console.log("createRecord");
  return new Promise((resolve,reject) => {
    var xmldoc = new dom().parseFromString("<record/>");
    var s = new serializer();
    var baseNode = xmldoc.firstChild;
    _.each(data,(value,key) => {
        if(_.includes(['w2_no','year','employee_no','full_name','emp_status','hire_date','term_date','ssan4','job_title','department'],key)){
          var dataChild = xmldoc.createElement('data');
          dataChild.setAttribute("name",key);
          dataChild.appendChild(xmldoc.createTextNode(value));
          baseNode.appendChild(dataChild);
        }
    });
    var fileChild = xmldoc.createElement('file');
    fileChild.appendChild(xmldoc.createTextNode(path.join(config.archivePath,'files',data.archive_file.substring(data.archive_file.lastIndexOf('/')+1))));
    baseNode.appendChild(fileChild);
    resolve(baseNode);
  })
}
function createInput(){
  console.log('createInput')
  return new Promise((resolve,reject) =>{
    var xmldoc = new dom().parseFromString("<records/>");
    var s = new serializer();
    fs.writeFile(inputFile,s.serializeToString(xmldoc),function(err){
      if(err){
        reject(err);
      }
      else{
        resolve()
      }
    });
  })
}
function appendRecord(node){
  console.log('appendRecord')
  return new Promise((resolve,reject)=> {
    fs.readFile(inputFile,'utf-8',function(err,contents){
      if(err){
        reject(err);
      }
      else{
        var xmldoc = new dom().parseFromString(contents);
        var baseNode = xmldoc.firstChild;
        baseNode.appendChild(node);
        var s = new serializer();
        fs.writeFile(inputFile,s.serializeToString(xmldoc),function(err){
          if(err){
            reject(err);
          }
          else{
            resolve()
          }
        })
      }
    });
  })
}

function submitJob(){
  console.log('submitJob')
  return request({
            uri: 'http://records.everteam.us:8080/et_dev/Capture?Action=Run&Cmd=Submit&Name=W2_ARCHIVE_JOB&Param=FromURL=true&Param=Name=FA_ARCHIVE_JOB&user_token=3c3848679c88cea7395217e9131fd8d754649d77e0f1489a370c934daee91e1c57a370e759ebbb94c6f173fac33b4faf',
            method:'POST',
          })

}
function cleanUp(){
  console.log('cleanUp')
  return new Promise((resolve,reject)=> {
    fs.unlink(inputFile,(err3) => {
        if(err3){
          reject(err3);
        }
        else{
          fs.access(startFile, fs.constants.R_OK | fs.constants.W_OK, (err) => {
            if(err){
              resolve();
            }
            else{
              fs.unlink(startFile,(err2) => {
                if(err2){
                  reject(err2);
                }
                else{
                  resolve
                }
              });
            }
          })
        }
    });
  });

}
var processFile = function(job,done){
  var data = job.data.vars
  console.log("processing " + data)
  writeFileContent(data)
    .then((data) => {
      return createRecord(data);
    })
    .then((node) => {
      return appendRecord(node);
    })
    .then(() => {
      done();
    })
  }

function getXmlFiles(){
  console.log("Getting xml files");
  return new Promise(function(resolve,reject){
    fs.readdir(path.join(config.archivePath,'xml'),(err,files) => {
      var xmlFiles = _.filter(files,function(f) {
        return f.endsWith(".xml") && !f.endsWith("input.xml");
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
  submitJob()
    .then((resp) => {
      return new Promise((resolve,reject) =>{
        setTimeout(() => {
          resolve()
        },60000)
      })
    })
    .then(() => {
      return cleanUp()
    })
    .then(() => {
      done();
    })
}

module.exports = function(data){
  var q = uuidv4();

  console.log("received " + data.length )
  var jobs = []
  _.each(data,(obj) => {
    var job = queue.create(q,{type:'file', vars: obj})
      .removeOnComplete( true )
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
  var finalJob = queue.create(q,{type:'finish', vars:jobs})
    .removeOnComplete( true )
    .save((err) => {
      if(err){
        console.log(job.id)
        console.log(err);
      }
    })
  createInput()
    .then(()=> {
      queue.process(q,(job,done) => {
        if(job.data.type == 'file'){
          processFile(job,done);
        }
        else{
          finishJob(job,done);
        }
      })
    })
}
