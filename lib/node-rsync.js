/*!
 * node-rsync
 *
 * Copyright(c) 2011 Mihai Tomescu <matomesc@gmail.com>
 * Copyright(c) 2011 Tolga Tezel <tolgatezel11@gmail.com>
 *
 * MIT Licensed
 */

var fs = require('fs');
var util = require('util');
var hash = require('./hash');
var EventEmitter = require('events').EventEmitter;

//
// Algorithm functions
//

function createHashtable(checksums) {
  
  var hashtable = {};
  var len = checksums.length;
  var checksum;
  var weak16;

  for (var i = 0; i < len; i++) {
    checksum = checksums[i];

    weak16 = hash.weak16(checksum.weak);
    if (hashtable[weak16]) {
      hashtable[weak16].push(checksum);
    } else {
      hashtable[weak16] = [checksum];
    }
  }

  return hashtable;
}

// rolls through data 1 byte at a time, and determines sync instructions
function roll(data, checksums, blockSize) {
  
  var results = [];
  var hashtable = createHashtable(checksums);
  var length = data.length;
  var start = 0;
  var end = blockSize > length ? length : blockSize;
  // Updated when a block matches
  var lastMatchedEnd = 0;
  // This gets updated every iteration with the previous weak 32bit hash
  var prevRollingWeak = null;

  var weak;
  var weak16;
  var match;
  var d;
  var len;
  var mightMatch;
  var chunk;
  var strong;
  var hashtable_weak16;
  var hashtable_weak16i;

  for (; end <= length; start++, end++) {

    weak = hash.weak32(data, prevRollingWeak, start, end);
    weak16 = hash.weak16(weak.sum);
    match = false;
    d = null;
    prevRollingWeak = weak;
    hashtable_weak16 = hashtable[weak16];

    if (hashtable_weak16) {
      len = hashtable_weak16.length

      for (var i = 0; i < len; i++) {
       hashtable_weak16i = hashtable_weak16[i];
        if (hashtable_weak16i.weak === weak.sum) {
          mightMatch = hashtable_weak16i;
          chunk = data.slice(start, end);
          strong = hash.md5(chunk);

          if (mightMatch.strong === strong) {
            match = mightMatch;
            break;
          }
        }
      }
    }

    if (match) {
      if(start < lastMatchedEnd) {
        d = data.slice(lastMatchedEnd - 1, end);
        results.push({
          data: d,
          index: match.index
        });
      } else if (start - lastMatchedEnd > 0) {
        d = data.slice(lastMatchedEnd, start);
        results.push({
          data: d,
          index: match.index
        });
      } else {
        results.push({
          index: match.index
        });
      }
      
      lastMatchedEnd = end;
    } else if (end === length) {
      // No match and last block
      d = data.slice(lastMatchedEnd);
      results.push({
        data: d
      });
    }
  }

  return results;
}

//
// RSync implementation
//

var RSync = function (f, size) {
    // block size used in checksums
    this.size = size;

    // file cache
    this.cache = {};
};

util.inherits(RSync, EventEmitter);

RSync.prototype = {
    checksum: function (path, callback) {
      var self = this;

      fs.readFile(path, "utf-8", function (err, data) {
        if (!err) {
          // cache file
          self.cache[path] = data;
        } else if (err && err.code === 'ENOENT') {
          cache[path] = [];
        } else {
          return callback(err);
        }

        var length = self.cache[path].length;
        var incr = self.size;
        var start = 0;
        var end = incr > length ? length : incr;
        var blockIndex = 0;
        var result = [];
        var chunk;
        var weak;
        var strong;

        while (start < length) {
          chunk = data.slice(start, end);
          weak = hash.weak32(chunk).sum;
          strong = hash.md5(chunk);
          
          result.push({
            index: blockIndex,
            weak: weak,
            strong: strong
          });

          // update slice indices
          start += incr;
          end = (end + incr) > length ? length : end + incr;

          // update block index
          blockIndex++;

        }
        
        return callback(null, result);
      });
    },
    //
    // Calculates instructions for synching using the given checksums
    //
    // Instructions are an array of sync objects which contain
    // the index of the block before which the the data must to be
    // inserted:
    // [{ index: null, data: 'cf92d' }, { index: 0, data: 'da41f' }]
    //
    diff: function (path, checksumList, callback) {
      if( !checksumList) {
        return callback(new Errors('Checksums must be provided'));
      }

      var self = this;
      var filesize;

      function diffsForFile(checksumNode, callback) {
        
        
        var checksumNodePath = checksumNode.path;

        fs.readFile(checksumNodePath, "utf-8", function(err, data) {
          if (err) {
            return callback(err);
          }
          var res = roll(data, checksumNode.checksums, self.size);
          // diffNode.diffs = roll(data, checksumNode.checksums, self.size);
          // diffList.push(diffNode);
          // callback(null, diffList);
          return callback(null, res);
        });
      }

      fs.lstat(path, function(err, stat) {
        filesize = stat.size;


        // TODO - Check Directory
        if(stat.isDirectory()) {
          console.log("IMPLEMENT THIS");
        }

        // If the path was a file, clearly there was only one checksum
        // entry i.e. the length of checksumList will be 1 which will 
        // be stored in checksumList[0]
        var checksumNode = checksumList[0];

        // File
        if(stat.isFile() || !options.links) {
          return diffsForFile(checksumNode, callback);
        }

        // TODO - Link
        // diffsForLink(checksumNode, callback);
        //
      });
    },
    //
    // Syncs a file based on instructions, then recalculates its
    // checksum
    //
    // This is Called Patch in MakeDrive - getPatchedData
    sync: function (path, diff, callback) {
        
        var self = this;
        var path = path
        var raw = this.cache[path]
        var i = 0
        var len = diff.length;


        if(typeof raw === 'undefined') {
          var err = new Error('must do checksum() first');
          return callback(err, null);
        }

        //get slice of raw file from block's index
        function rawslice(index) {
          var start = index*self.size;
          var end = start + self.size > raw.length ? raw.length : start + self.size;
          return raw.slice(start, end);
        }

        var synced = '';
        
        for(; i < len; i++) {
          var chunk = diff[i];

          if(typeof chunk.data === 'undefined') { //use slice of original file
            synced += rawslice(chunk.index).toString();
          } else {
            synced += chunk.data.toString();

            if(typeof chunk.index !== 'undefined') {
              synced += rawslice(chunk.index).toString();
            }
          }
        }

        delete this.cache[path];
        raw = new Buffer(synced);
        return callback(null, raw);
    },
    //
    //  Files that are being synced
    //
    files: {}
};

exports.createRSync = function (root, size) {
    return new RSync(root, size || 750);
};
