var fs = require('fs')
  , vows = require('vows')
  , assert = require('assert')
  , rsync = require('../lib/node-rsync.js');
  
var clientFilePath = './files/hello-client.txt'
  , serverFilePath = './files/hello-server.txt';

//Rsnyc tests
vows.describe('Rsync - updating server file')
  .addBatch({
    'chunk of size chunkSize = 2 in midst': {
      topic: function() {
          var self = this;
          
          rsync.chunkSize = 2;
          
          var clientContents = 'aabbqqcc'
            , serverContents = 'aabbcc'
          
          serverUpdate(
              clientFilePath
            , clientContents
            , serverFilePath
            , serverContents
            , function(err, outgoing) {
              if(err) throw err;
              self.callback(null, outgoing.data.toString())
          });
      }, 
      'diffence is just that block': function(topic) {
        assert.equal('qq', topic);
      },
      'two chunks of size chunkSize = 2 in midst': {
        topic: function() {
            var self = this
              , clientContents = 'aappbbqqcc'
              , serverContents = 'aabbcc'
              , changes = ['pp', 'qq'];
            
            rsync.chunkSize = 2; 
            
            serverUpdate(
                clientFilePath
              , clientContents
              , serverFilePath
              , serverContents
              , function(err, outgoing) {
                if(err) throw err;
                self.callback(null, {outgoing: outgoing.data.toString(), changes: changes})
            });
        }, 
        'diffences = the two chunks': function(topic) {
          assert.include(topic.changes, topic.outgoing);
          delete(topic.changes[topic.changes.indexOf(topic.outgoing)]);
        }
      }
    }
  })
  .addBatch({
    'chunks all over the place': {
      topic: function() {
          var self = this
            , clientContents = '12345678910111213141516'
            , serverContents = '37891012131516'
            , changes = ['12', '456', '11', '4'];

          rsync.chunkSize = 3; 
          
          serverUpdate(
              clientFilePath
            , clientContents
            , serverFilePath
            , serverContents
            , function(err, outgoing) {
              if(err) throw err;
              self.callback(null, {outgoing: outgoing.data.toString(), changes: changes})
          });
      }, 
      'diffences are correct': function(topic) {
        console.log('all ova da place tests');
        assert.include(topic.changes, topic.outgoing);
        delete(topic.changes[topic.changes.indexOf(topic.outgoing)]);
      }
    }  
  })
  .run();


//HELPERS

//
//  Overwrite file contents of @path (string) with @contents (string)
//  Checks if path is an allowed path, so you can't overwrite important files
//
function fileOverwrite (path, contents, callback) {
  //allowed paths
  var allowed = [
      clientFilePath
    , serverFilePath 
  ];
  
  if(allowed.indexOf(path) === -1) { return; }  //nuh-uh!
  
  fs.open(path, 'w+', function (err, fd) {
    if (err) {
      return callback(err);
    }
    
    fs.truncate(fd, 0, function(err) {

      if (err) {
        return callback(err);
      }
      
      fs.writeFile(path, contents, function(e,d){
        callback(e,d)
      });
    });
  });
};

//
//  Helper for basic Rsync testing
//  Overwrite @clientPath with @clientContents
//  Overwrite @serverPath with@serverContents
//  When all this is done:
//  - checksum the server file
//  - search the client file for new blocks
//  - call @callback
//
function serverUpdate (clientPath, clientContents, serverPath, serverContents, callback) {

  fileOverwrite(clientPath, clientContents, function(err, written) {
    if(err) callback(err);
        
    fileOverwrite(serverPath, serverContents, function(err, written) {
      
      if(err) callback(err);
      
      callback(null, "Dsa")
      // rsync had no chunk method!

      // rsync.chunk(serverPath, false, function (err, chunkData) {
      //   if(err) callback(err);

      //   var checksums = rsync.checksum(chunkData);
        
      //   rsync.search(clientPath, checksums, callback);
      // });
    });
  });  
};