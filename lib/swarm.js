var swarmhash = require('swarmhash');
var utils = require('ethereumjs-util');
var url = require('url');

var Manifest = function() {
  this.entries = {};
}

Manifest.prototype.addEntry = function (entry) {
  this.entries[entry.path] = entry;
}

Manifest.prototype.getEntry = function (path) {
  return this.entries[path];
}

var Swarm = function() {
  this.objects = {};
}

Swarm.prototype.store = function (content, callback) {
  var key = utils.setLengthLeft(swarmhash(utils.toBuffer(content)), 32).toString('hex');
  this.objects[key] = content;
  callback(null, key);
}

Swarm.prototype.retrieve = function (key, callback) {
  if (!this.objects[key]) {
    return callback('Not found');
  }
  callback(null, this.objects[key]);
}

/*
 * Type: application/bzz-manifest+json
 * Manifest:
 * - hash
 * - contentType
 * - entries
 * - status
 * - path
 */

Swarm.prototype.put = function (content, contentType, callback) {
  var self = this;
  self.store(content, function (err, key) {
    if (err) {
      return callback(err);
    }

    self.store('{"entries":[{"hash":"' + key + '","contentType":"' + contentType + '"}]}', callback);
  });
}

Swarm.prototype.loadManifest = function (key) {
  if (!this.objects[key]) {
    return;
  }

  var trie = new Manifest();

  var manifest = JSON.parse(this.objects[key]);
  for (var i = 0; i < manifest.entries.length; i++) {
    var entry = manifest.entries[i];
    if (!entry.path)
      entry.path = null;
    trie.addEntry(entry);
  }

  return trie;
}

Swarm.prototype.get = function (uri, callback) {
  // uri is a bzz:// or bzzr:// URI, where the 'host' can be a contenthash
  uri = url.parse(uri);

  var hash = uri.hostname || uri.pathname;

  if (!hash) {
    return callback('Invalid URL');
  }

  // NOTE: ENS is not supported
  if (!hash.match(/^[0-9a-fA-F]{64}$/)) {
    return callback('Not a content hash URL');
  }

  // load manifest
  var trie = this.loadManifest(hash);

  var entry = trie.getEntry(uri.path);
  if (!entry) {
    return callback('Entry not found');
  }

  var object = this.objects[entry.hash];
  if (!object) {
    return callback('Path not found');
  }

  callback(null, {
    Content: object,
    ContentType: entry.contentType,
    Status: entry.status,
    Size: object.length.toString()
  });
}

Swarm.prototype.modify = function (uri, contentHash, contentType, callback) {
  callback('Not implemented');
}

module.exports = Swarm;