/* jshint node: true */
'use strict';
var CoreObject = require('core-object');
var Promise    = require('ember-cli/lib/ext/promise');
var ssh2       = require('ssh2');
var fs         = require('fs');
var path       = require('path');

module.exports = CoreObject.extend({
  init: function(options) {
    this._super(options);
    this._plugin = options.plugin;
    this._client = this._plugin.readConfig('sshClient') || new ssh2.Client();
  },

  upload: function(options) {
    options = options || {};
    return this._uploadFiles(options);
  },

  _uploadFiles: function(options) {
    var filePaths = options.filePaths || [];
    var conn = this._client;
    var plugin = this._plugin;
    var connectionOptions = this._getConnectionOptions(options);

    return new Promise(function(resolve, reject) {
      conn.on('ready', function () {
        conn.sftp(function(err, sftp) {
          if (err) {
            throw err;
          }
          var remoteDir = options.remoteDir || '';
          var promises = filePaths.map(function(fileName) {
            return new Promise(function(fileResolve, fileReject) {
              var filePath = path.join(options.cwd, fileName);
              var buffer = fs.readFileSync(filePath);
              var targetFile = remoteDir + fileName;
              var writeStream = sftp.createWriteStream(targetFile);
              writeStream.on('error', function(err) {
                fileReject(err);
              });
              writeStream.on('finish', function() {
                plugin.log('✔  ' + targetFile, { verbose: true });
                fileResolve(targetFile);
              });
              writeStream.write(buffer);
              writeStream.end();
            });
          });
          Promise.all(promises).then(resolve).catch(reject);
        });
      }).on('error', function (error) {
        reject(error);
      }).connect(connectionOptions);
    }.bind(this));
  },

  _getConnectionOptions: function(opts) {
    var options = {
      host: opts.host,
      username: opts.username,
      port: opts.port,
      agent: opts.agent,
    };

    if (opts.privateKey) {
      options.privateKey = opts.privateKey;
    }

    if (typeof opts.password !== 'undefined') {
      options.password = opts.password;
    }

    return options;
  }
});
